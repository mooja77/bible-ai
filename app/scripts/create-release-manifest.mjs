import { createHash } from "node:crypto";
import { createReadStream, existsSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { readGitCommit, trackedWorktreeClean } from "./git-source-state.mjs";
import {
  appRoot,
  packageName,
  productName,
  releaseRoot,
  releaseRootLabel,
  version,
} from "./release-metadata.mjs";

const manifestPath = join(releaseRoot, "release-manifest.json");
const repoRoot = join(appRoot, "..");

const fileArtifacts = [
  ["app", join(releaseRoot, "app.exe")],
  ["corpus", join(releaseRoot, "corpus.sqlite")],
  ["sidecar_entry", join(releaseRoot, "sidecar", "index.mjs")],
  ["sidecar_council", join(releaseRoot, "sidecar", "council.mjs")],
  ["sidecar_explain", join(releaseRoot, "sidecar", "explain.mjs")],
  ["sidecar_package", join(releaseRoot, "sidecar", "package.json")],
  ["sidecar_lockfile", join(releaseRoot, "sidecar", "package-lock.json")],
  ["node_runtime", join(releaseRoot, "sidecar", "node", "node.exe")],
  ["nsis_installer", findFirstFile(join(releaseRoot, "bundle", "nsis"), /\.exe$/i)],
  ["msi_installer", findFirstFile(join(releaseRoot, "bundle", "msi"), /\.msi$/i)],
  ["sbom_npm", join(appRoot, "release", "sbom-npm.cdx.json")],
  ["sbom_cargo", join(appRoot, "release", "sbom-cargo.cdx.json")],
  ["windows_signing", join(appRoot, "release", "windows-signing.json")],
];

const directoryArtifacts = [
  ["sidecar_providers", join(releaseRoot, "sidecar", "providers")],
  ["sidecar_grounded", join(releaseRoot, "sidecar", "grounded")],
  ["sidecar_dependencies", join(releaseRoot, "sidecar", "node_modules")],
];

const forbiddenArtifacts = [["sidecar_tests", join(releaseRoot, "sidecar", "tests")]];

const missing = fileArtifacts
  .filter(([, filePath]) => !filePath || !existsSync(filePath))
  .map(([name]) => name);

for (const [name, dirPath] of directoryArtifacts) {
  if (!existsSync(dirPath)) missing.push(name);
}

const forbidden = forbiddenArtifacts.filter(([, artifactPath]) => existsSync(artifactPath)).map(([name]) => name);

if (missing.length > 0) {
  console.error(`Release manifest failed: missing ${missing.join(", ")}`);
  process.exit(1);
}

if (forbidden.length > 0) {
  console.error(`Release manifest failed: forbidden bundled artifact(s): ${forbidden.join(", ")}`);
  process.exit(1);
}

const files = [];
for (const [name, filePath] of fileArtifacts) {
  files.push(await describeFile(name, filePath));
}

const directories = directoryArtifacts.map(([name, dirPath]) => describeDirectory(name, dirPath));

const manifest = {
  app: productName,
  package_name: packageName,
  version,
  generated_at: new Date().toISOString(),
  release_root: releaseRootLabel,
  source_control: {
    git_commit: readGitCommit(repoRoot),
    tracked_worktree_clean: trackedWorktreeClean(repoRoot),
  },
  files,
  directories,
};

writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
console.log(`Release manifest written: ${manifestPath}`);

async function describeFile(name, filePath) {
  const stats = statSync(filePath);
  return {
    name,
    path: relative(releaseRoot, filePath).replaceAll("\\", "/"),
    bytes: stats.size,
    modified_at: stats.mtime.toISOString(),
    sha256: await sha256(filePath),
  };
}

function describeDirectory(name, dirPath) {
  const summary = summarizeDirectory(dirPath);
  return {
    name,
    path: relative(releaseRoot, dirPath).replaceAll("\\", "/"),
    files: summary.files,
    bytes: summary.bytes,
  };
}

function summarizeDirectory(dirPath) {
  let files = 0;
  let bytes = 0;
  const stack = [dirPath];
  while (stack.length > 0) {
    const current = stack.pop();
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const path = join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(path);
        continue;
      }
      if (!entry.isFile()) continue;
      const stats = statSync(path);
      files += 1;
      bytes += stats.size;
    }
  }
  return { files, bytes };
}

function sha256(filePath) {
  return new Promise((resolveHash, rejectHash) => {
    const hash = createHash("sha256");
    const stream = createReadStream(filePath);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("error", rejectHash);
    stream.on("end", () => resolveHash(hash.digest("hex")));
  });
}

function findFirstFile(root, pattern) {
  if (!existsSync(root)) return null;
  return (
    readdirSync(root)
      .map((name) => join(root, name))
      .filter((filePath) => pattern.test(filePath) && statSync(filePath).isFile())
      .sort()[0] ?? null
  );
}
