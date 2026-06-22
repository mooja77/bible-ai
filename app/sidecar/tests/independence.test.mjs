import { test } from "node:test";
import assert from "node:assert/strict";
import { buildIndependenceReport, __test } from "../grounded/independence.mjs";

const { citedIds, jaccard, meanPairwiseJaccard, distinctRoutes } = __test;

function voice(provider, label, ids) {
  return {
    provider,
    status: "ok",
    result: { positions: [{ label, supporting_evidence_ids: ids }] },
  };
}

test("citedIds merges supporting ids + evidence ids, dedups, drops junk", () => {
  const pos = {
    supporting_evidence_ids: [1001001, 1001002, 1001001, 0, -5, "x"],
    evidence: [{ verse_id: 1001003 }, { verse_id: 1001002 }],
  };
  assert.deepEqual(citedIds(pos).sort((a, b) => a - b), [1001001, 1001002, 1001003]);
});

test("jaccard + meanPairwiseJaccard behave", () => {
  assert.equal(jaccard(new Set([1, 2]), new Set([1, 2])), 1);
  assert.equal(jaccard(new Set([1, 2]), new Set([3, 4])), 0);
  assert.equal(jaccard(new Set(), new Set([1])), 0);
  assert.equal(meanPairwiseJaccard([new Set([1, 2]), new Set([1, 2]), new Set([1, 2])]), 1);
});

test("distinctRoutes counts unique non-empty citation signatures", () => {
  assert.equal(distinctRoutes([[1, 2], [2, 1], [3]]), 2); // {1,2} and {3}
  assert.equal(distinctRoutes([[], []]), 0);
});

test("agreement on the SAME proof-texts is flagged correlated, not independent", () => {
  const synthesis = { positions: [{ label: "Grace alone", supporting_evidence_ids: [1, 2] }] };
  const voices = [
    voice("claude", "Grace alone", [1, 2]),
    voice("gpt", "Grace alone", [1, 2]),
    voice("gemini", "Grace alone", [1, 2]),
  ];
  const report = buildIndependenceReport(synthesis, voices);
  assert.equal(report.available, true);
  const p = report.positions[0];
  assert.equal(p.supporting_voice_count, 3);
  assert.equal(p.independence, "correlated");
  assert.deepEqual(p.shared_verse_ids.sort((a, b) => a - b), [1, 2]);
  assert.equal(report.correlated_count, 1);
});

test("agreement from DISTINCT proof-texts is genuine independent corroboration", () => {
  const synthesis = { positions: [{ label: "Faith works", supporting_evidence_ids: [10] }] };
  const voices = [
    voice("claude", "Faith works", [10, 11]),
    voice("gpt", "Faith works", [20, 21]),
    voice("gemini", "Faith works", [30, 31]),
  ];
  const report = buildIndependenceReport(synthesis, voices);
  const p = report.positions[0];
  assert.equal(p.supporting_voice_count, 3);
  assert.equal(p.distinct_route_count, 3);
  assert.equal(p.independence, "independent");
  assert.equal(report.independent_count, 1);
});

test("a position only one voice argues is single_source", () => {
  const synthesis = {
    positions: [
      { label: "Majority", supporting_evidence_ids: [1] },
      { label: "Minority", supporting_evidence_ids: [9] },
    ],
  };
  const voices = [
    voice("claude", "Majority", [1, 2]),
    voice("gpt", "Majority", [3, 4]),
    voice("gemini", "Minority", [9]),
  ];
  const report = buildIndependenceReport(synthesis, voices);
  const minority = report.positions.find((p) => p.label === "Minority");
  assert.equal(minority.independence, "single_source");
  assert.equal(minority.supporting_voice_count, 1);
});

test("independence is unavailable with fewer than two voices", () => {
  const synthesis = { positions: [{ label: "X", supporting_evidence_ids: [1] }] };
  const report = buildIndependenceReport(synthesis, [voice("claude", "X", [1])]);
  assert.equal(report.available, false);
  assert.match(report.note, /two voices/);
});

test("buildIndependenceReport tolerates empty / junk input", () => {
  assert.equal(buildIndependenceReport(null, null).available, false);
  assert.equal(buildIndependenceReport({ positions: [] }, []).available, false);
});
