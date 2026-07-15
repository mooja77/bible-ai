import { createHash } from "node:crypto";
import { createReadStream, existsSync, readFileSync, statSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const evidencePath = resolve(process.argv[2] ?? "release/macos-manual-release-gates.json");
const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const requiredBooleans = [
  "developer_id_signature_passed",
  "notarization_passed",
  "staple_validation_passed",
  "gatekeeper_assessment_passed",
  "clean_profile_install_passed",
  "first_launch_passed",
  "keychain_storage_passed",
  "keychain_backup_exclusion_passed",
  "real_provider_setup_passed",
  "real_council_run_passed",
  "workspace_export_passed",
  "backup_restore_passed",
  "restart_persistence_passed",
  "exports_secret_leak_check_passed",
  "keyboard_only_workflow_passed",
  "screen_reader_smoke_passed",
  "zoom_200_percent_passed",
  "sensitive_topic_wording_review_passed",
  "localized_crisis_resources_review_passed",
];

const failures = [];
if (!existsSync(evidencePath)) {
  failures.push(`macOS manual QA evidence missing: ${evidencePath}`);
} else {
  const evidence = JSON.parse(readFileSync(evidencePath, "utf8"));
  if (evidence.format_version !== 1) failures.push("format_version must be 1");
  for (const field of ["operator", "macos_version", "hardware", "clean_profile"]) {
    if (!String(evidence[field] ?? "").trim()) failures.push(`${field} is required`);
  }
  if (!evidence.completed_at || Number.isNaN(Date.parse(evidence.completed_at))) {
    failures.push("completed_at must be an ISO date/time");
  }
  for (const field of requiredBooleans) {
    if (evidence[field] !== true) failures.push(`${field} must be true`);
  }
  await verifyDmg(evidence.dmg_artifact);
  for (const [index, note] of (Array.isArray(evidence.notes) ? evidence.notes : []).entries()) {
    if (String(note).match(/(api[_-]?key|sk-[A-Za-z0-9]|AIza[ A-Za-z0-9_-]+)/i)) {
      failures.push(`note ${index + 1} appears to contain a credential-like value`);
    }
  }
}

if (failures.length > 0) {
  console.error("macOS manual release gate failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`macOS manual release gate passed: ${evidencePath}`);

async function verifyDmg(artifact) {
  const name = basename(String(artifact?.name ?? ""));
  if (!name.toLowerCase().endsWith(".dmg")) failures.push("dmg_artifact.name must be a .dmg file");
  if (!Number.isInteger(artifact?.bytes) || artifact.bytes <= 0) {
    failures.push("dmg_artifact.bytes must be a positive integer");
  }
  if (!/^[a-f0-9]{64}$/.test(String(artifact?.sha256 ?? ""))) {
    failures.push("dmg_artifact.sha256 must be a lowercase 64-character digest");
  }
  const candidates = [
    join(appRoot, "installers", name),
    join(appRoot, "src-tauri", "target", "release", "bundle", "dmg", name),
    join(appRoot, "src-tauri", "target", "release", "macos-release-package", name),
  ];
  const currentPath = candidates.find((path) => existsSync(path) && statSync(path).isFile());
  if (!currentPath) {
    failures.push(`${name || "DMG"}: current installer file is missing`);
    return;
  }
  if (statSync(currentPath).size !== artifact.bytes) {
    failures.push(`${name}: byte count does not match the current DMG`);
    return;
  }
  if ((await sha256(currentPath)) !== artifact.sha256) {
    failures.push(`${name}: SHA-256 does not match the current DMG`);
  }
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
