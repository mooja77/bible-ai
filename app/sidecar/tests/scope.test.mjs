import { test } from "node:test";
import assert from "node:assert/strict";
import { normaliseScopePositions } from "../grounded/scope.mjs";
import { buildVoicePrompt } from "../providers/_shared.mjs";

test("normaliseScopePositions keeps labelled positions, trims, caps at 6", () => {
  const out = normaliseScopePositions({
    positions: [
      { label: "A", description: "desc a" },
      { label: "  B  ", description: "" },
      { label: "", description: "no label -> dropped" },
      { description: "no label -> dropped" },
      ...Array.from({ length: 8 }, (_, i) => ({ label: `X${i}` })),
    ],
  });
  assert.ok(out.length <= 6);
  assert.equal(out[0].label, "A");
  assert.equal(out[1].label, "B");
  assert.ok(out.every((p) => p.label));
});

test("normaliseScopePositions tolerates junk input", () => {
  assert.deepEqual(normaliseScopePositions(null), []);
  assert.deepEqual(normaliseScopePositions({}), []);
  assert.deepEqual(normaliseScopePositions({ positions: "x" }), []);
});

test("buildVoicePrompt injects the scoping frame when positions are provided", () => {
  const p = buildVoicePrompt({
    question: "Q",
    evidence: [],
    scopedPositions: [{ label: "Grace alone", description: "saved by grace through faith" }],
  });
  assert.ok(p.includes("Candidate positions identified during scoping"));
  assert.ok(p.includes("Grace alone"));
});

test("buildVoicePrompt omits the scoping frame when none provided", () => {
  const p = buildVoicePrompt({ question: "Q", evidence: [] });
  assert.ok(!p.includes("Candidate positions identified during scoping"));
});
