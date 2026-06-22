import { test } from "node:test";
import assert from "node:assert/strict";
import {
  runKillTest,
  selectSkeptic,
  buildKillTestPrompt,
  __test,
} from "../grounded/kill-test.mjs";

const { leadingPosition } = __test;

const SYNTH = {
  confidence: "high",
  synthesis: "Leading view holds.",
  positions: [
    { label: "Leader", weight: 0.7, summary: "the strong view", supporting_evidence_ids: [1, 2] },
    { label: "Minority", weight: 0.3, summary: "the weak view", supporting_evidence_ids: [9] },
  ],
};
const EVIDENCE = [
  { verse_id: 1, book_name: "John", chapter: 3, verse: 16, text: "For God so loved..." },
  { verse_id: 2, book_name: "Rom", chapter: 5, verse: 8, text: "But God commendeth..." },
];

function fakeProvider(name, completeImpl) {
  return { name, complete: completeImpl };
}

test("leadingPosition picks the highest weight", () => {
  assert.equal(leadingPosition(SYNTH).label, "Leader");
  assert.equal(leadingPosition({ positions: [] }), null);
});

test("selectSkeptic prefers a cross-family provider, falls back to any complete", () => {
  const openai = fakeProvider("openai", async () => "{}");
  const claude = fakeProvider("claude", async () => "{}");
  // synthesizer is claude → prefer openai (different family)
  assert.equal(selectSkeptic("claude", [claude, openai]).name, "openai");
  // only same-family available → still usable (adversarial role)
  assert.equal(selectSkeptic("claude", [claude]).name, "claude");
  // none can complete → null
  assert.equal(selectSkeptic("claude", [{ name: "gateway" }]), null);
});

test("buildKillTestPrompt includes the target position and only the given evidence", () => {
  const p = buildKillTestPrompt({ question: "Q", evidence: EVIDENCE, position: SYNTH.positions[0] });
  assert.ok(p.includes("LEADING POSITION TO DESTROY"));
  assert.ok(p.includes("Leader"));
  assert.ok(p.includes("verse_id 1"));
});

test("runKillTest parses a survives verdict", async () => {
  const skeptic = fakeProvider("openai", async () =>
    '{"strongest_counter":"The minority reading","vulnerable_claim":"one citation","survives":true,"severity":"minor","notes":"holds"}',
  );
  const out = await runKillTest({
    synthesizerName: "claude",
    providers: [skeptic],
    question: "Q",
    evidence: EVIDENCE,
    synthesis: SYNTH,
  });
  assert.equal(out.available, true);
  assert.equal(out.parsed, true);
  assert.equal(out.skeptic_provider, "openai");
  assert.equal(out.survives, true);
  assert.equal(out.severity, "minor");
  assert.equal(out.target_label, "Leader");
});

test("runKillTest surfaces a fatal objection", async () => {
  const skeptic = fakeProvider("openai", async () =>
    'Here you go: {"strongest_counter":"verse X refutes it","survives":false,"severity":"fatal","notes":"cannot stand"} done',
  );
  const out = await runKillTest({
    synthesizerName: "claude",
    providers: [skeptic],
    question: "Q",
    evidence: EVIDENCE,
    synthesis: SYNTH,
  });
  assert.equal(out.parsed, true);
  assert.equal(out.survives, false);
  assert.equal(out.severity, "fatal");
});

test("runKillTest is fail-soft on a thrown call and on junk output", async () => {
  const thrower = fakeProvider("openai", async () => {
    throw new Error("network");
  });
  const t = await runKillTest({ synthesizerName: "claude", providers: [thrower], question: "Q", evidence: EVIDENCE, synthesis: SYNTH });
  assert.equal(t.available, true);
  assert.equal(t.parsed, false);

  const junk = fakeProvider("openai", async () => "no json here");
  const j = await runKillTest({ synthesizerName: "claude", providers: [junk], question: "Q", evidence: EVIDENCE, synthesis: SYNTH });
  assert.equal(j.parsed, false);
});

test("runKillTest is unavailable with no provider or no position", async () => {
  const none = await runKillTest({ synthesizerName: "claude", providers: [], question: "Q", evidence: EVIDENCE, synthesis: SYNTH });
  assert.equal(none.available, false);
  const noPos = await runKillTest({
    synthesizerName: "claude",
    providers: [fakeProvider("openai", async () => "{}")],
    question: "Q",
    evidence: EVIDENCE,
    synthesis: { positions: [] },
  });
  assert.equal(noPos.available, false);
});
