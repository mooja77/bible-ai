"""
Ingest the World English Bible Protestant Edition into data/corpus.sqlite.

Source: eBible.org ENGWEBP USFM zip. The edition is public domain and contains
the 66-book Protestant canon, which matches the app's current corpus schema.

Usage:
    python scripts/ingest_web.py
"""

from __future__ import annotations

from _lib import (
    ensure_books,
    ensure_schema,
    load_zip,
    open_corpus,
    parse_usfm_zip_protestant,
    upsert_translation,
)

SOURCE_URL = "https://ebible.org/Scriptures/engwebp_usfm.zip"


def main() -> None:
    source = load_zip(SOURCE_URL, "engwebp_usfm.zip")
    conn = open_corpus()
    try:
        ensure_schema(conn)
        ensure_books(conn)
        count = upsert_translation(
            conn,
            code="WEB",
            name="World English Bible",
            language="en",
            year=2020,
            license="Public Domain",
            source_url=SOURCE_URL,
            rows=parse_usfm_zip_protestant(source),
        )
        conn.commit()
    finally:
        conn.close()

    print(f"Ingested {count} WEB verses")


if __name__ == "__main__":
    main()
