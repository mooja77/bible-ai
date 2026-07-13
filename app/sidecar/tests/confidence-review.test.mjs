import { test } from "node:test";
import assert from "node:assert/strict";
import { evaluateConfidenceReview } from "../../scripts/verify-council-confidence-review.mjs";

function completedReview(overrides = {}) {
  const cases = Array.from({ length: 20 }, (_, index) => ({
    case_id: `case-${String(index + 1).padStart(3, "0")}`,
    question: "",
    system_adjusted_band: index < 12 ? "moderate" : "low",
    human_band: index < 12 ? "moderate" : "low",
    confidence_humility_score: 2,
    blocking_issue: false,
    reviewer_notes: "Evidence, dissent, and limitations were reviewed.",
  }));
  return {
    format_version: 1,
    evaluation_name: "council-confidence-adjustment-labelled-agreement-v1",
    status: "complete",
    source_fixture: { sha256: "a".repeat(64) },
    policy: {
      minimum_cases: 20,
      minimum_exact_agreement: 0.6,
      minimum_within_one_band: 0.9,
      maximum_overstatement_rate: 0.15,
      maximum_severe_overstatement_count: 0,
      maximum_blocking_issue_count: 0,
    },
    reviewer: {
      name: "Named reviewer",
      role: "theological quality reviewer",
      reviewed_at: "2026-07-13T12:00:00Z",
    },
    cases,
    ...overrides,
  };
}

const source = {
  results: Array.from({ length: 20 }, (_, index) => ({
    response: {
      soft_layer: { confidence: { adjusted: index < 12 ? "moderate" : "low" } },
    },
  })),
};

test("a complete labelled agreement review passes", () => {
  const result = evaluateConfidenceReview(completedReview(), source, "a".repeat(64));
  assert.deepEqual(result.failures, []);
  assert.equal(result.metrics.exact_agreement, 1);
});

test("review fails on stale source, missing labels, or anonymous review", () => {
  const review = completedReview({ reviewer: { name: null, role: null, reviewed_at: null } });
  review.cases[0].human_band = null;
  const result = evaluateConfidenceReview(review, source, "b".repeat(64));
  assert.ok(result.failures.some((failure) => /SHA-256/.test(failure)));
  assert.ok(result.failures.some((failure) => /reviewer.name/.test(failure)));
  assert.ok(result.failures.some((failure) => /human_band/.test(failure)));
});

test("confidence overstatement and blocking issues fail policy", () => {
  const review = completedReview();
  for (let index = 0; index < 4; index += 1) review.cases[index].human_band = "contested";
  review.cases[4].blocking_issue = true;
  const result = evaluateConfidenceReview(review, source, "a".repeat(64));
  assert.ok(result.failures.some((failure) => /overstatement rate/.test(failure)));
  assert.ok(result.failures.some((failure) => /severe overstatement/.test(failure)));
  assert.ok(result.failures.some((failure) => /blocking issue/.test(failure)));
});
