import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { basename, join } from "node:path";
import {
  findMacosDmg,
  macosManifestPath,
  macosPackageDir,
  macosSummaryPath,
  sha256,
} from "./macos-release-utils.mjs";

const failures = [];
const successes = [];
const dmg = findMacosDmg();

if (!existsSync(macosPackageDir)) failures.push(`missing macOS package directory: ${macosPackageDir}`);
if (!dmg) failures.push("missing release DMG");
if (!existsSync(macosManifestPath)) failures.push(`missing macOS manifest: ${macosManifestPath}`);
if (!existsSync(macosSummaryPath)) failures.push(`missing macOS summary: ${macosSummaryPath}`);

if (failures.length === 0) {
  const manifest = JSON.parse(readFileSync(macosManifestPath, "utf8"));
  const dmgEntry = (manifest.files ?? []).find((file) => file.name === "dmg_installer");
  if (!dmgEntry) failures.push("manifest missing dmg_installer entry");

  const expectedNames = [
    basename(dmg),
    "README.md",
    "macos-release-manifest.json",
    "macos-release-summary.md",
    "macos-signing.json",
  ].sort();
  const actualNames = readdirSync(macosPackageDir)
    .filter((name) => statSync(join(macosPackageDir, name)).isFile())
    .sort();
  for (const name of expectedNames) {
    if (!actualNames.includes(name)) failures.push(`missing package file: ${name}`);
  }
  for (const name of actualNames) {
    if (!expectedNames.includes(name)) failures.push(`unexpected package file: ${name}`);
  }

  if (dmgEntry) await verifyCopiedFile(basename(dmg), Number(dmgEntry.bytes), dmgEntry.sha256);
  await verifySameHash("macos-release-manifest.json", macosManifestPath);
  await verifySameHash("macos-release-summary.md", macosSummaryPath);
}

if (failures.length > 0) {
  console.error("macOS release package verification failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("macOS release package verification passed:");
for (const success of successes) console.log(`- ${success}`);

async function verifyCopiedFile(name, expectedBytes, expectedHash) {
  const path = join(macosPackageDir, name);
  if (!existsSync(path)) return;
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

async function verifySameHash(name, sourcePath) {
  const packagePath = join(macosPackageDir, name);
  if (!existsSync(packagePath)) return;
  const sourceHash = await sha256(sourcePath);
  const packageHash = await sha256(packagePath);
  if (sourceHash !== packageHash) {
    failures.push(`${name} differs from release root copy`);
    return;
  }
  successes.push(name);
}
