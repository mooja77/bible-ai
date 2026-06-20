import test from "node:test";
import assert from "node:assert/strict";
import { councilProgressLine } from "../index.mjs";

test("councilProgressLine wraps an event with id and type", () => {
  const msg = councilProgressLine("r7", { seq: 1, ts: 123, kind: "voice_started" });
  assert.deepEqual(msg, {
    id: "r7",
    type: "council_progress",
    event: { seq: 1, ts: 123, kind: "voice_started" },
  });
});
