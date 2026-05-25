import { existsSync, statSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import {
  findMacosApp,
  findMacosDmg,
  isExecutable,
  macosAppExecutable,
  summarizeDirectory,
} from "./macos-release-utils.mjs";

const failures = [];
const successes = [];
const appBundle = findMacosApp();
const dmg = findMacosDmg();

if (!appBundle) {
  failures.push("macOS .app bundle missing under src-tauri/target/release/bundle/macos");
} else {
  checkDirectory("app bundle", appBundle);
  checkFile("Info.plist", join(appBundle, "Contents", "Info.plist"));
  const executable = macosAppExecutable(appBundle);
  if (!executable) {
    failures.push("app bundle executable missing under Contents/MacOS");
  } else if (!isExecutable(executable)) {
    failures.push(`app bundle executable is not executable: ${executable}`);
  } else {
    successes.push(`app executable: ${executable}`);
  }

  const resources = join(appBundle, "Contents", "Resources");
  checkFile("corpus resource", join(resources, "corpus.sqlite"));
  checkFile("sidecar entry", join(resources, "sidecar", "index.mjs"));
  checkFile("sidecar council module", join(resources, "sidecar", "council.mjs"));
  checkFile("sidecar explanation module", join(resources, "sidecar", "explain.mjs"));
  checkFile("sidecar package", join(resources, "sidecar", "package.json"));
  checkFile("sidecar lockfile", join(resources, "sidecar", "package-lock.json"));
  const nodePath = join(resources, "sidecar", "node", "bin", "node");
  checkFile("bundled macOS Node runtime", nodePath);
  if (existsSync(nodePath) && !isExecutable(nodePath)) {
    failures.push(`bundled macOS Node runtime is not executable: ${nodePath}`);
  }
  checkDirectory("sidecar providers", join(resources, "sidecar", "providers"));
  checkDirectory("sidecar dependencies", join(resources, "sidecar", "node_modules"));
  checkAbsent("sidecar tests", join(resources, "sidecar", "tests"));

  if (process.platform === "darwin" && process.env.BIBLE_AI_REQUIRE_MACOS_CODESIGN === "true") {
    const result = spawnSync("codesign", ["--verify", "--deep", "--strict", appBundle], {
      encoding: "utf8",
    });
    if (result.status !== 0) {
      failures.push(`codesign verification failed: ${(result.stderr || result.stdout).trim()}`);
    } else {
      successes.push("codesign verification");
    }
  }
}

if (!dmg) {
  failures.push("macOS DMG missing under src-tauri/target/release/bundle/dmg");
} else {
  checkFile("DMG installer", dmg);
}

if (failures.length > 0) {
  console.error("macOS release verification failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("macOS release verification passed:");
for (const success of successes) console.log(`- ${success}`);

function checkFile(label, filePath) {
  if (!existsSync(filePath)) {
    failures.push(`${label} missing: ${filePath}`);
    return;
  }
  const stats = statSync(filePath);
  if (!stats.isFile()) {
    failures.push(`${label} is not a file: ${filePath}`);
    return;
  }
  if (stats.size <= 0) {
    failures.push(`${label} is empty: ${filePath}`);
    return;
  }
  successes.push(`${label}: ${filePath}`);
}

function checkDirectory(label, dirPath) {
  if (!existsSync(dirPath)) {
    failures.push(`${label} missing: ${dirPath}`);
    return;
  }
  if (!statSync(dirPath).isDirectory()) {
    failures.push(`${label} is not a directory: ${dirPath}`);
    return;
  }
  if (summarizeDirectory(dirPath).files <= 0) {
    failures.push(`${label} has no bundled files: ${dirPath}`);
    return;
  }
  successes.push(`${label}: ${dirPath}`);
}

function checkAbsent(label, artifactPath) {
  if (existsSync(artifactPath)) {
    failures.push(`${label} should not be bundled: ${artifactPath}`);
  }
}
