import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { findFabricatedCitations } from "../../scripts/quality-checks.mjs";

const clean = {
  retrieved_evidence: [{ verse_id: 45009006 }, { verse_id: 45009015 }],
  synthesis: {
    positions: [{ label: "A", evidence: [{ verse_id: 45009006, citation: "Romans 9:6" }] }],
  },
};

const fabricated = {
  retrieved_evidence: [{ verse_id: 45009006 }],
  synthesis: {
    positions: [
      { label: "A", evidence: [{ verse_id: 66066666, citation: "Revelation 99:99" }] },
    ],
  },
};

test("a citation within the retrieved evidence is not fabricated", () => {
  assert.deepEqual(findFabricatedCitations(clean), []);
});

test("a citation outside the retrieved evidence is flagged as fabricated", () => {
  const found = findFabricatedCitations(fabricated);
  assert.equal(found.length, 1);
  assert.equal(found[0].verse_id, 66066666);
  assert.equal(found[0].citation, "Revelation 99:99");
});

test("an empty retrieval pool is inconclusive, not all-fabricated", () => {
  const found = findFabricatedCitations({
    retrieved_evidence: [],
    synthesis: { positions: [{ evidence: [{ verse_id: 1 }] }] },
  });
  assert.deepEqual(found, []);
});

test("the shipped Council quality fixtures contain no fabricated citations", () => {
  const fx = JSON.parse(
    readFileSync(new URL("../../tests/fixtures/council-quality.json", import.meta.url), "utf8"),
  );
  for (const f of fx.fixtures) {
    assert.deepEqual(findFabricatedCitations(f.response), [], f.slug);
  }
});
