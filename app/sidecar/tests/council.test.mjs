/**
 * Unit tests for the Council orchestrator's deterministic behaviour:
 * input validation and the mock-mode path (BIBLE_AI_MOCK_COUNCIL=1).
 * Live provider calls are intentionally out of scope here.
 */

import test from "node:test";
import assert from "node:assert/strict";

import { runCouncil, resolveSynthesisMode, withTimeout, emitMockSequence, judgedEventPayload } from "../council.mjs";

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

test("mock mode: a sentinel question forces an actionable failure", async () => {
  // The sentinel drives the production error path (thrown -> surfaced to the
  // UI), so the failure state can be exercised end-to-end in tests. The
  // message must stay plain-language and actionable for non-technical users.
  await assert.rejects(
    () =>
      withMockMode(() =>
        runCouncil({
          question: "Anything __FORCE_COUNCIL_ERROR__ here",
          evidence: EVIDENCE,
        }),
      ),
    (err) => {
      assert.match(err.message, /Settings/);
      assert.match(err.message, /try again/i);
      return true;
    },
  );
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

test("withTimeout: resolves with the value when the promise is fast", async () => {
  assert.equal(await withTimeout(Promise.resolve("ok"), 1000, "X"), "ok");
});

test("withTimeout: rejects with a timeout error when the promise is too slow", async () => {
  await assert.rejects(
    () => withTimeout(new Promise(() => {}), 10, "OpenAI"),
    /timed out after/,
  );
});

test("emitMockSequence: emits voice_failed for a non-ok voice", () => {
  const events = [];
  const emit = (kind, payload) => events.push({ kind, ...payload });
  emitMockSequence(
    {
      voices: [
        { provider: "a", display_name: "A", status: "ok", result: { positions: [] }, duration_ms: 10 },
        { provider: "b", display_name: "B", status: "error", error_category: "auth", error_hint: "check key" },
      ],
      synthesis: { positions: [{ label: "X", weight: 1.0 }], confidence: "high" },
      synthesis_mode: "consensus",
    },
    emit,
  );
  assert.equal(events[0].kind, "voice_started");
  assert.equal(events[1].kind, "voice_done");
  assert.equal(events[2].kind, "voice_started");
  assert.equal(events[3].kind, "voice_failed");
  assert.equal(events[3].category, "auth");
  assert.equal(events[4].kind, "judged");
  assert.equal(events[4].leader_label, "X");
});

test("mock mode emits an ordered progress event sequence", async () => {
  const events = [];
  await withMockMode(() =>
    runCouncil({
      question: "What does grace mean?",
      evidence: EVIDENCE,
      model: "sonnet",
      onEvent: (e) => events.push(e),
    }),
  );

  const kinds = events.map((e) => e.kind);
  // Mock mirrors the full Grounded Council pipeline order: scope + per-position
  // depth, the (single) voice, the grounding floor, the cross-family judge, then
  // the headline judged event. Single-voice mock → no synthesis_started.
  assert.deepEqual(kinds, [
    "scope_started",
    "scope_done",
    "position_retrieval_started",
    "position_retrieval_done",
    "position_retrieval_started",
    "position_retrieval_done",
    "depth_done",
    "voice_started",
    "voice_done",
    "grounding_started",
    "grounding_done",
    "judge_started",
    "judge_done",
    "judged",
  ]);

  for (let i = 1; i < events.length; i++) {
    assert.ok(events[i].seq > events[i - 1].seq, "seq must strictly increase");
  }
  assert.ok(events.every((e) => typeof e.ts === "number" && e.ts > 0));
});

test("judgedEventPayload picks the highest-weighted position", () => {
  const synthesis = {
    confidence: "medium",
    positions: [
      { label: "Minority", weight: 0.3 },
      { label: "Leader", weight: 0.7 },
    ],
  };
  assert.deepEqual(judgedEventPayload(synthesis), {
    leader_label: "Leader",
    leader_weight: 0.7,
    confidence: "medium",
  });
});

test("judgedEventPayload is null-safe for empty synthesis", () => {
  assert.equal(judgedEventPayload(null), null);
  assert.equal(judgedEventPayload({ positions: [] }), null);
});
