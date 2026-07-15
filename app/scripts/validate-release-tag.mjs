import { version } from "./release-metadata.mjs";

const args = parseArgs(process.argv);
const channel = args.get("channel");
const tag = String(args.get("tag") ?? "").trim();
const escapedVersion = version.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

if (!tag) fail("--tag is required");

if (channel === "candidate") {
  if (!new RegExp(`^v${escapedVersion}-rc\\.[1-9][0-9]*$`).test(tag)) {
    fail(`candidate tag must match v${version}-rc.N (N starts at 1)`);
  }
} else if (channel === "public") {
  if (tag !== `v${version}`) fail(`public tag must be exactly v${version}`);
} else {
  fail("--channel must be candidate or public");
}

console.log(`Validated ${channel} tag ${tag} for Bible AI ${version}.`);

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

function fail(message) {
  console.error(`Release tag validation failed: ${message}`);
  process.exit(1);
}
