"""
Ingest openbible.info's cross-reference dataset (TSK-derived) into the
cross_refs table.

Source: https://a.openbible.info/data/cross-references.zip  (CC-BY)
Format (tab-separated):
    From Verse \t To Verse \t Votes
Where verses are OSIS-style (e.g. "Gen.1.1") and "To Verse" may be a range
like "Gen.1.1-Gen.1.5". Ranges are expanded to the START verse only — the
schema is one row per (from, to, source) pair, so we keep the canonical
anchor verse and let the reader show context naturally.

Idempotent — re-running clears existing 'openbible' rows and re-inserts.

Usage:
    python scripts/ingest_tsk.py
"""

from __future__ import annotations

import io
import sys
import urllib.request
import zipfile
from pathlib import Path

from _lib import open_corpus, ensure_schema, BOOKS, SOURCES_DIR, verse_id

SOURCE_URL = "https://a.openbible.info/data/cross-references.zip"
CACHE_FILENAME = "cross_references.txt"

# OSIS code → our book_id. Matches our BOOKS list's osis_code column.
OSIS_TO_BOOK_ID: dict[str, int] = {b[1]: b[0] for b in BOOKS}


def fetch_cached() -> Path:
    SOURCES_DIR.mkdir(parents=True, exist_ok=True)
    dest = SOURCES_DIR / CACHE_FILENAME
    if dest.exists():
        return dest
    print(f"Downloading {SOURCE_URL}")
    with urllib.request.urlopen(SOURCE_URL, timeout=120) as resp:
        zip_bytes = resp.read()
    with zipfile.ZipFile(io.BytesIO(zip_bytes)) as zf:
        names = [n for n in zf.namelist() if n.endswith(".txt")]
        if not names:
            sys.exit(f"zip from {SOURCE_URL} contains no .txt file")
        with zf.open(names[0]) as src:
            dest.write_bytes(src.read())
    print(f"Cached at {dest}")
    return dest


def parse_osis(ref: str) -> tuple[int, int, int] | None:
    """Parse 'Gen.1.1' → (book_id, chapter, verse). Returns None on unknown
    book or malformed ref."""
    parts = ref.split(".")
    if len(parts) != 3:
        return None
    book, chap, verse = parts
    book_id = OSIS_TO_BOOK_ID.get(book)
    if book_id is None:
        return None
    try:
        return book_id, int(chap), int(verse)
    except ValueError:
        return None


def to_anchor_verse_id(to_field: str) -> int | None:
    """The 'To Verse' field may be a single verse or a range like
    'Gen.1.1-Gen.1.5' or 'Gen.1.1-3'. We collapse to the start verse."""
    start = to_field.split("-", 1)[0].strip()
    parsed = parse_osis(start)
    if parsed is None:
        return None
    book_id, chap, vn = parsed
    return verse_id(book_id, chap, vn)


def main() -> None:
    src = fetch_cached()

    rows: list[tuple[int, int, str, float]] = []
    skipped = 0
    with src.open("r", encoding="utf-8") as f:
        next(f, None)  # header
        for raw in f:
            line = raw.rstrip("\n")
            if not line or line.startswith("#"):
                continue
            cols = line.split("\t")
            if len(cols) < 2:
                continue
            from_parsed = parse_osis(cols[0].strip())
            to_vid = to_anchor_verse_id(cols[1])
            if from_parsed is None or to_vid is None:
                skipped += 1
                continue
            from_vid = verse_id(*from_parsed)
            try:
                votes = float(cols[2]) if len(cols) >= 3 else 0.0
            except ValueError:
                votes = 0.0
            rows.append((from_vid, to_vid, "openbible", votes))

    print(f"Parsed {len(rows)} cross-references (skipped {skipped} malformed)")

    conn = open_corpus()
    try:
        ensure_schema(conn)
        conn.execute("DELETE FROM cross_refs WHERE source = 'openbible'")
        conn.executemany(
            "INSERT OR REPLACE INTO cross_refs "
            "(from_verse_id, to_verse_id, source, weight) VALUES (?, ?, ?, ?)",
            rows,
        )
        conn.commit()
        n = conn.execute(
            "SELECT COUNT(*) FROM cross_refs WHERE source = 'openbible'"
        ).fetchone()[0]
    finally:
        conn.close()

    print(f"Stored {n} cross-references in corpus.sqlite")


if __name__ == "__main__":
    main()
