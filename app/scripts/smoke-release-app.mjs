import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawn, spawnSync } from "node:child_process";

const appRoot = resolve(import.meta.dirname, "..");
const appExe = join(appRoot, "src-tauri", "target", "release", "app.exe");
const profileRoot = mkdtempSync(join(tmpdir(), "bible-ai-release-profile-"));
const appData = join(profileRoot, "AppData", "Roaming");
const localAppData = join(profileRoot, "AppData", "Local");
const userDataDir = join(appData, "com.jm.bibleai");
const minRunMs = Number(process.env.RELEASE_SMOKE_MS ?? 8000);
const credentialService = `Bible-AI-Release-Smoke-${process.pid}-${Date.now()}`;

const child = spawn(appExe, [], {
  cwd: join(appRoot, "src-tauri", "target", "release"),
  detached: false,
  env: smokeEnv({
    APPDATA: appData,
    LOCALAPPDATA: localAppData,
    BIBLE_AI_USER_DATA_DIR: userDataDir,
    BIBLE_AI_CREDENTIAL_SERVICE: credentialService,
    BIBLE_AI_MOCK_COUNCIL: "1",
  }),
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

function smokeEnv(overrides) {
  const keep = [
    "ComSpec",
    "Path",
    "PATH",
    "PATHEXT",
    "ProgramFiles",
    "ProgramFiles(x86)",
    "ProgramW6432",
    "SystemRoot",
    "TEMP",
    "TMP",
    "USERNAME",
    "USERPROFILE",
    "WINDIR",
  ];
  const env = {};
  for (const key of keep) {
    if (process.env[key]) env[key] = process.env[key];
  }
  return { ...env, ...overrides };
}

function cleanup() {
  cleanupCredentials();
  try {
    rmSync(profileRoot, { recursive: true, force: true, maxRetries: 3, retryDelay: 250 });
  } catch {
    // Best-effort cleanup. A locked WebView cache should not hide the smoke result.
  }
}

function cleanupCredentials() {
  if (process.platform !== "win32") return;
  for (const name of [
    "google_api_key",
    "openai_api_key",
    "anthropic_api_key",
    "managed_gateway_token",
  ]) {
    spawnSync("cmdkey.exe", [`/delete:${name}.${credentialService}`], {
      stdio: "ignore",
      windowsHide: true,
    });
  }
}
