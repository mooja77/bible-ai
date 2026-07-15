import { createHash } from "node:crypto";
import { createReadStream, existsSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";

const args = parseArgs(process.argv);
const assetsRoot = resolve(args.get("assets") ?? "release/public-assets");
const outputPath = resolve(args.get("output") ?? join(assetsRoot, "SHA256SUMS.txt"));

if (!existsSync(assetsRoot)) fail(`assets directory is missing: ${assetsRoot}`);

const outputName = basename(outputPath);
const files = readdirSync(assetsRoot)
  .map((name) => join(assetsRoot, name))
  .filter((path) => statSync(path).isFile() && basename(path) !== outputName)
  .sort((left, right) => basename(left).localeCompare(basename(right)));

for (const extension of [".exe", ".msi"]) {
  if (!files.some((path) => path.toLowerCase().endsWith(extension))) {
    fail(`no ${extension} installer found`);
  }
}
if (args.get("require-macos") === "true" && !files.some((path) => path.toLowerCase().endsWith(".dmg"))) {
  fail("no .dmg installer found");
}

const lines = [];
for (const path of files) lines.push(`${await sha256(path)}  ${basename(path)}`);
writeFileSync(outputPath, `${lines.join("\n")}\n`, "utf8");
console.log(`Release checksums written: ${outputPath} (${files.length} files)`);

function parseArgs(argv) {
  const values = new Map();
  for (let index = 2; index < argv.length; index += 1) {
    const key = argv[index];
    if (!key.startsWith("--")) continue;
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) fail(`${key} requires a value`);
    values.set(key.slice(2), value);
    index += 1;
  }
  return values;
}

function sha256(path) {
  return new Promise((resolveHash, rejectHash) => {
    const hash = createHash("sha256");
    const stream = createReadStream(path);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("error", rejectHash);
    stream.on("end", () => resolveHash(hash.digest("hex")));
  });
}

function fail(message) {
  console.error(`Release checksum generation failed: ${message}`);
  process.exit(1);
}
