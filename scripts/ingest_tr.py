"""
Ingest the Textus Receptus (Greek NT) into data/corpus.sqlite.

Source: scrollmapper/bible_databases (public-domain TR, Stephanus 1550-ish).
27 NT books. The basis for the KJV's NT, so excellent for cross-referencing.

Usage:
    python scripts/ingest_tr.py
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
    "formats/json/TR.json"
)


def main() -> None:
    data = load_json(SOURCE_URL, "TR.json")
    conn = open_corpus()
    try:
        ensure_schema(conn)
        ensure_books(conn)
        count = upsert_translation(
            conn,
            code="TR",
            name="Textus Receptus",
            language="grc",
            year=1550,
            license="Public Domain",
            source_url=SOURCE_URL,
            kind="original",
            rows=parse_scrollmapper(data),
        )
        conn.commit()
    finally:
        conn.close()

    print(f"Ingested {count} TR verses (Greek NT)")


if __name__ == "__main__":
    main()
