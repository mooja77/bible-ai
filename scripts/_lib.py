"""
Shared helpers for Bible translation ingestion scripts.

Every translation lands in the same `corpus.sqlite` via the same book/verse
reference space. Per-translation scripts only need to: (1) fetch their source,
(2) parse it into a list of (book_id, chapter, verse, text) rows, and
(3) call `upsert_translation` with their metadata + rows.
"""

from __future__ import annotations

import json
import re
import sqlite3
import urllib.request
import zipfile
from io import BytesIO
from pathlib import Path
from typing import Iterable

ROOT = Path(__file__).resolve().parents[1]
SCHEMA_PATH = ROOT / "data" / "schema.sql"
CORPUS_DB = ROOT / "data" / "corpus.sqlite"
SOURCES_DIR = ROOT / "data" / "sources"

# Canonical 66-book Protestant order. ids are stable identifiers used in
# composite verse_ids across the whole app; do not renumber.
BOOKS: list[tuple[int, str, str, str, int]] = [
    # (id, osis, name, testament, canonical_order)
    (1, "Gen", "Genesis", "OT", 1), (2, "Exod", "Exodus", "OT", 2),
    (3, "Lev", "Leviticus", "OT", 3), (4, "Num", "Numbers", "OT", 4),
    (5, "Deut", "Deuteronomy", "OT", 5), (6, "Josh", "Joshua", "OT", 6),
    (7, "Judg", "Judges", "OT", 7), (8, "Ruth", "Ruth", "OT", 8),
    (9, "1Sam", "1 Samuel", "OT", 9), (10, "2Sam", "2 Samuel", "OT", 10),
    (11, "1Kgs", "1 Kings", "OT", 11), (12, "2Kgs", "2 Kings", "OT", 12),
    (13, "1Chr", "1 Chronicles", "OT", 13), (14, "2Chr", "2 Chronicles", "OT", 14),
    (15, "Ezra", "Ezra", "OT", 15), (16, "Neh", "Nehemiah", "OT", 16),
    (17, "Esth", "Esther", "OT", 17), (18, "Job", "Job", "OT", 18),
    (19, "Ps", "Psalms", "OT", 19), (20, "Prov", "Proverbs", "OT", 20),
    (21, "Eccl", "Ecclesiastes", "OT", 21), (22, "Song", "Song of Solomon", "OT", 22),
    (23, "Isa", "Isaiah", "OT", 23), (24, "Jer", "Jeremiah", "OT", 24),
    (25, "Lam", "Lamentations", "OT", 25), (26, "Ezek", "Ezekiel", "OT", 26),
    (27, "Dan", "Daniel", "OT", 27), (28, "Hos", "Hosea", "OT", 28),
    (29, "Joel", "Joel", "OT", 29), (30, "Amos", "Amos", "OT", 30),
    (31, "Obad", "Obadiah", "OT", 31), (32, "Jonah", "Jonah", "OT", 32),
    (33, "Mic", "Micah", "OT", 33), (34, "Nah", "Nahum", "OT", 34),
    (35, "Hab", "Habakkuk", "OT", 35), (36, "Zeph", "Zephaniah", "OT", 36),
    (37, "Hag", "Haggai", "OT", 37), (38, "Zech", "Zechariah", "OT", 38),
    (39, "Mal", "Malachi", "OT", 39),
    (40, "Matt", "Matthew", "NT", 40), (41, "Mark", "Mark", "NT", 41),
    (42, "Luke", "Luke", "NT", 42), (43, "John", "John", "NT", 43),
    (44, "Acts", "Acts", "NT", 44), (45, "Rom", "Romans", "NT", 45),
    (46, "1Cor", "1 Corinthians", "NT", 46), (47, "2Cor", "2 Corinthians", "NT", 47),
    (48, "Gal", "Galatians", "NT", 48), (49, "Eph", "Ephesians", "NT", 49),
    (50, "Phil", "Philippians", "NT", 50), (51, "Col", "Colossians", "NT", 51),
    (52, "1Thess", "1 Thessalonians", "NT", 52), (53, "2Thess", "2 Thessalonians", "NT", 53),
    (54, "1Tim", "1 Timothy", "NT", 54), (55, "2Tim", "2 Timothy", "NT", 55),
    (56, "Titus", "Titus", "NT", 56), (57, "Phlm", "Philemon", "NT", 57),
    (58, "Heb", "Hebrews", "NT", 58), (59, "Jas", "James", "NT", 59),
    (60, "1Pet", "1 Peter", "NT", 60), (61, "2Pet", "2 Peter", "NT", 61),
    (62, "1John", "1 John", "NT", 62), (63, "2John", "2 John", "NT", 63),
    (64, "3John", "3 John", "NT", 64), (65, "Jude", "Jude", "NT", 65),
    (66, "Rev", "Revelation", "NT", 66),
]

