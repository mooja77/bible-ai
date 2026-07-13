import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const evidencePath = resolve(process.argv[2] ?? "release/manual-release-gates.json");
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
  if (!Array.isArray(evidence.installer_artifacts) || evidence.installer_artifacts.length === 0) {
    failures.push("installer_artifacts must list the NSIS/MSI files tested");
  }
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
