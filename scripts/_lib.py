"""
Shared helpers for Bible translation ingestion scripts.

Every translation lands in the same `corpus.sqlite` via the same book/verse
reference space. Per-translation scripts only need to: (1) fetch their source,
(2) parse it into a list of (book_id, chapter, verse, text) rows, and
(3) call `upsert_translation` with their metadata + rows.
"""

from __future__ import annotations

import json
import hashlib
import re
import sqlite3
import urllib.request
import zipfile
from io import BytesIO
from pathlib import Path
from typing import Iterable
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
SCHEMA_PATH = ROOT / "data" / "schema.sql"
CORPUS_DB = ROOT / "data" / "corpus.sqlite"
SOURCES_DIR = ROOT / "data" / "sources"

COMPARISON_VERSIFICATION = "eng-kjv"
VERSIFICATION_SCHEMES = (
    (
        COMPARISON_VERSIFICATION,
        "English Protestant (KJV-style)",
        "Canonical comparison anchors used by the current 66-book UI.",
        "https://ubsicap.github.io/usfm/usfm3.0.1/chapters_verses/index.html",
    ),
    (
        "hebrew-wlc",
        "Hebrew Masoretic (WLC)",
        "Edition-local WLC chapter and verse numbering.",
        "https://github.com/openscriptures/morphhb",
    ),
    (
        "greek-tr",
        "Greek New Testament (Textus Receptus)",
        "Edition-local Textus Receptus numbering.",
        "https://github.com/scrollmapper/bible_databases",
    ),
)

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
    conn.executemany(
        """
        INSERT INTO versification_schemes (code, name, description, source_url)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(code) DO UPDATE SET
          name = excluded.name,
          description = excluded.description,
          source_url = excluded.source_url
        """,
        VERSIFICATION_SCHEMES,
    )


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
    versification: str = COMPARISON_VERSIFICATION,
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
    # Replace this translation's text wholesale so a re-ingest from a
    # corrected source with fewer verses cannot leave orphan rows behind
    # (translation_text_fts is rebuilt the same way just below).
    conn.execute("DELETE FROM translation_text WHERE translation_code = ?", (code,))
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

    conn.execute(
        """
        INSERT INTO translation_versification
          (translation_code, scheme_code, comparison_scheme_code)
        VALUES (?, ?, ?)
        ON CONFLICT(translation_code) DO UPDATE SET
          scheme_code = excluded.scheme_code,
          comparison_scheme_code = excluded.comparison_scheme_code
        """,
        (code, versification, COMPARISON_VERSIFICATION),
    )
    # Rebuild the default identity layer for this edition. Sources with a
    # different versification replace affected rows after upsert rather than
    # silently sharing a nominal chapter/verse with the comparison edition.
    conn.execute("DELETE FROM edition_verse_mappings WHERE translation_code = ?", (code,))
    conn.executemany(
        """
        INSERT INTO edition_verse_mappings
          (translation_code, local_verse_id, canonical_verse_id, mapping_kind, source)
        VALUES (?, ?, ?, 'identity', 'edition-local identity')
        """,
        [(code, vid, vid) for _translation, vid, _text in text_rows],
    )

    for bid, count in chapter_counts.items():
        # Only raise chapter_count, never lower — different translations may
        # have different max chapters (e.g. an incomplete translation).
        conn.execute(
            "UPDATE books SET chapter_count = ? WHERE id = ? AND chapter_count < ?",
            (count, bid, count),
        )

    return len(text_rows)


def verified_cached_source(url: str, cache_name: str, expected_sha256: str) -> bytes:
    raw = fetch_cached(url, cache_name)
    actual = hashlib.sha256(raw).hexdigest()
    if actual != expected_sha256:
        raise ValueError(
            f"Checksum mismatch for {cache_name}: expected {expected_sha256}, got {actual}"
        )
    return raw


def _parse_osis_reference(value: str) -> tuple[int, int, int, str]:
    """Parse `Ps.13.6!a` into a local identity plus an optional segment."""
    ref, _, segment = value.partition("!")
    parts = ref.split(".")
    if len(parts) != 3:
        raise ValueError(f"Unsupported OSIS verse reference: {value!r}")
    osis, chapter, verse = parts
    by_osis = {book[1]: book[0] for book in BOOKS}
    if osis not in by_osis:
        raise ValueError(f"Unknown OSIS book in verse mapping: {osis!r}")
    return by_osis[osis], int(chapter), int(verse), segment


