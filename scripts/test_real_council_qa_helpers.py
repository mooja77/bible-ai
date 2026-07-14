"""Regression tests for the real-provider Council QA harness."""

from __future__ import annotations

import sqlite3
import unittest

import run_real_council_qa as qa


class EvidenceSelectionTests(unittest.TestCase):
    def test_chapter_comparison_includes_argument_center(self) -> None:
        connection = sqlite3.connect(qa.CORPUS_DB)
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
        connection = sqlite3.connect(qa.CORPUS_DB)
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
