import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { productName, releaseRoot, version } from "./release-metadata.mjs";

const manifestPath = join(releaseRoot, "release-manifest.json");
const summaryPath = join(releaseRoot, "release-summary.md");
const failures = [];
const successes = [];

if (!existsSync(manifestPath)) failures.push(`missing manifest: ${manifestPath}`);
if (!existsSync(summaryPath)) failures.push(`missing summary: ${summaryPath}`);

if (failures.length === 0) {
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  const summary = readFileSync(summaryPath, "utf8");
  const files = Array.isArray(manifest.files) ? manifest.files : [];
  const directories = Array.isArray(manifest.directories) ? manifest.directories : [];
  const expectedTitle = `# ${manifest.app ?? productName} ${manifest.version ?? version} Release`;

  requireText(summary, expectedTitle, "summary title");
  requireText(summary, `Generated: ${manifest.generated_at}`, "generated timestamp");
  requireText(summary, "| Name | Path | Size | SHA-256 |", "artifact table header");

  for (const file of files) {
    const row = `| ${escapeCell(file.name)} | \`${file.path}\` | ${formatBytes(
      Number(file.bytes ?? 0),
    )} | \`${file.sha256 ?? ""}\` |`;
    requireText(summary, row, `${file.name} artifact row`);
  }

  if (directories.length > 0) {
    requireText(summary, "| Name | Path | Files | Size |", "directory table header");
  }
  for (const directory of directories) {
    const row = `| ${escapeCell(directory.name)} | \`${directory.path}\` | ${Number(
      directory.files ?? 0,
    ).toLocaleString()} | ${formatBytes(Number(directory.bytes ?? 0))} |`;
    requireText(summary, row, `${directory.name} directory row`);
  }
}

if (failures.length > 0) {
  console.error("Release summary verification failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Release summary verification passed:");
for (const success of successes) console.log(`- ${success}`);

function requireText(summary, expected, label) {
  if (summary.includes(expected)) {
    successes.push(label);
    return;
  }
  failures.push(`missing ${label}: ${expected}`);
}

function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${value.toFixed(unitIndex === 0 ? 0 : 2)} ${units[unitIndex]}`;
}

function escapeCell(value) {
  return String(value ?? "").replaceAll("|", "\\|");
}
