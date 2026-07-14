"""Resumable, lock-verified, atomic corpus build orchestrator."""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import sqlite3
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
LOCK_PATH = DATA / "corpus-lock.json"
SCHEMA_PATH = DATA / "schema.sql"
INGEST_SCRIPTS = [
    "ingest_kjv.py",
    "ingest_asv.py",
    "ingest_web.py",
    "ingest_ylt.py",
    "ingest_wlc.py",
    "ingest_tr.py",
    "ingest_morphhb.py",
    "ingest_tsk.py",
    "ingest_strongs.py",
]


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def fingerprint(lock: dict) -> str:
    digest = hashlib.sha256()
    paths = [
        LOCK_PATH,
        SCHEMA_PATH,
        ROOT / "scripts" / "_lib.py",
        ROOT / "scripts" / "build_corpus.py",
        ROOT / "scripts" / "fetch_corpus_sources.py",
        ROOT / "scripts" / "embed_corpus.py",
        ROOT / "scripts" / "verify_corpus.py",
        *(ROOT / "scripts" / name for name in INGEST_SCRIPTS),
    ]
    for path in paths:
        digest.update(path.relative_to(ROOT).as_posix().encode("utf-8"))
        digest.update(path.read_bytes())
    digest.update(
        json.dumps(lock.get("embedding_identity"), sort_keys=True).encode("utf-8")
    )
    return digest.hexdigest()


def atomic_json(path: Path, payload: dict) -> None:
    temporary = path.with_name(f".{path.name}.{os.getpid()}.tmp")
    try:
        temporary.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
        os.replace(temporary, path)
    finally:
        temporary.unlink(missing_ok=True)


def run(command: list[str], *, env: dict[str, str] | None = None) -> None:
    print("+", " ".join(command), flush=True)
    subprocess.run(command, cwd=ROOT, env=env, check=True)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", type=Path, default=DATA / "corpus.sqlite")
    parser.add_argument("--offline", action="store_true")
    parser.add_argument(
        "--restart",
        action="store_true",
        help="discard only this orchestrator's temporary database and state",
    )
    parser.add_argument("--plan", action="store_true", help="print the deterministic steps")
    parser.add_argument(
        "--stop-after",
        help="stop after a named checkpoint without promoting (useful for audited partial runs)",
    )
    args = parser.parse_args()

    output = args.output.resolve()
    work = output.with_name(f".{output.name}.building")
    state_path = output.with_name(f".{output.name}.build-state.json")
    lock = json.loads(LOCK_PATH.read_text(encoding="utf-8"))
    identity = lock["embedding_identity"]
    steps: list[tuple[str, list[str]]] = [
        (
            "fetch",
            [
                sys.executable,
                "scripts/fetch_corpus_sources.py",
                *(["--offline"] if args.offline else []),
            ],
        ),
        ("verify-sources", [sys.executable, "scripts/verify_corpus_lock.py"]),
        *[
            (name.removesuffix(".py"), [sys.executable, f"scripts/{name}"])
            for name in INGEST_SCRIPTS
        ],
        *[
            (
                f"embed-{code}",
                [
                    sys.executable,
                    "scripts/embed_corpus.py",
                    "--translation",
                    code,
                    "--model",
                    identity["model"],
                ],
            )
            for code in lock["required_embedding_translations"]
        ],
        ("verify-corpus", [sys.executable, "scripts/verify_corpus.py"]),
    ]
    if args.plan:
        print(json.dumps({"output": str(output), "work": str(work), "steps": steps}, indent=2))
        return

    if args.restart:
        work.unlink(missing_ok=True)
        state_path.unlink(missing_ok=True)
    if work.exists() and not state_path.exists():
        raise SystemExit(
            "Incomplete build state is ambiguous; inspect it, then pass --restart to discard it."
        )
    build_fingerprint = fingerprint(lock)
    state = (
        json.loads(state_path.read_text(encoding="utf-8"))
        if state_path.exists()
        else {"fingerprint": build_fingerprint, "completed": []}
    )
    if state["fingerprint"] != build_fingerprint:
        raise SystemExit("Build inputs changed; pass --restart to start a clean temporary database.")
    completed = set(state["completed"])
    if state_path.exists() and not work.exists() and any(
        name not in {"fetch", "verify-sources"} for name in completed
    ):
        raise SystemExit(
            "Build database is missing after ingestion began; pass --restart to start cleanly."
        )
    if args.stop_after and args.stop_after not in {name for name, _ in steps}:
        raise SystemExit(f"Unknown --stop-after checkpoint: {args.stop_after}")
    env = os.environ.copy()
    env["BIBLE_AI_CORPUS_DB"] = str(work)

    for name, command in steps:
        if name in completed:
            print(f"reuse completed step: {name}")
            continue
        if name not in {"fetch", "verify-sources"} and not work.exists():
            work.parent.mkdir(parents=True, exist_ok=True)
        run(command, env=env)
        completed.add(name)
        state["completed"] = [step_name for step_name, _ in steps if step_name in completed]
        atomic_json(state_path, state)
        if args.stop_after == name:
            print(f"Stopped at verified checkpoint: {name}")
            return

    connection = sqlite3.connect(work)
    try:
        connection.execute("PRAGMA optimize")
        connection.execute("VACUUM")
        connection.commit()
        quick_check = connection.execute("PRAGMA quick_check").fetchone()[0]
        if quick_check != "ok":
            raise RuntimeError(f"final SQLite quick_check failed: {quick_check}")
    finally:
        connection.close()
    output.parent.mkdir(parents=True, exist_ok=True)
    os.replace(work, output)
    state_path.unlink(missing_ok=True)
    print(
        json.dumps(
            {
                "promoted": str(output),
                "bytes": output.stat().st_size,
                "sha256": sha256_file(output),
                "fingerprint": build_fingerprint,
            },
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