# Known name variants → canonical name. Covers Roman-numeral styles ("I Samuel"),
# long-form Revelation ("Revelation of John"), and a few others that appear in
# different public-domain sources.
_BOOK_NAME_ALIASES: dict[str, str] = {
    "I Samuel": "1 Samuel", "II Samuel": "2 Samuel",
    "I Kings": "1 Kings", "II Kings": "2 Kings",
    "I Chronicles": "1 Chronicles", "II Chronicles": "2 Chronicles",
    "I Corinthians": "1 Corinthians", "II Corinthians": "2 Corinthians",
    "I Thessalonians": "1 Thessalonians", "II Thessalonians": "2 Thessalonians",
    "I Timothy": "1 Timothy", "II Timothy": "2 Timothy",
    "I Peter": "1 Peter", "II Peter": "2 Peter",
    "I John": "1 John", "II John": "2 John", "III John": "3 John",
    "Song of Songs": "Song of Solomon",
    "Canticles": "Song of Solomon",
    "Revelation of John": "Revelation",
    "The Revelation": "Revelation",
    "Psalm": "Psalms",
}

_BOOK_ID_BY_NAME: dict[str, int] = {b[2]: b[0] for b in BOOKS}

PROTESTANT_CHAPTER_COUNTS: dict[int, int] = {
    1: 50, 2: 40, 3: 27, 4: 36, 5: 34, 6: 24, 7: 21, 8: 4, 9: 31,
    10: 24, 11: 22, 12: 25, 13: 29, 14: 36, 15: 10, 16: 13, 17: 10,
    18: 42, 19: 150, 20: 31, 21: 12, 22: 8, 23: 66, 24: 52, 25: 5,
    26: 48, 27: 12, 28: 14, 29: 3, 30: 9, 31: 1, 32: 4, 33: 7,
    34: 3, 35: 3, 36: 3, 37: 2, 38: 14, 39: 4, 40: 28, 41: 16,
    42: 24, 43: 21, 44: 28, 45: 16, 46: 16, 47: 13, 48: 6, 49: 6,
    50: 4, 51: 4, 52: 5, 53: 3, 54: 6, 55: 4, 56: 3, 57: 1, 58: 13,
    59: 5, 60: 5, 61: 3, 62: 5, 63: 1, 64: 1, 65: 1, 66: 22,
}

USFM_BOOK_ID_BY_CODE: dict[str, int] = {
    "GEN": 1, "EXO": 2, "LEV": 3, "NUM": 4, "DEU": 5, "JOS": 6,
    "JDG": 7, "RUT": 8, "1SA": 9, "2SA": 10, "1KI": 11, "2KI": 12,
    "1CH": 13, "2CH": 14, "EZR": 15, "NEH": 16, "EST": 17, "JOB": 18,
    "PSA": 19, "PRO": 20, "ECC": 21, "SNG": 22, "ISA": 23, "JER": 24,
    "LAM": 25, "EZK": 26, "DAN": 27, "HOS": 28, "JOL": 29, "AMO": 30,
    "OBA": 31, "JON": 32, "MIC": 33, "NAM": 34, "HAB": 35, "ZEP": 36,
    "HAG": 37, "ZEC": 38, "MAL": 39, "MAT": 40, "MRK": 41, "LUK": 42,
    "JHN": 43, "ACT": 44, "ROM": 45, "1CO": 46, "2CO": 47, "GAL": 48,
    "EPH": 49, "PHP": 50, "COL": 51, "1TH": 52, "2TH": 53, "1TI": 54,
    "2TI": 55, "TIT": 56, "PHM": 57, "HEB": 58, "JAS": 59, "1PE": 60,
    "2PE": 61, "1JN": 62, "2JN": 63, "3JN": 64, "JUD": 65, "REV": 66,
}


