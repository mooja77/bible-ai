// Objective AI-quality checks over a Council response (EP-022 follow-up). Pure
// functions are unit-tested in sidecar/tests/quality-checks.test.mjs; run
// directly, this gates the shipped Council quality fixtures so a fabricated
// citation can never sneak into them.
//
// A "fabricated citation" is a position that cites a verse the Council did not
// actually retrieve as evidence -- the clearest, most checkable AI trust failure
// (the model citing Scripture that was never in the evidence pool).

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

/**
 * Return citations whose verse is not present in the response's retrieved
 * evidence. If the response has no retrieved evidence, the check is inconclusive
 * (returns []) rather than flagging every citation.
 */
export function findFabricatedCitations(response) {
  const retrieved = new Set(
    (response?.retrieved_evidence ?? [])
      .map((e) => e?.verse_id)
      .filter((id) => id != null),
  );
  if (retrieved.size === 0) return [];
  const fabricated = [];
  for (const position of response?.synthesis?.positions ?? []) {
    for (const evidence of position?.evidence ?? []) {
      if (evidence?.verse_id != null && !retrieved.has(evidence.verse_id)) {
        fabricated.push({
          position: position.label ?? "(unlabeled)",
          verse_id: evidence.verse_id,
          citation: evidence.citation ?? null,
        });
      }
    }
  }
  return fabricated;
}

function main() {
  const here = dirname(fileURLToPath(import.meta.url));
  const fixturePath = join(here, "..", "tests", "fixtures", "council-quality.json");
  let fixtures;
  try {
    fixtures = JSON.parse(readFileSync(fixturePath, "utf8")).fixtures ?? [];
  } catch (err) {
    console.error(`quality-checks: could not read ${fixturePath}: ${err.message}`);
    process.exit(1);
  }
  let problems = 0;
  for (const fixture of fixtures) {
    for (const finding of findFabricatedCitations(fixture.response)) {
      console.error(
        `[fabricated-citation] ${fixture.slug}: ${finding.position} cites ${finding.citation ?? finding.verse_id} (verse ${finding.verse_id}) which was not retrieved`,
      );
      problems += 1;
    }
  }
  if (problems > 0) {
    console.error(`quality-checks: ${problems} fabricated citation(s) found`);
    process.exit(1);
  }
  console.log(`quality-checks: ${fixtures.length} fixture(s) clean`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main();
}
