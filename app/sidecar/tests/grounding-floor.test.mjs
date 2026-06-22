import { test } from "node:test";
import assert from "node:assert/strict";
import {
  runGroundingFloor,
  collectCitedVerseIds,
  buildRegenNote,
} from "../grounded/grounding-floor.mjs";
import { buildEvidenceSet } from "../grounded/evidence-set.mjs";

const evidence = [
  { verse_id: 43003016, book_name: "John", chapter: 3, verse: 16, text: "For God so loved..." },
  { verse_id: 45003023, book_name: "Romans", chapter: 3, verse: 23, text: "for all have sinned..." },
  { verse_id: 49002008, book_name: "Ephesians", chapter: 2, verse: 8, text: "by grace ye are saved..." },
];

function position(label, ids) {
  return {
    label,
    weight: 1,
    summary: "",
    supporting_evidence_ids: ids,
    challenging_evidence_ids: [],
    evidence: ids.map((verse_id) => ({ verse_id, citation: "", quote: "" })),
  };
}

test("buildEvidenceSet collects valid verse_ids only", () => {
  const { ids } = buildEvidenceSet([...evidence, { verse_id: 0 }, { verse_id: "x" }, {}]);
  assert.equal(ids.size, 3);
  assert.ok(ids.has(43003016));
});

test("fully-grounded synthesis passes the floor", () => {
  const synthesis = { positions: [position("Grace alone", [43003016, 49002008])] };
  const r = runGroundingFloor(synthesis, evidence);
  assert.equal(r.hard_fail, false);
  assert.equal(r.citation_accuracy, 1);
  assert.equal(r.out_of_corpus_verse_ids.length, 0);
});

test("a hallucinated verse_id hard-fails the floor", () => {
  const synthesis = { positions: [position("Invented", [43003016, 99999999])] };
  const r = runGroundingFloor(synthesis, evidence);
  assert.equal(r.hard_fail, true);
  assert.ok(r.out_of_corpus_verse_ids.includes(99999999));
  assert.ok(r.violations.some((v) => v.verse_id === 99999999));
  assert.ok(r.citation_accuracy < 1);
});

test("a position whose only citations are out-of-corpus is flagged", () => {
  const synthesis = { positions: [position("Ungrounded", [11110000, 22220000])] };
  const r = runGroundingFloor(synthesis, evidence);
  assert.equal(r.hard_fail, true);
  assert.ok(r.uncited_positions.includes("Ungrounded"));
});

test("a synthesis with no citations does not hard-fail (cannot adjudicate)", () => {
  const synthesis = { positions: [{ label: "Empty", weight: 1, evidence: [] }] };
  const r = runGroundingFloor(synthesis, evidence);
  assert.equal(r.hard_fail, false);
  assert.equal(r.cited_count, 0);
  assert.equal(r.citation_accuracy, 1);
});

test("collectCitedVerseIds pulls ids from every field", () => {
  const synthesis = {
    positions: [
      {
        label: "P",
        evidence: [{ verse_id: 43003016 }],
        supporting_evidence_ids: [45003023],
        challenging_evidence_ids: [49002008],
        argument_map: { nodes: [{ verse_ids: [11110000] }] },
      },
    ],
    evidence_classification: [{ verse_id: 22220000, status: "ignored" }],
  };
  const cited = collectCitedVerseIds(synthesis);
  const ids = cited.map((c) => c.verse_id).sort((a, b) => a - b);
  assert.deepEqual(ids, [11110000, 22220000, 43003016, 45003023, 49002008]);
});

test("buildRegenNote names the flagged verse_ids", () => {
  const synthesis = { positions: [position("Invented", [43003016, 99999999])] };
  const r = runGroundingFloor(synthesis, evidence);
  const note = buildRegenNote(r);
  assert.ok(note.includes("99999999"));
  assert.ok(/cite ONLY verse_ids/i.test(note));
});
