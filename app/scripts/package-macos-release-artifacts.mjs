import { copyFileSync, existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import {
  findMacosDmg,
  macosManifestPath,
  macosPackageDir,
  macosSummaryPath,
} from "./macos-release-utils.mjs";
import { appRoot } from "./release-metadata.mjs";

const dmg = findMacosDmg();
if (!dmg) {
  console.error("macOS release package failed: missing DMG artifact");
  process.exit(1);
}
if (!existsSync(macosManifestPath)) {
  console.error(`macOS release package failed: missing ${macosManifestPath}`);
  process.exit(1);
}
if (!existsSync(macosSummaryPath)) {
  console.error(`macOS release package failed: missing ${macosSummaryPath}`);
  process.exit(1);
}

rmSync(macosPackageDir, { recursive: true, force: true });
mkdirSync(macosPackageDir, { recursive: true });

copyArtifact(dmg, join(macosPackageDir, basename(dmg)));
copyArtifact(macosManifestPath, join(macosPackageDir, "macos-release-manifest.json"));
copyArtifact(macosSummaryPath, join(macosPackageDir, "macos-release-summary.md"));
copyArtifact(join(appRoot, "release", "macos-signing.json"), join(macosPackageDir, "macos-signing.json"));
writeFileSync(join(macosPackageDir, "README.md"), readme(basename(dmg)), "utf8");

console.log(`macOS release package written: ${macosPackageDir}`);

function copyArtifact(source, destination) {
  if (!existsSync(source)) {
    console.error(`macOS release package failed: missing ${source}`);
    process.exit(1);
  }
  copyFileSync(source, destination);
  console.log(`- ${destination}`);
}

function readme(dmgName) {
  return `# Bible AI macOS Release Package

Install artifact:

- \`${dmgName}\`

Release evidence:

- \`macos-release-manifest.json\`
- \`macos-release-summary.md\`
- \`macos-signing.json\`

Manual macOS QA must verify:

1. DMG opens and app can be copied to Applications.
2. First launch succeeds on a clean macOS user.
3. Provider keys save to Keychain and are not stored in SQLite backups.
4. Council runs with at least two configured providers.
5. Workspace, export, backup, and restore workflows work on macOS.
6. Public distribution builds are signed and notarized before publishing.
`;
}
