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

const [manifestPath, jsonlPath] = positional;
if (!manifestPath || !jsonlPath) {
  console.error(
    "usage: node scripts/resources/import-resource-jsonl.mjs manifest.json entries.jsonl [--out resource-import.json]",
  );
  process.exit(2);
}

const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
const errors = validateResourceManifest(manifest);
if (errors.length) {
  for (const error of errors) console.error(error);
  process.exit(1);
}

const collections = new Map(manifest.collections.map((collection, index) => [
  collection.slug,
  {
    id: index + 1,
    source_id: 1,
    slug: collection.slug,
    title: collection.title,
    kind: collection.kind,
    metadata_json: JSON.stringify(collection.metadata ?? {}),
  },
]));
const lines = (await readFile(jsonlPath, "utf8"))
  .split(/\r?\n/)
  .map((line) => line.trim())
  .filter(Boolean);

const entries = [];
for (const [index, line] of lines.entries()) {
  const entry = JSON.parse(line);
  const collection = collections.get(entry.collection_slug);
  if (!collection) {
    throw new Error(`line ${index + 1}: unknown collection_slug ${entry.collection_slug}`);
  }
  if (!entry.body || typeof entry.body !== "string") {
    throw new Error(`line ${index + 1}: body is required`);
  }
  const payload = normalizeEntryPayload(entry);
  entries.push({
    id: index + 1,
    collection_id: collection.id,
    ref: entry.ref ?? null,
    title: entry.title ?? entry.ref ?? `Entry ${index + 1}`,
    body: entry.body,
    search_text: entry.search_text ?? `${entry.title ?? ""} ${entry.ref ?? ""} ${entry.body}`,
    payload_json: JSON.stringify(payload),
  });
}

const payload = {
  app: "Bible AI",
  export_version: 1,
  user_schema_version: 12,
  exported_at: new Date().toISOString(),
  tables: {
    resource_sources: [
      {
        id: 1,
        slug: manifest.slug,
        title: manifest.title,
        source_url: manifest.source_url ?? null,
        license: manifest.license,
        attribution: manifest.attribution,
        version: manifest.version ?? null,
        imported_at: new Date().toISOString(),
        metadata_json: JSON.stringify({
          source_status:
            manifest.source_status ?? manifest.metadata?.source_status ?? "user-imported",
          maintainer: manifest.maintainer ?? null,
          redistribution_permission: manifest.redistribution_permission ?? null,
          modification_rules: manifest.modification_rules ?? null,
          share_alike_requirements: manifest.share_alike_requirements ?? null,
          trademark_restrictions: manifest.trademark_restrictions ?? null,
          source_review: manifest.source_review ?? null,
          metadata: manifest.metadata ?? {},
        }),
      },
    ],
    resource_collections: Array.from(collections.values()),
    resource_entries: entries,
  },
};

const outPath = options.get("out") ? resolve(options.get("out")) : null;
if (outPath) {
  await mkdir(dirname(outPath), { recursive: true });
  await writeFile(outPath, `${JSON.stringify(payload, null, 2)}\n`);
  console.log(`wrote resource import: ${outPath}`);
} else {
  console.log(JSON.stringify(payload, null, 2));
}

function normalizeEntryPayload(entry) {
  const payload =
    entry.payload && typeof entry.payload === "object" && !Array.isArray(entry.payload)
      ? { ...entry.payload }
      : {};
  const scriptureRefs = normalizeStringList(
    entry.related_scripture_refs ?? entry.scripture_refs ?? payload.related_scripture_refs,
  );
  if (scriptureRefs.length > 0) {
    payload.related_scripture_refs = scriptureRefs;
  }
  if (typeof entry.citation_note === "string" && entry.citation_note.trim()) {
    payload.citation_note = entry.citation_note.trim();
  }
  if (typeof entry.entry_attribution === "string" && entry.entry_attribution.trim()) {
    payload.entry_attribution = entry.entry_attribution.trim();
  }
  return payload;
}

function normalizeStringList(value) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean);
  }
  if (typeof value === "string") {
    return value
      .split(/[,;\n]/)
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [];
}
