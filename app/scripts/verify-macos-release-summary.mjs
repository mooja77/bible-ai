import { existsSync, readFileSync } from "node:fs";
import { macosManifestPath, macosSummaryPath } from "./macos-release-utils.mjs";

const failures = [];
const successes = [];

if (!existsSync(macosManifestPath)) failures.push(`missing macOS manifest: ${macosManifestPath}`);
if (!existsSync(macosSummaryPath)) failures.push(`missing macOS summary: ${macosSummaryPath}`);

if (failures.length === 0) {
  const manifest = JSON.parse(readFileSync(macosManifestPath, "utf8"));
  const summary = readFileSync(macosSummaryPath, "utf8");
  expectIncludes(summary, `# ${manifest.app} ${manifest.version} macOS Release`, "summary title");
  expectIncludes(summary, "## Files", "files section");
  expectIncludes(summary, "## Directories", "directories section");
  expectIncludes(summary, "## Install Notes", "install notes section");
  for (const file of manifest.files ?? []) {
    expectIncludes(summary, file.name, `${file.name} row`);
    expectIncludes(summary, file.sha256, `${file.name} hash`);
  }
  for (const dir of manifest.directories ?? []) {
    expectIncludes(summary, dir.name, `${dir.name} row`);
  }
}

if (failures.length > 0) {
  console.error("macOS release summary verification failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("macOS release summary verification passed:");
for (const success of successes) console.log(`- ${success}`);

function expectIncludes(value, pattern, label) {
  if (!value.includes(pattern)) {
    failures.push(`summary missing ${label}: ${pattern}`);
  } else {
    successes.push(label);
  }
}
