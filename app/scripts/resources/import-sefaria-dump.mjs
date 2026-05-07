import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { validateResourceManifest } from "./validate-resource-manifest.mjs";

const positional = [];
const options = new Map();
for (let i = 2; i < process.argv.length; i += 1) {
  const value = process.argv[i];
  if (value.startsWith("--")) {
    const next = process.argv[i + 1];
    options.set(value.slice(2), next && !next.startsWith("--") ? next : "true");
    if (next && !next.startsWith("--")) i += 1;
  } else {
    positional.push(value);
  }
}

const [manifestPath, dumpPath] = positional;
if (!manifestPath || !dumpPath) {
  console.error(
    "usage: node scripts/resources/import-sefaria-dump.mjs manifest.json dump.json --collection slug [--out entries.jsonl]",
  );
  process.exit(2);
}

const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
const errors = validateResourceManifest(manifest);
if (manifest.metadata?.sefaria_license_review !== true) {
  errors.push("manifest.metadata.sefaria_license_review must be true for Sefaria-style imports");
}
if (errors.length) {
  for (const error of errors) console.error(error);
  process.exit(1);
}

const collectionSlug = options.get("collection") ?? manifest.collections?.[0]?.slug;
if (!manifest.collections.some((collection) => collection.slug === collectionSlug)) {
  console.error(`unknown collection slug: ${collectionSlug}`);
  process.exit(1);
}

const dump = JSON.parse(await readFile(dumpPath, "utf8"));
const records = normalizeDumpRecords(dump);
const entries = [];
for (const record of records) {
  const baseRef = String(record.ref ?? record.title ?? manifest.title).trim();
  if (!baseRef) continue;
  const leaves = flattenText(record.text ?? record.content ?? record.body);
  for (const leaf of leaves) {
    const body = stripHtml(leaf.text).replace(/\s+/g, " ").trim();
    if (!body) continue;
    const ref = leaf.path.length ? `${baseRef} ${leaf.path.join(".")}` : baseRef;
    entries.push({
      collection_slug: collectionSlug,
      ref,
      title: baseRef,
      body,
      search_text: `${baseRef} ${ref} ${body}`.replace(/\s+/g, " ").trim(),
      payload: {
        source_format: "sefaria_dump",
        sefaria_ref: baseRef,
        path: leaf.path,
        language: record.language ?? record.lang ?? null,
        version_title: record.versionTitle ?? record.version_title ?? null,
        categories: record.categories ?? null,
        import_index: entries.length + 1,
      },
    });
  }
}

if (entries.length === 0) {
  console.error("dump produced no resource entries");
  process.exit(1);
}

const out = entries.map((entry) => JSON.stringify(entry)).join("\n") + "\n";
const outPath = options.get("out") ? resolve(options.get("out")) : null;
if (outPath) {
  await mkdir(dirname(outPath), { recursive: true });
  await writeFile(outPath, out);
  console.log(`wrote Sefaria-style resource JSONL: ${outPath}`);
} else {
  process.stdout.write(out);
}

function normalizeDumpRecords(value) {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.texts)) return value.texts;
  if (Array.isArray(value?.records)) return value.records;
  if (value && typeof value === "object" && ("text" in value || "content" in value || "body" in value)) {
    return [value];
  }
  return [];
}

function flattenText(value, path = []) {
  if (typeof value === "string") return [{ path, text: value }];
  if (Array.isArray(value)) {
    return value.flatMap((item, index) => flattenText(item, [...path, index + 1]));
  }
  if (value && typeof value === "object") {
    return Object.entries(value).flatMap(([key, item]) => flattenText(item, [...path, key]));
  }
  return [];
}

function stripHtml(value) {
  return String(value).replace(/<[^>]*>/g, "");
}
