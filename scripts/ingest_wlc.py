"""
Ingest the Westminster Leningrad Codex (Hebrew OT) into data/corpus.sqlite.

Source: scrollmapper/bible_databases (public-domain WLC, ~Masoretic).
39 OT books. Text is vowel-pointed Hebrew with cantillation marks.

Usage:
    python scripts/ingest_wlc.py
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
    "formats/json/WLC.json"
)


def main() -> None:
    data = load_json(SOURCE_URL, "WLC.json")
    conn = open_corpus()
    try:
        ensure_schema(conn)
        ensure_books(conn)
        count = upsert_translation(
            conn,
            code="WLC",
            name="Westminster Leningrad Codex",
            language="hbo",
            year=1008,  # Leningrad Codex dated ~1008 CE
            license="Public Domain",
            source_url=SOURCE_URL,
            kind="original",
            rows=parse_scrollmapper(data),
        )
        conn.commit()
    finally:
        conn.close()

    print(f"Ingested {count} WLC verses (Hebrew OT)")


if __name__ == "__main__":
    main()
