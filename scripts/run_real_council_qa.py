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
import ctypes
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
CREDENTIAL_SERVICE = "Bible AI"
CREDENTIAL_ENV_KEYS = {
    "google_api_key": "GOOGLE_API_KEY",
    "openai_api_key": "OPENAI_API_KEY",
    "anthropic_api_key": "ANTHROPIC_API_KEY",
    "managed_gateway_token": "MANAGED_GATEWAY_TOKEN",
}

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

TOPICAL_REFERENCE_SEEDS = [
    {
        "keywords": ["trinity", "triune"],
        "references": (
            "Matthew 28:19; John 1:1-3; John 1:14; John 10:30; "
            "John 14:16-17; 2 Corinthians 13:14; Colossians 2:9; "
            "Acts 5:3-4; Hebrews 1:3"
        ),
    },
    {
        "keywords": ["eucharist", "eucharistic", "john 6"],
        "references": "John 6:51-58",
    },
    {
        "keywords": ["assurance", "security", "perseverance"],
        "references": (
            "John 10:27-30; Romans 8:31-39; Philippians 1:6; "
            "1 John 5:11-13; Hebrews 6:4-6; Hebrews 10:26-31; 2 Peter 1:10"
        ),
    },
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
    # A whole named chapter can be longer than the complete evidence budget.
    # Reserve one third for topical seeds and FTS so "John 6" does not yield
    # only verses 1–24 while starving the disputed 51–58 section.
    explicit_limit = min(limit, max(1, (limit * 2) // 3))
    evidence = explicit_reference_evidence(conn, question, explicit_limit)
    seen = {row["verse_id"] for row in evidence}
    for row in topical_reference_evidence(conn, question, limit):
        if len(evidence) >= limit:
            break
        if row["verse_id"] in seen:
            continue
        seen.add(row["verse_id"])
        evidence.append(row)
    # If topical seeds did not use the reserved capacity, give it back to the
    # explicit passages before falling through to noisier keyword retrieval.
    for row in explicit_reference_evidence(conn, question, limit):
        if len(evidence) >= limit:
            break
        if row["verse_id"] in seen:
            continue
        seen.add(row["verse_id"])
        evidence.append(row)
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


def topical_reference_evidence(
    conn: sqlite3.Connection,
    question: str,
    limit: int,
    translation: str = "KJV",
) -> list[dict[str, Any]]:
    lowered = question.lower()
    rows = []
    for seed in TOPICAL_REFERENCE_SEEDS:
        if not any(keyword in lowered for keyword in seed["keywords"]):
            continue
        for row in explicit_reference_evidence(
            conn,
            seed["references"],
            limit - len(rows),
            translation,
        ):
            row["source"] = "qa-topical-reference"
            row["matched_terms"] = seed["keywords"]
            rows.append(row)
            if len(rows) >= limit:
                return rows
    return rows


def explicit_reference_evidence(
    conn: sqlite3.Connection,
    question: str,
    limit: int,
    translation: str = "KJV",
) -> list[dict[str, Any]]:
    ranges: list[tuple[int, int, int, str]] = []
    seen_ranges = set()
    for book_id, book_osis, book_name, _testament, _canonical_order in BOOKS:
        chapter_count = PROTESTANT_CHAPTER_COUNTS[book_id]
        aliases = [book_name, book_osis]
        aliases.extend(short_aliases(book_name))
        for alias in aliases:
            pattern = re.compile(
                rf"(?<![A-Za-z0-9])(?<![1-3] ){re.escape(alias)}\.?\s+(\d+)(?::(\d+)(?:-(?:(\d+):)?(\d+))?)?",
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
                if (start_id, end_id) in seen_ranges:
                    continue
                seen_ranges.add((start_id, end_id))
                ranges.append((match.start(), start_id, end_id, alias.lower()))

    # Preserve the question's reference order and interleave ranges. Without
    # this, canonical-book iteration lets the first retrieved chapter consume
    # the whole limit (for example Romans 4 before James 2), defeating the
    # release verifier's primary-passage coverage check.
    ranges.sort(key=lambda item: item[0])
    range_rows: list[list[sqlite3.Row | tuple[Any, ...]]] = []
    range_aliases: list[str] = []
    for _position, start_id, end_id, alias in ranges:
        range_rows.append(
            conn.execute(
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
                (translation, start_id, end_id, limit),
            ).fetchall()
        )
        range_aliases.append(alias)

    rows = []
    seen_verses = set()
    offset = 0
    while len(rows) < limit:
        added = False
        for candidates, alias in zip(range_rows, range_aliases):
            if offset >= len(candidates):
                continue
            row = candidates[offset]
            if row[0] in seen_verses:
                continue
            seen_verses.add(row[0])
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
                    "matched_terms": [alias],
                }
            )
            added = True
            if len(rows) >= limit:
                break
        if not added:
            break
        offset += 1
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
    request_id = payload.get("id")
    proc.stdin.write(json.dumps(payload, ensure_ascii=False) + "\n")
    proc.stdin.flush()
    while True:
        line = proc.stdout.readline()
        if not line:
            raise RuntimeError("sidecar closed stdout")
        message = json.loads(line)
        if message.get("id") != request_id:
            raise RuntimeError(
                f"sidecar response id mismatch: expected {request_id!r}, "
                f"received {message.get('id')!r}"
            )
        if message.get("type") == "council_progress":
            continue
        if message.get("type") == "error":
            raise RuntimeError(message.get("error", "unknown sidecar error"))
        if "result" not in message:
            raise RuntimeError(
                f"sidecar terminal response omitted result: {message.get('type')!r}"
            )
        return message["result"]


def terminate_process_tree(proc: subprocess.Popen[str]) -> None:
    if proc.poll() is not None:
        return
    if os.name == "nt":
        subprocess.run(
            ["taskkill", "/PID", str(proc.pid), "/T", "/F"],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            check=False,
        )
    else:
        proc.terminate()
    try:
        proc.wait(timeout=5)
    except subprocess.TimeoutExpired:
        proc.kill()


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


def reusable_verified_result(result: dict[str, Any]) -> bool:
    """Return true only for a persisted result that already meets local trust checks."""
    if has_output_weakness(result):
        return False
    response = result.get("response") or {}
    required_stages = {"grounding", "scope", "judge", "independence", "soft_layer", "kill_test"}
    if not required_stages.issubset(response):
        return False
    grounding = response.get("grounding") or {}
    if (
        grounding.get("hard_fail") is not False
        or grounding.get("verification_status") != "verified"
        or not (grounding.get("cited_count", 0) > 0)
    ):
        return False

    evidence = result.get("evidence") or response.get("retrieved_evidence") or []
    evidence_by_id = {int(row.get("verse_id", 0)): row for row in evidence}
    positions = (response.get("synthesis") or {}).get("positions") or []
    if not positions:
        return False
    for position in positions:
        citations = position.get("evidence") or []
        if not citations:
            return False
        for citation in citations:
            row = evidence_by_id.get(int(citation.get("verse_id", 0)))
            if not row or citation.get("quote") != row.get("text"):
                return False
    return True


def slugify(value: str) -> str:
    return re.sub(r"(^-|-$)", "", re.sub(r"[^a-z0-9]+", "-", value.lower()))[:80]


def iso_now() -> str:
    return time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())


def write_json(path: Path, payload: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


class FILETIME(ctypes.Structure):
    _fields_ = [("dwLowDateTime", ctypes.c_uint32), ("dwHighDateTime", ctypes.c_uint32)]


class CREDENTIALW(ctypes.Structure):
    _fields_ = [
        ("Flags", ctypes.c_uint32),
        ("Type", ctypes.c_uint32),
        ("TargetName", ctypes.c_wchar_p),
        ("Comment", ctypes.c_wchar_p),
        ("LastWritten", FILETIME),
        ("CredentialBlobSize", ctypes.c_uint32),
        ("CredentialBlob", ctypes.POINTER(ctypes.c_ubyte)),
        ("Persist", ctypes.c_uint32),
        ("AttributeCount", ctypes.c_uint32),
        ("Attributes", ctypes.c_void_p),
        ("TargetAlias", ctypes.c_wchar_p),
        ("UserName", ctypes.c_wchar_p),
    ]


def read_windows_credential(target: str) -> str | None:
    if os.name != "nt":
        return None
    credential_ptr = ctypes.POINTER(CREDENTIALW)()
    ok = ctypes.windll.advapi32.CredReadW(
        ctypes.c_wchar_p(target),
        ctypes.c_uint32(1),  # CRED_TYPE_GENERIC
        ctypes.c_uint32(0),
        ctypes.byref(credential_ptr),
    )
    if not ok:
        return None
    try:
        credential = credential_ptr.contents
        blob_size = int(credential.CredentialBlobSize or 0)
        if blob_size <= 0:
            return None
        blob = ctypes.string_at(credential.CredentialBlob, blob_size)
        value = blob.decode("utf-16-le").strip()
        return value or None
    finally:
        ctypes.windll.advapi32.CredFree(credential_ptr)


def apply_credential_vault_env(env: dict[str, str], enabled: bool) -> list[str]:
    if not enabled or os.name != "nt":
        return []
    loaded = []
    for credential_name, env_key in CREDENTIAL_ENV_KEYS.items():
        if env.get(env_key):
            continue
        value = read_windows_credential(f"{credential_name}.{CREDENTIAL_SERVICE}")
        if value:
            env[env_key] = value
            loaded.append(env_key)
    return loaded


def restrict_provider_env(env: dict[str, str], providers: str | None) -> list[str]:
    if not providers:
        return []
    allowed = {provider.strip().lower() for provider in providers.split(",") if provider.strip()}
    valid = {"claude", "openai", "gemini", "gateway"}
    unknown = sorted(allowed - valid)
    if unknown:
        raise ValueError(f"Unknown provider(s): {', '.join(unknown)}")
    disabled = []
    if "claude" not in allowed:
        env["DISABLE_CLAUDE_VOICE"] = "1"
        env.pop("ANTHROPIC_API_KEY", None)
        disabled.append("claude")
    if "openai" not in allowed:
        env.pop("OPENAI_API_KEY", None)
        disabled.append("openai")
    if "gemini" not in allowed:
        env.pop("GOOGLE_API_KEY", None)
        disabled.append("gemini")
    if "gateway" not in allowed:
        env.pop("MANAGED_GATEWAY_URL", None)
        env.pop("MANAGED_GATEWAY_TOKEN", None)
        disabled.append("gateway")
    return disabled


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
    parser.add_argument("--start", type=int, default=1, choices=range(1, 31))
    parser.add_argument("--evidence-limit", type=int, default=36)
    parser.add_argument("--model", default="sonnet")
    parser.add_argument("--out", type=Path, default=DEFAULT_OUT)
    parser.add_argument("--weak-out", type=Path, default=DEFAULT_WEAK_OUT)
    parser.add_argument("--continue-on-error", action="store_true")
    parser.add_argument(
        "--resume",
        action="store_true",
        help=(
            "Reuse only already-verified results from --out and rerun the remaining "
            "selected questions. Provider/model diagnostics must match."
        ),
    )
    parser.add_argument(
        "--no-credential-vault",
        action="store_true",
        help="Do not load provider credentials from the Windows Credential Manager.",
    )
    parser.add_argument(
        "--providers",
        help="Comma-separated provider allowlist for this QA run, e.g. claude,openai.",
    )
    parser.add_argument(
        "--claude-code",
        action="store_true",
        help="Ignore ANTHROPIC_API_KEY for this run and use the local Claude Code login for the Claude voice.",
    )
    args = parser.parse_args()

    env = os.environ.copy()
    env.pop("BIBLE_AI_MOCK_COUNCIL", None)
    loaded_credentials = apply_credential_vault_env(env, not args.no_credential_vault)
    if loaded_credentials:
        print(
            "Loaded provider credential flags from Windows Credential Manager:",
            ", ".join(loaded_credentials),
        )
    if args.claude_code:
        env.pop("ANTHROPIC_API_KEY", None)
        print("Claude voice will use local Claude Code login for this run.")
    disabled_providers = restrict_provider_env(env, args.providers)
    if disabled_providers:
        print("Provider allowlist active; disabled:", ", ".join(disabled_providers))
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

        selected_questions = QUESTION_BANK[args.start - 1 : args.start - 1 + args.limit]
        reusable_by_question: dict[str, dict[str, Any]] = {}
        if args.resume and args.out.exists():
            existing = json.loads(args.out.read_text(encoding="utf-8"))
            existing_available = sorted(
                provider.get("display_name")
                for provider in (existing.get("provider_diagnostics") or {}).get("providers", [])
                if provider.get("available")
            )
            current_available = sorted(provider.get("display_name") for provider in available)
            if existing.get("model") != args.model or existing_available != current_available:
                raise RuntimeError(
                    "Cannot resume: saved model/provider diagnostics do not match this run"
                )
            reusable_by_question = {
                result.get("question"): result
                for result in existing.get("results", [])
                if result.get("question") in selected_questions and reusable_verified_result(result)
            }
            print(
                f"Resume accepted {len(reusable_by_question)}/{len(selected_questions)} "
                "already-verified result(s)."
            )

        for offset, question in enumerate(selected_questions, start=0):
            index = args.start + offset
            if question in reusable_by_question:
                print(f"[{index}/{len(QUESTION_BANK)}] reuse verified: {question}")
                results.append(reusable_by_question[question])
                continue
            evidence = retrieve_evidence(conn, question, args.evidence_limit)
            print(f"[{index}/{len(QUESTION_BANK)}] {question} ({len(evidence)} evidence rows)")
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
        terminate_process_tree(proc)
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
