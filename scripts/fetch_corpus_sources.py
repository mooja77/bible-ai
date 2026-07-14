"""Fetch every locked corpus source and verify it before any parser sees it."""

from __future__ import annotations

import argparse
import hashlib
import io
import json
import os
import tempfile
import time
import urllib.error
import urllib.request
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
LOCK_PATH = ROOT / "data" / "corpus-lock.json"
USER_AGENT = "Bible-AI-corpus-builder/1"


def sha256_bytes(payload: bytes) -> str:
    return hashlib.sha256(payload).hexdigest()


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def download(url: str) -> bytes:
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    last_error: Exception | None = None
    for attempt in range(3):
        try:
            with urllib.request.urlopen(request, timeout=120) as response:
                return response.read()
        except (urllib.error.URLError, TimeoutError) as error:
            last_error = error
            if attempt < 2:
                time.sleep(2**attempt)
    raise RuntimeError(f"Could not download {url}: {last_error}")


def checked(payload: bytes, artifact: dict, label: str) -> bytes:
    expected_bytes = int(artifact["bytes"])
    expected_hash = artifact["sha256"]
    if len(payload) != expected_bytes or sha256_bytes(payload) != expected_hash:
        raise RuntimeError(
            f"{label} did not match corpus lock: "
            f"bytes={len(payload)}/{expected_bytes}, "
            f"sha256={sha256_bytes(payload)}/{expected_hash}"
        )
    return payload


def atomic_write(path: Path, payload: bytes) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_name(f".{path.name}.{os.getpid()}.tmp")
    try:
        temporary.write_bytes(payload)
        os.replace(temporary, path)
    finally:
        temporary.unlink(missing_ok=True)


def cached_path_ok(path: Path, artifact: dict) -> bool:
    return (
        path.is_file()
        and path.stat().st_size == artifact["bytes"]
        and sha256_file(path) == artifact["sha256"]
    )


def fetch_path_artifact(artifact: dict, offline: bool) -> None:
    path = ROOT / artifact["path"]
    if cached_path_ok(path, artifact):
        print(f"verified {artifact['id']}: {path.relative_to(ROOT)}")
        return
    if artifact.get("fetch_policy") == "repository_snapshot":
        raise RuntimeError(
            f"{artifact['id']}: the checksum-locked repository snapshot is missing "
            f"or invalid: {path}. Restore it from version control; the documented "
            "upstream URL is mutable and must not be substituted automatically."
        )
    if offline:
        raise RuntimeError(f"{artifact['id']}: locked cache is missing or invalid: {path}")
    payload = download(artifact["source_url"])
    if artifact["id"] == "openbible-xrefs":
        with zipfile.ZipFile(io.BytesIO(payload)) as archive:
            candidates = sorted(name for name in archive.namelist() if name.endswith(".txt"))
            if not candidates:
                raise RuntimeError("openbible-xrefs: downloaded archive contains no .txt file")
            payload = archive.read(candidates[0])
    atomic_write(path, checked(payload, artifact, artifact["id"]))
    print(f"fetched and verified {artifact['id']}: {path.relative_to(ROOT)}")


def aggregate_for(files: list[Path]) -> tuple[int, str]:
    lines = [f"{path.name}:{sha256_file(path)}" for path in sorted(files)]
    return sum(path.stat().st_size for path in files), hashlib.sha256(
        "\n".join(lines).encode("utf-8")
    ).hexdigest()


def glob_artifact_ok(artifact: dict) -> bool:
    excluded = set(artifact.get("exclude", []))
    files = sorted(
        path
        for path in ROOT.glob(artifact["path_glob"])
        if path.is_file() and path.name not in excluded
    )
    total, aggregate = aggregate_for(files)
    return (
        [path.name for path in files] == sorted(artifact["files"])
        and total == artifact["bytes"]
        and aggregate == artifact["aggregate_sha256"]
    )


def fetch_glob_artifact(artifact: dict, offline: bool) -> None:
    if glob_artifact_ok(artifact):
        print(f"verified {artifact['id']}: {artifact['path_glob']}")
        return
    if offline:
        raise RuntimeError(f"{artifact['id']}: locked cache set is missing or invalid")
    version = str(artifact["version"])
    if artifact["id"] != "morphhb" or "@" not in version:
        raise RuntimeError(f"No deterministic fetch adapter for glob artifact {artifact['id']}")
    commit = version.rsplit("@", 1)[1]
    destination = ROOT / "data" / "sources" / "morphhb"
    destination.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix="morphhb-", dir=destination.parent) as temp_name:
        temporary = Path(temp_name)
        downloaded: list[Path] = []
        for name in artifact["files"]:
            payload = download(
                f"https://raw.githubusercontent.com/openscriptures/morphhb/{commit}/wlc/{name}"
            )
            path = temporary / name
            path.write_bytes(payload)
            downloaded.append(path)
        total, aggregate = aggregate_for(downloaded)
        if total != artifact["bytes"] or aggregate != artifact["aggregate_sha256"]:
            raise RuntimeError(
                f"{artifact['id']} aggregate did not match corpus lock: "
                f"bytes={total}/{artifact['bytes']}, "
                f"sha256={aggregate}/{artifact['aggregate_sha256']}"
            )
        for source in downloaded:
            os.replace(source, destination / source.name)
    print(f"fetched and verified {artifact['id']}: {artifact['path_glob']}")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--offline",
        action="store_true",
        help="require the existing cache to match the lock; never use the network",
    )
    args = parser.parse_args()
    lock = json.loads(LOCK_PATH.read_text(encoding="utf-8"))
    for artifact in lock["artifacts"]:
        if "path" in artifact:
            fetch_path_artifact(artifact, args.offline)
        else:
            fetch_glob_artifact(artifact, args.offline)


if __name__ == "__main__":
    main()
