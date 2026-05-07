import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const requiredFields = [
  "source_title",
  "source_url",
  "maintainer",
  "license",
  "attribution",
  "version",
  "redistribution_permission",
  "modification_rules",
  "share_alike_requirements",
  "trademark_restrictions",
  "import_format",
  "reference_compatibility",
  "known_data_quality_risks",
  "decision",
];

const acceptedDecisions = new Set(["accept", "defer", "reject"]);

export function assessSourceReview(review, manifest = null) {
  const errors = [];
  for (const field of requiredFields) {
    const value = review?.[field];
    if (value === undefined || value === null || value === "") {
      errors.push(`source assessment requires ${field}`);
    }
  }

  if (!acceptedDecisions.has(review?.decision)) {
    errors.push("decision must be one of: accept, defer, reject");
  }
  if (review?.decision === "accept") {
    if (review.redistribution_permission !== true) {
      errors.push("accepted source must have redistribution_permission: true");
    }
    if (String(review.license).toLowerCase().includes("unknown")) {
      errors.push("accepted source license must not be unknown");
    }
    if (String(review.attribution).trim().length < 10) {
      errors.push("accepted source requires usable attribution text");
    }
  }
  if (review?.license_clarity === "unclear" && review?.decision === "accept") {
    errors.push("unclear license terms must be deferred or rejected");
  }
  if (review?.source_quality === "unusable" && review?.decision === "accept") {
    errors.push("unusable source quality must be deferred or rejected");
  }
  if (
    ["poor", "unverified"].includes(String(review?.ocr_quality ?? "").toLowerCase()) &&
    review?.decision === "accept"
  ) {
    errors.push("poor or unverified OCR quality must be deferred or rejected");
  }

  if (manifest) {
    const comparisons = [
      ["source_title", "title"],
      ["source_url", "source_url"],
      ["license", "license"],
      ["attribution", "attribution"],
      ["version", "version"],
    ];
    for (const [reviewField, manifestField] of comparisons) {
      if (
        review[reviewField] !== undefined &&
        manifest[manifestField] !== undefined &&
        String(review[reviewField]).trim() !== String(manifest[manifestField]).trim()
      ) {
        errors.push(
          `assessment ${reviewField} does not match manifest ${manifestField}`,
        );
      }
    }
    if (review?.decision !== "accept") {
      errors.push("manifest import requires an accepted source assessment");
    }
  }

  return errors;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const [reviewPath, manifestPath] = process.argv.slice(2);
  if (!reviewPath) {
    console.error(
      "usage: node scripts/resources/assess-source.mjs source-review.json [manifest.json]",
    );
    process.exit(2);
  }

  const review = JSON.parse(await readFile(reviewPath, "utf8"));
  const manifest = manifestPath
    ? JSON.parse(await readFile(manifestPath, "utf8"))
    : null;
  const errors = assessSourceReview(review, manifest);
  if (errors.length) {
    for (const error of errors) console.error(error);
    process.exit(1);
  }
  console.log(`source assessment ok: ${review.source_title} (${review.decision})`);
}
