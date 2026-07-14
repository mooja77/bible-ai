import { copyFileSync, existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import { releaseRoot } from "./release-metadata.mjs";

const packageDir = join(releaseRoot, "manual-qa-package");
const installersDir = join(packageDir, "installers");
const scriptsDir = join(packageDir, "scripts");
const manifestPath = join(releaseRoot, "release-manifest.json");
const summaryPath = join(releaseRoot, "release-summary.md");

if (!existsSync(manifestPath)) {
  console.error(`Manual QA package failed: missing ${manifestPath}`);
  process.exit(1);
}
if (!existsSync(summaryPath)) {
  console.error(`Manual QA package failed: missing ${summaryPath}`);
  process.exit(1);
}

const manifest = JSON.parse(await readText(manifestPath));
const installers = (Array.isArray(manifest.files) ? manifest.files : []).filter((file) =>
  String(file?.name ?? "").endsWith("_installer"),
);

if (installers.length === 0) {
  console.error("Manual QA package failed: manifest does not list installer artifacts");
  process.exit(1);
}

rmSync(packageDir, { recursive: true, force: true });
mkdirSync(installersDir, { recursive: true });
mkdirSync(scriptsDir, { recursive: true });

const installerNames = [];
for (const artifact of installers) {
  const name = basename(artifact.path);
  copyArtifact(join(releaseRoot, artifact.path), join(installersDir, name));
  installerNames.push(name);
}

copyArtifact(manifestPath, join(packageDir, "release-manifest.json"));
copyArtifact(summaryPath, join(packageDir, "release-summary.md"));
copyArtifact(
  join(import.meta.dirname, "collect-manual-release-gates.ps1"),
  join(scriptsDir, "collect-manual-release-gates.ps1"),
);
copyArtifact(
  join(import.meta.dirname, "verify-manual-release-gates.mjs"),
  join(scriptsDir, "verify-manual-release-gates.mjs"),
);

writeFileSync(join(packageDir, "RUN-MANUAL-QA.ps1"), runScript(installerNames), "utf8");
writeFileSync(join(packageDir, "README.md"), readme(installerNames), "utf8");

console.log(`Manual QA package written: ${packageDir}`);

function copyArtifact(source, destination) {
  if (!existsSync(source)) {
    console.error(`Manual QA package failed: missing ${source}`);
    process.exit(1);
  }
  copyFileSync(source, destination);
  console.log(`- ${destination}`);
}

function readText(path) {
  return import("node:fs/promises").then(({ readFile }) => readFile(path, "utf8"));
}

function runScript(names) {
  const artifactArray = names.map((name) => `  "installers\\${escapePowerShell(name)}"`).join(",\n");
  return `[CmdletBinding()]
param(
  [string]$Operator = $env:USERNAME,
  [string]$WindowsProfile = $env:USERPROFILE,
  [switch]$MarkChecklistPassed
)

$ErrorActionPreference = "Stop"
$installerArtifacts = @(
${artifactArray}
)

Write-Host "Bible AI manual release QA package"
Write-Host ""
Write-Host "Use this folder from a separate clean Windows profile or VM."
Write-Host "Install one of the installers in .\\installers, complete the manual checklist in README.md, then rerun this script with -MarkChecklistPassed."
Write-Host "Do not paste API keys or credential values into any evidence file."
Write-Host ""

if (-not $MarkChecklistPassed) {
  Write-Host "Checklist was not marked complete. No evidence file was written."
  Write-Host "After completing the checklist, run:"
  Write-Host ('powershell -ExecutionPolicy Bypass -File .\\RUN-MANUAL-QA.ps1 -Operator "' + $Operator + '" -MarkChecklistPassed')
  exit 0
}

& "$PSScriptRoot\\scripts\\collect-manual-release-gates.ps1" \`
  -Operator $Operator \`
  -WindowsProfile $WindowsProfile \`
  -OutputPath "$PSScriptRoot\\manual-release-gates.json" \`
  -InstallerArtifacts $installerArtifacts \`
  -CleanProfileInstallPassed \`
  -FirstLaunchPassed \`
  -SettingsProviderKeysPassed \`
  -CredentialVaultUpgradeProfilePassed \`
  -ExportsSecretLeakCheckPassed \`
  -BackupRestorePassed \`
  -SqliteBackupRestorePassed \`
  -KeyboardOnlyWorkflowPassed \`
  -ScreenReaderSmokePassed \`
  -Zoom200PercentPassed \`
  -SensitiveTopicWordingReviewPassed \`
  -LocalizedCrisisResourcesReviewPassed

if (Get-Command node -ErrorAction SilentlyContinue) {
  node "$PSScriptRoot\\scripts\\verify-manual-release-gates.mjs" "$PSScriptRoot\\manual-release-gates.json"
} else {
  Write-Host "Node was not found in this profile, so local evidence verification was skipped."
  Write-Host "Copy manual-release-gates.json back to app\\release and run npm run qa:public-release:verify."
}
`;
}

function readme(names) {
  const installerList = names.map((name) => `- \`installers/${name}\``).join("\n");
  return `# Bible AI Manual Release QA Package

Use this package from a separate clean Windows profile or VM. It is for evidence collection only and must not contain provider keys.

## Installers

${installerList}

## Checklist

1. Install the generated NSIS or MSI from \`installers/\`.
2. Launch Bible AI for the first time and confirm local app data is created without errors.
3. Open Settings and enter at least two provider credentials.
4. Use the in-app provider test buttons and confirm provider status is clear.
5. Confirm the Council submit panel shows which voices will run.
6. Run a Council question with mock mode disabled and at least two real providers.
7. Save a Council result to a workspace.
8. Export Markdown, HTML, PDF, and backup JSON.
9. Restore backup JSON into a fresh profile.
10. Create and restore a SQLite backup.
11. Open source data drawers and exported files.
12. Confirm no local paths, provider keys, raw API credentials, or credential names appear in exports or source drawers.
13. For upgraded-profile QA, open an existing profile that previously had SQLite-stored provider keys and confirm the keys migrate to the OS credential vault.
14. Complete the full Study Packet workflow using only the keyboard; verify visible focus, Escape focus return, and no focus traps.
15. With a screen reader, smoke-test Reader, Council, Settings, overlays, status/error notices, and critical icon-button labels.
16. Verify Reader, Council, Settings, Theology, Resources, and exports at 200% OS/browser zoom as well as the app's maximum text-size setting.
17. Review sensitive-topic wording with the named safety reviewer; confirm it does not present the app as emergency, medical, or pastoral care.
18. Verify the displayed crisis resources against the official source for every target locale and record the reviewer/date in the safety-resource registry or release evidence.

## Evidence

After the checklist passes, run:

\`\`\`powershell
powershell -ExecutionPolicy Bypass -File .\\RUN-MANUAL-QA.ps1 -Operator "Release QA" -MarkChecklistPassed
\`\`\`

\`-MarkChecklistPassed\` attests that every checklist item above was completed by the named operator. The script writes \`manual-release-gates.json\`. Copy that file back to \`app/release/manual-release-gates.json\` and run:

\`\`\`powershell
cd app
npm run qa:public-release:verify
\`\`\`

Do not paste provider keys or credential values into \`manual-release-gates.json\`.
`;
}

function escapePowerShell(value) {
  return String(value).replaceAll("`", "``").replaceAll('"', '`"');
}
