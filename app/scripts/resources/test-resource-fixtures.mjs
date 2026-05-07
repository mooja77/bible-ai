import { readFile } from "node:fs/promises";

const fixtures = [
  {
    path: "tests/fixtures/resources/public-domain-creeds-import.json",
    searches: ["apostles", "almighty", "jesus christ"],
    expectedLicense: "Public Domain",
    expectedRelatedScriptureRefs: ["Genesis 1:1", "John 1:1"],
  },
  {
    path: "tests/fixtures/resources/sefaria-style-import.json",
    searches: ["tradition carefully", "judge patiently", "further study"],
    expectedLicense: "Public Domain",
    expectedRelatedScriptureRefs: [],
  },
];

let failures = 0;
for (const fixture of fixtures) {
  const payload = JSON.parse(await readFile(fixture.path, "utf8"));
  const sources = payload.tables?.resource_sources ?? [];
  const entries = payload.tables?.resource_entries ?? [];
  if (sources.length === 0) {
    fail(`${fixture.path}: expected at least one resource source`);
    continue;
  }
  if (entries.length === 0) {
    fail(`${fixture.path}: expected at least one resource entry`);
    continue;
  }
  for (const source of sources) {
    if (source.license !== fixture.expectedLicense) {
      fail(`${fixture.path}: expected source license ${fixture.expectedLicense}`);
    }
    if (!String(source.attribution ?? "").trim()) {
      fail(`${fixture.path}: source attribution is required`);
    }
    parseJson(source.metadata_json, `${fixture.path}: source metadata_json`);
  }
  for (const entry of entries) {
    if (!String(entry.body ?? "").trim()) {
      fail(`${fixture.path}: entry ${entry.id ?? "unknown"} body is required`);
    }
    const entryPayload = parseJson(
      entry.payload_json,
      `${fixture.path}: entry ${entry.id ?? "unknown"} payload_json`,
    );
    for (const ref of fixture.expectedRelatedScriptureRefs ?? []) {
      if (!Array.isArray(entryPayload?.related_scripture_refs)) {
        fail(`${fixture.path}: entry ${entry.id ?? "unknown"} is missing related Scripture refs`);
        continue;
      }
      if (!entryPayload.related_scripture_refs.includes(ref)) {
        fail(`${fixture.path}: entry ${entry.id ?? "unknown"} is missing related ref ${ref}`);
      }
    }
  }
  for (const query of fixture.searches) {
    const needle = query.toLowerCase();
    const match = entries.some((entry) =>
      [entry.title, entry.ref, entry.body, entry.search_text]
        .map((value) => String(value ?? "").toLowerCase())
        .join(" ")
        .includes(needle),
    );
    if (!match) {
      fail(`${fixture.path}: no fixture entry matched search "${query}"`);
    }
  }
}

if (failures > 0) {
  process.exit(1);
}
console.log("resource fixture search checks passed");

function parseJson(value, label) {
  try {
    return JSON.parse(String(value ?? "{}"));
  } catch {
    fail(`${label} must be valid JSON`);
    return null;
  }
}

function fail(message) {
  failures += 1;
  console.error(message);
}
