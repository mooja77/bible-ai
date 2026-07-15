import { copyFileSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { windowsPackageEvidenceNames } from "./release-package-contract.mjs";

const appRoot = resolve(import.meta.dirname, "..");
const releaseRoot = join(appRoot, "src-tauri", "target", "release");
const packageDir = join(releaseRoot, "release-package");
const manifestPath = join(releaseRoot, "release-manifest.json");
const summaryPath = join(releaseRoot, "release-summary.md");
const evidencePaths = windowsPackageEvidenceNames.map((name) => join(appRoot, "release", name));

if (!existsSync(manifestPath)) {
  console.error(`Release package failed: missing ${manifestPath}`);
  process.exit(1);
}
if (!existsSync(summaryPath)) {
  console.error(`Release package failed: missing ${summaryPath}`);
  process.exit(1);
}
for (const evidencePath of evidencePaths) {
  if (!existsSync(evidencePath)) {
    console.error(`Release package failed: missing release evidence ${evidencePath}`);
    process.exit(1);
  }
}

const manifest = JSON.parse(await readText(manifestPath));
const installers = (Array.isArray(manifest.files) ? manifest.files : []).filter((file) =>
  String(file?.name ?? "").endsWith("_installer"),
);

if (installers.length === 0) {
  console.error("Release package failed: manifest does not list installer artifacts");
  process.exit(1);
}

rmSync(packageDir, { recursive: true, force: true });
mkdirSync(packageDir, { recursive: true });

for (const artifact of installers) {
  copyArtifact(join(releaseRoot, artifact.path), join(packageDir, lastPathSegment(artifact.path)));
}
copyArtifact(manifestPath, join(packageDir, "release-manifest.json"));
copyArtifact(summaryPath, join(packageDir, "release-summary.md"));
for (const evidencePath of evidencePaths) {
  copyArtifact(evidencePath, join(packageDir, lastPathSegment(evidencePath)));
}

console.log(`Release package written: ${packageDir}`);

function copyArtifact(source, destination) {
  if (!existsSync(source)) {
    console.error(`Release package failed: missing ${source}`);
    process.exit(1);
  }
  copyFileSync(source, destination);
  console.log(`- ${destination}`);
}

function lastPathSegment(path) {
  return String(path).split(/[\\/]/).filter(Boolean).at(-1);
}

function readText(path) {
  return import("node:fs/promises").then(({ readFile }) => readFile(path, "utf8"));
}
