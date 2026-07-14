import { createHash } from "node:crypto";
import { createReadStream, existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { releaseRoot } from "./release-metadata.mjs";

const packageDir = join(releaseRoot, "manual-qa-package");
const installersDir = join(packageDir, "installers");
const manifestPath = join(releaseRoot, "release-manifest.json");
const packageManifestPath = join(packageDir, "release-manifest.json");
const packageSummaryPath = join(packageDir, "release-summary.md");
const requiredPackageFiles = [
  "README.md",
  "RUN-MANUAL-QA.ps1",
  "release-manifest.json",
  "release-summary.md",
  "scripts/collect-manual-release-gates.ps1",
  "scripts/verify-manual-release-gates.mjs",
];

const failures = [];
const successes = [];

if (!existsSync(packageDir)) failures.push(`missing manual QA package directory: ${packageDir}`);
if (!existsSync(manifestPath)) failures.push(`missing release manifest: ${manifestPath}`);
if (!existsSync(packageManifestPath)) failures.push(`missing package manifest copy`);
if (!existsSync(packageSummaryPath)) failures.push(`missing package release summary copy`);

for (const file of requiredPackageFiles) {
  const path = join(packageDir, file);
  if (!existsSync(path) || !statSync(path).isFile()) failures.push(`missing package file: ${file}`);
}

if (failures.length === 0) {
  const manifest = JSON.parse(await readText(manifestPath));
  const installers = (Array.isArray(manifest.files) ? manifest.files : []).filter((file) =>
    String(file?.name ?? "").endsWith("_installer"),
  );
  if (installers.length === 0) failures.push("release manifest does not list installer artifacts");

  for (const artifact of installers) {
    const name = lastPathSegment(artifact.path);
    await verifyInstaller(name, Number(artifact.bytes), artifact.sha256);
  }

  await verifyCopiedFile("release-manifest.json", manifestPath, packageManifestPath);
  await verifyCopiedFile(
    "release-summary.md",
    join(releaseRoot, "release-summary.md"),
    packageSummaryPath,
  );

  await verifyEvidenceContract("RUN-MANUAL-QA.ps1", [
    "KeyboardOnlyWorkflowPassed",
    "ScreenReaderSmokePassed",
    "Zoom200PercentPassed",
    "SensitiveTopicWordingReviewPassed",
    "LocalizedCrisisResourcesReviewPassed",
  ]);
  await verifyEvidenceContract("README.md", [
    "using only the keyboard",
    "screen reader",
    "200%",
    "named safety reviewer",
    "official source for every target locale",
  ]);
  await verifyEvidenceContract("scripts/collect-manual-release-gates.ps1", [
    "Get-FileHash",
    "sha256",
    "bytes",
    "keyboard_only_workflow_passed",
    "screen_reader_smoke_passed",
    "zoom_200_percent_passed",
    "sensitive_topic_wording_review_passed",
    "localized_crisis_resources_review_passed",
  ]);

  const packageNames = new Set(readdirSync(installersDir));
  for (const artifact of installers) {
    packageNames.delete(lastPathSegment(artifact.path));
  }
  for (const unexpected of packageNames) {
    failures.push(`unexpected installer package file: ${unexpected}`);
  }
}

if (failures.length > 0) {
  console.error("Manual QA package verification failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Manual QA package verification passed:");
for (const success of successes) console.log(`- ${success}`);

async function verifyInstaller(name, expectedBytes, expectedHash) {
  const path = join(installersDir, name);
  if (!existsSync(path)) {
    failures.push(`missing installer in manual QA package: ${name}`);
    return;
  }
  const stats = statSync(path);
  if (stats.size !== expectedBytes) {
    failures.push(`${name} byte mismatch: expected ${expectedBytes}, got ${stats.size}`);
    return;
  }
  const actualHash = await sha256(path);
  if (actualHash !== expectedHash) {
    failures.push(`${name} sha256 mismatch: expected ${expectedHash}, got ${actualHash}`);
    return;
  }
  successes.push(`${name}: ${stats.size} bytes`);
}

async function verifyCopiedFile(name, sourcePath, packagePath) {
  if (!existsSync(sourcePath) || !existsSync(packagePath)) return;
  const sourceHash = await sha256(sourcePath);
  const packageHash = await sha256(packagePath);
  if (sourceHash !== packageHash) {
    failures.push(`${name} differs from release root copy`);
    return;
  }
  successes.push(name);
}

async function verifyEvidenceContract(relativePath, requiredTokens) {
  const path = join(packageDir, relativePath);
  if (!existsSync(path)) return;
  const text = await readText(path);
  for (const token of requiredTokens) {
    if (!text.includes(token)) {
      failures.push(`${relativePath} omits release-evidence token: ${token}`);
    }
  }
  if (!requiredTokens.some((token) => !text.includes(token))) {
    successes.push(`${relativePath} evidence contract`);
  }
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

function lastPathSegment(path) {
  return String(path).split(/[\\/]/).filter(Boolean).at(-1);
}

function readText(path) {
  return import("node:fs/promises").then(({ readFile }) => readFile(path, "utf8"));
}