def book_id_for_name(name: str) -> int:
    canonical = _BOOK_NAME_ALIASES.get(name, name)
    if canonical not in _BOOK_ID_BY_NAME:
        raise KeyError(f"Unknown book name: {name!r} (normalised to {canonical!r})")
    return _BOOK_ID_BY_NAME[canonical]


def verse_id(book_id: int, chapter: int, verse: int) -> int:
    return book_id * 1_000_000 + chapter * 1_000 + verse


def fetch_cached(url: str, cache_name: str) -> bytes:
    """Download once and cache in data/sources/<cache_name>."""
    SOURCES_DIR.mkdir(parents=True, exist_ok=True)
    dest = SOURCES_DIR / cache_name
    if not dest.exists():
        print(f"Downloading {url}")
        with urllib.request.urlopen(url, timeout=120) as resp:
            dest.write_bytes(resp.read())
        print(f"Cached at {dest}")
    return dest.read_bytes()


def load_zip(url: str, cache_name: str) -> zipfile.ZipFile:
    return zipfile.ZipFile(BytesIO(fetch_cached(url, cache_name)))


def load_json(url: str, cache_name: str) -> dict:
    raw = fetch_cached(url, cache_name)
    # Some sources ship with a UTF-8 BOM.
    return json.loads(raw.decode("utf-8-sig"))


def open_corpus() -> sqlite3.Connection:
    CORPUS_DB.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(CORPUS_DB)
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def ensure_schema(conn: sqlite3.Connection) -> None:
    conn.executescript(SCHEMA_PATH.read_text(encoding="utf-8"))


def ensure_books(conn: sqlite3.Connection) -> None:
    conn.executemany(
        """
        INSERT INTO books (id, osis_code, name, testament, chapter_count, canonical_order)
        VALUES (?, ?, ?, ?, 0, ?)
        ON CONFLICT(id) DO UPDATE SET
          osis_code = excluded.osis_code,
          name = excluded.name,
          testament = excluded.testament,
          canonical_order = excluded.canonical_order
        """,
        [(b[0], b[1], b[2], b[3], b[4]) for b in BOOKS],
    )


def parse_scrollmapper(root: dict) -> Iterable[tuple[int, int, int, int, str]]:
    """Yield (verse_id, book_id, chapter, verse, text) tuples from a
    scrollmapper-style JSON: {"books": [{"name", "chapters": [{"chapter",
    "verses": [{"verse", "text"}]}]}]}.

    Verses whose text is empty/blank are skipped — some scrollmapper files
    (e.g. TR, WLC) ship all 66 books with empty placeholders for the other
    testament. Empty rows pollute the FTS index and confuse retrieval.
    """
    if "books" not in root:
        raise ValueError("scrollmapper JSON missing 'books' key")
    for book in root["books"]:
        bid = book_id_for_name(book["name"])
        for chap in book["chapters"]:
            c = int(chap["chapter"])
            for v in chap["verses"]:
                vn = int(v["verse"])
                text = (v["text"] or "").strip()
                if not text:
                    continue
                yield (verse_id(bid, c, vn), bid, c, vn, text)


def parse_scrollmapper_protestant_subset(root: dict) -> Iterable[tuple[int, int, int, int, str]]:
    """Parse scrollmapper JSON while skipping deuterocanonical books and
    canonical-book additions that exceed the current 66-book schema.
    """
    if "books" not in root:
        raise ValueError("scrollmapper JSON missing 'books' key")
    for book in root["books"]:
        try:
            bid = book_id_for_name(book["name"])
        except KeyError:
            continue
        max_chapter = PROTESTANT_CHAPTER_COUNTS[bid]
        for chap in book["chapters"]:
            c = int(chap["chapter"])
            if c > max_chapter:
                continue
            for v in chap["verses"]:
                vn = int(v["verse"])
                text = (v["text"] or "").strip()
                if not text:
                    continue
                yield (verse_id(bid, c, vn), bid, c, vn, text)


