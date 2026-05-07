import { existsSync, statSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { appRoot } from "./release-metadata.mjs";

const failures = [];
const warnings = [];
const successes = [];

if (process.platform !== "darwin") {
  failures.push("macOS release builds must run on macOS. Build the .app/.dmg on an Apple computer or macOS CI runner.");
}

checkCommand("node", ["--version"], "Node.js");
checkCommand("npm", ["--version"], "npm");
checkCommand("cargo", ["--version"], "Cargo");
checkCommand("rustc", ["--version"], "Rust");
checkCommand("xcodebuild", ["-version"], "Xcode command line tools");
checkCommand("xcrun", ["--find", "codesign"], "codesign via xcrun");

const sidecarDir = join(appRoot, "sidecar");
const macNode = join(sidecarDir, "node", "bin", "node");
const nodeModules = join(sidecarDir, "node_modules");
if (!existsSync(macNode)) {
  failures.push(`macOS sidecar Node runtime missing: ${macNode}. Run npm run macos:sidecar:prepare on macOS.`);
} else if (!statSync(macNode).isFile()) {
  failures.push(`macOS sidecar Node runtime is not a file: ${macNode}`);
} else {
  successes.push(`macOS sidecar Node runtime: ${macNode}`);
}

if (!existsSync(nodeModules)) {
  failures.push(`sidecar dependencies missing: ${nodeModules}. Run npm run macos:sidecar:prepare on macOS.`);
} else {
  successes.push(`sidecar dependencies: ${nodeModules}`);
}

const hasSigningIdentity =
  Boolean(process.env.APPLE_SIGNING_IDENTITY) ||
  Boolean(process.env.TAURI_SIGNING_PRIVATE_KEY) ||
  Boolean(process.env.CSC_NAME);
if (!hasSigningIdentity) {
  warnings.push("no signing identity environment variable detected. Unsigned local DMGs can be tested, but public macOS distribution needs signing and notarization.");
}

if (failures.length > 0) {
  console.error("macOS build environment verification failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  if (warnings.length > 0) {
    console.error("");
    console.error("Warnings:");
    for (const warning of warnings) console.error(`- ${warning}`);
  }
  process.exit(1);
}

console.log("macOS build environment verification passed:");
for (const success of successes) console.log(`- ${success}`);
if (warnings.length > 0) {
  console.log("");
  console.log("Warnings:");
  for (const warning of warnings) console.log(`- ${warning}`);
}

function checkCommand(command, args, label) {
  const result = spawnSync(command, args, { encoding: "utf8" });
  if (result.error) {
    failures.push(`${label} unavailable: ${result.error.message}`);
    return;
  }
  if (result.status !== 0) {
    failures.push(`${label} failed with exit ${result.status}: ${(result.stderr || result.stdout).trim()}`);
    return;
  }
  successes.push(`${label}: ${(result.stdout || result.stderr).trim().split(/\r?\n/)[0]}`);
}
