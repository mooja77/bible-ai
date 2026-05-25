import { existsSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

const appRoot = resolve(import.meta.dirname, "..");
const releaseRoot = join(appRoot, "src-tauri", "target", "release");
const bundleRoot = join(releaseRoot, "bundle");

const requiredFiles = [
  ["app executable", join(releaseRoot, "app.exe")],
  ["corpus resource", join(releaseRoot, "corpus.sqlite")],
  ["sidecar entry", join(releaseRoot, "sidecar", "index.mjs")],
  ["sidecar council module", join(releaseRoot, "sidecar", "council.mjs")],
  ["sidecar explanation module", join(releaseRoot, "sidecar", "explain.mjs")],
  ["sidecar package", join(releaseRoot, "sidecar", "package.json")],
  ["sidecar lockfile", join(releaseRoot, "sidecar", "package-lock.json")],
  ["bundled Node runtime", join(releaseRoot, "sidecar", "node", "node.exe")],
];

const requiredDirectories = [
  ["sidecar providers", join(releaseRoot, "sidecar", "providers")],
  ["sidecar dependencies", join(releaseRoot, "sidecar", "node_modules")],
];

const forbiddenPaths = [
  ["sidecar tests", join(releaseRoot, "sidecar", "tests")],
];

const requiredBundles = [
  ["NSIS installer", join(bundleRoot, "nsis"), /\.exe$/i],
  ["MSI installer", join(bundleRoot, "msi"), /\.msi$/i],
];

const failures = [];
const successes = [];

function directoryHasFiles(dirPath) {
  const stack = [dirPath];
  while (stack.length > 0) {
    const current = stack.pop();
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const entryPath = join(current, entry.name);
      if (entry.isFile()) return true;
      if (entry.isDirectory()) {
        stack.push(entryPath);
        continue;
      }
      try {
        if (statSync(entryPath).isFile()) return true;
      } catch {
        // Broken links cannot contribute a bundled file.
      }
    }
  }
  return false;
}

for (const [label, filePath] of requiredFiles) {
  if (!existsSync(filePath)) {
    failures.push(`${label} missing: ${filePath}`);
    continue;
  }
  const stats = statSync(filePath);
  if (!stats.isFile()) {
    failures.push(`${label} is not a file: ${filePath}`);
    continue;
  }
  if (stats.size <= 0) {
    failures.push(`${label} is empty: ${filePath}`);
    continue;
  }
  successes.push(`${label}: ${filePath}`);
}

for (const [label, dirPath] of requiredDirectories) {
  if (!existsSync(dirPath)) {
    failures.push(`${label} missing: ${dirPath}`);
    continue;
  }
  if (!statSync(dirPath).isDirectory()) {
    failures.push(`${label} is not a directory: ${dirPath}`);
    continue;
  }
  if (!directoryHasFiles(dirPath)) {
    failures.push(`${label} has no bundled files: ${dirPath}`);
    continue;
  }
  successes.push(`${label}: ${dirPath}`);
}

for (const [label, filePath] of forbiddenPaths) {
  if (existsSync(filePath)) {
    failures.push(`${label} should not be bundled: ${filePath}`);
  }
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
