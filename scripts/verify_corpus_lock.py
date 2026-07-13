"""Verify cached corpus inputs against data/corpus-lock.json."""

from __future__ import annotations

import hashlib
import json
import argparse
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
LOCK_PATH = ROOT / "data" / "corpus-lock.json"


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--metadata-only",
        action="store_true",
        help="validate the committed lock structure without requiring ignored source artifacts",
    )
    args = parser.parse_args()
    lock = json.loads(LOCK_PATH.read_text(encoding="utf-8"))
    failures: list[str] = []
    checked = 0

    if lock.get("format_version") != 1:
        failures.append("format_version must be 1")
    artifacts = lock.get("artifacts", [])
    ids = [artifact.get("id") for artifact in artifacts]
    if not artifacts:
        failures.append("artifacts must not be empty")
    if len(ids) != len(set(ids)):
        failures.append("artifact ids must be unique")

    for artifact in artifacts:
        artifact_id = artifact.get("id", "(unnamed)")
        for field in ("version", "source_url", "license", "attribution", "bytes"):
            if not artifact.get(field):
                failures.append(f"{artifact_id}: missing {field}")
        checksum = artifact.get("sha256") or artifact.get("aggregate_sha256")
        if not isinstance(checksum, str) or len(checksum) != 64:
            failures.append(f"{artifact_id}: checksum must be a 64-character sha256")

    if args.metadata_only:
        print(json.dumps({"checked_lock_entries": len(artifacts), "failures": failures}, indent=2))
        if failures:
            raise SystemExit(1)
        return

    for artifact in artifacts:
        artifact_id = artifact.get("id", "(unnamed)")
        if "path" in artifact:
            path = ROOT / artifact["path"]
            if not path.exists():
                failures.append(f"{artifact_id}: missing {path}")
                continue
            actual_hash = sha256(path)
            actual_bytes = path.stat().st_size
            if actual_hash != artifact.get("sha256"):
                failures.append(
                    f"{artifact_id}: sha256 expected={artifact.get('sha256')} actual={actual_hash}"
                )
            if actual_bytes != artifact.get("bytes"):
                failures.append(
                    f"{artifact_id}: bytes expected={artifact.get('bytes')} actual={actual_bytes}"
                )
            checked += 1
            continue

        pattern = artifact.get("path_glob")
        if not pattern:
            failures.append(f"{artifact_id}: lock entry has neither path nor path_glob")
            continue
        excluded = set(artifact.get("exclude", []))
        files = sorted(
            path for path in ROOT.glob(pattern) if path.is_file() and path.name not in excluded
        )
        lines = [f"{path.name}:{sha256(path)}" for path in files]
        aggregate = hashlib.sha256("\n".join(lines).encode("utf-8")).hexdigest()
        total_bytes = sum(path.stat().st_size for path in files)
        if len(files) != artifact.get("file_count"):
            failures.append(
                f"{artifact_id}: file_count expected={artifact.get('file_count')} actual={len(files)}"
            )
        if aggregate != artifact.get("aggregate_sha256"):
            failures.append(
                f"{artifact_id}: aggregate sha256 expected={artifact.get('aggregate_sha256')} actual={aggregate}"
            )
        if total_bytes != artifact.get("bytes"):
            failures.append(
                f"{artifact_id}: bytes expected={artifact.get('bytes')} actual={total_bytes}"
            )
        checked += 1

    print(json.dumps({"checked_artifacts": checked, "failures": failures}, indent=2))
    if failures:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
