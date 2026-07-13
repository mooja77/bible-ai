"""Validate the shipped Bible corpus and optionally perform safe cleanup.

Usage:
    python scripts/verify_corpus.py
    python scripts/verify_corpus.py --fix

`--fix` applies idempotent schema additions, mapping backfills, and removes only
verse identities that are unreferenced by every corpus table. It never changes
translation text.
"""

from __future__ import annotations

import argparse
import json
import sqlite3
from pathlib import Path

from _lib import (
    CORPUS_DB,
    ROOT,
    backfill_identity_verse_mappings,
    ensure_schema,
    prune_unreferenced_verses,
    verse_id,
)

LOCK_PATH = ROOT / "data" / "corpus-lock.json"


def scalar(conn: sqlite3.Connection, sql: str, params: tuple = ()) -> int:
    return int(conn.execute(sql, params).fetchone()[0])


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--fix", action="store_true")
    args = parser.parse_args()

    failures: list[str] = []
    conn = sqlite3.connect(CORPUS_DB)
    conn.execute("PRAGMA foreign_keys = ON")
    try:
        if args.fix:
            ensure_schema(conn)
            added = backfill_identity_verse_mappings(conn)
            removed = prune_unreferenced_verses(conn)
            conn.commit()
            print(f"Applied corpus maintenance: mappings_added={added}, stale_verses_removed={removed}")

        integrity = conn.execute("PRAGMA quick_check").fetchone()[0]
        if integrity != "ok":
            failures.append(f"SQLite quick_check: {integrity}")
        foreign_keys = list(conn.execute("PRAGMA foreign_key_check"))
        if foreign_keys:
            failures.append(f"foreign_key_check returned {len(foreign_keys)} row(s)")

        checks = {
            "blank translation rows": scalar(conn, "SELECT COUNT(*) FROM translation_text WHERE trim(text) = ''"),
            "translation rows without local mappings": scalar(
                conn,
                """
                SELECT COUNT(*) FROM translation_text t
                WHERE NOT EXISTS (
                  SELECT 1 FROM edition_verse_mappings m
                  WHERE m.translation_code = t.translation_code AND m.local_verse_id = t.verse_id
                )
                """,
            ),
            "mapping rows without local text": scalar(
                conn,
                """
                SELECT COUNT(*) FROM edition_verse_mappings m
                WHERE NOT EXISTS (
                  SELECT 1 FROM translation_text t
                  WHERE t.translation_code = m.translation_code AND t.verse_id = m.local_verse_id
                )
                """,
            ),
            "unreferenced verse identities": scalar(
                conn,
                """
                SELECT COUNT(*) FROM verses v
                WHERE NOT EXISTS (SELECT 1 FROM translation_text t WHERE t.verse_id = v.id)
                  AND NOT EXISTS (SELECT 1 FROM word_tokens w WHERE w.verse_id = v.id)
                  AND NOT EXISTS (SELECT 1 FROM verse_embeddings e WHERE e.verse_id = v.id)
                  AND NOT EXISTS (
                    SELECT 1 FROM edition_verse_mappings m
                    WHERE m.local_verse_id = v.id OR m.canonical_verse_id = v.id
                  )
                  AND NOT EXISTS (
                    SELECT 1 FROM cross_refs c
                    WHERE c.from_verse_id = v.id OR c.to_verse_id = v.id
                  )
                """,
            ),
        }
        for label, count in checks.items():
            if count:
                failures.append(f"{label}: {count}")

        fts_count = scalar(conn, "SELECT COUNT(*) FROM translation_text_fts")
        text_count = scalar(conn, "SELECT COUNT(*) FROM translation_text")
        if fts_count != text_count:
            failures.append(f"FTS/text parity: fts={fts_count}, text={text_count}")

        required_mappings = [
            (verse_id(29, 4, 1), verse_id(29, 3, 1), "WLC Joel 4:1 -> comparison Joel 3:1"),
            (verse_id(19, 3, 2), verse_id(19, 3, 1), "WLC Psalm 3:2 -> comparison Psalm 3:1"),
        ]
        for local_id, canonical_id, label in required_mappings:
            found = scalar(
                conn,
                """
                SELECT COUNT(*) FROM edition_verse_mappings
                WHERE translation_code = 'WLC' AND local_verse_id = ? AND canonical_verse_id = ?
                """,
                (local_id, canonical_id),
            )
            if not found:
                failures.append(f"missing versification fixture: {label}")

        if LOCK_PATH.exists():
            lock = json.loads(LOCK_PATH.read_text(encoding="utf-8"))
            expected = lock.get("expected_translation_rows", {})
            actual = dict(
                conn.execute(
                    "SELECT translation_code, COUNT(*) FROM translation_text GROUP BY translation_code"
                )
            )
            for code, count in expected.items():
                if actual.get(code) != count:
                    failures.append(
                        f"translation row count {code}: expected={count}, actual={actual.get(code)}"
                    )
            for code in lock.get("required_embedding_translations", []):
                embeddings = scalar(
                    conn,
                    "SELECT COUNT(*) FROM verse_embeddings WHERE translation_code = ?",
                    (code,),
                )
                rows = actual.get(code, 0)
                if embeddings != rows:
                    failures.append(
                        f"embedding coverage {code}: embeddings={embeddings}, translation_rows={rows}"
                    )
        else:
            failures.append(f"missing corpus lockfile: {LOCK_PATH}")

        print(
            json.dumps(
                {
                    "translations": dict(
                        conn.execute(
                            "SELECT translation_code, COUNT(*) FROM translation_text GROUP BY translation_code"
                        )
                    ),
                    "verses": scalar(conn, "SELECT COUNT(*) FROM verses"),
                    "mappings": scalar(conn, "SELECT COUNT(*) FROM edition_verse_mappings"),
                    "embeddings": scalar(conn, "SELECT COUNT(*) FROM verse_embeddings"),
                    "failures": failures,
                },
                indent=2,
                sort_keys=True,
            )
        )
    finally:
        conn.close()

    if failures:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
