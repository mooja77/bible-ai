import test from "node:test";
import assert from "node:assert/strict";

import { explainPassage, formatPassageCitation } from "../explain.mjs";

test("formatPassageCitation: formats same-chapter ranges", () => {
  assert.equal(
    formatPassageCitation([
      { book_name: "Genesis", chapter: 1, verse: 1 },
      { book_name: "Genesis", chapter: 1, verse: 2 },
    ]),
    "Genesis 1:1-2",
  );
});

test("formatPassageCitation: includes the end chapter for cross-chapter ranges", () => {
  assert.equal(
    formatPassageCitation([
      { book_name: "Genesis", chapter: 1, verse: 31 },
      { book_name: "Genesis", chapter: 2, verse: 1 },
    ]),
    "Genesis 1:31-2:1",
  );
});

test("formatPassageCitation: includes both books for cross-book ranges", () => {
  assert.equal(
    formatPassageCitation([
      { book_name: "Genesis", chapter: 50, verse: 26 },
      { book_name: "Exodus", chapter: 1, verse: 1 },
    ]),
    "Genesis 50:26-Exodus 1:1",
  );
});

test("explainPassage: uses the formatted citation in the summary", () => {
  const result = explainPassage({
    passage: [
      { book_name: "Genesis", chapter: 1, verse: 31 },
      { book_name: "Genesis", chapter: 2, verse: 1 },
    ],
  });
  assert.equal(result.citation, "Genesis 1:31-2:1");
  assert.match(result.summary, /Genesis 1:31-2:1/);
});