def apply_wlc_versification_map(
    conn: sqlite3.Connection,
    *,
    xml_bytes: bytes,
    source_label: str,
) -> int:
    """Map WLC-local references to the English/KJV comparison scheme.

    The OpenScriptures map contains full-verse moves plus seven partial-verse
    boundaries. Local WLC text remains stored at its own reference. Runtime
    comparison uses this table and may combine a superscription/body pair that
    maps to the same canonical verse.
    """
    root = ET.fromstring(xml_bytes)
    entries: list[tuple[str, int, int, str, str, str, str]] = []
    affected_local_ids: set[int] = set()
    canonical_refs: dict[int, tuple[int, int, int]] = {}

    for element in root.iter():
        if not element.tag.endswith("verse"):
            continue
        wlc_ref = element.get("wlc")
        canonical_ref = element.get("kjv")
        mapping_kind = element.get("type", "full")
        if not wlc_ref or not canonical_ref or mapping_kind not in {"full", "partial"}:
            continue
        local_book, local_chapter, local_verse, local_segment = _parse_osis_reference(wlc_ref)
        canonical_book, canonical_chapter, canonical_verse, canonical_segment = (
            _parse_osis_reference(canonical_ref)
        )
        local_id = verse_id(local_book, local_chapter, local_verse)
        canonical_id = verse_id(canonical_book, canonical_chapter, canonical_verse)
        affected_local_ids.add(local_id)
        canonical_refs[canonical_id] = (canonical_book, canonical_chapter, canonical_verse)
        entries.append(
            (
                "WLC",
                local_id,
                canonical_id,
                mapping_kind,
                local_segment,
                canonical_segment,
                source_label,
            )
        )

    # Mapping targets are canonical reference anchors. Ensure they exist even
    # when WLC is ingested before an English translation.
    conn.executemany(
        """
        INSERT INTO verses (id, book_id, chapter, verse)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(id) DO NOTHING
        """,
        [(vid, *ref) for vid, ref in canonical_refs.items()],
    )
    conn.executemany(
        "DELETE FROM edition_verse_mappings WHERE translation_code = 'WLC' AND local_verse_id = ?",
        [(vid,) for vid in affected_local_ids],
    )
    conn.executemany(
        """
        INSERT INTO edition_verse_mappings
          (translation_code, local_verse_id, canonical_verse_id, mapping_kind,
           local_segment, canonical_segment, source)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        """,
        entries,
    )

    # Psalm superscriptions remain at the nominal local verse while the body
    # may also map there. Mark the retained local row honestly as a heading.
    conn.execute(
        """
        UPDATE edition_verse_mappings AS mapping
        SET mapping_kind = 'heading', source = ?
        WHERE mapping.translation_code = 'WLC'
          AND mapping.mapping_kind = 'identity'
          AND EXISTS (
            SELECT 1
            FROM edition_verse_mappings AS other
            WHERE other.translation_code = mapping.translation_code
              AND other.canonical_verse_id = mapping.canonical_verse_id
              AND other.local_verse_id <> mapping.local_verse_id
          )
        """,
        (source_label,),
    )
    return len(entries)


def backfill_identity_verse_mappings(conn: sqlite3.Connection) -> int:
    """Add explicit identity mappings for editions ingested before this schema."""
    conn.execute(
        """
        INSERT OR IGNORE INTO translation_versification
          (translation_code, scheme_code, comparison_scheme_code)
        SELECT code,
               CASE code WHEN 'WLC' THEN 'hebrew-wlc'
                         WHEN 'TR' THEN 'greek-tr'
                         ELSE ? END,
               ?
        FROM translations
        """,
        (COMPARISON_VERSIFICATION, COMPARISON_VERSIFICATION),
    )
    before = conn.execute("SELECT COUNT(*) FROM edition_verse_mappings").fetchone()[0]
    conn.execute(
        """
        INSERT OR IGNORE INTO edition_verse_mappings
          (translation_code, local_verse_id, canonical_verse_id, mapping_kind, source)
        SELECT t.translation_code, t.verse_id, t.verse_id, 'identity',
               'schema backfill: edition-local identity'
        FROM translation_text t
        WHERE NOT EXISTS (
          SELECT 1
          FROM edition_verse_mappings existing
          WHERE existing.translation_code = t.translation_code
            AND existing.local_verse_id = t.verse_id
        )
        """
    )
    after = conn.execute("SELECT COUNT(*) FROM edition_verse_mappings").fetchone()[0]
    return after - before


def prune_unreferenced_verses(conn: sqlite3.Connection) -> int:
    """Delete stale verse identities left by removed/changed source editions."""
    before = conn.execute("SELECT COUNT(*) FROM verses").fetchone()[0]
    conn.execute(
        """
        DELETE FROM verses
        WHERE NOT EXISTS (SELECT 1 FROM translation_text t WHERE t.verse_id = verses.id)
          AND NOT EXISTS (SELECT 1 FROM word_tokens w WHERE w.verse_id = verses.id)
          AND NOT EXISTS (SELECT 1 FROM verse_embeddings e WHERE e.verse_id = verses.id)
          AND NOT EXISTS (
            SELECT 1 FROM edition_verse_mappings m
            WHERE m.local_verse_id = verses.id OR m.canonical_verse_id = verses.id
          )
          AND NOT EXISTS (
            SELECT 1 FROM cross_refs c
            WHERE c.from_verse_id = verses.id OR c.to_verse_id = verses.id
          )
        """
    )
    after = conn.execute("SELECT COUNT(*) FROM verses").fetchone()[0]
    return before - after
