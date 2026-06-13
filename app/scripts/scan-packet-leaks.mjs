// Leak scanner for Study Packet exports (EP-017). Scans text for forbidden data
// that must never appear in a shareable packet: provider API keys, secret-looking
// assignments (tokens/passwords/credentials), local filesystem paths, and UNC /
// network paths. Pure `scanForLeaks` is unit-tested in
// sidecar/tests/scan-packet-leaks.test.mjs; run directly it scans a packet
// directory and exits non-zero on any finding.
//
// Conservative by design: patterns target high-confidence secret/path shapes so
// Scripture and ordinary prose do not trigger false positives. Findings carry
// only a short redacted sample, never the full secret.

import { readdirSync, readFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

export const LEAK_TYPES = [
  "provider_api_key",
  "secret_assignment",
  "local_path",
  "network_path",
];

const PATTERNS = [
  { type: "provider_api_key", re: /\bsk-ant-[A-Za-z0-9_-]{12,}/g },
  { type: "provider_api_key", re: /\bsk-proj-[A-Za-z0-9_-]{12,}/g },
  { type: "provider_api_key", re: /\bsk-[A-Za-z0-9]{20,}\b/g },
  { type: "provider_api_key", re: /\bAIza[A-Za-z0-9_-]{20,}/g },
  {
    type: "secret_assignment",
    re: /\b[\w-]*(?:api[_-]?key|secret|token|password|credential)[\w-]*\s*[=:]\s*["']?(?=[^"'\s]*\d)[A-Za-z0-9_\-.\/+]{8,}/gi,
  },
  { type: "network_path", re: /\\\\[A-Za-z0-9._-]+\\[^\s"']+/g },
  { type: "local_path", re: /\b[A-Za-z]:\\[^\s"']+/g },
  { type: "local_path", re: /\/(?:Users|home)\/[A-Za-z0-9._-]+(?:\/[^\s"']*)?/g },
  {
    type: "local_path",
    re: /\/(?:tmp|var|etc|private|opt|root)\/[A-Za-z0-9._-]+(?:\/[^\s"']*)?/g,
  },
];

function redact(match) {
  return match.length > 12 ? `${match.slice(0, 12)}...` : match;
}

/** Return a list of { type, sample } leak findings (empty = clean). */
export function scanForLeaks(text) {
  if (typeof text !== "string" || text === "") return [];
  const findings = [];
  const seen = new Set();
  for (const { type, re } of PATTERNS) {
    for (const m of text.matchAll(re)) {
      const key = `${type}|${m[0]}`;
      if (seen.has(key)) continue;
      seen.add(key);
      findings.push({ type, sample: redact(m[0]) });
    }
  }
  return findings;
}

function walkFiles(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out.push(...walkFiles(full));
    else out.push(full);
  }
  return out;
}

function main() {
  const here = dirname(fileURLToPath(import.meta.url));
  const target = process.argv[2]
    ? process.argv[2]
    : join(here, "..", "..", "docs", "samples", "study-packets");
  let files;
  try {
    files = walkFiles(target);
  } catch {
    console.log(`scan-packet-leaks: nothing to scan at ${target}`);
    return;
  }
  let problems = 0;
  for (const file of files) {
    let text;
    try {
      text = readFileSync(file, "utf8");
    } catch {
      continue;
    }
    for (const finding of scanForLeaks(text)) {
      console.error(`[leak] ${file}: ${finding.type} (${finding.sample})`);
      problems += 1;
    }
  }
  if (problems > 0) {
    console.error(`scan-packet-leaks: ${problems} forbidden value(s) found`);
    process.exit(1);
  }
  console.log(`scan-packet-leaks: ${files.length} file(s) clean`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main();
}
