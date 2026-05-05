import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawn } from "node:child_process";

const appRoot = resolve(import.meta.dirname, "..");
const appExe = join(appRoot, "src-tauri", "target", "release", "app.exe");
const profileRoot = mkdtempSync(join(tmpdir(), "bible-ai-release-profile-"));
const appData = join(profileRoot, "AppData", "Roaming");
const localAppData = join(profileRoot, "AppData", "Local");
const minRunMs = Number(process.env.RELEASE_SMOKE_MS ?? 8000);

const child = spawn(appExe, [], {
  cwd: join(appRoot, "src-tauri", "target", "release"),
  detached: false,
  env: {
    ...process.env,
    APPDATA: appData,
    LOCALAPPDATA: localAppData,
  },
  stdio: "ignore",
  windowsHide: true,
});

let exited = false;
let exitCode = null;
let exitSignal = null;

child.on("exit", (code, signal) => {
  exited = true;
  exitCode = code;
  exitSignal = signal;
});

child.on("error", (error) => {
  cleanup();
  console.error(`Release smoke failed to launch app: ${error.message}`);
  process.exit(1);
});

await delay(minRunMs);

if (exited) {
  cleanup();
  console.error(
    `Release smoke failed: app exited before ${minRunMs}ms with code ${exitCode} signal ${exitSignal}`,
  );
  process.exit(1);
}

child.kill();
await delay(1000);
cleanup();

console.log(`Release smoke passed: app stayed running for ${minRunMs}ms with a clean profile.`);

function delay(ms) {
  return new Promise((resolveDelay) => setTimeout(resolveDelay, ms));
}

function cleanup() {
  try {
    rmSync(profileRoot, { recursive: true, force: true, maxRetries: 3, retryDelay: 250 });
  } catch {
    // Best-effort cleanup. A locked WebView cache should not hide the smoke result.
  }
}
