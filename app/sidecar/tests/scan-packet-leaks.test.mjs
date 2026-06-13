import { test } from "node:test";
import assert from "node:assert/strict";
import { scanForLeaks, LEAK_TYPES } from "../../scripts/scan-packet-leaks.mjs";

function types(text) {
  return scanForLeaks(text).map((f) => f.type);
}

test("clean Scripture and prose produce no findings", () => {
  assert.deepEqual(
    scanForLeaks("In the beginning God created the heaven and the earth. (Genesis 1:1, KJV)"),
    [],
  );
});

test("provider API keys are detected", () => {
  assert.ok(types("token: sk-ant-api03-abcdEFGH1234ijklMNOP5678qrst").includes("provider_api_key"));
  assert.ok(types("openai sk-proj-ABCDEFGHIJKLMNOP1234567890").includes("provider_api_key"));
  assert.ok(types("google key AIzaSyA1B2C3D4E5F6G7H8I9J0kLmNoPqRsTuVw").includes("provider_api_key"));
});

test("secret-looking assignments are detected", () => {
  assert.ok(types("ANTHROPIC_API_KEY=sk-secret-value-1234567890").includes("secret_assignment"));
  assert.ok(types('managed_gateway_token: "tok_abcdef1234567890"').includes("secret_assignment"));
});

test("local filesystem paths are detected", () => {
  assert.ok(types("exported from C:\\Users\\Moores Home PC\\BibleApp").includes("local_path"));
  assert.ok(types("see /Users/john/Library/app-data/user.sqlite").includes("local_path"));
  assert.ok(types("/home/jdoe/.config/bible-ai/backup").includes("local_path"));
});

test("UNC / network paths are detected (a gap the old sanitizer missed)", () => {
  assert.ok(types("source \\\\fileserver\\share\\notes").includes("network_path"));
});

test("findings never echo the full secret back", () => {
  const findings = scanForLeaks("ANTHROPIC_API_KEY=sk-ant-api03-supersecretvalue1234567890");
  assert.ok(findings.length >= 1);
  for (const f of findings) {
    assert.ok(!String(f.sample).includes("supersecretvalue1234567890"), JSON.stringify(f));
  }
});

test("LEAK_TYPES enumerates the categories", () => {
  assert.ok(LEAK_TYPES.includes("provider_api_key"));
  assert.ok(LEAK_TYPES.includes("local_path"));
  assert.ok(LEAK_TYPES.includes("network_path"));
  assert.ok(LEAK_TYPES.includes("secret_assignment"));
});
