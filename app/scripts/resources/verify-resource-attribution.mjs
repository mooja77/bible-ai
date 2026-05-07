import { readFile } from "node:fs/promises";
import { validateResourceManifest } from "./validate-resource-manifest.mjs";

const requiredReviewFields = [
  "source_url",
  "maintainer",
  "license",
  "attribution",
  "redistribution_permission",
  "modification_rules",
];

const manifestPath = process.argv[2];
if (!manifestPath) {
  console.error("usage: node scripts/resources/verify-resource-attribution.mjs manifest.json");
  process.exit(2);
}

const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
const errors = validateResourceManifest(manifest);
for (const field of requiredReviewFields) {
  if (manifest[field] === undefined || manifest[field] === "") {
    errors.push(`source review requires ${field}`);
  }
}
if (String(manifest.license ?? "").toLowerCase().includes("unknown")) {
  errors.push("license must not be unknown");
}
if (errors.length) {
  for (const error of errors) console.error(error);
  process.exit(1);
}
console.log(`attribution ok: ${manifest.title} (${manifest.license})`);
