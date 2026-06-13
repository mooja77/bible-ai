// Quality-case schema, validator, and resolution-rule enforcer for the AI
// quality-ops loop (EP-022; schema per docs/quality-ops-plan.md +
// docs/ai-risk-eval-plan.md). Pure functions are exported and unit-tested in
// sidecar/tests/quality-cases.test.mjs; running this file directly validates
// every case under app/tests/quality-cases/ and exits non-zero on any problem.

import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

export const SEVERITIES = ["S0", "S1", "S2", "S3"];

export const STATUSES = ["open", "investigating", "resolved", "accepted_risk", "wont_fix"];

export const FAILURE_CLASSES = [
  "fabricated_citation",
  "misquoted_passage",
  "missing_primary_passage",
  "hidden_disagreement",
  "overconfident_claim",
  "tradition_misrepresentation",
  "sensitive_topic_failure",
  "prompt_injection",
  "retrieval_false_positive",
  "retrieval_false_negative",
  "export_audit_gap",
  "licensing_gap",
  "accessibility_issue",
];

const REQUIRED_FIELDS = [
  "id",
  "severity",
  "source",
  "user_workflow",
  "prompt",
  "failure_class",
  "status",
];

function hasText(value) {
  return typeof value === "string" && value.trim() !== "";
}

/** Return a list of schema errors for one quality case (empty = valid). */
export function validateQualityCase(qualityCase) {
  if (!qualityCase || typeof qualityCase !== "object") {
    return ["quality case must be an object"];
  }
  const errors = [];
  for (const field of REQUIRED_FIELDS) {
    const value = qualityCase[field];
    if (value === undefined || value === null || (typeof value === "string" && value.trim() === "")) {
      errors.push(`missing required field: ${field}`);
    }
  }
  if (qualityCase.severity !== undefined && !SEVERITIES.includes(qualityCase.severity)) {
    errors.push(`unknown severity: ${qualityCase.severity}`);
  }
  if (qualityCase.status !== undefined && !STATUSES.includes(qualityCase.status)) {
    errors.push(`unknown status: ${qualityCase.status}`);
  }
  if (
    qualityCase.failure_class !== undefined &&
    !FAILURE_CLASSES.includes(qualityCase.failure_class)
  ) {
    errors.push(`unknown failure_class: ${qualityCase.failure_class}`);
  }
  return errors;
}

/** Cases that must link a regression fixture before they can be "resolved". */
function isFixtureGated(qualityCase) {
  if (qualityCase.severity === "S0" || qualityCase.severity === "S1") return true;
  if (qualityCase.severity === "S2" && qualityCase.repeated === true) return true;
  return false;
}

/**
 * Enforce the quality-ops resolution rule: an S0/S1 (or recurred S2) case marked
 * "resolved" must link a regression fixture; a case marked "accepted_risk" must
 * carry a written rationale. Returns a list of human-readable violations.
 */
export function resolutionViolations(cases) {
  const violations = [];
  for (const qualityCase of cases) {
    const id = qualityCase.id ?? "(no id)";
    if (qualityCase.status === "accepted_risk") {
      if (!hasText(qualityCase.accepted_risk)) {
        violations.push(`${id}: status accepted_risk requires an accepted_risk rationale`);
      }
      continue;
    }
    if (qualityCase.status === "resolved" && isFixtureGated(qualityCase)) {
      if (!hasText(qualityCase.linked_fixture)) {
        violations.push(
          `${id}: a resolved ${qualityCase.severity} case must link a regression fixture (or be recorded as an accepted_risk)`,
        );
      }
    }
  }
  return violations;
}

function loadCases(dir) {
  const cases = [];
  for (const file of readdirSync(dir).filter((f) => f.endsWith(".json"))) {
    const raw = JSON.parse(readFileSync(join(dir, file), "utf8"));
    const arr = Array.isArray(raw) ? raw : Array.isArray(raw.cases) ? raw.cases : [raw];
    for (const c of arr) cases.push({ ...c, __file: file });
  }
  return cases;
}

function main() {
  const here = dirname(fileURLToPath(import.meta.url));
  const dir = join(here, "..", "tests", "quality-cases");
  let cases;
  try {
    cases = loadCases(dir);
  } catch (err) {
    console.error(`quality-cases: could not load cases from ${dir}: ${err.message}`);
    process.exit(1);
  }
  let problems = 0;
  for (const qualityCase of cases) {
    for (const error of validateQualityCase(qualityCase)) {
      console.error(`[${qualityCase.__file}] ${qualityCase.id ?? "(no id)"}: ${error}`);
      problems += 1;
    }
  }
  for (const violation of resolutionViolations(cases)) {
    console.error(`[resolution] ${violation}`);
    problems += 1;
  }
  if (problems > 0) {
    console.error(`quality-cases: ${problems} problem(s) found`);
    process.exit(1);
  }
  console.log(`quality-cases: ${cases.length} case(s) validated OK`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main();
}
