import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const requiredSourceFields = ["slug", "title", "license", "attribution", "collections"];
const requiredCollectionFields = ["slug", "title", "kind"];

export function validateResourceManifest(manifest) {
  const errors = [];
  for (const field of requiredSourceFields) {
    if (!manifest?.[field]) errors.push(`manifest requires ${field}`);
  }
  if (!Array.isArray(manifest?.collections) || manifest.collections.length === 0) {
    errors.push("manifest.collections must contain at least one collection");
  }
  for (const [index, collection] of (manifest?.collections ?? []).entries()) {
    for (const field of requiredCollectionFields) {
      if (!collection?.[field]) errors.push(`collections[${index}] requires ${field}`);
    }
  }
  if (manifest?.redistribution_permission === false) {
    errors.push("manifest marks redistribution_permission as false");
  }
  return errors;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const manifestPath = process.argv[2];
  if (!manifestPath) {
    console.error("usage: node scripts/resources/validate-resource-manifest.mjs manifest.json");
    process.exit(2);
  }
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  const errors = validateResourceManifest(manifest);
  if (errors.length) {
    for (const error of errors) console.error(error);
    process.exit(1);
  }
  console.log(`manifest ok: ${manifest.title}`);
}
