// Canonical quality-case schema and resolution-rule verifier.
// Contract: docs/quality-ops-plan.md. Running this file validates every JSON
// case under app/tests/quality-cases and fails closed on schema drift.

import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

export const SEVERITIES = ["S0", "S1", "S2", "S3", "S4"];
export const STATUSES = ["open", "fixed", "accepted_risk", "duplicate", "cannot_reproduce"];
export const REDACTION_STATUSES = ["not_needed", "redacted", "blocked"];

export const FAILURE_CLASSES = [
  "fabricated_citation",
  "misquoted_passage",
  "missing_primary_passage",
  "hidden_disagreement",
  "overconfident_disputed_claim",
  "tradition_lens_misrepresentation",
  "sensitive_topic_safety_failure",
  "prompt_injection_resource_poisoning",
  "retrieval_false_positive",
  "retrieval_false_negative",
  "export_audit_gap",
  "licensing_attribution_gap",
  "accessibility_readability",
];

const REQUIRED_FIELDS = [
  "case_id",
  "severity",
  "source",
  "user_workflow",
  "prompt",
  "passage_resource_context",
  "provider_model",
  "retrieval_mode",
  "expected_behavior",
  "actual_behavior",
  "failure_class",
  "status",
  "linked_fix",
  "linked_regression_fixture",
  "accepted_risk_rationale",
  "redaction_status",
];

function hasText(value) {
  return typeof value === "string" && value.trim() !== "";
}

function hasOwn(record, field) {
  return Object.prototype.hasOwnProperty.call(record, field);
}

/** Return canonical schema errors for one quality case (empty means valid). */
export function validateQualityCase(qualityCase) {
  if (!qualityCase || typeof qualityCase !== "object" || Array.isArray(qualityCase)) {
    return ["quality case must be an object"];
  }

  const errors = [];
  for (const field of REQUIRED_FIELDS) {
    if (!hasOwn(qualityCase, field)) errors.push(`missing required field: ${field}`);
  }

  for (const field of [
    "case_id",
    "source",
    "user_workflow",
    "prompt",
    "passage_resource_context",
    "provider_model",
    "retrieval_mode",
    "expected_behavior",
    "actual_behavior",
  ]) {
    if (hasOwn(qualityCase, field) && !hasText(qualityCase[field])) {
      errors.push(`${field} must be a non-empty string`);
    }
  }

  if (qualityCase.severity !== undefined && !SEVERITIES.includes(qualityCase.severity)) {
    errors.push(`unknown severity: ${qualityCase.severity}`);
  }
  if (qualityCase.status !== undefined && !STATUSES.includes(qualityCase.status)) {
    errors.push(`unknown status: ${qualityCase.status}`);
  }
  if (
    qualityCase.redaction_status !== undefined &&
    !REDACTION_STATUSES.includes(qualityCase.redaction_status)
  ) {
    errors.push(`unknown redaction_status: ${qualityCase.redaction_status}`);
  }
  if (!Array.isArray(qualityCase.failure_class) || qualityCase.failure_class.length === 0) {
    errors.push("failure_class must be a non-empty array");
  } else {
    const unknown = qualityCase.failure_class.filter((item) => !FAILURE_CLASSES.includes(item));
    if (unknown.length > 0) errors.push(`unknown failure_class: ${unknown.join(", ")}`);
    if (new Set(qualityCase.failure_class).size !== qualityCase.failure_class.length) {
      errors.push("failure_class must not contain duplicates");
    }
  }
  if (qualityCase.repeated !== undefined && typeof qualityCase.repeated !== "boolean") {
    errors.push("repeated must be boolean when present");
  }
  for (const field of [
    "linked_fix",
    "linked_regression_fixture",
    "accepted_risk_rationale",
    "accepted_risk_owner",
  ]) {
    if (
      hasOwn(qualityCase, field) &&
      qualityCase[field] !== null &&
      !hasText(qualityCase[field])
    ) {
      errors.push(`${field} must be null or a non-empty string`);
    }
  }
  return errors;
}

function isFixtureGated(qualityCase) {
  return (
    qualityCase.severity === "S0" ||
    qualityCase.severity === "S1" ||
    (qualityCase.severity === "S2" && qualityCase.repeated === true)
  );
}

/** Enforce the documented fixture-or-accepted-risk resolution rule. */
export function resolutionViolations(cases) {
  const violations = [];
  for (const qualityCase of cases) {
    const id = qualityCase.case_id ?? "(no case_id)";
    if (qualityCase.redaction_status === "blocked" && qualityCase.status !== "open") {
      violations.push(`${id}: redaction-blocked content must remain open`);
    }
    if (qualityCase.status === "accepted_risk") {
      if (!hasText(qualityCase.accepted_risk_rationale)) {
        violations.push(`${id}: accepted_risk requires accepted_risk_rationale`);
      }
      if (!hasText(qualityCase.accepted_risk_owner)) {
        violations.push(`${id}: accepted_risk requires accepted_risk_owner`);
      }
      continue;
    }
    if (qualityCase.status === "fixed" && isFixtureGated(qualityCase)) {
      if (!hasText(qualityCase.linked_regression_fixture)) {
        violations.push(
          `${id}: a fixed ${qualityCase.severity} case must link a regression fixture or be an accepted risk`,
        );
      }
      if (!hasText(qualityCase.linked_fix)) {
        violations.push(`${id}: a fixed ${qualityCase.severity} case must link its fix`);
      }
    }
  }
  return violations;
}

function loadCases(dir) {
  const cases = [];
  for (const file of readdirSync(dir).filter((name) => name.endsWith(".json")).sort()) {
    const raw = JSON.parse(readFileSync(join(dir, file), "utf8"));
    const records = Array.isArray(raw) ? raw : Array.isArray(raw.cases) ? raw.cases : [raw];
    for (const record of records) cases.push({ ...record, __file: file });
  }
  return cases;
}

function main() {
  const here = dirname(fileURLToPath(import.meta.url));
  const dir = join(here, "..", "tests", "quality-cases");
  let cases;
  try {
    cases = loadCases(dir);
  } catch (error) {
    console.error(`quality-cases: could not load cases from ${dir}: ${error.message}`);
    process.exit(1);
  }

  const problems = [];
  const ids = new Map();
  for (const qualityCase of cases) {
    for (const error of validateQualityCase(qualityCase)) {
      problems.push(`[${qualityCase.__file}] ${qualityCase.case_id ?? "(no case_id)"}: ${error}`);
    }
    if (hasText(qualityCase.case_id)) {
      if (ids.has(qualityCase.case_id)) {
        problems.push(
          `[${qualityCase.__file}] duplicate case_id ${qualityCase.case_id}; first seen in ${ids.get(qualityCase.case_id)}`,
        );
      } else {
        ids.set(qualityCase.case_id, qualityCase.__file);
      }
    }
  }
  for (const violation of resolutionViolations(cases)) problems.push(`[resolution] ${violation}`);

  if (problems.length > 0) {
    for (const problem of problems) console.error(problem);
    console.error(`quality-cases: ${problems.length} problem(s) found`);
    process.exit(1);
  }
  console.log(`quality-cases: ${cases.length} case(s) validated against the canonical schema`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main();
