import { readFile } from "node:fs/promises";
import { assessSourceReview } from "./assess-source.mjs";

const validReview = JSON.parse(
  await readFile("tests/fixtures/resources/public-domain-creeds-source-review.json", "utf8"),
);
const manifest = JSON.parse(
  await readFile("tests/fixtures/resources/public-domain-creeds-manifest.json", "utf8"),
);
const poorOcrReview = JSON.parse(
  await readFile("tests/fixtures/resources/poor-ocr-source-review.json", "utf8"),
);
const invalidAcceptedReview = {
  ...validReview,
  source_title: "Invalid Accepted Resource",
  license: "Unknown",
  license_clarity: "unclear",
  redistribution_permission: false,
  decision: "accept",
};

const validErrors = assessSourceReview(validReview, manifest);
if (validErrors.length > 0) {
  console.error("expected valid review to pass:");
  for (const error of validErrors) console.error(`- ${error}`);
  process.exit(1);
}

const invalidErrors = assessSourceReview(invalidAcceptedReview);
const requiredFailures = [
  "accepted source must have redistribution_permission: true",
  "accepted source license must not be unknown",
  "unclear license terms must be deferred or rejected",
];
const missing = requiredFailures.filter((message) => !invalidErrors.includes(message));
if (missing.length > 0) {
  console.error("expected invalid accepted review to fail with:");
  for (const message of missing) console.error(`- ${message}`);
  console.error("actual errors:");
  for (const error of invalidErrors) console.error(`- ${error}`);
  process.exit(1);
}

const poorOcrErrors = assessSourceReview(poorOcrReview);
if (!poorOcrErrors.includes("poor or unverified OCR quality must be deferred or rejected")) {
  console.error("expected poor OCR review to fail with OCR quality rejection");
  console.error("actual errors:");
  for (const error of poorOcrErrors) console.error(`- ${error}`);
  process.exit(1);
}

console.log("source assessment tests passed");
