import { createHash } from "node:crypto";
import { createReadStream, existsSync, readFileSync, statSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const evidencePath = resolve(process.argv[2] ?? "release/manual-release-gates.json");
const packageOrAppRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const requiredBooleans = [
  "clean_profile_install_passed",
  "first_launch_passed",
  "settings_provider_keys_passed",
  "credential_vault_clean_profile_passed",
  "credential_vault_upgrade_profile_passed",
  "exports_secret_leak_check_passed",
  "backup_restore_passed",
  "sqlite_backup_restore_passed",
  "keyboard_only_workflow_passed",
  "screen_reader_smoke_passed",
  "zoom_200_percent_passed",
  "sensitive_topic_wording_review_passed",
  "localized_crisis_resources_review_passed",
];

const failures = [];
if (!existsSync(evidencePath)) {
  failures.push(`manual QA evidence missing: ${evidencePath}`);
} else {
  const evidence = JSON.parse(readFileSync(evidencePath, "utf8"));
  if (!evidence.operator || !String(evidence.operator).trim()) {
    failures.push("operator is required");
  }
  if (!evidence.completed_at || Number.isNaN(Date.parse(evidence.completed_at))) {
    failures.push("completed_at must be an ISO date/time");
  }
  if (!evidence.windows_profile || !String(evidence.windows_profile).trim()) {
    failures.push("windows_profile is required");
  }
  for (const key of requiredBooleans) {
    if (evidence[key] !== true) failures.push(`${key} must be true`);
  }
  await verifyInstallerArtifacts(evidence.installer_artifacts);
  if (Array.isArray(evidence.notes)) {
    for (const [index, note] of evidence.notes.entries()) {
      if (String(note).match(/(api[_-]?key|sk-[A-Za-z0-9]|AIza[ A-Za-z0-9_-]+)/i)) {
        failures.push(`note ${index + 1} appears to contain a credential-like value`);
      }
    }
  }
}

if (failures.length > 0) {
  console.error("Manual release gate failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Manual release gate passed: ${evidencePath}`);

async function verifyInstallerArtifacts(artifacts) {
  if (!Array.isArray(artifacts) || artifacts.length < 2) {
    failures.push("installer_artifacts must contain identity records for the NSIS and MSI tested");
    return;
  }
  const seenNames = new Set();
  const seenExtensions = new Set();
  for (const artifact of artifacts) {
    const name = basename(String(artifact?.name ?? ""));
    const label = name || "installer artifact";
    if (!name || seenNames.has(name)) {
      failures.push(`${label}: name must be non-empty and unique`);
      continue;
    }
    seenNames.add(name);
    const extension = name.toLowerCase().endsWith(".msi")
      ? ".msi"
      : name.toLowerCase().endsWith(".exe")
        ? ".exe"
        : "";
    if (!extension) failures.push(`${label}: expected an .exe or .msi installer`);
    else seenExtensions.add(extension);
    if (!Number.isInteger(artifact?.bytes) || artifact.bytes <= 0) {
      failures.push(`${label}: bytes must be a positive integer`);
    }
    if (!/^[a-f0-9]{64}$/.test(String(artifact?.sha256 ?? ""))) {
      failures.push(`${label}: sha256 must be a lowercase 64-character digest`);
    }

    const currentPath = findCurrentArtifact(name);
    if (!currentPath) {
      failures.push(`${label}: current installer file is missing`);
      continue;
    }
    const currentBytes = statSync(currentPath).size;
    if (currentBytes !== artifact.bytes) {
      failures.push(`${label}: byte mismatch; evidence=${artifact.bytes} current=${currentBytes}`);
      continue;
    }
    const currentHash = await sha256(currentPath);
    if (currentHash !== artifact.sha256) {
      failures.push(`${label}: SHA-256 does not match the current installer`);
    }
  }
  if (!seenExtensions.has(".exe")) failures.push("installer_artifacts must include the NSIS .exe");
  if (!seenExtensions.has(".msi")) failures.push("installer_artifacts must include the MSI");
}

function findCurrentArtifact(name) {
  const candidates = [
    join(packageOrAppRoot, "installers", name),
    join(packageOrAppRoot, "src-tauri", "target", "release", "bundle", "nsis", name),
    join(packageOrAppRoot, "src-tauri", "target", "release", "bundle", "msi", name),
  ];
  return candidates.find((path) => existsSync(path) && statSync(path).isFile()) ?? null;
}

function sha256(path) {
  return new Promise((resolveHash, rejectHash) => {
    const hash = createHash("sha256");
    const stream = createReadStream(path);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("error", rejectHash);
    stream.on("end", () => resolveHash(hash.digest("hex")));
  });
}