def parse_usfm_zip_protestant(zip_file: zipfile.ZipFile) -> Iterable[tuple[int, int, int, int, str]]:
    """Parse a 66-book USFM zip into corpus rows.

    The parser intentionally extracts plain verse text only. Footnotes,
    cross-reference notes, Strong's attributes, and formatting markers are
    removed so reader/search text stays compact.
    """
    for name in sorted(zip_file.namelist()):
        if not name.lower().endswith(".usfm"):
            continue
        lines = zip_file.read(name).decode("utf-8-sig").splitlines()
        book_id = None
        for line in lines[:12]:
            match = re.match(r"\\id\s+([A-Z0-9]{3})\b", line)
            if match:
                book_id = USFM_BOOK_ID_BY_CODE.get(match.group(1))
                break
        if book_id is None:
            continue

        chapter: int | None = None
        current_verse: int | None = None
        parts: list[str] = []

        def flush() -> tuple[int, int, int, int, str] | None:
            if chapter is None or current_verse is None:
                return None
            text = normalize_usfm_text(" ".join(parts))
            if not text:
                return None
            return (verse_id(book_id, chapter, current_verse), book_id, chapter, current_verse, text)

        for raw_line in lines:
            line = raw_line.strip()
            if not line:
                continue
            chapter_match = re.match(r"\\c\s+(\d+)", line)
            if chapter_match:
                row = flush()
                if row:
                    yield row
                chapter = int(chapter_match.group(1))
                current_verse = None
                parts = []
                continue
            verse_match = re.match(r"\\v\s+(\d+)\s*(.*)", line)
            if verse_match:
                row = flush()
                if row:
                    yield row
                current_verse = int(verse_match.group(1))
                parts = [verse_match.group(2)]
                continue
            if current_verse is not None and not re.match(
                r"\\(id|ide|h|toc\d|mt\d?|ms\d?|s\d?|is\d?|ip|ili|rem)\b",
                line,
            ):
                parts.append(line)

        row = flush()
        if row:
            yield row


def normalize_usfm_text(text: str) -> str:
    text = re.sub(r"\\f\s+.*?\\f\*", " ", text)
    text = re.sub(r"\\x\s+.*?\\x\*", " ", text)
    text = re.sub(r'\\w\s+([^|\\]+)(?:\|[^\\]*)?\\w\*', r"\1", text)
    text = re.sub(r'\|[A-Za-z0-9_-]+="[^"]*"', "", text)
    text = re.sub(r"\\\+?[A-Za-z0-9-]+\*?", " ", text)
    text = text.replace("~", " ")
    text = re.sub(r"\s+", " ", text).strip()
    text = re.sub(r"\s+([,.;:?!])", r"\1", text)
    return text


def upsert_translation(
    conn: sqlite3.Connection,
    *,
    code: str,
    name: str,
    language: str,
    year: int | None,
    license: str,
    source_url: str,
    kind: str = "translation",
    rows: Iterable[tuple[int, int, int, int, str]],
) -> int:
    """Register the translation and write all of its verses + text + FTS rows.
    Idempotent — re-running replaces this translation's text without touching
    anything else. Returns the number of verse rows written."""
    conn.execute(
        """
        INSERT INTO translations (code, name, language, year, license, source_url, kind)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(code) DO UPDATE SET
          name = excluded.name,
          language = excluded.language,
          year = excluded.year,
          license = excluded.license,
          source_url = excluded.source_url,
          kind = excluded.kind
        """,
        (code, name, language, year, license, source_url, kind),
    )

    verse_rows = []
    text_rows = []
    chapter_counts: dict[int, int] = {}

    for vid, bid, chap, _verse, text in rows:
        verse_rows.append((vid, bid, chap, _verse))
        text_rows.append((code, vid, text))
        if chap > chapter_counts.get(bid, 0):
            chapter_counts[bid] = chap

    conn.executemany(
        "INSERT INTO verses (id, book_id, chapter, verse) VALUES (?, ?, ?, ?) "
        "ON CONFLICT(id) DO NOTHING",
        verse_rows,
    )
    conn.executemany(
        "INSERT INTO translation_text (translation_code, verse_id, text) VALUES (?, ?, ?) "
        "ON CONFLICT(translation_code, verse_id) DO UPDATE SET text = excluded.text",
        text_rows,
    )

    conn.execute("DELETE FROM translation_text_fts WHERE translation_code = ?", (code,))
    conn.executemany(
        "INSERT INTO translation_text_fts (translation_code, verse_id, text) VALUES (?, ?, ?)",
        text_rows,
    )

    for bid, count in chapter_counts.items():
        # Only raise chapter_count, never lower — different translations may
        # have different max chapters (e.g. an incomplete translation).
        conn.execute(
            "UPDATE books SET chapter_count = ? WHERE id = ? AND chapter_count < ?",
            (count, bid, count),
        )

    return len(text_rows)
