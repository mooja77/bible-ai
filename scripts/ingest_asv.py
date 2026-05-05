"""
Ingest the American Standard Version (1901) into data/corpus.sqlite.

Source: scrollmapper/bible_databases (public-domain ASV).
Idempotent — re-running overwrites ASV text but leaves other translations alone.

Usage:
    python scripts/ingest_asv.py
"""

from __future__ import annotations

from _lib import (
    ensure_books,
    ensure_schema,
    load_json,
    open_corpus,
    parse_scrollmapper,
    upsert_translation,
)

SOURCE_URL = (
    "https://raw.githubusercontent.com/scrollmapper/bible_databases/master/"
    "formats/json/ASV.json"
)


def main() -> None:
    data = load_json(SOURCE_URL, "ASV.json")
    conn = open_corpus()
    try:
        ensure_schema(conn)
        ensure_books(conn)
        count = upsert_translation(
            conn,
            code="ASV",
            name="American Standard Version",
            language="en",
            year=1901,
            license="Public Domain",
            source_url=SOURCE_URL,
            rows=parse_scrollmapper(data),
        )
        conn.commit()
    finally:
        conn.close()

    print(f"Ingested {count} ASV verses")


if __name__ == "__main__":
    main()
