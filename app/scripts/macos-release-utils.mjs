import { createHash } from "node:crypto";
import { createReadStream, existsSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { productName, releaseRoot, version } from "./release-metadata.mjs";

export const macosBundleRoot = join(releaseRoot, "bundle");
export const macosAppBundleDir = join(macosBundleRoot, "macos");
export const macosDmgDir = join(macosBundleRoot, "dmg");
export const macosManifestPath = join(releaseRoot, "macos-release-manifest.json");
export const macosSummaryPath = join(releaseRoot, "macos-release-summary.md");
export const macosPackageDir = join(releaseRoot, "macos-release-package");

export function findMacosApp() {
  return findFirst(macosAppBundleDir, (name, path) => name.endsWith(".app") && statSync(path).isDirectory());
}

export function findMacosDmg() {
  return findFirst(macosDmgDir, (name, path) => name.endsWith(".dmg") && statSync(path).isFile());
}

export function macosAppExecutable(appPath) {
  const macosDir = join(appPath, "Contents", "MacOS");
  if (!existsSync(macosDir)) return null;
  return (
    readdirSync(macosDir)
      .map((name) => join(macosDir, name))
      .filter((path) => statSync(path).isFile())
      .sort()[0] ?? null
  );
}

export function describeFile(name, filePath) {
  const stats = statSync(filePath);
  return {
    name,
    path: relative(releaseRoot, filePath).replaceAll("\\", "/"),
    bytes: stats.size,
    modified_at: stats.mtime.toISOString(),
  };
}

export async function describeFileWithHash(name, filePath) {
  return {
    ...describeFile(name, filePath),
    sha256: await sha256(filePath),
  };
}

export function describeDirectory(name, dirPath) {
  const summary = summarizeDirectory(dirPath);
  return {
    name,
    path: relative(releaseRoot, dirPath).replaceAll("\\", "/"),
    files: summary.files,
    bytes: summary.bytes,
  };
}

export function summarizeDirectory(dirPath) {
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

export function isExecutable(path) {
  if (!existsSync(path) || !statSync(path).isFile()) return false;
  if (process.platform === "win32") return true;
  return Boolean(statSync(path).mode & 0o111);
}

export function sha256(filePath) {
  return new Promise((resolveHash, rejectHash) => {
    const hash = createHash("sha256");
    const stream = createReadStream(filePath);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("error", rejectHash);
    stream.on("end", () => resolveHash(hash.digest("hex")));
  });
}

export function macosArchiveName() {
  return `${productName}_${version}_macos-release-package.zip`;
}

function findFirst(root, predicate) {
  if (!existsSync(root)) return null;
  return (
    readdirSync(root)
      .map((name) => [name, join(root, name)])
      .filter(([name, path]) => predicate(name, path))
      .map(([, path]) => path)
      .sort()[0] ?? null
  );
}
