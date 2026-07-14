import { createHash } from "node:crypto";
import { createReadStream, existsSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

const appRoot = resolve(import.meta.dirname, "..");
const releaseRoot = join(appRoot, "src-tauri", "target", "release");
const packageDir = join(releaseRoot, "release-package");
const manifestPath = join(releaseRoot, "release-manifest.json");
const summaryPath = join(releaseRoot, "release-summary.md");
const sbomPaths = [
  join(appRoot, "release", "sbom-npm.cdx.json"),
  join(appRoot, "release", "sbom-cargo.cdx.json"),
];

const failures = [];
const successes = [];

if (!existsSync(packageDir)) failures.push(`missing package directory: ${packageDir}`);
if (!existsSync(manifestPath)) failures.push(`missing manifest: ${manifestPath}`);
if (!existsSync(summaryPath)) failures.push(`missing summary: ${summaryPath}`);

if (failures.length === 0) {
  const manifest = JSON.parse(await readText(manifestPath));
  const installers = (Array.isArray(manifest.files) ? manifest.files : []).filter((file) =>
    String(file?.name ?? "").endsWith("_installer"),
  );
  const expectedNames = [
    ...installers.map((artifact) => lastPathSegment(artifact.path)),
    "release-manifest.json",
    "release-summary.md",
    ...sbomPaths.map(lastPathSegment),
  ].sort();
  const actualNames = readdirSync(packageDir)
    .filter((name) => statSync(join(packageDir, name)).isFile())
    .sort();

  for (const name of expectedNames) {
    if (!actualNames.includes(name)) failures.push(`missing package file: ${name}`);
  }
  for (const name of actualNames) {
    if (!expectedNames.includes(name)) failures.push(`unexpected package file: ${name}`);
  }

  for (const artifact of installers) {
    await verifyPackageFile(lastPathSegment(artifact.path), Number(artifact.bytes), artifact.sha256);
  }
  await verifyCopiedFile("release-manifest.json", manifestPath);
  await verifyCopiedFile("release-summary.md", summaryPath);
  for (const sbomPath of sbomPaths) {
    await verifyCopiedFile(lastPathSegment(sbomPath), sbomPath);
  }
}

if (failures.length > 0) {
  console.error("Release package verification failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Release package verification passed:");
for (const success of successes) console.log(`- ${success}`);

async function verifyPackageFile(name, expectedBytes, expectedHash) {
  const filePath = join(packageDir, name);
  if (!existsSync(filePath)) return;
  const stats = statSync(filePath);
  if (stats.size !== expectedBytes) {
    failures.push(`${name} byte mismatch: expected ${expectedBytes}, got ${stats.size}`);
    return;
  }
  const actualHash = await sha256(filePath);
  if (actualHash !== expectedHash) {
    failures.push(`${name} sha256 mismatch: expected ${expectedHash}, got ${actualHash}`);
    return;
  }
  successes.push(`${name}: ${stats.size} bytes`);
}

async function verifyCopiedFile(name, sourcePath) {
  const packagePath = join(packageDir, name);
  if (!existsSync(packagePath)) return;
  const sourceStats = statSync(sourcePath);
  const packageStats = statSync(packagePath);
  if (sourceStats.size !== packageStats.size) {
    failures.push(`${name} byte mismatch: expected ${sourceStats.size}, got ${packageStats.size}`);
    return;
  }
  const sourceHash = await sha256(sourcePath);
  const packageHash = await sha256(packagePath);
  if (sourceHash !== packageHash) {
    failures.push(`${name} differs from release root copy`);
    return;
  }
  successes.push(`${name}: ${packageStats.size} bytes`);
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
