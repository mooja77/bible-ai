import { existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { spawn } from "node:child_process";
import { releaseArchivePath, releaseRoot } from "./release-metadata.mjs";

const packageDir = join(releaseRoot, "release-package");

if (!existsSync(packageDir)) {
  console.error(`Release archive verification failed: missing package directory ${packageDir}`);
  process.exit(1);
}
if (!existsSync(releaseArchivePath) || statSync(releaseArchivePath).size <= 0) {
  console.error(`Release archive verification failed: missing or empty archive ${releaseArchivePath}`);
  process.exit(1);
}

const expected = readdirSync(packageDir)
  .filter((name) => statSync(join(packageDir, name)).isFile())
  .sort();
const actual = (await listArchive(releaseArchivePath))
  .map((entry) => entry.replace(/^\.?\//, ""))
  .filter((entry) => entry && entry !== ".")
  .sort();

const missing = expected.filter((name) => !actual.includes(name));
const extra = actual.filter((name) => !expected.includes(name));

if (missing.length > 0 || extra.length > 0) {
  console.error("Release archive verification failed:");
  for (const name of missing) console.error(`- missing from archive: ${name}`);
  for (const name of extra) console.error(`- unexpected archive entry: ${name}`);
  process.exit(1);
}

console.log(`Release archive verification passed: ${releaseArchivePath}`);
for (const name of actual) console.log(`- ${name}`);

function listArchive(filePath) {
  return new Promise((resolveList, rejectList) => {
    const child = spawn("tar.exe", ["-tf", filePath], { windowsHide: true });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", rejectList);
    child.on("exit", (code, signal) => {
      if (code !== 0) {
        rejectList(new Error(`tar.exe exited with code ${code} signal ${signal}: ${stderr}`));
        return;
      }
      resolveList(stdout.split(/\r?\n/).filter(Boolean));
    });
  });
}
