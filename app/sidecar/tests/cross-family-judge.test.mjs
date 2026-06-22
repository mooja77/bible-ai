import { test } from "node:test";
import assert from "node:assert/strict";
import {
  selectCrossFamilyJudge,
  familyOf,
  buildJudgeUserPrompt,
  runCrossFamilyJudge,
} from "../grounded/cross-family-judge.mjs";

const claude = { name: "claude", complete: async () => "{}" };
const openai = { name: "openai", complete: async () => "{}" };
const gemini = { name: "gemini", complete: async () => "{}" };
const gateway = { name: "gateway" }; // opaque — no complete()

test("familyOf maps known provider names to families", () => {
  assert.equal(familyOf("claude"), "anthropic");
  assert.equal(familyOf("openai"), "openai");
  assert.equal(familyOf("gemini"), "google");
});

test("selectCrossFamilyJudge prefers openai, excludes synthesizer family + non-complete", () => {
  assert.equal(selectCrossFamilyJudge("claude", [claude, gemini, openai]).name, "openai");
  assert.equal(selectCrossFamilyJudge("claude", [claude, gemini]).name, "gemini");
  assert.equal(selectCrossFamilyJudge("claude", [claude]), null); // only same family
  assert.equal(selectCrossFamilyJudge("claude", [claude, gateway]), null); // gateway has no complete()
});

test("buildJudgeUserPrompt lists evidence verse_ids and position citations", () => {
  const prompt = buildJudgeUserPrompt({
    question: "Q?",
    evidence: [{ verse_id: 43003016, book_name: "John", chapter: 3, verse: 16, text: "x" }],
    synthesis: {
      synthesis: "S",
      confidence: "medium",
      positions: [{ label: "P", weight: 1, summary: "x", evidence: [{ verse_id: 43003016 }] }],
    },
  });
  assert.ok(prompt.includes("verse_id 43003016"));
  assert.ok(prompt.includes("P (weight 1)"));
});

test("runCrossFamilyJudge parses a verdict from a fake cross-family provider", async () => {
  const fake = {
    name: "openai",
    complete: async () =>
      '{"grounding_faithful": true, "ungrounded_claims": [], "balance_preserved": true, "overreach": [], "verdict": "sound", "notes": "ok"}',
  };
  const r = await runCrossFamilyJudge({
    synthesizerName: "claude",
    providers: [claude, fake],
    question: "Q",
    evidence: [],
    synthesis: { positions: [] },
  });
  assert.equal(r.available, true);
  assert.equal(r.parsed, true);
  assert.equal(r.judge_provider, "openai");
  assert.equal(r.verdict, "sound");
  assert.equal(r.grounding_faithful, true);
});

test("runCrossFamilyJudge is fail-soft: no judge / bad json / thrown error", async () => {
  const none = await runCrossFamilyJudge({
    synthesizerName: "claude",
    providers: [claude],
    question: "Q",
    evidence: [],
    synthesis: {},
  });
  assert.equal(none.available, false);

  const bad = { name: "gemini", complete: async () => "not json at all" };
  const r1 = await runCrossFamilyJudge({
    synthesizerName: "claude",
    providers: [bad],
    question: "Q",
    evidence: [],
    synthesis: {},
  });
  assert.equal(r1.parsed, false);
  assert.equal(r1.available, true);

  const boom = {
    name: "gemini",
    complete: async () => {
      throw new Error("network");
    },
  };
  const r2 = await runCrossFamilyJudge({
    synthesizerName: "claude",
    providers: [boom],
    question: "Q",
    evidence: [],
    synthesis: {},
  });
  assert.equal(r2.parsed, false);
  assert.equal(r2.available, true);
});

test("an unrecognised verdict downgrades to mixed", async () => {
  const fake = { name: "openai", complete: async () => '{"verdict": "great"}' };
  const r = await runCrossFamilyJudge({
    synthesizerName: "claude",
    providers: [fake],
    question: "Q",
    evidence: [],
    synthesis: {},
  });
  assert.equal(r.verdict, "mixed");
});
