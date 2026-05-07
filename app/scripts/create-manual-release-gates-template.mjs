import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

const outputPath = resolve(process.argv[2] ?? "release/manual-release-gates.json");
const template = {
  operator: "",
  completed_at: new Date().toISOString(),
  windows_profile: "",
  installer_artifacts: [],
  clean_profile_install_passed: false,
  first_launch_passed: false,
  settings_provider_keys_passed: false,
  credential_vault_clean_profile_passed: false,
  credential_vault_upgrade_profile_passed: false,
  exports_secret_leak_check_passed: false,
  backup_restore_passed: false,
  sqlite_backup_restore_passed: false,
  notes: [
    "Run this on a separate clean Windows user profile or VM.",
    "Do not paste provider keys or credential values into this file.",
  ],
};

mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, `${JSON.stringify(template, null, 2)}\n`);
console.log(`Wrote manual release gate template: ${outputPath}`);
