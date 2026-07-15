import { createHash } from "node:crypto";
import { createReadStream, existsSync, mkdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { findMacosDmg } from "./macos-release-utils.mjs";

const args = parseArgs(process.argv);
const dmgPath = resolve(args.get("dmg") ?? findMacosDmg() ?? "");
const outputPath = resolve(args.get("output") ?? "release/macos-manual-release-gates.json");

if (!dmgPath || !existsSync(dmgPath) || !statSync(dmgPath).isFile()) {
  console.error("macOS QA template failed: provide an existing DMG with --dmg <path>.");
  process.exit(1);
}

const payload = {
  format_version: 1,
  operator: "",
  completed_at: "",
  macos_version: "",
  hardware: "",
  clean_profile: "",
  dmg_artifact: {
    name: dmgPath.split(/[\\/]/).at(-1),
    bytes: statSync(dmgPath).size,
    sha256: await sha256(dmgPath),
  },
  developer_id_signature_passed: false,
  notarization_passed: false,
  staple_validation_passed: false,
  gatekeeper_assessment_passed: false,
  clean_profile_install_passed: false,
  first_launch_passed: false,
  keychain_storage_passed: false,
  keychain_backup_exclusion_passed: false,
  real_provider_setup_passed: false,
  real_council_run_passed: false,
  workspace_export_passed: false,
  backup_restore_passed: false,
  restart_persistence_passed: false,
  exports_secret_leak_check_passed: false,
  keyboard_only_workflow_passed: false,
  screen_reader_smoke_passed: false,
  zoom_200_percent_passed: false,
  sensitive_topic_wording_review_passed: false,
  localized_crisis_resources_review_passed: false,
  notes: [],
};

mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
console.log(`macOS manual QA template written: ${outputPath}`);

function parseArgs(argv) {
  const values = new Map();
  for (let index = 2; index < argv.length; index += 1) {
    if (!argv[index].startsWith("--")) continue;
    values.set(argv[index].slice(2), argv[index + 1]);
    index += 1;
  }
  return values;
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
