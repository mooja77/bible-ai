import { test } from "node:test";
import assert from "node:assert/strict";
import { scanForLeaks, LEAK_TYPES } from "../../scripts/scan-packet-leaks.mjs";

function types(text) {
  return scanForLeaks(text).map((f) => f.type);
}

// Fake, non-functional sample values for exercising the scanner. They are built
// by concatenation so this file never contains a contiguous secret-format
// literal that an external secret scanner (e.g. GitGuardian) would flag. None of
// these are, or ever were, real credentials.
const SAMPLE = {
  anthropic: "sk-ant-" + "api03-EXAMPLEonlyNOTAREALKEY00000",
  openai: "sk-proj-" + "EXAMPLEonlyNOTAREALKEY0000",
  google: "AIza" + "SyEXAMPLEonlyNOTAREALKEY0000000000",
  gatewayToken: "tok_" + "EXAMPLEonlyNOTAREAL1234567890",
};

test("clean Scripture and prose produce no findings", () => {
  assert.deepEqual(
    scanForLeaks("In the beginning God created the heaven and the earth. (Genesis 1:1, KJV)"),
    [],
  );
});

test("provider API keys are detected", () => {
  assert.ok(types(`token: ${SAMPLE.anthropic}`).includes("provider_api_key"));
  assert.ok(types(`openai ${SAMPLE.openai}`).includes("provider_api_key"));
  assert.ok(types(`google key ${SAMPLE.google}`).includes("provider_api_key"));
});

test("secret-looking assignments are detected", () => {
  assert.ok(types(`ANTHROPIC_API_KEY=${SAMPLE.anthropic}`).includes("secret_assignment"));
  assert.ok(types(`managed_gateway_token: "${SAMPLE.gatewayToken}"`).includes("secret_assignment"));
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
  const findings = scanForLeaks(`ANTHROPIC_API_KEY=${SAMPLE.anthropic}`);
  assert.ok(findings.length >= 1);
  for (const f of findings) {
    assert.ok(!String(f.sample).includes("NOTAREALKEY"), JSON.stringify(f));
  }
});

test("LEAK_TYPES enumerates the categories", () => {
  assert.ok(LEAK_TYPES.includes("provider_api_key"));
  assert.ok(LEAK_TYPES.includes("local_path"));
  assert.ok(LEAK_TYPES.includes("network_path"));
  assert.ok(LEAK_TYPES.includes("secret_assignment"));
});
