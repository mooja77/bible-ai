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

const [manifestPath, textPath] = positional;
if (!manifestPath || !textPath) {
  console.error(
    "usage: node scripts/resources/import-public-domain-text.mjs manifest.json text.md --collection slug [--mode headings|paragraphs|single] [--out entries.jsonl]",
  );
  process.exit(2);
}

const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
const errors = validateResourceManifest(manifest);
if (errors.length) {
  for (const error of errors) console.error(error);
  process.exit(1);
}

const collectionSlug = options.get("collection") ?? manifest.collections?.[0]?.slug;
const collection = manifest.collections.find((item) => item.slug === collectionSlug);
if (!collection) {
  console.error(`unknown collection slug: ${collectionSlug}`);
  process.exit(1);
}

const mode = options.get("mode") ?? "headings";
if (!["headings", "paragraphs", "single"].includes(mode)) {
  console.error("mode must be one of: headings, paragraphs, single");
  process.exit(1);
}

const text = (await readFile(textPath, "utf8"))
  .replace(/^\uFEFF/, "")
  .replace(/\r\n/g, "\n")
  .trim();
if (!text) {
  console.error("input text is empty");
  process.exit(1);
}

const entries = buildEntries(text, mode, collectionSlug);
if (entries.length === 0) {
  console.error("input text produced no entries");
  process.exit(1);
}

const out = entries.map((entry) => JSON.stringify(entry)).join("\n") + "\n";
const outPath = options.get("out") ? resolve(options.get("out")) : null;
if (outPath) {
  await mkdir(dirname(outPath), { recursive: true });
  await writeFile(outPath, out);
  console.log(`wrote resource JSONL: ${outPath}`);
} else {
  process.stdout.write(out);
}

function buildEntries(sourceText, splitMode, collectionSlug) {
  if (splitMode === "single") {
    const title = options.get("title") ?? manifest.title;
    return [entryForBlock(collectionSlug, title, title, sourceText, 1)];
  }

  if (splitMode === "paragraphs") {
    return sourceText
      .split(/\n{2,}/)
      .map((block) => block.trim())
      .filter(Boolean)
      .map((block, index) => {
        const ref = options.get("ref-prefix")
          ? `${options.get("ref-prefix")} ${index + 1}`
          : `Paragraph ${index + 1}`;
        return entryForBlock(collectionSlug, ref, ref, block, index + 1);
      });
  }

  return splitHeadingBlocks(sourceText).map((block, index) =>
    entryForBlock(collectionSlug, block.title, block.title, block.body, index + 1),
  );
}

function splitHeadingBlocks(sourceText) {
  const blocks = [];
  let currentTitle = null;
  let currentLines = [];
  for (const line of sourceText.split("\n")) {
    const heading = line.match(/^#{1,6}\s+(.+?)\s*$/);
    if (heading) {
      flush();
      currentTitle = heading[1].trim();
    } else {
      currentLines.push(line);
    }
  }
  flush();
  return blocks;

  function flush() {
    const body = currentLines.join("\n").trim();
    if (body) {
      blocks.push({
        title: currentTitle ?? `Entry ${blocks.length + 1}`,
        body,
      });
    }
    currentLines = [];
  }
}

function entryForBlock(collectionSlug, ref, title, body, index) {
  const cleanBody = body.replace(/\n{3,}/g, "\n\n").trim();
  const relatedScriptureRefs = normalizeStringList(options.get("related-scripture-refs"));
  const citationNote = options.get("citation-note");
  return {
    collection_slug: collectionSlug,
    ref,
    title,
    body: cleanBody,
    search_text: `${title} ${ref} ${cleanBody}`.replace(/\s+/g, " ").trim(),
    related_scripture_refs: relatedScriptureRefs.length > 0 ? relatedScriptureRefs : undefined,
    citation_note: citationNote && citationNote.trim() ? citationNote.trim() : undefined,
    payload: {
      source_format: "public_domain_text",
      import_index: index,
    },
  };
}

function normalizeStringList(value) {
  if (!value) return [];
  return String(value)
    .split(/[,;\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
}
