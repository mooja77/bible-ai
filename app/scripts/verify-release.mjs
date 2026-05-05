import { existsSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

const appRoot = resolve(import.meta.dirname, "..");
const releaseRoot = join(appRoot, "src-tauri", "target", "release");
const bundleRoot = join(releaseRoot, "bundle");

const requiredPaths = [
  ["app executable", join(releaseRoot, "app.exe")],
  ["corpus resource", join(releaseRoot, "corpus.sqlite")],
  ["sidecar entry", join(releaseRoot, "sidecar", "index.mjs")],
  ["sidecar council module", join(releaseRoot, "sidecar", "council.mjs")],
  ["bundled Node runtime", join(releaseRoot, "sidecar", "node", "node.exe")],
  ["sidecar dependencies", join(releaseRoot, "sidecar", "node_modules")],
];

const requiredBundles = [
  ["NSIS installer", join(bundleRoot, "nsis"), /\.exe$/i],
  ["MSI installer", join(bundleRoot, "msi"), /\.msi$/i],
];

const failures = [];
const successes = [];

for (const [label, filePath] of requiredPaths) {
  if (!existsSync(filePath)) {
    failures.push(`${label} missing: ${filePath}`);
    continue;
  }
  const stats = statSync(filePath);
  if (stats.isFile() && stats.size <= 0) {
    failures.push(`${label} is empty: ${filePath}`);
    continue;
  }
  successes.push(`${label}: ${filePath}`);
}

for (const [label, dir, pattern] of requiredBundles) {
  if (!existsSync(dir)) {
    failures.push(`${label} directory missing: ${dir}`);
    continue;
  }
  const matches = readdirSync(dir)
    .filter((name) => pattern.test(name))
    .map((name) => join(dir, name))
    .filter((filePath) => statSync(filePath).isFile() && statSync(filePath).size > 0);
  if (matches.length === 0) {
    failures.push(`${label} artifact missing in: ${dir}`);
    continue;
  }
  for (const match of matches) successes.push(`${label}: ${match}`);
}

if (failures.length > 0) {
  console.error("Release verification failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Release verification passed:");
for (const success of successes) console.log(`- ${success}`);
