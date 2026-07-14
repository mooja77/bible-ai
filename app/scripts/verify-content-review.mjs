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
  if (!String(review.decision_reference ?? "").trim()) {
    failures.push("decision_reference is required");
  }
  if (!review.completed_at || Number.isNaN(Date.parse(review.completed_at))) {
    failures.push("completed_at must be an ISO date/time");
  }
  if (!Array.isArray(review.target_territories) || review.target_territories.length === 0) {
    failures.push("target_territories must name every intended distribution territory");
  }
  if (!Array.isArray(review.distribution_channels) || review.distribution_channels.length === 0) {
    failures.push("distribution_channels must name every intended release channel");
  }
  const expectedReleaseScope = {
    model: "free_noncommercial",
    free_of_charge: true,
    paid_access: false,
    subscriptions: false,
    advertising: false,
    bundled_content_sales: false,
    scope_change_requires_new_review: true,
  };
  for (const [field, expected] of Object.entries(expectedReleaseScope)) {
    if (review?.release_scope?.[field] !== expected) {
      failures.push(`release_scope.${field} must be ${JSON.stringify(expected)}`);
    }
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
    const expectedChecksum = artifact.sha256 ?? artifact.aggregate_sha256;
    if (source.locked_version !== artifact.version) {
      failures.push(`${artifact.id}.locked_version does not match corpus-lock.json`);
    }
    if (source.locked_checksum !== expectedChecksum) {
      failures.push(`${artifact.id}.locked_checksum does not match corpus-lock.json`);
    }
    if (source.lock_license_label !== artifact.license) {
      failures.push(`${artifact.id}.lock_license_label does not match corpus-lock.json`);
    }
    if (!Array.isArray(source.evidence_refs) || source.evidence_refs.length === 0 ||
        source.evidence_refs.some((reference) => !String(reference ?? "").trim())) {
      failures.push(`${artifact.id}.evidence_refs must contain at least one non-empty reference`);
    }
    for (const field of ["license_conclusion", "redistribution_scope", "attribution_text"]) {
      if (!String(source[field] ?? "").trim()) failures.push(`${artifact.id}.${field} is required`);
    }
    if (!Array.isArray(source.obligations)) {
      failures.push(`${artifact.id}.obligations must be an array (use [] only when none apply)`);
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
