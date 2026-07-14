"""
Embed every verse of a translation into data/corpus.sqlite via Ollama.

Default model: nomic-embed-text (768-dim). Store as raw little-endian f32
BLOBs in the `verse_embeddings` table — no sqlite-vec dependency needed.

Usage:
    python scripts/embed_corpus.py                 # KJV, nomic-embed-text
    python scripts/embed_corpus.py --translation ASV
    python scripts/embed_corpus.py --model bge-large-en-v1.5

Idempotent — re-running replaces existing embeddings for the (translation, model)
pair. Safe to interrupt; progress survives.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import platform
import struct
import sys
import time
import urllib.error
import urllib.request

from _lib import open_corpus, ensure_schema

OLLAMA_BATCH_URL = "http://localhost:11434/api/embed"
OLLAMA_TAGS_URL = "http://localhost:11434/api/tags"
OLLAMA_VERSION_URL = "http://localhost:11434/api/version"
GENERATOR_VERSION = "embed_corpus.py@2"


def ollama_get(url: str) -> dict:
    with urllib.request.urlopen(url, timeout=30) as resp:
        value = json.loads(resp.read().decode("utf-8"))
    if not isinstance(value, dict):
        raise RuntimeError(f"Ollama returned a non-object response from {url}")
    return value


def normalise_model_name(value: str) -> str:
    return value.removesuffix(":latest")


def ollama_identity(model: str) -> tuple[str, str]:
    tags = ollama_get(OLLAMA_TAGS_URL).get("models")
    if not isinstance(tags, list):
        raise RuntimeError("Ollama /api/tags response did not include models")
    wanted = normalise_model_name(model)
    match = next(
        (
            row
            for row in tags
            if isinstance(row, dict)
            and normalise_model_name(str(row.get("name") or row.get("model") or "")) == wanted
        ),
        None,
    )
    digest = str((match or {}).get("digest") or "")
    if len(digest) != 64:
        raise RuntimeError(f"Could not resolve the installed Ollama digest for model {model!r}")
    version = str(ollama_get(OLLAMA_VERSION_URL).get("version") or "")
    if not version:
        raise RuntimeError("Ollama /api/version response did not include a version")
    return digest, version


def platform_identity() -> str:
    return json.dumps(
        {
            "byteorder": sys.byteorder,
            "machine": platform.machine(),
            "platform": platform.platform(),
            "python": platform.python_version(),
        },
        sort_keys=True,
        separators=(",", ":"),
    )


def embedding_checksum(conn, translation: str, model: str) -> tuple[int, str]:
    digest = hashlib.sha256()
    count = 0
    for verse, dim, blob in conn.execute(
        """
        SELECT verse_id, dim, embedding
        FROM verse_embeddings
        WHERE translation_code = ? AND model = ?
        ORDER BY verse_id
        """,
        (translation, model),
    ):
        if len(blob) != dim * 4:
            raise RuntimeError(
                f"Embedding blob length mismatch for {translation} verse_id={verse}: "
                f"bytes={len(blob)}, dim={dim}"
            )
        digest.update(struct.pack("<QI", int(verse), int(dim)))
        digest.update(blob)
        count += 1
    return count, digest.hexdigest()


def save_build_state(
    conn,
    *,
    translation: str,
    model: str,
    model_digest: str,
    ollama_version: str,
    platform_json: str,
    embedding_count: int,
    aggregate_sha256: str,
) -> None:
    conn.execute(
        """
        INSERT INTO embedding_builds (
          translation_code, model, model_digest, ollama_version,
          generator_version, platform_json, embedding_count, aggregate_sha256,
          generated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
        ON CONFLICT(translation_code, model) DO UPDATE SET
          model_digest = excluded.model_digest,
          ollama_version = excluded.ollama_version,
          generator_version = excluded.generator_version,
          platform_json = excluded.platform_json,
          embedding_count = excluded.embedding_count,
          aggregate_sha256 = excluded.aggregate_sha256,
          generated_at = excluded.generated_at
        """,
        (
            translation,
            model,
            model_digest,
            ollama_version,
            GENERATOR_VERSION,
            platform_json,
            embedding_count,
            aggregate_sha256,
        ),
    )


def embed_batch(model: str, texts: list[str]) -> list[list[float]]:
    """Use Ollama's newer /api/embed endpoint which accepts a list of inputs
    and returns them in one forward pass. ~20-40x faster than calling
    /api/embeddings per verse."""
    req = urllib.request.Request(
        OLLAMA_BATCH_URL,
        data=json.dumps({"model": model, "input": texts}).encode("utf-8"),
        headers={"Content-Type": "application/json"},
    )
    with urllib.request.urlopen(req, timeout=300) as resp:
        data = json.loads(resp.read().decode("utf-8"))
    embs = data.get("embeddings")
    if not isinstance(embs, list) or len(embs) != len(texts):
        raise RuntimeError(
            f"Ollama batch returned {len(embs) if isinstance(embs, list) else 'n/a'} embeddings for {len(texts)} inputs"
        )
    return embs


def embed_batch_resilient(model: str, texts: list[str]) -> list[list[float]]:
    """Split an oversized Ollama batch without losing progress or ordering."""
    try:
        return embed_batch(model, texts)
    except urllib.error.HTTPError as error:
        if error.code != 400 or len(texts) <= 1:
            raise
        midpoint = len(texts) // 2
        return embed_batch_resilient(model, texts[:midpoint]) + embed_batch_resilient(
            model, texts[midpoint:]
        )


def pack_f32(floats: list[float]) -> bytes:
    return struct.pack(f"<{len(floats)}f", *floats)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--translation", default="KJV")
    ap.add_argument("--model", default="nomic-embed-text")
    ap.add_argument("--batch-size", type=int, default=100, help="verses per Ollama batch call")
    state = ap.add_mutually_exclusive_group()
    state.add_argument(
        "--rebuild",
        action="store_true",
        help="delete and regenerate this translation/model embedding set",
    )
    state.add_argument(
        "--adopt-existing",
        action="store_true",
        help="attach current model identity to a legacy complete/partial set (one-time migration)",
    )
    args = ap.parse_args()

    conn = open_corpus()
    try:
        ensure_schema(conn)

        if args.rebuild:
            conn.execute(
                "DELETE FROM verse_embeddings WHERE translation_code = ? AND model = ?",
                (args.translation, args.model),
            )
            conn.execute(
                "DELETE FROM embedding_builds WHERE translation_code = ? AND model = ?",
                (args.translation, args.model),
            )
            conn.commit()

        cur = conn.execute(
            "SELECT COUNT(*) FROM translation_text WHERE translation_code = ?",
            (args.translation,),
        )
        total = cur.fetchone()[0]
        if total == 0:
            sys.exit(f"No verses for translation {args.translation!r}")

        cur = conn.execute(
            """
            SELECT t.verse_id, t.text
            FROM translation_text t
            LEFT JOIN verse_embeddings e
              ON e.translation_code = t.translation_code
             AND e.verse_id = t.verse_id
             AND e.model = ?
            WHERE t.translation_code = ? AND e.verse_id IS NULL
            ORDER BY t.verse_id
            """,
            (args.model, args.translation),
        )
        rows = cur.fetchall()
        remaining = len(rows)
        done = total - remaining
        try:
            model_digest, ollama_version = ollama_identity(args.model)
        except urllib.error.URLError as error:
            sys.exit(f"Could not inspect Ollama model identity: {error}")
        current_platform = platform_identity()
        build = conn.execute(
            """
            SELECT model_digest, ollama_version, generator_version, platform_json,
                   embedding_count, aggregate_sha256
            FROM embedding_builds
            WHERE translation_code = ? AND model = ?
            """,
            (args.translation, args.model),
        ).fetchone()
        if build and not args.adopt_existing:
            identity = build[:4]
            expected_identity = (
                model_digest,
                ollama_version,
                GENERATOR_VERSION,
                current_platform,
            )
            if identity != expected_identity:
                sys.exit(
                    "Embedding resume identity changed; use --rebuild to regenerate or "
                    "--adopt-existing only after independently validating the legacy set."
                )
        elif not build and done and not args.adopt_existing:
            sys.exit(
                f"Found {done} legacy embeddings without build identity. Re-run once with "
                "--adopt-existing, or use --rebuild for strict provenance."
            )

        save_build_state(
            conn,
            translation=args.translation,
            model=args.model,
            model_digest=model_digest,
            ollama_version=ollama_version,
            platform_json=current_platform,
            embedding_count=done,
            aggregate_sha256="",
        )
        conn.commit()
        print(
            f"Embedding {remaining} / {total} verses ({args.translation}, model={args.model})"
        )
        if remaining == 0:
            count, aggregate = embedding_checksum(conn, args.translation, args.model)
            save_build_state(
                conn,
                translation=args.translation,
                model=args.model,
                model_digest=model_digest,
                ollama_version=ollama_version,
                platform_json=current_platform,
                embedding_count=count,
                aggregate_sha256=aggregate,
            )
            conn.commit()
            print(f"Embedding identity recorded: digest={model_digest}, sha256={aggregate}")
            return

        started = time.time()
        dim = None
        processed = 0
        failed = False

        for batch_start in range(0, remaining, args.batch_size):
            batch = rows[batch_start : batch_start + args.batch_size]
            texts = [r[1] for r in batch]

            try:
                embs = embed_batch_resilient(args.model, texts)
            except urllib.error.HTTPError as e:
                detail = e.read().decode("utf-8", errors="replace")
                print(f"\n  Ollama rejected a single input at offset {batch_start}: {detail}")
                failed = True
                break
            except urllib.error.URLError as e:
                sys.exit(
                    f"Could not reach Ollama at {OLLAMA_BATCH_URL}: {e}. Is `ollama serve` running?"
                )
            except Exception as e:
                print(f"\n  batch error at offset {batch_start}: {e}; exiting")
                failed = True
                break

            if dim is None:
                dim = len(embs[0])

            pending = [
                (args.translation, batch[i][0], args.model, dim, pack_f32(embs[i]))
                for i in range(len(batch))
            ]
            conn.executemany(
                "INSERT OR REPLACE INTO verse_embeddings "
                "(translation_code, verse_id, model, dim, embedding) "
                "VALUES (?, ?, ?, ?, ?)",
                pending,
            )
            processed += len(batch)
            done += len(batch)
            save_build_state(
                conn,
                translation=args.translation,
                model=args.model,
                model_digest=model_digest,
                ollama_version=ollama_version,
                platform_json=current_platform,
                embedding_count=done,
                aggregate_sha256="",
            )
            conn.commit()

            elapsed = time.time() - started
            rate = processed / elapsed if elapsed > 0 else 0
            eta = (remaining - processed) / rate if rate > 0 else 0
            print(
                f"  {done}/{total}  ({rate:.1f}/s, ETA {eta / 60:.1f} min)",
                flush=True,
            )

        if failed:
            print(
                f"Stopped early after a batch error. {done}/{total} embeddings "
                f"stored; re-run to resume from where it left off."
            )
            sys.exit(1)
        count, aggregate = embedding_checksum(conn, args.translation, args.model)
        save_build_state(
            conn,
            translation=args.translation,
            model=args.model,
            model_digest=model_digest,
            ollama_version=ollama_version,
            platform_json=current_platform,
            embedding_count=count,
            aggregate_sha256=aggregate,
        )
        conn.commit()
        print(
            f"Done. {done}/{total} embeddings stored; "
            f"model_digest={model_digest}, aggregate_sha256={aggregate}."
        )
    finally:
        conn.close()


if __name__ == "__main__":
    main()
