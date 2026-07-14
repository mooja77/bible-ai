import test from "node:test";
import assert from "node:assert/strict";
import { runDiagnostics } from "../index.mjs";

test("a scoped provider diagnostic does not contact unrelated providers", async () => {
  const previousAnthropic = process.env.ANTHROPIC_API_KEY;
  delete process.env.ANTHROPIC_API_KEY;
  try {
    const result = await runDiagnostics({ settings: {}, scope: "anthropic" });

    assert.equal(result.checks.anthropic.checked, true);
    assert.equal(result.checks.anthropic.configured, false);
    assert.match(result.checks.anthropic.error, /No Anthropic API key/);
    for (const name of ["claude", "google", "openai", "gateway", "ollama"]) {
      assert.equal(result.checks[name].checked, false, `${name} should be skipped`);
      assert.equal(result.checks[name].error, "Not tested in this run");
    }
  } finally {
    if (previousAnthropic === undefined) delete process.env.ANTHROPIC_API_KEY;
    else process.env.ANTHROPIC_API_KEY = previousAnthropic;
  }
});
