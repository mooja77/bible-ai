import { test } from "node:test";
import assert from "node:assert/strict";
import { buildSoftLayer, semanticEntropy, adjustConfidence } from "../grounded/soft-layer.mjs";

function voice(provider, label) {
  return { provider, status: "ok", result: { positions: [{ label, weight: 0.8 }] } };
}

test("semanticEntropy is 0 when every voice favors the same view", () => {
  const e = semanticEntropy([voice("a", "Grace alone"), voice("b", "Grace alone"), voice("c", "Grace alone")]);
  assert.equal(e.available, true);
  assert.equal(e.value, 0);
  assert.equal(e.label, "consensus");
});

test("semanticEntropy is high when voices split across views", () => {
  const e = semanticEntropy([voice("a", "View A"), voice("b", "View B"), voice("c", "View C")]);
  assert.equal(e.available, true);
  assert.equal(e.value, 1); // even 3-way split, normalized → 1
  assert.equal(e.label, "high divergence");
});

test("semanticEntropy unavailable with fewer than two voices", () => {
  assert.equal(semanticEntropy([voice("a", "X")]).available, false);
  assert.equal(semanticEntropy([]).available, false);
});

test("adjustConfidence reads high down to low on a hard floor failure", () => {
  const c = adjustConfidence({
    stated: "high",
    grounding: { hard_fail: true, out_of_corpus_verse_ids: [9] },
    judge: { available: true, parsed: true, verdict: "sound" },
    leaderRouteDiversity: { route_classification: "distinct" },
    entropy: 0,
  });
  assert.equal(c.stated, "high");
  assert.equal(c.adjusted, "low"); // high(3) − 2 (floor fail) = 1 → low
  assert.equal(c.empirically_calibrated, false);
  assert.ok(c.downgraded);
  assert.ok(c.reasons.some((r) => /grounding floor/.test(r)));
});

test("adjustConfidence can reach contested when multiple signals fire", () => {
  const c = adjustConfidence({
    stated: "high",
    grounding: { hard_fail: true },
    judge: { available: true, parsed: true, verdict: "unsound" },
    leaderRouteDiversity: { route_classification: "overlapping" },
    entropy: 0.9,
  });
  assert.equal(c.adjusted, "contested"); // 3 − 2 − 2 − 1 − 1 < 0 → contested
  assert.ok(c.downgraded);
});

test("adjustConfidence downgrades for correlated (echoed) support", () => {
  const c = adjustConfidence({
    stated: "high",
    grounding: { hard_fail: false },
    judge: { available: true, parsed: true, verdict: "sound" },
    leaderRouteDiversity: { route_classification: "overlapping" },
    entropy: 0,
  });
  assert.equal(c.adjusted, "moderate"); // 3 - 1 = 2 → moderate
  assert.ok(c.downgraded);
  assert.ok(c.reasons.some((r) => /correlated/.test(r)));
});

test("adjustConfidence leaves a clean high alone", () => {
  const c = adjustConfidence({
    stated: "high",
    grounding: { hard_fail: false },
    judge: { available: true, parsed: true, verdict: "sound" },
    leaderRouteDiversity: { route_classification: "distinct" },
    entropy: 0,
  });
  assert.equal(c.adjusted, "high");
  assert.equal(c.downgraded, false);
  assert.deepEqual(c.reasons, []);
});

test("adjustConfidence reads down for a fatal kill-test", () => {
  const base = {
    stated: "high",
    grounding: { hard_fail: false },
    judge: { available: true, parsed: true, verdict: "sound" },
    leaderRouteDiversity: { route_classification: "distinct" },
    entropy: 0,
  };
  const fatal = adjustConfidence({ ...base, killTest: { available: true, parsed: true, severity: "fatal" } });
  assert.equal(fatal.adjusted, "low"); // high(3) − 2 = 1 → low
  assert.ok(fatal.reasons.some((r) => /kill-test/.test(r)));
  const serious = adjustConfidence({ ...base, killTest: { available: true, parsed: true, severity: "serious" } });
  assert.equal(serious.adjusted, "moderate"); // 3 − 1 = 2
  const survived = adjustConfidence({ ...base, killTest: { available: true, parsed: true, severity: "none" } });
  assert.equal(survived.adjusted, "high"); // no penalty
});

test("buildSoftLayer assembles entropy + confidence + a full tick checklist", () => {
  const synthesis = {
    confidence: "high",
    positions: [
      { label: "Leader", weight: 0.7, weakest_link: "narrow" },
      { label: "Minority", weight: 0.3 },
    ],
  };
  const voices = [voice("a", "Leader"), voice("b", "Leader"), voice("c", "Minority")];
  const out = buildSoftLayer({
    synthesis,
    voices,
    grounding: { hard_fail: false, out_of_corpus_verse_ids: [] },
    judge: { available: true, parsed: true, verdict: "sound", judge_provider: "gpt" },
    evidenceRouteDiversity: {
      positions: [{ label: "Leader", route_classification: "distinct" }],
    },
  });
  assert.equal(out.available, true);
  assert.equal(out.tick_total, 6);
  assert.ok(out.tick_passed >= 4);
  // 3 voices split 2-1 → high inter-voice entropy → honest read-down from high.
  assert.equal(out.confidence.adjusted, "moderate");
  assert.ok(out.confidence.downgraded);
  assert.equal(out.semantic_entropy.available, true);
  assert.ok(out.semantic_entropy.value >= 0.66);
  // The dissent + grounded + corroborated + cross-examined + limits checks pass.
  assert.equal(out.tick.find((c) => c.id === "grounded").pass, true);
  assert.equal(out.tick.find((c) => c.id === "corroborated").pass, true);
  assert.equal(out.tick.find((c) => c.id === "dissent_preserved").pass, true);
});

test("buildSoftLayer is unavailable without positions", () => {
  assert.equal(buildSoftLayer({ synthesis: { positions: [] }, voices: [] }).available, false);
  assert.equal(buildSoftLayer({ synthesis: null, voices: [] }).available, false);
});
