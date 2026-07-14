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

    identity = lock.get("embedding_identity") or {}
    for field in ("model", "model_digest", "dim", "generator_version"):
        if not identity.get(field):
            failures.append(f"embedding_identity: missing {field}")
    if len(str(identity.get("model_digest") or "")) != 64:
        failures.append("embedding_identity: model_digest must be a 64-character sha256")
    if not isinstance(identity.get("dim"), int) or identity.get("dim", 0) <= 0:
        failures.append("embedding_identity: dim must be a positive integer")

    for artifact in artifacts:
        artifact_id = artifact.get("id", "(unnamed)")
        for field in ("version", "source_url", "license", "attribution", "bytes"):
            if not artifact.get(field):
                failures.append(f"{artifact_id}: missing {field}")
        checksum = artifact.get("sha256") or artifact.get("aggregate_sha256")
        if not isinstance(checksum, str) or len(checksum) != 64:
            failures.append(f"{artifact_id}: checksum must be a 64-character sha256")
        has_path = isinstance(artifact.get("path"), str) and bool(artifact.get("path"))
        has_glob = isinstance(artifact.get("path_glob"), str) and bool(
            artifact.get("path_glob")
        )
        fetch_policy = artifact.get("fetch_policy", "network")
        if fetch_policy not in {"network", "repository_snapshot"}:
            failures.append(
                f"{artifact_id}: fetch_policy must be network or repository_snapshot"
            )
        if has_path == has_glob:
            failures.append(f"{artifact_id}: specify exactly one of path or path_glob")
        if fetch_policy == "repository_snapshot":
            if not has_path:
                failures.append(
                    f"{artifact_id}: repository_snapshot requires an exact path"
                )
            else:
                snapshot_path = ROOT / artifact["path"]
                if not snapshot_path.is_file():
                    failures.append(
                        f"{artifact_id}: missing repository snapshot {snapshot_path}"
                    )
                else:
                    actual_hash = sha256(snapshot_path)
                    actual_bytes = snapshot_path.stat().st_size
                    if actual_hash != artifact.get("sha256"):
                        failures.append(
                            f"{artifact_id}: repository snapshot sha256 "
                            f"expected={artifact.get('sha256')} actual={actual_hash}"
                        )
                    if actual_bytes != artifact.get("bytes"):
                        failures.append(
                            f"{artifact_id}: repository snapshot bytes "
                            f"expected={artifact.get('bytes')} actual={actual_bytes}"
                        )
        if has_glob:
            expected_files = artifact.get("files")
            if not isinstance(artifact.get("file_count"), int) or artifact.get(
                "file_count", 0
            ) <= 0:
                failures.append(f"{artifact_id}: file_count must be a positive integer")
            if not isinstance(expected_files, list) or len(expected_files) != artifact.get(
                "file_count"
            ):
                failures.append(
                    f"{artifact_id}: files must list exactly file_count entries"
                )
            elif (
                any(not isinstance(name, str) or not name for name in expected_files)
                or len(expected_files) != len(set(expected_files))
            ):
                failures.append(f"{artifact_id}: files must contain unique non-empty names")

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
        expected_files = artifact.get("files")
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
        if expected_files is not None and [path.name for path in files] != sorted(
            expected_files
        ):
            failures.append(
                f"{artifact_id}: locked filenames do not match the cached artifact set"
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
