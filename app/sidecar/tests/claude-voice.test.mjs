import test from "node:test";
import assert from "node:assert/strict";

import { callClaude } from "../providers/claude.mjs";

test("callClaude isolates the subscription query from tools and saved settings", async () => {
  let captured;
  const queryFn = (request) => {
    captured = request;
    return (async function* () {
      yield { type: "result", result: "ok" };
    })();
  };

  const result = await callClaude({
    systemPrompt: "system",
    userPrompt: "user",
    model: "haiku",
    timeoutMs: 1_000,
    queryFn,
  });

  assert.equal(result, "ok");
  assert.deepEqual(captured.options.tools, []);
  assert.deepEqual(captured.options.settingSources, []);
  assert.deepEqual(captured.options.mcpServers, {});
  assert.deepEqual(captured.options.plugins, []);
  assert.deepEqual(captured.options.hooks, {});
  assert.deepEqual(captured.options.agents, {});
  assert.ok(captured.options.abortController instanceof AbortController);
});

test("callClaude aborts the SDK query when its deadline expires", async () => {
  let capturedController;
  const queryFn = ({ options }) => {
    capturedController = options.abortController;
    return (async function* () {
      await new Promise((_resolve, reject) => {
        options.abortController.signal.addEventListener(
          "abort",
          () => reject(options.abortController.signal.reason),
          { once: true },
        );
      });
    })();
  };

  await assert.rejects(
    () =>
      callClaude({
        systemPrompt: "system",
        userPrompt: "user",
        timeoutMs: 10,
        queryFn,
      }),
    /Claude timed out after/,
  );
  assert.equal(capturedController.signal.aborted, true);
});
