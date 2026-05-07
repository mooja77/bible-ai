import { chmodSync, copyFileSync, existsSync, mkdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { appRoot } from "./release-metadata.mjs";

const args = new Map();
for (let i = 2; i < process.argv.length; i += 1) {
  const key = process.argv[i];
  if (!key.startsWith("--")) continue;
  const next = process.argv[i + 1];
  if (next && !next.startsWith("--")) {
    args.set(key.slice(2), next);
    i += 1;
  } else {
    args.set(key.slice(2), "true");
  }
}

if (process.platform !== "darwin" && args.get("allow-non-darwin") !== "true") {
  console.error("macOS sidecar preparation must run on macOS so native optional dependencies resolve for darwin.");
  process.exit(1);
}

const sidecarDir = join(appRoot, "sidecar");
const sourceNode = resolve(args.get("node") ?? process.execPath);
const targetNode = join(sidecarDir, "node", "bin", "node");
const skipNpmCi = args.get("skip-npm-ci") === "true";

if (!existsSync(sourceNode) || !statSync(sourceNode).isFile()) {
  console.error(`Node runtime not found: ${sourceNode}`);
  process.exit(1);
}

mkdirSync(join(sidecarDir, "node", "bin"), { recursive: true });
copyFileSync(sourceNode, targetNode);
chmodSync(targetNode, 0o755);
console.log(`Copied macOS Node runtime: ${targetNode}`);

const version = run(targetNode, ["--version"], { cwd: sidecarDir }).stdout.trim();
console.log(`Bundled sidecar Node version: ${version}`);

if (!skipNpmCi) {
  run("npm", ["ci", "--include=optional"], { cwd: sidecarDir, stdio: "inherit" });
}

console.log("macOS sidecar preparation complete.");

function run(command, commandArgs, options = {}) {
  const result = spawnSync(command, commandArgs, {
    cwd: options.cwd,
    encoding: "utf8",
    stdio: options.stdio ?? "pipe",
  });
  if (result.error) {
    console.error(`${command} failed: ${result.error.message}`);
    process.exit(1);
  }
  if (result.status !== 0) {
    console.error(`${command} exited with code ${result.status}`);
    if (result.stderr) console.error(result.stderr.trim());
    process.exit(result.status ?? 1);
  }
  return result;
}
