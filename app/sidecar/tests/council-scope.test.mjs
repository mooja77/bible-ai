import { test } from "node:test";
import assert from "node:assert/strict";
import { scopeCouncil } from "../council.mjs";

// Stage 2b leg 1: scopeCouncil runs ONLY the scope pass so the Rust host can
// retrieve targeted evidence per candidate position before the full council run.

test("scopeCouncil returns synthetic positions in mock mode", async () => {
  const prev = process.env.BIBLE_AI_MOCK_COUNCIL;
  process.env.BIBLE_AI_MOCK_COUNCIL = "1";
  try {
    const out = await scopeCouncil({ question: "Is baptism required for salvation?" });
    assert.equal(out.available, true);
    assert.equal(out.source, "mock");
    assert.ok(Array.isArray(out.positions));
    assert.ok(out.positions.length >= 1);
    // Positions are the scope shape {label, description} the host forwards back.
    for (const p of out.positions) {
      assert.equal(typeof p.label, "string");
      assert.ok(p.label.length > 0);
      assert.ok("description" in p);
    }
  } finally {
    if (prev === undefined) delete process.env.BIBLE_AI_MOCK_COUNCIL;
    else process.env.BIBLE_AI_MOCK_COUNCIL = prev;
  }
});

test("scopeCouncil mock output is stable across calls (deterministic)", async () => {
  const prev = process.env.BIBLE_AI_MOCK_COUNCIL;
  process.env.BIBLE_AI_MOCK_COUNCIL = "1";
  try {
    const a = await scopeCouncil({ question: "Q" });
    const b = await scopeCouncil({ question: "Q" });
    assert.deepEqual(a.positions, b.positions);
  } finally {
    if (prev === undefined) delete process.env.BIBLE_AI_MOCK_COUNCIL;
    else process.env.BIBLE_AI_MOCK_COUNCIL = prev;
  }
});

test("scopeCouncil rejects a missing/blank question", async () => {
  await assert.rejects(() => scopeCouncil({ question: "" }), /question is required/);
  await assert.rejects(() => scopeCouncil({}), /question is required/);
  await assert.rejects(() => scopeCouncil({ question: 42 }), /question is required/);
});
