import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { macosManifestPath, macosSummaryPath } from "./macos-release-utils.mjs";

if (!existsSync(macosManifestPath)) {
  console.error(`macOS release summary failed: missing ${macosManifestPath}`);
  process.exit(1);
}

const manifest = JSON.parse(readFileSync(macosManifestPath, "utf8"));
const lines = [
  `# ${manifest.app} ${manifest.version} macOS Release`,
  "",
  `Generated: ${manifest.generated_at}`,
  "",
  `Source commit: \`${manifest.source_control?.git_commit ?? "unknown"}\``,
  `Tracked worktree clean: ${manifest.source_control?.tracked_worktree_clean === true ? "yes" : "no"}`,
  "",
  "## Files",
  "",
  "| Name | Path | Size | SHA-256 |",
  "|---|---:|---:|---|",
];

for (const file of manifest.files ?? []) {
  lines.push(`| ${file.name} | \`${file.path}\` | ${file.bytes} | \`${file.sha256}\` |`);
}

lines.push("", "## Directories", "", "| Name | Path | Files | Size |", "|---|---:|---:|---:|");
for (const dir of manifest.directories ?? []) {
  lines.push(`| ${dir.name} | \`${dir.path}\` | ${dir.files} | ${dir.bytes} |`);
}

lines.push(
  "",
  "## Install Notes",
  "",
  "- Use the DMG for normal installation testing.",
  "- Public distribution requires signing and notarization before publishing outside local/test use.",
  "- Verify first launch, provider credential storage in Keychain, Council, exports, and backup/restore on macOS.",
  "",
);

writeFileSync(macosSummaryPath, `${lines.join("\n")}`, "utf8");
console.log(`macOS release summary written: ${macosSummaryPath}`);
