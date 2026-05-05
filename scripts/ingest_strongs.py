"""
Ingest Strong's Greek + Hebrew lexicons into the strongs table.

Source: openscriptures/strongs (CC-BY-SA, derived from public-domain Strong's
Exhaustive Concordance, 1890). The files are JS modules wrapping a single
JSON object — we strip the `var X = ` prefix and trailing `;` and parse.

Usage:
    python scripts/ingest_strongs.py
"""

from __future__ import annotations

import json
import re
import urllib.request

from _lib import open_corpus, ensure_schema, SOURCES_DIR

GREEK_URL = (
    "https://raw.githubusercontent.com/openscriptures/strongs/master/"
    "greek/strongs-greek-dictionary.js"
)
HEBREW_URL = (
    "https://raw.githubusercontent.com/openscriptures/strongs/master/"
    "hebrew/strongs-hebrew-dictionary.js"
)


def fetch_cached(url: str, name: str) -> str:
    SOURCES_DIR.mkdir(parents=True, exist_ok=True)
    dest = SOURCES_DIR / name
    if not dest.exists():
        print(f"Downloading {url}")
        with urllib.request.urlopen(url, timeout=120) as resp:
            dest.write_bytes(resp.read())
        print(f"Cached at {dest}")
    return dest.read_text(encoding="utf-8")


def parse_js_dict(js_text: str) -> dict:
    """The file is `var <name> = { ... }; module.exports = ...;`. Find the
    first `{` after `=` and let JSONDecoder raw-decode the dict — that
    naturally stops at the matching closing brace and ignores trailing JS."""
    start = js_text.find("=")
    brace = js_text.find("{", start)
    if start < 0 or brace < 0:
        raise ValueError("could not locate dictionary literal in JS source")
    obj, _ = json.JSONDecoder().raw_decode(js_text[brace:])
    return obj


def to_rows(d: dict):
    for code, entry in d.items():
        yield (
            code,
            entry.get("lemma") or "",
            entry.get("translit"),
            None,                              # pron — not provided
            entry.get("kjv_def"),              # short gloss
            entry.get("strongs_def"),          # long definition
        )


def main() -> None:
    greek = parse_js_dict(fetch_cached(GREEK_URL, "strongs-greek-dictionary.js"))
    hebrew = parse_js_dict(fetch_cached(HEBREW_URL, "strongs-hebrew-dictionary.js"))
    rows = list(to_rows(greek)) + list(to_rows(hebrew))
    print(f"Parsed {len(greek)} Greek + {len(hebrew)} Hebrew = {len(rows)} entries")

    conn = open_corpus()
    try:
        ensure_schema(conn)
        conn.executemany(
            "INSERT INTO strongs (code, lemma, translit, pron, gloss, definition) "
            "VALUES (?, ?, ?, ?, ?, ?) "
            "ON CONFLICT(code) DO UPDATE SET "
            "  lemma=excluded.lemma, translit=excluded.translit, pron=excluded.pron, "
            "  gloss=excluded.gloss, definition=excluded.definition",
            rows,
        )
        conn.commit()
        n = conn.execute("SELECT COUNT(*) FROM strongs").fetchone()[0]
    finally:
        conn.close()

    print(f"Stored {n} Strong's entries in corpus.sqlite")


if __name__ == "__main__":
    main()
