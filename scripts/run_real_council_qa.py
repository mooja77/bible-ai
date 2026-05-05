"""
Run non-mock Council QA against the local corpus and configured providers.

The script retrieves candidate evidence from data/corpus.sqlite, sends each
question to the Node sidecar with BIBLE_AI_MOCK_COUNCIL removed, and saves full
structured results for audit and future fixtures.

Usage:
    python scripts/run_real_council_qa.py --limit 20
    python scripts/run_real_council_qa.py --limit 30 --model sonnet
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sqlite3
import subprocess
import sys
import time
from pathlib import Path
from typing import Any

SCRIPT_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(SCRIPT_DIR))
from _lib import BOOKS, PROTESTANT_CHAPTER_COUNTS

ROOT = Path(__file__).resolve().parents[1]
CORPUS_DB = ROOT / "data" / "corpus.sqlite"
SIDECAR = ROOT / "app" / "sidecar" / "index.mjs"
DEFAULT_OUT = ROOT / "app" / "tests" / "fixtures" / "council-real-results.json"
DEFAULT_WEAK_OUT = ROOT / "app" / "tests" / "fixtures" / "council-real-weak-results.json"
RUN_LEVEL_FLAGS = {"limited_provider_coverage"}

QUESTION_BANK = [
    "How should Romans 9 be weighed in debates about election?",
    "How should James 2 and Romans 4 be compared?",
    "What does 1 Timothy 2 imply about church leadership?",
    "How should 1 Corinthians 11 be interpreted today?",
    "What is the strongest biblical case for and against infant baptism?",
    "What is the strongest biblical case for and against believer's baptism?",
    "How should Hebrews 6 be understood in perseverance debates?",
    "How should Hebrews 10 be understood in perseverance debates?",
    "What does the New Testament teach about divorce and remarriage?",
    "What is the relationship between Israel and the church?",
    "How should Revelation 20 be interpreted across millennial views?",
    "What does Scripture teach about spiritual gifts continuing?",
    "How should Genesis 1 be read in relation to creation timing?",
    "What is the biblical basis for the Trinity?",
    "How should John 6 be weighed in Eucharistic debates?",
    "How should Acts 2:38 be interpreted?",
    "What is the biblical case for church discipline?",
    "How should Romans 13 be applied to unjust governments?",
    "What does Scripture teach about assurance of salvation?",
    "How should the Sermon on the Mount relate to Christian ethics?",
    "What is the biblical case for congregational, presbyterian, and episcopal polity?",
    "How should women prophesying in 1 Corinthians 11 relate to 1 Timothy 2?",
    "What is the relationship between faith, repentance, and works?",
    "What does Scripture teach about hell and final judgment?",
    "How should Old Testament law apply to Christians?",
    "What is the biblical case for Sabbath continuity or discontinuity?",
    "How should the household codes be interpreted today?",
    "What is the role of tradition in biblical interpretation?",
    "How should disputed passages be handled when manuscript evidence is mixed?",
    "What does Scripture teach about the deuterocanonical books, if anything?",
]

STOPWORDS = {
    "about", "again", "against", "among", "and", "are", "biblical", "case",
    "christian", "debates", "does", "for", "from", "have", "how", "into",
    "its", "new", "old", "should", "strongest", "teach", "text", "that",
    "the", "their", "them", "there", "this", "through", "today", "what",
    "when", "where", "which", "with",
}


def question_terms(question: str) -> list[str]:
    terms = []
    for token in re.findall(r"[A-Za-z][A-Za-z0-9']+", question.lower()):
        token = token.strip("'")
        if len(token) < 4 or token in STOPWORDS:
            continue
        if token.endswith("s") and len(token) > 5:
            token = token[:-1]
        if token not in terms:
            terms.append(token)
    return terms[:12]


def retrieve_evidence(conn: sqlite3.Connection, question: str, limit: int) -> list[dict[str, Any]]:
    evidence = explicit_reference_evidence(conn, question, limit)
    seen = {row["verse_id"] for row in evidence}
    terms = question_terms(question)
    if not terms:
        terms = ["faith", "works", "law", "grace"]
    match_query = " OR ".join(f'"{term}"' for term in terms)
    rows = conn.execute(
        """
        SELECT f.verse_id, f.translation_code, v.book_id, b.name, b.osis_code,
               v.chapter, v.verse, f.text, bm25(translation_text_fts) AS rank
        FROM translation_text_fts f
        JOIN verses v ON v.id = f.verse_id
        JOIN books b ON b.id = v.book_id
        WHERE translation_text_fts MATCH ?
          AND f.translation_code IN ('KJV', 'WEB', 'ASV')
        ORDER BY rank
        LIMIT ?
        """,
        (match_query, limit),
    ).fetchall()
    for row in rows:
        if len(evidence) >= limit:
            break
        if row[0] in seen:
            continue
        seen.add(row[0])
        evidence.append(
            {
                "verse_id": row[0],
                "translation_code": row[1],
                "book_id": row[2],
                "book_name": row[3],
                "book_osis": row[4],
                "chapter": row[5],
                "verse": row[6],
                "text": row[7],
                "source": "qa-fts",
                "keyword_score": abs(float(row[8] or 0)),
                "matched_terms": terms,
            }
        )
    return evidence


def explicit_reference_evidence(
    conn: sqlite3.Connection,
    question: str,
    limit: int,
    translation: str = "KJV",
) -> list[dict[str, Any]]:
    rows = []
    seen = set()
    for book_id, book_osis, book_name, _testament, _canonical_order in BOOKS:
        chapter_count = PROTESTANT_CHAPTER_COUNTS[book_id]
        aliases = [book_name, book_osis]
        aliases.extend(short_aliases(book_name))
        for alias in aliases:
            pattern = re.compile(
                rf"(?<![A-Za-z0-9]){re.escape(alias)}\.?\s+(\d+)(?::(\d+)(?:-(?:(\d+):)?(\d+))?)?",
                re.IGNORECASE,
            )
            for match in pattern.finditer(question):
                chapter = int(match.group(1))
                if chapter < 1 or chapter > chapter_count:
                    continue
                start_verse = int(match.group(2) or "1")
                end_chapter = int(match.group(3) or chapter)
                end_verse = int(match.group(4) or (match.group(2) or "999"))
                start_id = book_id * 1_000_000 + chapter * 1000 + start_verse
                end_id = book_id * 1_000_000 + end_chapter * 1000 + end_verse
                if (start_id, end_id) in seen:
                    continue
                seen.add((start_id, end_id))
                for row in conn.execute(
                    """
                    SELECT v.id, t.translation_code, v.book_id, b.name, b.osis_code,
                           v.chapter, v.verse, t.text
                    FROM verses v
                    JOIN books b ON b.id = v.book_id
                    JOIN translation_text t ON t.verse_id = v.id
                    WHERE t.translation_code = ?1 AND v.id >= ?2 AND v.id <= ?3
                    ORDER BY v.id
                    LIMIT ?4
                    """,
                    (translation, start_id, end_id, limit - len(rows)),
                ):
                    rows.append(
                        {
                            "verse_id": row[0],
                            "translation_code": row[1],
                            "book_id": row[2],
                            "book_name": row[3],
                            "book_osis": row[4],
                            "chapter": row[5],
                            "verse": row[6],
                            "text": row[7],
                            "source": "explicit-reference",
                            "matched_terms": [alias.lower()],
                        }
                    )
                    if len(rows) >= limit:
                        return rows
    return rows


def short_aliases(book_name: str) -> list[str]:
    return {
        "1 Timothy": ["1 Tim"],
        "2 Timothy": ["2 Tim"],
        "1 Corinthians": ["1 Cor"],
        "2 Corinthians": ["2 Cor"],
        "1 Thessalonians": ["1 Thess"],
        "2 Thessalonians": ["2 Thess"],
        "1 Peter": ["1 Pet"],
        "2 Peter": ["2 Pet"],
        "1 John": ["1 Jn"],
        "2 John": ["2 Jn"],
        "3 John": ["3 Jn"],
    }.get(book_name, [])


def send_sidecar(proc: subprocess.Popen[str], payload: dict[str, Any]) -> dict[str, Any]:
    assert proc.stdin is not None
    assert proc.stdout is not None
    proc.stdin.write(json.dumps(payload, ensure_ascii=False) + "\n")
    proc.stdin.flush()
    line = proc.stdout.readline()
    if not line:
        raise RuntimeError("sidecar closed stdout")
    message = json.loads(line)
    if message.get("type") == "error":
        raise RuntimeError(message.get("error", "unknown sidecar error"))
    return message["result"]


def diagnostics(proc: subprocess.Popen[str], model: str) -> dict[str, Any]:
    return send_sidecar(
        proc,
        {
            "id": "diagnostics",
            "type": "diagnostics",
            "settings": {},
            "model": model,
        },
    )


def run_question(
    proc: subprocess.Popen[str],
    question: str,
    evidence: list[dict[str, Any]],
    model: str,
    index: int,
) -> dict[str, Any]:
    started = time.time()
    result = send_sidecar(
        proc,
        {
            "id": f"qa-{index}",
            "type": "council",
            "question": question,
            "evidence": evidence,
            "model": model,
            "settings": {},
        },
    )
    return {
        "slug": slugify(question),
        "question": question,
        "captured_at": iso_now(),
        "duration_ms": round((time.time() - started) * 1000),
        "evidence": evidence,
        "response": result,
        "weakness_flags": weakness_flags(result),
    }


def weakness_flags(response: dict[str, Any]) -> list[str]:
    flags = []
    manifest = response.get("manifest") or []
    voices = response.get("voices") or []
    ok_voices = [voice for voice in voices if voice.get("status") == "ok"]
    if len([provider for provider in manifest if provider.get("available")]) < 2:
        flags.append("limited_provider_coverage")
    if any(voice.get("status") == "error" for voice in voices):
        flags.append("provider_failure")
    synthesis = response.get("synthesis") or {}
    positions = synthesis.get("positions") or []
    if len(positions) < 2:
        flags.append("single_position")
    if synthesis.get("confidence") == "high" and len(ok_voices) < 2:
        flags.append("possible_overconfidence")
    if not synthesis.get("confidence_rationale"):
        flags.append("missing_confidence_rationale")
    if not synthesis.get("evidence_classification"):
        flags.append("missing_evidence_classification")
    for position in positions:
        if not position.get("why_not_higher"):
            flags.append("missing_why_not_higher")
            break
    if any(not (position.get("evidence") or []) for position in positions):
        flags.append("position_without_cited_evidence")
    return sorted(set(flags))


def has_output_weakness(result: dict[str, Any]) -> bool:
    return any(flag not in RUN_LEVEL_FLAGS for flag in result.get("weakness_flags", []))


def slugify(value: str) -> str:
    return re.sub(r"(^-|-$)", "", re.sub(r"[^a-z0-9]+", "-", value.lower()))[:80]


def iso_now() -> str:
    return time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())


def write_json(path: Path, payload: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def build_payload(
    *,
    model: str,
    diag: dict[str, Any],
    results: list[dict[str, Any]],
    errors: list[dict[str, Any]],
    complete: bool,
) -> dict[str, Any]:
    return {
        "captured_at": iso_now(),
        "complete": complete,
        "mock_mode": False,
        "model": model,
        "question_count": len(results),
        "run_warnings": sorted(
            {
                flag
                for result in results
                for flag in result.get("weakness_flags", [])
                if flag in RUN_LEVEL_FLAGS
            }
        ),
        "provider_diagnostics": diag,
        "results": results,
        "errors": errors,
    }


def weak_payload(payload: dict[str, Any]) -> dict[str, Any]:
    weak_results = [
        result for result in payload["results"] if has_output_weakness(result)
    ]
    return {
        **payload,
        "question_count": len(weak_results),
        "results": weak_results,
    }


def write_run_outputs(
    out: Path,
    weak_out: Path,
    *,
    model: str,
    diag: dict[str, Any],
    results: list[dict[str, Any]],
    errors: list[dict[str, Any]],
    complete: bool,
) -> None:
    payload = build_payload(
        model=model,
        diag=diag,
        results=results,
        errors=errors,
        complete=complete,
    )
    write_json(out, payload)
    write_json(weak_out, weak_payload(payload))


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--limit", type=int, default=20, choices=range(1, 31))
    parser.add_argument("--evidence-limit", type=int, default=36)
    parser.add_argument("--model", default="sonnet")
    parser.add_argument("--out", type=Path, default=DEFAULT_OUT)
    parser.add_argument("--weak-out", type=Path, default=DEFAULT_WEAK_OUT)
    parser.add_argument("--continue-on-error", action="store_true")
    args = parser.parse_args()

    env = os.environ.copy()
    env.pop("BIBLE_AI_MOCK_COUNCIL", None)
    log_path = ROOT / "app" / "tests" / "fixtures" / "council-real-qa-sidecar.log"
    log_path.parent.mkdir(parents=True, exist_ok=True)
    log_file = log_path.open("w", encoding="utf-8")
    proc = subprocess.Popen(
        ["node", str(SIDECAR)],
        cwd=str(ROOT),
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        stderr=log_file,
        text=True,
        encoding="utf-8",
        env=env,
    )
    conn = sqlite3.connect(CORPUS_DB)
    results = []
    errors = []
    diag: dict[str, Any] = {}
    try:
        diag = diagnostics(proc, args.model)
        available = [p for p in diag.get("providers", []) if p.get("available")]
        print("Available providers:", ", ".join(p["name"] for p in available) or "none")
        if not available:
            raise RuntimeError("No non-mock providers available")

        for index, question in enumerate(QUESTION_BANK[: args.limit], start=1):
            evidence = retrieve_evidence(conn, question, args.evidence_limit)
            print(f"[{index}/{args.limit}] {question} ({len(evidence)} evidence rows)")
            try:
                results.append(run_question(proc, question, evidence, args.model, index))
                write_run_outputs(
                    args.out,
                    args.weak_out,
                    model=args.model,
                    diag=diag,
                    results=results,
                    errors=errors,
                    complete=False,
                )
            except Exception as exc:
                errors.append({"question": question, "error": str(exc), "captured_at": iso_now()})
                print(f"  failed: {exc}", file=sys.stderr)
                write_run_outputs(
                    args.out,
                    args.weak_out,
                    model=args.model,
                    diag=diag,
                    results=results,
                    errors=errors,
                    complete=False,
                )
                if not args.continue_on_error:
                    raise
    finally:
        conn.close()
        if proc.stdin:
            proc.stdin.close()
        proc.terminate()
        log_file.close()

    write_run_outputs(
        args.out,
        args.weak_out,
        model=args.model,
        diag=diag,
        results=results,
        errors=errors,
        complete=True,
    )
    print(f"Wrote {args.out}")
    print(f"Wrote {args.weak_out}")
    if errors:
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
