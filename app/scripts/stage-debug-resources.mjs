import {
  copyFileSync,
  cpSync,
  existsSync,
  mkdirSync,
  rmSync,
  statSync,
} from "node:fs";
import { dirname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const debugRoot = join(appRoot, "src-tauri", "target", "debug");
const debugSidecar = join(debugRoot, "sidecar");

copyFileIfChanged(join(appRoot, "..", "data", "corpus.sqlite"), join(debugRoot, "corpus.sqlite"));

copyFileAlways(join(appRoot, "sidecar", "index.mjs"), join(debugSidecar, "index.mjs"));
copyFileAlways(join(appRoot, "sidecar", "council.mjs"), join(debugSidecar, "council.mjs"));
copyFileAlways(join(appRoot, "sidecar", "explain.mjs"), join(debugSidecar, "explain.mjs"));
copyFileAlways(join(appRoot, "sidecar", "package.json"), join(debugSidecar, "package.json"));
copyFileAlways(join(appRoot, "sidecar", "package-lock.json"), join(debugSidecar, "package-lock.json"));

replaceDirectory(join(appRoot, "sidecar", "providers"), join(debugSidecar, "providers"));
replaceDirectory(join(appRoot, "sidecar", "grounded"), join(debugSidecar, "grounded"));
copyDirectoryIfMissingOrChanged(
  join(appRoot, "sidecar", "node"),
  join(debugSidecar, "node"),
  process.platform === "win32" ? "node.exe" : join("bin", "node"),
);
copyDirectoryIfMissingOrChanged(
  join(appRoot, "sidecar", "node_modules"),
  join(debugSidecar, "node_modules"),
  ".package-lock.json",
);

removeGeneratedPath(join(debugSidecar, "tests"));

console.log(`Debug resources staged: ${debugRoot}`);

function copyFileIfChanged(source, destination) {
  assertFile(source);
  mkdirSync(dirname(destination), { recursive: true });
  if (!needsFileCopy(source, destination)) return;
  copyFileSync(source, destination);
}

function copyFileAlways(source, destination) {
  assertFile(source);
  mkdirSync(dirname(destination), { recursive: true });
  copyFileSync(source, destination);
}

function replaceDirectory(source, destination) {
  assertDirectory(source);
  removeGeneratedPath(destination);
  mkdirSync(dirname(destination), { recursive: true });
  cpSync(source, destination, { recursive: true });
}

function copyDirectoryIfMissingOrChanged(source, destination, markerRelativePath) {
  assertDirectory(source);
  const markerSource = join(source, markerRelativePath);
  const markerDestination = join(destination, markerRelativePath);
  if (existsSync(destination) && !needsFileCopy(markerSource, markerDestination)) return;
  replaceDirectory(source, destination);
}

function needsFileCopy(source, destination) {
  if (!existsSync(destination)) return true;
  const sourceStats = statSync(source);
  const destinationStats = statSync(destination);
  return (
    sourceStats.size !== destinationStats.size ||
    Math.trunc(sourceStats.mtimeMs) > Math.trunc(destinationStats.mtimeMs)
  );
}

function removeGeneratedPath(path) {
  if (!existsSync(path)) return;
  const resolvedPath = resolve(path);
  const resolvedRoot = resolve(debugRoot);
  if (resolvedPath !== resolvedRoot && resolvedPath.startsWith(`${resolvedRoot}${sep}`)) {
    rmSync(resolvedPath, { recursive: true, force: true });
    return;
  }
  throw new Error(`Refusing to remove path outside generated debug resources: ${resolvedPath}`);
}

function assertFile(path) {
  if (!existsSync(path) || !statSync(path).isFile()) {
    throw new Error(`Missing required debug resource file: ${path}`);
  }
}

function assertDirectory(path) {
  if (!existsSync(path) || !statSync(path).isDirectory()) {
    throw new Error(`Missing required debug resource directory: ${path}`);
  }
}
