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
    id: "QC-001",
    severity: "S0",
    source: "beta-user-report",
    user_workflow: "council",
    prompt: "How should Romans 9 be weighed in debates about election?",
    failure_class: "fabricated_citation",
    status: "resolved",
    linked_fixture: "tests/fixtures/council-quality.json#romans9",
    ...overrides,
  };
}

test("a complete quality case validates with no errors", () => {
  assert.deepEqual(validateQualityCase(validCase()), []);
});

test("missing required fields are reported", () => {
  const errors = validateQualityCase(validCase({ id: undefined, prompt: "" }));
  assert.ok(errors.some((e) => e.includes("id")), errors.join("; "));
  assert.ok(errors.some((e) => e.includes("prompt")), errors.join("; "));
});

test("unknown severity / status / failure_class are rejected", () => {
  const errors = validateQualityCase(
    validCase({ severity: "S9", status: "maybe", failure_class: "vibes" }),
  );
  assert.ok(errors.some((e) => e.includes("severity")));
  assert.ok(errors.some((e) => e.includes("status")));
  assert.ok(errors.some((e) => e.includes("failure_class")));
});

test("enum sets cover the documented values", () => {
  assert.ok(SEVERITIES.includes("S0") && SEVERITIES.includes("S3"));
  assert.ok(STATUSES.includes("resolved") && STATUSES.includes("accepted_risk"));
  assert.ok(FAILURE_CLASSES.includes("fabricated_citation"));
});

test("a resolved S0 case without a linked fixture is a violation", () => {
  const v = resolutionViolations([validCase({ linked_fixture: undefined })]);
  assert.equal(v.length, 1);
  assert.ok(v[0].includes("QC-001"));
});

test("a resolved S0 case with a linked fixture is allowed", () => {
  assert.deepEqual(resolutionViolations([validCase()]), []);
});

test("a resolved S2 case is only gated when it has recurred", () => {
  assert.deepEqual(
    resolutionViolations([
      validCase({ id: "QC-2", severity: "S2", linked_fixture: undefined }),
    ]),
    [],
  );
  const recurred = resolutionViolations([
    validCase({ id: "QC-3", severity: "S2", repeated: true, linked_fixture: undefined }),
  ]);
  assert.equal(recurred.length, 1);
});

test("an accepted-risk case must carry a rationale", () => {
  const v = resolutionViolations([
    validCase({ id: "QC-4", status: "accepted_risk", linked_fixture: undefined, accepted_risk: "" }),
  ]);
  assert.equal(v.length, 1);
  assert.deepEqual(
    resolutionViolations([
      validCase({
        id: "QC-5",
        status: "accepted_risk",
        linked_fixture: undefined,
        accepted_risk: "Provider rarely returns this; documented, revisit at GA.",
      }),
    ]),
    [],
  );
});
