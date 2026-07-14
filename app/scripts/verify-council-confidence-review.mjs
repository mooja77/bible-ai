import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const BANDS = ["contested", "low", "moderate", "high"];
const BAND_RANK = new Map(BANDS.map((band, index) => [band, index]));
const POLICY = {
  minimum_cases: 20,
  minimum_exact_agreement: 0.6,
  minimum_within_one_band: 0.9,
  maximum_overstatement_rate: 0.15,
  maximum_severe_overstatement_count: 0,
  maximum_blocking_issue_count: 0,
};

function hasText(value) {
  return typeof value === "string" && value.trim() !== "";
}

function validIsoDate(value) {
  return hasText(value) && !Number.isNaN(Date.parse(value));
}

function withinRoot(root, path) {
  const rel = relative(root, path);
  return rel !== "" && rel !== ".." && !rel.startsWith(`..${sep}`) && !isAbsolute(rel);
}

function sourceCaseId(result, index) {
  return String(result.slug ?? result.case_id ?? `case-${String(index + 1).padStart(3, "0")}`);
}

export function evaluateConfidenceReview(review, sourcePayload, sourceSha256) {
  const failures = [];
  if (review?.format_version !== 1) failures.push("format_version must be 1");
  if (review?.evaluation_name !== "council-confidence-adjustment-labelled-agreement-v1") {
    failures.push("unexpected evaluation_name");
  }
  if (review?.status !== "complete") failures.push("status must be complete");
  if (review?.source_fixture?.sha256 !== sourceSha256) {
    failures.push("source fixture SHA-256 does not match the review");
  }

  const sourceResults = Array.isArray(sourcePayload?.results) ? sourcePayload.results : [];
  const cases = Array.isArray(review?.cases) ? review.cases : [];
  if (cases.length !== sourceResults.length) {
    failures.push(`review has ${cases.length} case(s), source fixture has ${sourceResults.length}`);
  }
  for (const [field, value] of Object.entries(POLICY)) {
    if (review?.policy?.[field] !== value) failures.push(`policy.${field} must be ${value}`);
  }
  if (cases.length < POLICY.minimum_cases) {
    failures.push(`at least ${POLICY.minimum_cases} reviewed cases are required`);
  }
  if (!hasText(review?.reviewer?.name)) failures.push("reviewer.name is required");
  if (!hasText(review?.reviewer?.role)) failures.push("reviewer.role is required");
  if (!validIsoDate(review?.reviewer?.reviewed_at)) failures.push("reviewer.reviewed_at must be an ISO date");

  const ids = new Set();
  let exact = 0;
  let withinOne = 0;
  let overstatements = 0;
  let severeOverstatements = 0;
  let blockingIssues = 0;
  for (const [index, record] of cases.entries()) {
    const label = record?.case_id ?? `case ${index + 1}`;
    if (!hasText(record?.case_id) || ids.has(record.case_id)) {
      failures.push(`${label}: case_id must be non-empty and unique`);
    } else {
      ids.add(record.case_id);
    }
    const sourceResult = sourceResults[index];
    if (sourceResult) {
      const expectedId = sourceCaseId(sourceResult, index);
      const confidence = sourceResult.response?.soft_layer?.confidence ?? {};
      const expectedBand = confidence.adjusted ?? confidence.calibrated ?? null;
      if (record.case_id !== expectedId) failures.push(`${label}: case_id does not match source fixture`);
      if (record.question !== (sourceResult.question ?? "")) {
        failures.push(`${label}: question does not match source fixture`);
      }
      if (record.system_adjusted_band !== expectedBand) {
        failures.push(`${label}: system_adjusted_band does not match source fixture`);
      }
    }
    if (!BAND_RANK.has(record?.system_adjusted_band)) {
      failures.push(`${label}: invalid system_adjusted_band`);
      continue;
    }
    if (!BAND_RANK.has(record?.human_band)) {
      failures.push(`${label}: human_band must be one of ${BANDS.join(", ")}`);
      continue;
    }
    if (
      !Number.isInteger(record?.confidence_humility_score) ||
      record.confidence_humility_score < 0 ||
      record.confidence_humility_score > 2
    ) {
      failures.push(`${label}: confidence_humility_score must be 0, 1, or 2`);
    }
    if (typeof record?.blocking_issue !== "boolean") {
      failures.push(`${label}: blocking_issue must be boolean`);
    }
    if (!hasText(record?.reviewer_notes)) failures.push(`${label}: reviewer_notes is required`);

    const difference = BAND_RANK.get(record.system_adjusted_band) - BAND_RANK.get(record.human_band);
    if (difference === 0) exact += 1;
    if (Math.abs(difference) <= 1) withinOne += 1;
    if (difference > 0) overstatements += 1;
    if (difference > 1) severeOverstatements += 1;
    if (record.blocking_issue === true) blockingIssues += 1;
  }

  const denominator = cases.length || 1;
  const metrics = {
    case_count: cases.length,
    exact_agreement: exact / denominator,
    within_one_band: withinOne / denominator,
    overstatement_rate: overstatements / denominator,
    severe_overstatement_count: severeOverstatements,
    blocking_issue_count: blockingIssues,
  };
  if (metrics.exact_agreement < POLICY.minimum_exact_agreement) {
    failures.push(`exact agreement ${metrics.exact_agreement.toFixed(3)} is below policy`);
  }
  if (metrics.within_one_band < POLICY.minimum_within_one_band) {
    failures.push(`within-one-band agreement ${metrics.within_one_band.toFixed(3)} is below policy`);
  }
  if (metrics.overstatement_rate > POLICY.maximum_overstatement_rate) {
    failures.push(`overstatement rate ${metrics.overstatement_rate.toFixed(3)} exceeds policy`);
  }
  if (metrics.severe_overstatement_count > POLICY.maximum_severe_overstatement_count) {
    failures.push(`${metrics.severe_overstatement_count} severe overstatement(s) exceed policy`);
  }
  if (metrics.blocking_issue_count > POLICY.maximum_blocking_issue_count) {
    failures.push(`${metrics.blocking_issue_count} blocking issue(s) exceed policy`);
  }
  return { failures, metrics };
}

function parseArgs(argv) {
  const args = new Map();
  for (let index = 2; index < argv.length; index += 1) {
    if (argv[index] === "--review") args.set("review", argv[++index]);
  }
  return args;
}

function main() {
  const args = parseArgs(process.argv);
  const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
  const reviewPath = resolve(appRoot, args.get("review") ?? "release/council-confidence-review.json");
  if (!existsSync(reviewPath)) {
    console.error(`Confidence review is missing: ${reviewPath}`);
    process.exit(1);
  }
  const review = JSON.parse(readFileSync(reviewPath, "utf8"));
  const sourcePath = resolve(appRoot, review?.source_fixture?.path ?? "");
  if (!withinRoot(appRoot, sourcePath) || !existsSync(sourcePath)) {
    console.error("Confidence review source_fixture.path must resolve to an existing file inside app/.");
    process.exit(1);
  }
  const sourceBytes = readFileSync(sourcePath);
  const sourcePayload = JSON.parse(sourceBytes.toString("utf8"));
  const sourceSha256 = createHash("sha256").update(sourceBytes).digest("hex");
  const evaluation = evaluateConfidenceReview(review, sourcePayload, sourceSha256);
  if (evaluation.failures.length > 0) {
    console.error("Council confidence review failed:");
    for (const failure of evaluation.failures) console.error(`- ${failure}`);
    process.exit(1);
  }
  console.log("Council confidence review passed:");
  console.log(JSON.stringify(evaluation.metrics, null, 2));
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main();
