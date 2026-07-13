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
import json
import struct
import sys
import time
import urllib.error
import urllib.request

from _lib import open_corpus, ensure_schema

OLLAMA_BATCH_URL = "http://localhost:11434/api/embed"


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
    args = ap.parse_args()

    conn = open_corpus()
    try:
        ensure_schema(conn)

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
        print(
            f"Embedding {remaining} / {total} verses ({args.translation}, model={args.model})"
        )
        if remaining == 0:
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
            conn.commit()
            processed += len(batch)
            done += len(batch)

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
        print(f"Done. {done}/{total} embeddings stored.")
    finally:
        conn.close()


if __name__ == "__main__":
    main()
