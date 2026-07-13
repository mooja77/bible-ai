import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const reviewPath = resolve(process.argv[2] ?? "release/content-review.json");
const lock = JSON.parse(readFileSync(resolve("../data/corpus-lock.json"), "utf8"));
const failures = [];

if (!existsSync(reviewPath)) {
  failures.push(`content review evidence missing: ${reviewPath}`);
} else {
  const review = JSON.parse(readFileSync(reviewPath, "utf8"));
  if (!String(review.reviewer ?? "").trim()) failures.push("reviewer is required");
  if (!String(review.reviewer_role ?? "").trim()) failures.push("reviewer_role is required");
  if (!review.completed_at || Number.isNaN(Date.parse(review.completed_at))) {
    failures.push("completed_at must be an ISO date/time");
  }
  if (!Array.isArray(review.target_territories) || review.target_territories.length === 0) {
    failures.push("target_territories must name every intended distribution territory");
  }
  if (review.approved_for_public_distribution !== true) {
    failures.push("approved_for_public_distribution must be true");
  }
  const byId = new Map((review.sources ?? []).map((source) => [source.source_id, source]));
  for (const artifact of lock.artifacts) {
    const source = byId.get(artifact.id);
    if (!source) {
      failures.push(`missing source review: ${artifact.id}`);
      continue;
    }
    for (const field of ["license_confirmed", "redistribution_confirmed", "attribution_confirmed"]) {
      if (source[field] !== true) failures.push(`${artifact.id}.${field} must be true`);
    }
  }
}

if (failures.length) {
  console.error("Content rights gate failed:");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}
console.log(`Content rights gate passed: ${reviewPath}`);
