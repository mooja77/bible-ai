import { createHash } from "node:crypto";
import { createReadStream, existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import { packageName, productName, releaseRootLabel, version } from "./release-metadata.mjs";

const args = parseArgs(process.argv);
const assetsRoot = resolve(args.get("assets") ?? "release/promotion-assets");
const expectedCommit = String(args.get("expected-commit") ?? "").trim();
const requireMacos = args.get("require-macos") === "true";
const allowUnsignedWindows = args.get("allow-unsigned-windows") === "true";
const failures = [];
const verified = [];
const expectedInstallerNames = new Set();

if (!expectedCommit.match(/^[a-f0-9]{40}$/)) fail("--expected-commit must be a full lowercase Git SHA");
if (!existsSync(assetsRoot)) fail(`assets directory is missing: ${assetsRoot}`);

const windowsManifest = readJson(join(assetsRoot, "release-manifest.json"), "Windows manifest");
if (windowsManifest) {
  await verifyManifest(
    windowsManifest,
    ["nsis_installer", "msi_installer", "sbom_npm", "sbom_cargo", "windows_signing"],
    "Windows",
  );
}

const windowsSigning = readJson(join(assetsRoot, "windows-signing.json"), "Windows signing status");
if (windowsSigning) {
  const records = Array.isArray(windowsSigning.artifacts) ? windowsSigning.artifacts : [];
  for (const extension of [".exe", ".msi"]) {
    const record = records.find((entry) => String(entry?.name ?? "").toLowerCase().endsWith(extension));
    if (!record) {
      failures.push(`Windows signing status is missing ${extension}`);
      continue;
    }
    if (record.status !== "Valid" && !allowUnsignedWindows) {
      failures.push(`${record.name}: Authenticode status is ${record.status}; unsigned release was not acknowledged`);
    }
  }
}

const macosManifestPath = join(assetsRoot, "macos-release-manifest.json");
if (requireMacos || existsSync(macosManifestPath)) {
  const macosManifest = readJson(macosManifestPath, "macOS manifest");
  if (macosManifest) await verifyManifest(macosManifest, ["dmg_installer", "macos_signing"], "macOS");
  const macosSigning = readJson(join(assetsRoot, "macos-signing.json"), "macOS signing status");
  for (const field of [
    "developer_id_signature_valid",
    "notarization_valid",
    "staple_valid",
    "gatekeeper_assessment_valid",
  ]) {
    if (macosSigning?.[field] !== true) failures.push(`macOS signing status requires ${field}=true`);
  }
}

for (const extension of [".exe", ".msi", ...(requireMacos ? [".dmg"] : [])]) {
  if (!readdirSync(assetsRoot).some((name) => name.toLowerCase().endsWith(extension))) {
    failures.push(`release candidate is missing a ${extension} installer`);
  }
}

const actualInstallerNames = readdirSync(assetsRoot)
  .filter((name) => [".exe", ".msi", ".dmg"].some((extension) => name.toLowerCase().endsWith(extension)))
  .sort();
const expectedNames = [...expectedInstallerNames].sort();
if (JSON.stringify(actualInstallerNames) !== JSON.stringify(expectedNames)) {
  failures.push(
    `installer asset set mismatch; expected ${expectedNames.join(", ")}, got ${actualInstallerNames.join(", ")}`,
  );
}

if (failures.length > 0) {
  console.error("Release promotion verification failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Release promotion artifacts verified:");
for (const item of verified) console.log(`- ${item}`);

async function verifyManifest(manifest, requiredNames, label) {
  if (manifest.app !== productName) failures.push(`${label} manifest app must be ${productName}`);
  if (manifest.package_name !== packageName) failures.push(`${label} manifest package_name must be ${packageName}`);
  if (manifest.version !== version) failures.push(`${label} manifest version must be ${version}`);
  if (manifest.release_root !== releaseRootLabel) {
    failures.push(`${label} manifest release_root must be ${releaseRootLabel}`);
  }
  if (label === "macOS" && manifest.platform !== "macos") {
    failures.push("macOS manifest platform must be macos");
  }
  if (manifest.source_control?.git_commit !== expectedCommit) {
    failures.push(`${label} manifest source commit does not match ${expectedCommit}`);
  }
  if (manifest.source_control?.tracked_worktree_clean !== true) {
    failures.push(`${label} candidate was not built from a clean tracked worktree`);
  }
  for (const artifactName of requiredNames) {
    const artifact = (manifest.files ?? []).find((entry) => entry.name === artifactName);
    if (!artifact) {
      failures.push(`${label} manifest is missing ${artifactName}`);
      continue;
    }
    const assetPath = join(assetsRoot, basename(String(artifact.path ?? "")));
    if (artifactName.endsWith("_installer")) expectedInstallerNames.add(basename(assetPath));
    if (!existsSync(assetPath) || !statSync(assetPath).isFile()) {
      failures.push(`${label} asset is missing: ${basename(assetPath)}`);
      continue;
    }
    if (statSync(assetPath).size !== artifact.bytes) {
      failures.push(`${label} asset byte mismatch: ${basename(assetPath)}`);
      continue;
    }
    if ((await sha256(assetPath)) !== artifact.sha256) {
      failures.push(`${label} asset SHA-256 mismatch: ${basename(assetPath)}`);
      continue;
    }
    verified.push(`${basename(assetPath)} (${artifact.bytes} bytes)`);
  }
}

function readJson(path, label) {
  if (!existsSync(path)) {
    failures.push(`${label} is missing: ${path}`);
    return null;
  }
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    failures.push(`${label} is invalid JSON: ${error.message}`);
    return null;
  }
}

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
  console.error(`Release promotion verification failed: ${message}`);
  process.exit(1);
}
