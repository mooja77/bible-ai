"""Regression tests for the real-provider Council QA harness."""

from __future__ import annotations

import sqlite3
import unittest

import run_real_council_qa as qa


def build_test_corpus() -> sqlite3.Connection:
    """Create the smallest deterministic corpus needed by retrieval tests."""
    connection = sqlite3.connect(":memory:")
    connection.executescript(
        """
        CREATE TABLE books (
          id INTEGER PRIMARY KEY,
          name TEXT NOT NULL,
          osis_code TEXT NOT NULL
        );
        CREATE TABLE verses (
          id INTEGER PRIMARY KEY,
          book_id INTEGER NOT NULL,
          chapter INTEGER NOT NULL,
          verse INTEGER NOT NULL
        );
        CREATE TABLE translation_text (
          translation_code TEXT NOT NULL,
          verse_id INTEGER NOT NULL,
          text TEXT NOT NULL
        );
        CREATE VIRTUAL TABLE translation_text_fts USING fts5(
          text,
          translation_code UNINDEXED,
          verse_id UNINDEXED
        );
        """
    )
    books = {
        40: ("Matthew", "Matt"),
        42: ("Luke", "Luke"),
        45: ("Romans", "Rom"),
        59: ("James", "Jas"),
    }
    connection.executemany(
        "INSERT INTO books (id, name, osis_code) VALUES (?, ?, ?)",
        [(book_id, name, osis) for book_id, (name, osis) in books.items()],
    )

    references: set[tuple[int, int, int]] = set()

    def add_range(book_id: int, chapter: int, start: int, end: int) -> None:
        references.update((book_id, chapter, verse) for verse in range(start, end + 1))

    add_range(59, 2, 1, 26)
    add_range(45, 4, 1, 25)
    add_range(40, 5, 17, 20)
    add_range(40, 5, 38, 48)
    add_range(40, 6, 33, 33)
    add_range(40, 7, 12, 12)
    add_range(40, 7, 21, 27)
    add_range(42, 6, 27, 36)
    add_range(45, 12, 1, 21)
    add_range(59, 1, 22, 27)

    verse_rows = []
    text_rows = []
    fts_rows = []
    for book_id, chapter, verse in sorted(references):
        verse_id = book_id * 1_000_000 + chapter * 1000 + verse
        text = f"Fixture text for {books[book_id][0]} {chapter}:{verse}."
        verse_rows.append((verse_id, book_id, chapter, verse))
        text_rows.append(("KJV", verse_id, text))
        fts_rows.append((text, "KJV", verse_id))
    connection.executemany(
        "INSERT INTO verses (id, book_id, chapter, verse) VALUES (?, ?, ?, ?)",
        verse_rows,
    )
    connection.executemany(
        "INSERT INTO translation_text (translation_code, verse_id, text) VALUES (?, ?, ?)",
        text_rows,
    )
    connection.executemany(
        "INSERT INTO translation_text_fts (text, translation_code, verse_id) VALUES (?, ?, ?)",
        fts_rows,
    )
    return connection


class EvidenceSelectionTests(unittest.TestCase):
    def test_chapter_comparison_includes_argument_center(self) -> None:
        connection = build_test_corpus()
        try:
            evidence = qa.retrieve_evidence(
                connection,
                "How should James 2 and Romans 4 be compared?",
                24,
            )
        finally:
            connection.close()

        ids = {row["verse_id"] for row in evidence}
        self.assertIn(59_002_024, ids, "James 2:24 must be available to the Council")
        self.assertIn(45_004_003, ids, "Romans 4:3 must be available to the Council")
        self.assertLessEqual(len(evidence), 24)

    def test_sermon_question_retrieves_primary_and_parallel_ethics_texts(self) -> None:
        connection = build_test_corpus()
        try:
            evidence = qa.retrieve_evidence(
                connection,
                "How should the Sermon on the Mount relate to Christian ethics?",
                24,
            )
        finally:
            connection.close()

        ids = {row["verse_id"] for row in evidence}
        self.assertIn(40_005_017, ids, "Matthew 5:17 must anchor the primary discourse")
        self.assertIn(40_007_021, ids, "Matthew 7:21 must represent doing Jesus' teaching")
        self.assertIn(42_006_027, ids, "Luke 6:27 must provide the close Synoptic parallel")
        self.assertIn(45_012_001, ids, "Romans 12:1 must provide apostolic ethics context")
        self.assertIn(59_001_022, ids, "James 1:22 must represent hearing and doing")
        self.assertLessEqual(len(evidence), 24)


class WeaknessClassificationTests(unittest.TestCase):
    def test_failed_grounding_is_an_output_weakness(self) -> None:
        response = {
            "manifest": [{"available": True}, {"available": True}],
            "voices": [{"status": "ok"}, {"status": "ok"}],
            "synthesis": {
                "positions": [
                    {"why_not_higher": "x", "evidence": [{"verse_id": 1}]},
                    {"why_not_higher": "y", "evidence": [{"verse_id": 2}]},
                ],
                "confidence": "contested",
                "confidence_rationale": "mixed evidence",
                "evidence_classification": "textual",
            },
            "grounding": {"hard_fail": True, "verification_status": "failed"},
            "scope": {"available": True, "parsed": True},
            "judge": {"available": True, "parsed": True},
            "soft_layer": {"available": True},
            "kill_test": {"available": True, "parsed": True},
        }

        flags = qa.weakness_flags(response)
        self.assertIn("grounding_failure", flags)
        self.assertTrue(qa.has_output_weakness({"weakness_flags": flags}))


if __name__ == "__main__":
    unittest.main()
