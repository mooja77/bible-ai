"""
Assess the Douay-Rheims Bible, Challoner Revision, for future corpus import.

Source: scrollmapper/bible_databases DRC JSON. DRC is public domain, but it
uses Vulgate/deuterocanonical versification in places where this app currently
uses a 66-book Protestant-canon verse-id model. Importing it directly would
mislink some citations, especially in Psalms, Esther, and Daniel.

This script intentionally does not write data/corpus.sqlite. Keep Douay-Rheims
as a Phase 13 corpus task until alternate versification support is implemented.

Usage:
    python scripts/ingest_drc.py
"""

from __future__ import annotations

from _lib import (
    load_json,
)

SOURCE_URL = (
    "https://raw.githubusercontent.com/scrollmapper/bible_databases/master/"
    "formats/json/DRC.json"
)


def main() -> None:
    data = load_json(SOURCE_URL, "DRC.json")
    book_names = [book["name"] for book in data.get("books", [])]
    print("Douay-Rheims source is public domain, but import is deferred.")
    print(f"Source contains {len(book_names)} books/sections.")
    print("Reason: Vulgate/deuterocanonical versification needs Phase 13 mapping.")


if __name__ == "__main__":
    main()
