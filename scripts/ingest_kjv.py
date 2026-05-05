"""
Ingest the King James Version into data/corpus.sqlite.

Source: thiagobodruk/bible (public-domain KJV, one JSON file, 66 books in order).
Idempotent — re-running overwrites KJV text but leaves other translations alone.

Usage:
    python scripts/ingest_kjv.py
"""

from __future__ import annotations

from typing import Iterable

from _lib import (
    ensure_books,
    ensure_schema,
    load_json,
    open_corpus,
    upsert_translation,
    verse_id,
)

SOURCE_URL = (
    "https://raw.githubusercontent.com/thiagobodruk/bible/master/json/en_kjv.json"
)


def parse_thiagobodruk(books_json: list[dict]) -> Iterable[tuple[int, int, int, int, str]]:
    """Yield (verse_id, book_id, chapter, verse, text) from thiagobodruk format:
    a list of 66 books in canonical order, each with a `chapters` list of
    verse-string arrays (verse number = position + 1)."""
    if len(books_json) != 66:
        raise ValueError(f"Expected 66 books, got {len(books_json)}")
    for book_idx, book in enumerate(books_json, start=1):
        for c_idx, chapter in enumerate(book["chapters"], start=1):
            for v_idx, text in enumerate(chapter, start=1):
                yield (verse_id(book_idx, c_idx, v_idx), book_idx, c_idx, v_idx, text)


def main() -> None:
    # thiagobodruk ships the whole OT+NT as a plain JSON array (not an object),
    # so normalise before handing to our loader.
    data = load_json(SOURCE_URL, "en_kjv.json")
    books_json = data if isinstance(data, list) else data["books"]

    conn = open_corpus()
    try:
        ensure_schema(conn)
        ensure_books(conn)
        count = upsert_translation(
            conn,
            code="KJV",
            name="King James Version",
            language="en",
            year=1611,
            license="Public Domain",
            source_url=SOURCE_URL,
            rows=parse_thiagobodruk(books_json),
        )
        conn.commit()
    finally:
        conn.close()

    print(f"Ingested {count} KJV verses")


if __name__ == "__main__":
    main()
