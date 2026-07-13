import { test } from "node:test";
import assert from "node:assert/strict";
import {
  validateQualityCase,
  resolutionViolations,
  SEVERITIES,
  STATUSES,
  FAILURE_CLASSES,
} from "../../scripts/run-quality-cases.mjs";

function validCase(overrides = {}) {
  return {
    case_id: "QC-001",
    severity: "S0",
    source: "user_report",
    user_workflow: "council",
    prompt: "How should Romans 9 be weighed in debates about election?",
    passage_resource_context: "Romans 9 with retrieved evidence IDs 1-8.",
    provider_model: "recorded openai/model-a + gemini/model-b",
    retrieval_mode: "hybrid",
    expected_behavior: "Use only retrieved evidence and preserve disagreement.",
    actual_behavior: "A citation outside the retrieved evidence was displayed.",
    failure_class: ["fabricated_citation"],
    status: "fixed",
    linked_fix: "app/sidecar/grounded/grounding-floor.mjs",
    linked_regression_fixture: "app/sidecar/tests/grounding-floor.test.mjs",
    accepted_risk_rationale: null,
    redaction_status: "not_needed",
    ...overrides,
  };
}

test("a complete canonical quality case validates", () => {
  assert.deepEqual(validateQualityCase(validCase()), []);
});

test("missing and empty required fields are reported", () => {
  const qualityCase = validCase({ case_id: undefined, prompt: "" });
  delete qualityCase.provider_model;
  const errors = validateQualityCase(qualityCase);
  assert.ok(errors.some((error) => error.includes("case_id")), errors.join("; "));
  assert.ok(errors.some((error) => error.includes("prompt")), errors.join("; "));
  assert.ok(errors.some((error) => error.includes("provider_model")), errors.join("; "));
});

test("unknown enum values and scalar failure classes are rejected", () => {
  const errors = validateQualityCase(
    validCase({
      severity: "S9",
      status: "resolved",
      failure_class: "fabricated_citation",
      redaction_status: "maybe",
    }),
  );
  assert.ok(errors.some((error) => error.includes("severity")));
  assert.ok(errors.some((error) => error.includes("status")));
  assert.ok(errors.some((error) => error.includes("failure_class")));
  assert.ok(errors.some((error) => error.includes("redaction_status")));
});

test("enum sets cover every documented severity and canonical status", () => {
  assert.deepEqual(SEVERITIES, ["S0", "S1", "S2", "S3", "S4"]);
  assert.ok(STATUSES.includes("fixed") && STATUSES.includes("accepted_risk"));
  assert.ok(FAILURE_CLASSES.includes("prompt_injection_resource_poisoning"));
});

test("a fixed S0 case requires both a linked fix and fixture", () => {
  const violations = resolutionViolations([
    validCase({ linked_fix: null, linked_regression_fixture: null }),
  ]);
  assert.equal(violations.length, 2);
});

test("a fixed S0 case with fix and fixture is allowed", () => {
  assert.deepEqual(resolutionViolations([validCase()]), []);
});

test("a fixed S2 case is fixture-gated only when repeated", () => {
  assert.deepEqual(
    resolutionViolations([
      validCase({
        severity: "S2",
        linked_fix: null,
        linked_regression_fixture: null,
      }),
    ]),
    [],
  );
  const violations = resolutionViolations([
    validCase({
      severity: "S2",
      repeated: true,
      linked_fix: null,
      linked_regression_fixture: null,
    }),
  ]);
  assert.equal(violations.length, 2);
});

test("an accepted risk requires a rationale and accepting owner", () => {
  const invalid = resolutionViolations([
    validCase({
      status: "accepted_risk",
      linked_fix: null,
      linked_regression_fixture: null,
      accepted_risk_rationale: null,
    }),
  ]);
  assert.equal(invalid.length, 2);
  assert.deepEqual(
    resolutionViolations([
      validCase({
        status: "accepted_risk",
        linked_fix: null,
        linked_regression_fixture: null,
        accepted_risk_rationale: "A bounded workaround exists for the private pilot.",
        accepted_risk_owner: "named quality owner",
      }),
    ]),
    [],
  );
});

test("redaction-blocked cases cannot be closed", () => {
  const violations = resolutionViolations([
    validCase({ redaction_status: "blocked", status: "fixed" }),
  ]);
  assert.equal(violations.length, 1);
  assert.match(violations[0], /must remain open/);
});
