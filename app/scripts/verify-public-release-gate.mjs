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

const checks = [
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
    label: "Manual clean-profile and credential-vault QA",
    command: [process.execPath, "scripts/verify-manual-release-gates.mjs", manualEvidence],
  },
];

const missing = [];
if (!existsSync(resolve(realCouncilFixture))) {
  missing.push(`Council QA fixture missing: ${resolve(realCouncilFixture)}`);
}
if (!existsSync(resolve(manualEvidence))) {
  missing.push(`Manual QA evidence missing: ${resolve(manualEvidence)}`);
}

if (missing.length > 0) {
  console.error("Public release gate cannot run:");
  for (const item of missing) console.error(`- ${item}`);
  console.error("");
  console.error("Create the missing evidence with:");
  console.error("- python ../scripts/run_real_council_qa.py --limit 20 --continue-on-error");
  console.error("- npm run qa:manual-gates:template");
  process.exit(1);
}

const failures = [];
for (const check of checks) {
  console.log(`Running ${check.label}...`);
  const result = spawnSync(check.command[0], check.command.slice(1), {
    cwd: process.cwd(),
    stdio: "inherit",
  });
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
