"""
Ingest the Open Scriptures Hebrew Bible (morphhb) word-level Strong's tags
into the word_tokens table for the WLC translation.

Source: https://github.com/openscriptures/morphhb (CC-BY 4.0).
Each book is a separate OSIS XML file with a `<w lemma="..." morph="..."
id="...">word</w>` element per Hebrew word. The lemma field contains
Strong's numbers separated by `/` for prefixes/suffixes (e.g. "b/7225"
means prefix "b" + Strong's H7225). We split on `/`, keep the numeric
parts (with optional letter suffix like "a"), and prefix with "H" to
match the strongs lexicon table.

Usage:
    python scripts/ingest_morphhb.py
"""

from __future__ import annotations

import re
import urllib.request
import xml.etree.ElementTree as ET
from pathlib import Path

from _lib import open_corpus, ensure_schema, BOOKS, SOURCES_DIR, verse_id

OSIS_NS = "{http://www.bibletechnologies.net/2003/OSIS/namespace}"

# OSIS book code (used in source) → our (book_id, osis_code). Matches our
# BOOKS mapping for OT books.
OSIS_TO_BOOK_ID = {b[1]: b[0] for b in BOOKS}

# Source filenames are OSIS book abbreviations, but morphhb uses some
# slightly different ones (e.g. "Joel" vs "Jol"). Our BOOKS has the
# standard OSIS codes; map any morphhb-specific names here if needed.
MORPHHB_FILES = [
    "Gen", "Exod", "Lev", "Num", "Deut", "Josh", "Judg", "Ruth",
    "1Sam", "2Sam", "1Kgs", "2Kgs", "1Chr", "2Chr", "Ezra", "Neh",
    "Esth", "Job", "Ps", "Prov", "Eccl", "Song", "Isa", "Jer",
    "Lam", "Ezek", "Dan", "Hos", "Joel", "Amos", "Obad", "Jonah",
    "Mic", "Nah", "Hab", "Zeph", "Hag", "Zech", "Mal",
]

BASE_URL = "https://raw.githubusercontent.com/openscriptures/morphhb/master/wlc"

# Match a Strong's number from a lemma part: digits optionally followed by
# a single lowercase letter (e.g. "1254", "1254a"). morphhb uses uppercase
# letters too (rare); accept both.
STRONGS_RE = re.compile(r"^(\d{1,5})([a-zA-Z])?$")


def fetch_book(osis_code: str) -> bytes:
    SOURCES_DIR.mkdir(parents=True, exist_ok=True)
    cache = SOURCES_DIR / "morphhb" / f"{osis_code}.xml"
    cache.parent.mkdir(parents=True, exist_ok=True)
    if not cache.exists():
        url = f"{BASE_URL}/{osis_code}.xml"
        with urllib.request.urlopen(url, timeout=120) as resp:
            cache.write_bytes(resp.read())
    return cache.read_bytes()


def parse_lemma_to_strongs(lemma: str | None) -> list[str]:
    """`b/7225` → `['H7225']`. `1254 a` → `['H1254a']`. `7225+1234` ignored.
    Multiple Strong's per word return multiple entries."""
    if not lemma:
        return []
    out: list[str] = []
    for part in lemma.replace(" ", "").split("/"):
        m = STRONGS_RE.match(part)
        if m:
            num = int(m.group(1))
            suffix = (m.group(2) or "").lower()
            out.append(f"H{num}{suffix}")
    return out


def main() -> None:
    conn = open_corpus()
    try:
        ensure_schema(conn)

        # Wipe existing WLC word tokens so re-runs are idempotent.
        conn.execute("DELETE FROM word_tokens WHERE translation_code = 'WLC'")

        total_tokens = 0
        for osis in MORPHHB_FILES:
            print(f"Parsing {osis}…", flush=True)
            xml_bytes = fetch_book(osis)
            tree = ET.fromstring(xml_bytes)

            book_id = OSIS_TO_BOOK_ID.get(osis)
            if book_id is None:
                print(f"  unknown book {osis}, skipping")
                continue

            rows: list[tuple] = []
            for verse_el in tree.iter(f"{OSIS_NS}verse"):
                osis_id = verse_el.get("osisID", "")
                # Skip eID (verse closing) markers — they have no text.
                if not osis_id:
                    continue
                parts = osis_id.split(".")
                if len(parts) != 3:
                    continue
                try:
                    chap = int(parts[1])
                    vn = int(parts[2])
                except ValueError:
                    continue
                vid = verse_id(book_id, chap, vn)

                position = 0
                for w in verse_el.iter(f"{OSIS_NS}w"):
                    surface = (w.text or "").strip()
                    if not surface:
                        continue
                    position += 1
                    lemma_attr = w.get("lemma")
                    morph = w.get("morph")
                    # Multiple Strong's per word (e.g. prefix + root) are
                    # comma-joined so the schema's UNIQUE(verse_id, position)
                    # holds and the UI can split on lookup.
                    strongs_joined = ",".join(parse_lemma_to_strongs(lemma_attr)) or None
                    rows.append(
                        ("WLC", vid, position, surface, lemma_attr, strongs_joined, morph),
                    )

            if rows:
                # word_tokens has UNIQUE(translation_code, verse_id, position)
                # so when a word maps to multiple Strong's we'd collide. Drop
                # the unique constraint by inserting with auto id only — let
                # multiple rows share (verse_id, position).
                conn.executemany(
                    "INSERT INTO word_tokens "
                    "(translation_code, verse_id, position, surface, lemma, strongs, morph) "
                    "VALUES (?, ?, ?, ?, ?, ?, ?)",
                    rows,
                )
                conn.commit()
                total_tokens += len(rows)
                print(f"  +{len(rows)} tokens (total {total_tokens})", flush=True)

        print(f"Done. {total_tokens} WLC word tokens stored.")
    finally:
        conn.close()


if __name__ == "__main__":
    main()
