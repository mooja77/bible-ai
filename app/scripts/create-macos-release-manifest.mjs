import { existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { packageName, productName, releaseRoot, version } from "./release-metadata.mjs";
import {
  describeDirectory,
  describeFileWithHash,
  findMacosApp,
  findMacosDmg,
  macosAppExecutable,
  macosManifestPath,
} from "./macos-release-utils.mjs";

const appBundle = findMacosApp();
const dmg = findMacosDmg();
const missing = [];

if (!appBundle) missing.push("app_bundle");
if (!dmg) missing.push("dmg_installer");

let executable = null;
if (appBundle) executable = macosAppExecutable(appBundle);
if (appBundle && !executable) missing.push("app_executable");

const resources = appBundle ? join(appBundle, "Contents", "Resources") : null;
const fileArtifacts = [
  ["dmg_installer", dmg],
  ["app_info_plist", appBundle ? join(appBundle, "Contents", "Info.plist") : null],
  ["app_executable", executable],
  ["corpus", resources ? join(resources, "corpus.sqlite") : null],
  ["sidecar_entry", resources ? join(resources, "sidecar", "index.mjs") : null],
  ["sidecar_council", resources ? join(resources, "sidecar", "council.mjs") : null],
  ["node_runtime", resources ? join(resources, "sidecar", "node", "bin", "node") : null],
];
const directoryArtifacts = [
  ["app_bundle", appBundle],
  ["sidecar_dependencies", resources ? join(resources, "sidecar", "node_modules") : null],
];

for (const [name, path] of fileArtifacts) {
  if (!path || !existsSync(path)) missing.push(name);
}
for (const [name, path] of directoryArtifacts) {
  if (!path || !existsSync(path)) missing.push(name);
}

if (missing.length > 0) {
  console.error(`macOS release manifest failed: missing ${[...new Set(missing)].join(", ")}`);
  process.exit(1);
}

const files = [];
for (const [name, path] of fileArtifacts) {
  files.push(await describeFileWithHash(name, path));
}

const directories = directoryArtifacts.map(([name, path]) => describeDirectory(name, path));

const manifest = {
  app: productName,
  package_name: packageName,
  version,
  platform: "macos",
  generated_at: new Date().toISOString(),
  release_root: releaseRoot,
  files,
  directories,
};

writeFileSync(macosManifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
console.log(`macOS release manifest written: ${macosManifestPath}`);
