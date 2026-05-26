/**
 * Unit tests for the Council orchestrator's deterministic behaviour:
 * input validation and the mock-mode path (BIBLE_AI_MOCK_COUNCIL=1).
 * Live provider calls are intentionally out of scope here.
 */

import test from "node:test";
import assert from "node:assert/strict";

import { runCouncil, resolveSynthesisMode } from "../council.mjs";

const EVIDENCE = [
  {
    verse_id: 1001001,
    translation_code: "KJV",
    book_name: "Genesis",
    chapter: 1,
    verse: 1,
    text: "In the beginning God created the heaven and the earth.",
  },
  {
    verse_id: 1001002,
    translation_code: "KJV",
    book_name: "Genesis",
    chapter: 1,
    verse: 2,
    text: "And the earth was without form, and void.",
  },
];

/** Run a function with BIBLE_AI_MOCK_COUNCIL forced on, then restore env. */
async function withMockMode(fn) {
  const prev = process.env.BIBLE_AI_MOCK_COUNCIL;
  process.env.BIBLE_AI_MOCK_COUNCIL = "1";
  try {
    return await fn();
  } finally {
    if (prev === undefined) delete process.env.BIBLE_AI_MOCK_COUNCIL;
    else process.env.BIBLE_AI_MOCK_COUNCIL = prev;
  }
}

test("runCouncil: rejects a missing or non-string question", async () => {
  await assert.rejects(
    () => runCouncil({ question: "", evidence: EVIDENCE }),
    /question is required/,
  );
  await assert.rejects(
    () => runCouncil({ question: 42, evidence: EVIDENCE }),
    /question is required/,
  );
});

test("runCouncil: rejects empty or non-array evidence", async () => {
  await assert.rejects(
    () => runCouncil({ question: "Q", evidence: [] }),
    /evidence array is empty/,
  );
  await assert.rejects(
    () => runCouncil({ question: "Q", evidence: undefined }),
    /evidence array is empty/,
  );
});

test("mock mode: returns synthesis, voices, and manifest", async () => {
  const out = await withMockMode(() =>
    runCouncil({ question: "What does creation teach?", evidence: EVIDENCE }),
  );
  assert.ok(out.synthesis, "synthesis present");
  assert.ok(Array.isArray(out.voices), "voices is an array");
  assert.ok(Array.isArray(out.manifest), "manifest is an array");
  assert.equal(out.voices[0].provider, "mock");
  assert.equal(out.voices[0].status, "ok");
  assert.equal(out.manifest[0].available, true);
});

test("mock mode: synthesis positions carry weights that sum to 1", async () => {
  const out = await withMockMode(() =>
    runCouncil({ question: "Q", evidence: EVIDENCE }),
  );
  assert.equal(out.synthesis.positions.length, 2);
  const total = out.synthesis.positions.reduce((s, p) => s + p.weight, 0);
  assert.ok(Math.abs(total - 1) < 1e-9, `weights should sum to 1, got ${total}`);
});

test("mock mode: every synthesis position cites at least one evidence verse", async () => {
  const out = await withMockMode(() =>
    runCouncil({ question: "Q", evidence: EVIDENCE }),
  );
  for (const position of out.synthesis.positions) {
    assert.ok(
      Array.isArray(position.evidence) && position.evidence.length > 0,
      `position "${position.label}" must carry visible evidence`,
    );
  }
});

test("mock mode: classifies every retrieved verse", async () => {
  const out = await withMockMode(() =>
    runCouncil({ question: "Q", evidence: EVIDENCE }),
  );
  assert.equal(out.synthesis.evidence_classification.length, EVIDENCE.length);
  const ids = out.synthesis.evidence_classification.map((e) => e.verse_id).sort();
  assert.deepEqual(ids, [1001001, 1001002]);
});

test("mock mode: the question is echoed into the research trail", async () => {
  const question = "Does Genesis 1 describe a literal week?";
  const out = await withMockMode(() => runCouncil({ question, evidence: EVIDENCE }));
  const framed = out.synthesis.research_trail.find((e) => e.event_type === "question");
  assert.ok(framed, "a question event exists in the research trail");
  assert.match(framed.detail, /literal week/);
});

test("resolveSynthesisMode: one voice → single_voice (regardless of synthesisFailed)", () => {
  assert.equal(resolveSynthesisMode({ okCount: 1, synthesisFailed: false }), "single_voice");
  assert.equal(resolveSynthesisMode({ okCount: 1, synthesisFailed: true }), "single_voice");
});

test("resolveSynthesisMode: multiple voices but synthesis threw → synthesis_failed", () => {
  assert.equal(resolveSynthesisMode({ okCount: 3, synthesisFailed: true }), "synthesis_failed");
});

test("resolveSynthesisMode: multiple voices, synthesis ok → consensus", () => {
  assert.equal(resolveSynthesisMode({ okCount: 3, synthesisFailed: false }), "consensus");
});
