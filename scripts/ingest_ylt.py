"""
Ingest Young's Literal Translation (1862) into data/corpus.sqlite.

Source: scrollmapper/bible_databases (public-domain YLT).
YLT is a strictly word-for-word rendering, a useful literal companion to KJV/ASV
when weighing disputed passages.

Usage:
    python scripts/ingest_ylt.py
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
    "formats/json/YLT.json"
)


def main() -> None:
    data = load_json(SOURCE_URL, "YLT.json")
    conn = open_corpus()
    try:
        ensure_schema(conn)
        ensure_books(conn)
        count = upsert_translation(
            conn,
            code="YLT",
            name="Young's Literal Translation",
            language="en",
            year=1862,
            license="Public Domain",
            source_url=SOURCE_URL,
            rows=parse_scrollmapper(data),
        )
        conn.commit()
    finally:
        conn.close()

    print(f"Ingested {count} YLT verses")


if __name__ == "__main__":
    main()
