import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { createReadStream, existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { appRoot, packageName, productName, releaseRoot, version } from "./release-metadata.mjs";

const manifestPath = join(releaseRoot, "release-manifest.json");
const requiredFileNames = [
  "app",
  "corpus",
  "sidecar_entry",
  "sidecar_council",
  "sidecar_explain",
  "sidecar_package",
  "sidecar_lockfile",
  "node_runtime",
  "nsis_installer",
  "msi_installer",
];
const requiredDirectoryNames = ["sidecar_providers", "sidecar_grounded", "sidecar_dependencies"];
const forbiddenPaths = [["sidecar_tests", join(releaseRoot, "sidecar", "tests")]];
const sha256Pattern = /^[a-f0-9]{64}$/;

if (!existsSync(manifestPath)) {
  console.error(`Release manifest verification failed: missing ${manifestPath}`);
  process.exit(1);
}

const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
const failures = [];
const successes = [];

if (manifest.app !== productName) {
  failures.push(`manifest app name mismatch: expected ${productName}, got ${manifest.app}`);
} else {
  successes.push(`app: ${manifest.app}`);
}

if (manifest.version !== version) {
  failures.push(`manifest version mismatch: expected ${version}, got ${manifest.version}`);
} else {
  successes.push(`version: ${manifest.version}`);
}

if (manifest.package_name !== packageName) {
  failures.push(`manifest package name mismatch: expected ${packageName}, got ${manifest.package_name}`);
} else {
  successes.push(`package_name: ${manifest.package_name}`);
}

if (manifest.release_root !== releaseRoot) {
  failures.push(`manifest release_root mismatch: expected ${releaseRoot}, got ${manifest.release_root}`);
} else {
  successes.push("release_root");
}

if (!isValidIsoDate(manifest.generated_at)) {
  failures.push(`manifest generated_at is not a valid ISO timestamp: ${manifest.generated_at}`);
} else {
  successes.push(`generated_at: ${manifest.generated_at}`);
}

const currentCommit = git("rev-parse", "HEAD");
if (!/^[a-f0-9]{40}$/.test(String(manifest.source_control?.git_commit ?? ""))) {
  failures.push("manifest source_control.git_commit must be a full Git commit SHA");
} else if (manifest.source_control.git_commit !== currentCommit) {
  failures.push(`manifest source commit mismatch: expected ${currentCommit}, got ${manifest.source_control.git_commit}`);
} else {
  successes.push(`source_commit: ${currentCommit}`);
}
if (manifest.source_control?.tracked_worktree_clean !== true) {
  failures.push("manifest requires a clean tracked worktree at creation time");
} else if (git("status", "--porcelain", "--untracked-files=no") !== "") {
  failures.push("tracked worktree changed after the manifest was created");
} else {
  successes.push("tracked_worktree_clean");
}

if (!Array.isArray(manifest.files)) {
  failures.push("manifest.files is missing or not an array");
} else {
  verifyRequiredEntries("file", manifest.files, requiredFileNames);
  verifyUniqueEntries("file", manifest.files);
  for (const file of manifest.files) {
    await verifyFile(file);
  }
}

if (!Array.isArray(manifest.directories)) {
  failures.push("manifest.directories is missing or not an array");
} else {
  verifyRequiredEntries("directory", manifest.directories, requiredDirectoryNames);
  verifyUniqueEntries("directory", manifest.directories);
  for (const directory of manifest.directories) {
    verifyDirectory(directory);
  }
}

for (const [name, artifactPath] of forbiddenPaths) {
  if (existsSync(artifactPath)) failures.push(`${name} should not be bundled: ${artifactPath}`);
}

if (failures.length > 0) {
  console.error("Release manifest verification failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Release manifest verification passed:");
for (const success of successes) console.log(`- ${success}`);

async function verifyFile(file) {
  const name = String(file?.name ?? "unknown");
  const relativePath = String(file?.path ?? "");
  if (!file?.name) {
    failures.push("file entry has no name");
    return;
  }
  if (!relativePath) {
    failures.push(`${name} has no path`);
    return;
  }
  if (!Number.isSafeInteger(Number(file.bytes)) || Number(file.bytes) <= 0) {
    failures.push(`${name} has invalid byte count: ${file.bytes}`);
    return;
  }
  if (!isValidIsoDate(file.modified_at)) {
    failures.push(`${name} has invalid modified_at timestamp: ${file.modified_at}`);
    return;
  }
  if (!sha256Pattern.test(String(file.sha256 ?? ""))) {
    failures.push(`${name} has invalid sha256: ${file.sha256}`);
    return;
  }
  const filePath = join(releaseRoot, relativePath);
  if (!existsSync(filePath)) {
    failures.push(`${name} missing: ${filePath}`);
    return;
  }
  const stats = statSync(filePath);
  if (!stats.isFile()) {
    failures.push(`${name} is not a file: ${filePath}`);
    return;
  }
  if (stats.size !== Number(file.bytes)) {
    failures.push(`${name} byte mismatch: expected ${file.bytes}, got ${stats.size}`);
    return;
  }
  const actualHash = await sha256(filePath);
  if (actualHash !== file.sha256) {
    failures.push(`${name} sha256 mismatch: expected ${file.sha256}, got ${actualHash}`);
    return;
  }
  successes.push(`${name}: ${relativePath}`);
}

function verifyDirectory(directory) {
  const name = String(directory?.name ?? "unknown");
  const relativePath = String(directory?.path ?? "");
  if (!directory?.name) {
    failures.push("directory entry has no name");
    return;
  }
  if (!relativePath) {
    failures.push(`${name} has no path`);
    return;
  }
  if (!Number.isSafeInteger(Number(directory.files)) || Number(directory.files) <= 0) {
    failures.push(`${name} has invalid file count: ${directory.files}`);
    return;
  }
  if (!Number.isSafeInteger(Number(directory.bytes)) || Number(directory.bytes) <= 0) {
    failures.push(`${name} has invalid byte count: ${directory.bytes}`);
    return;
  }
  const dirPath = join(releaseRoot, relativePath);
  if (!existsSync(dirPath)) {
    failures.push(`${name} missing: ${dirPath}`);
    return;
  }
  const summary = summarizeDirectory(dirPath);
  if (summary.files !== Number(directory.files)) {
    failures.push(`${name} file count mismatch: expected ${directory.files}, got ${summary.files}`);
    return;
  }
  if (summary.bytes !== Number(directory.bytes)) {
    failures.push(`${name} byte mismatch: expected ${directory.bytes}, got ${summary.bytes}`);
    return;
  }
  successes.push(`${name}: ${relativePath}`);
}

function verifyRequiredEntries(kind, entries, requiredNames) {
  const names = new Set(entries.map((entry) => String(entry?.name ?? "")));
  for (const name of requiredNames) {
    if (!names.has(name)) failures.push(`manifest missing required ${kind}: ${name}`);
  }
}

function verifyUniqueEntries(kind, entries) {
  const names = new Set();
  const paths = new Set();
  for (const entry of entries) {
    const name = String(entry?.name ?? "");
    const path = String(entry?.path ?? "");
    if (name) {
      if (names.has(name)) failures.push(`manifest has duplicate ${kind} name: ${name}`);
      names.add(name);
    }
    if (path) {
      if (paths.has(path)) failures.push(`manifest has duplicate ${kind} path: ${path}`);
      paths.add(path);
    }
  }
}

function summarizeDirectory(dirPath) {
  let files = 0;
  let bytes = 0;
  const stack = [dirPath];
  while (stack.length > 0) {
    const current = stack.pop();
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const path = join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(path);
        continue;
      }
      if (!entry.isFile()) continue;
      const stats = statSync(path);
      files += 1;
      bytes += stats.size;
    }
  }
  return { files, bytes };
}

function isValidIsoDate(value) {
  return typeof value === "string" && !Number.isNaN(Date.parse(value));
}

function sha256(filePath) {
  return new Promise((resolveHash, rejectHash) => {
    const hash = createHash("sha256");
    const stream = createReadStream(filePath);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("error", rejectHash);
    stream.on("end", () => resolveHash(hash.digest("hex")));
  });
}

function git(...args) {
  const result = spawnSync("git", args, {
    cwd: join(appRoot, ".."),
    encoding: "utf8",
    windowsHide: true,
  });
  if (result.status !== 0) return "";
  return String(result.stdout ?? "").trim();
}
