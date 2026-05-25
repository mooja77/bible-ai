import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { packageName, productName, releaseRoot, version } from "./release-metadata.mjs";
import { macosManifestPath, sha256, summarizeDirectory } from "./macos-release-utils.mjs";

const requiredFileNames = [
  "dmg_installer",
  "app_info_plist",
  "app_executable",
  "corpus",
  "sidecar_entry",
  "sidecar_council",
  "sidecar_explain",
  "sidecar_package",
  "sidecar_lockfile",
  "node_runtime",
];
const requiredDirectoryNames = ["app_bundle", "sidecar_providers", "sidecar_dependencies"];
const sha256Pattern = /^[a-f0-9]{64}$/;
const failures = [];
const successes = [];

if (!existsSync(macosManifestPath)) {
  console.error(`macOS release manifest verification failed: missing ${macosManifestPath}`);
  process.exit(1);
}

const manifest = JSON.parse(readFileSync(macosManifestPath, "utf8"));
expectEqual("app", manifest.app, productName);
expectEqual("version", manifest.version, version);
expectEqual("package_name", manifest.package_name, packageName);
expectEqual("platform", manifest.platform, "macos");
expectEqual("release_root", manifest.release_root, releaseRoot);

if (!isValidIsoDate(manifest.generated_at)) {
  failures.push(`manifest generated_at is not a valid ISO timestamp: ${manifest.generated_at}`);
} else {
  successes.push(`generated_at: ${manifest.generated_at}`);
}

if (!Array.isArray(manifest.files)) {
  failures.push("manifest.files is missing or not an array");
} else {
  verifyRequiredEntries("file", manifest.files, requiredFileNames);
  verifyUniqueEntries("file", manifest.files);
  for (const file of manifest.files) await verifyFile(file);
}

if (!Array.isArray(manifest.directories)) {
  failures.push("manifest.directories is missing or not an array");
} else {
  verifyRequiredEntries("directory", manifest.directories, requiredDirectoryNames);
  verifyUniqueEntries("directory", manifest.directories);
  for (const directory of manifest.directories) verifyDirectory(directory);
}

const sidecarProviders = Array.isArray(manifest.directories)
  ? manifest.directories.find((directory) => directory?.name === "sidecar_providers")
  : null;
if (sidecarProviders?.path) {
  const sidecarTestsPath = join(releaseRoot, String(sidecarProviders.path), "..", "tests");
  if (existsSync(sidecarTestsPath)) {
    failures.push(`sidecar_tests should not be bundled: ${sidecarTestsPath}`);
  }
}

if (failures.length > 0) {
  console.error("macOS release manifest verification failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("macOS release manifest verification passed:");
for (const success of successes) console.log(`- ${success}`);

function expectEqual(label, actual, expected) {
  if (actual !== expected) {
    failures.push(`manifest ${label} mismatch: expected ${expected}, got ${actual}`);
  } else {
    successes.push(`${label}: ${actual}`);
  }
}

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

function isValidIsoDate(value) {
  return typeof value === "string" && !Number.isNaN(Date.parse(value));
}
