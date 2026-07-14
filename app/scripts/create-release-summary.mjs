import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { productName, releaseRoot, version } from "./release-metadata.mjs";

const manifestPath = join(releaseRoot, "release-manifest.json");
const summaryPath = join(releaseRoot, "release-summary.md");

if (!existsSync(manifestPath)) {
  console.error(`Release summary failed: missing ${manifestPath}`);
  process.exit(1);
}

const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
const files = Array.isArray(manifest.files) ? manifest.files : [];
const directories = Array.isArray(manifest.directories) ? manifest.directories : [];

const lines = [
  `# ${manifest.app ?? productName} ${manifest.version ?? version} Release`,
  "",
  `Generated: ${manifest.generated_at ?? new Date().toISOString()}`,
  "",
  `Source commit: \`${manifest.source_control?.git_commit ?? "unknown"}\``,
  `Tracked worktree clean: ${manifest.source_control?.tracked_worktree_clean === true ? "yes" : "no"}`,
  "",
  "## Artifacts",
  "",
  "| Name | Path | Size | SHA-256 |",
  "|---|---|---:|---|",
];

for (const file of files) {
  lines.push(
    `| ${escapeCell(file.name)} | \`${file.path}\` | ${formatBytes(Number(file.bytes ?? 0))} | \`${file.sha256 ?? ""}\` |`,
  );
}

if (directories.length > 0) {
  lines.push("", "## Directories", "", "| Name | Path | Files | Size |", "|---|---|---:|---:|");
  for (const directory of directories) {
    lines.push(
      `| ${escapeCell(directory.name)} | \`${directory.path}\` | ${Number(
        directory.files ?? 0,
      ).toLocaleString()} | ${formatBytes(Number(directory.bytes ?? 0))} |`,
    );
  }
}

lines.push(
  "",
  "## Verification",
  "",
  "- Run `npm run release:manifest:verify` after copying artifacts.",
  "- Attach `release-manifest.json` and this summary with the installers.",
  "",
);

writeFileSync(summaryPath, `${lines.join("\n")}`, "utf8");
console.log(`Release summary written: ${summaryPath}`);

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
