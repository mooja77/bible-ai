import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

const args = new Map();
for (let i = 2; i < process.argv.length; i += 1) {
  const key = process.argv[i];
  if (!key.startsWith("--")) continue;
  const next = process.argv[i + 1];
  if (next && !next.startsWith("--")) {
    args.set(key.slice(2), next);
    i += 1;
  } else {
    args.set(key.slice(2), "true");
  }
}

const realCouncilFixture = args.get("council-fixture") ?? "tests/fixtures/council-real-results.json";
const manualEvidence = args.get("manual-evidence") ?? "release/manual-release-gates.json";
const contentReview = args.get("content-review") ?? "release/content-review.json";
const confidenceReview = args.get("confidence-review") ?? "release/council-confidence-review.json";
const macosEvidence = args.get("macos-evidence");
const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";

const checks = [
  {
    label: "Corpus source lock",
    command: ["python", "../scripts/verify_corpus_lock.py"],
  },
  {
    label: "Corpus integrity and edition coverage",
    command: ["python", "../scripts/verify_corpus.py"],
  },
  {
    label: "Schema mirror sync",
    command: [process.execPath, "scripts/verify-schema-sync.mjs"],
  },
  {
    label: "Software bills of materials",
    command: [process.execPath, "scripts/generate-sbom.mjs"],
  },
  {
    label: "SBOM validation",
    command: [process.execPath, "scripts/verify-sbom.mjs"],
  },
  {
    label: "App dependency audit",
    command: [npmCommand, "audit", "--audit-level=high"],
    shell: process.platform === "win32",
  },
  {
    label: "Sidecar dependency audit",
    command: [npmCommand, "audit", "--prefix", "sidecar", "--audit-level=high"],
    shell: process.platform === "win32",
  },
  {
    label: "Rust dependency audit",
    command: ["cargo", "audit", "--file", "src-tauri/Cargo.lock"],
  },
  {
    label: "Real Council QA",
    command: [
      process.execPath,
      "scripts/verify-real-council-qa.mjs",
      "--fixture",
      realCouncilFixture,
    ],
  },
  {
    label: "Human Council confidence-band review",
    command: [
      process.execPath,
      "scripts/verify-council-confidence-review.mjs",
      "--review",
      confidenceReview,
    ],
  },
  {
    label: "Manual clean-profile and credential-vault QA",
    command: [process.execPath, "scripts/verify-manual-release-gates.mjs", manualEvidence],
  },
  {
    label: "Human content rights review",
    command: [process.execPath, "scripts/verify-content-review.mjs", contentReview],
  },
];

if (macosEvidence) {
  checks.push({
    label: "Manual clean-profile macOS QA",
    command: [process.execPath, "scripts/verify-macos-manual-release-gates.mjs", macosEvidence],
  });
}

const missing = [];
if (!existsSync(resolve(realCouncilFixture))) {
  missing.push(`Council QA fixture missing: ${resolve(realCouncilFixture)}`);
}
if (!existsSync(resolve(manualEvidence))) {
  missing.push(`Manual QA evidence missing: ${resolve(manualEvidence)}`);
}
if (!existsSync(resolve(contentReview))) {
  missing.push(`Content review evidence missing: ${resolve(contentReview)}`);
}
if (!existsSync(resolve(confidenceReview))) {
  missing.push(`Confidence review evidence missing: ${resolve(confidenceReview)}`);
}
if (macosEvidence && !existsSync(resolve(macosEvidence))) {
  missing.push(`macOS manual QA evidence missing: ${resolve(macosEvidence)}`);
}

if (missing.length > 0) {
  console.error("Public release gate cannot run:");
  for (const item of missing) console.error(`- ${item}`);
  console.error("");
  console.error("Create the missing evidence with:");
  console.error("- python ../scripts/run_real_council_qa.py --limit 20 --continue-on-error");
  console.error("- npm run qa:manual-gates:template");
  console.error("- npm run qa:content-review:template");
  console.error("- npm run qa:confidence-review:template");
  process.exit(1);
}

const failures = [];
for (const check of checks) {
  console.log(`Running ${check.label}...`);
  const result = spawnSync(check.command[0], check.command.slice(1), {
    cwd: process.cwd(),
    stdio: "inherit",
    shell: check.shell ?? false,
  });
  if (result.error) {
    console.error(`${check.label} could not start: ${result.error.message}`);
  }
  if (result.status !== 0) failures.push(check.label);
}

if (failures.length > 0) {
  console.error("");
  console.error("Public release gate failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("");
console.log("Public release gate passed.");
