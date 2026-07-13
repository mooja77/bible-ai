"""
Ingest the Westminster Leningrad Codex (Hebrew OT) into data/corpus.sqlite.

Source: scrollmapper/bible_databases (public-domain WLC, ~Masoretic).
39 OT books. Text is vowel-pointed Hebrew with cantillation marks.

Usage:
    python scripts/ingest_wlc.py
"""

from __future__ import annotations

from _lib import (
    apply_wlc_versification_map,
    ensure_books,
    ensure_schema,
    load_json,
    open_corpus,
    parse_scrollmapper,
    upsert_translation,
    verified_cached_source,
)

SOURCE_URL = (
    "https://raw.githubusercontent.com/scrollmapper/bible_databases/"
    "ba07bc991644d82b24426b920245eb4422daa769/"
    "formats/json/WLC.json"
)
VERSE_MAP_URL = (
    "https://raw.githubusercontent.com/openscriptures/morphhb/"
    "65214d2bdf57f01feb4822c22c5b0d4de032891f/"
    "wlc/VerseMap.xml"
)
VERSE_MAP_SHA256 = "6cd269ca3dccef2cb944b9d9dd8afc950f929dab53a534f1268d23affa983163"


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
            versification="hebrew-wlc",
            rows=parse_scrollmapper(data),
        )
        verse_map = verified_cached_source(
            VERSE_MAP_URL,
            "morphhb/VerseMap.xml",
            VERSE_MAP_SHA256,
        )
        mapping_count = apply_wlc_versification_map(
            conn,
            xml_bytes=verse_map,
            source_label=f"OpenScriptures MorphHB VerseMap.xml sha256:{VERSE_MAP_SHA256}",
        )
        conn.commit()
    finally:
        conn.close()

    print(f"Ingested {count} WLC verses and {mapping_count} versification mappings")


if __name__ == "__main__":
    main()
