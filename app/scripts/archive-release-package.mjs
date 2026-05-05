import { existsSync, rmSync, statSync } from "node:fs";
import { join } from "node:path";
import { spawn } from "node:child_process";
import { releaseArchivePath, releaseRoot } from "./release-metadata.mjs";

const packageDir = join(releaseRoot, "release-package");

if (!existsSync(packageDir)) {
  console.error(`Release archive failed: missing package directory ${packageDir}`);
  process.exit(1);
}

rmSync(releaseArchivePath, { force: true });

await run("tar.exe", ["-a", "-c", "-f", releaseArchivePath, "-C", packageDir, "."]);

if (!existsSync(releaseArchivePath) || statSync(releaseArchivePath).size <= 0) {
  console.error(`Release archive failed: empty or missing archive ${releaseArchivePath}`);
  process.exit(1);
}

console.log(`Release archive written: ${releaseArchivePath}`);

function run(command, args) {
  return new Promise((resolveRun, rejectRun) => {
    const child = spawn(command, args, { stdio: "inherit", windowsHide: true });
    child.on("error", rejectRun);
    child.on("exit", (code, signal) => {
      if (code === 0) resolveRun();
      else rejectRun(new Error(`${command} exited with code ${code} signal ${signal}`));
    });
  });
}
