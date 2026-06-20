/**
 * WebdriverIO + tauri-driver E2E test runner.
 *
 * Mirrors the official Tauri 2 + WebdriverIO example:
 *   - Capabilities use ONLY `tauri:options.application` (no browserName).
 *   - tauri-driver is spawned per-session in `beforeSession`, not globally.
 *   - The app binary is produced by `tauri build --debug --no-bundle`;
 *     `scripts/stage-debug-resources.mjs` then mirrors bundle resources next
 *     to the debug executable for clean E2E runs.
 *
 * Prereqs:
 *   - `tauri-driver.exe`  on PATH (~/.cargo/bin)
 *   - `msedgedriver.exe`  on PATH, version-matched to installed Edge
 */

import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { basename, dirname, join, resolve, sep } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Built by `npm run tauri build -- --debug --no-bundle`. The binary path is
// the same as a plain `cargo build` would produce, but the artefact is built
// through Tauri's pipeline so the WebView loads our frontend bundle.
const APP_BINARY = resolve(__dirname, "src-tauri/target/debug/app.exe");

process.env.BIBLE_AI_MOCK_COUNCIL = "1";

let tauriDriverProc: ChildProcess | null = null;
let exiting = false;
let profileRoot: string | null = null;
let credentialService: string | null = null;

function createE2eEnvironment() {
  profileRoot = mkdtempSync(join(tmpdir(), "bible-ai-e2e-profile-"));
  const appData = join(profileRoot, "AppData", "Roaming");
  const localAppData = join(profileRoot, "AppData", "Local");
  const userDataDir = join(appData, "com.jm.bibleai");
  mkdirSync(appData, { recursive: true });
  mkdirSync(localAppData, { recursive: true });
  mkdirSync(userDataDir, { recursive: true });

  credentialService = `Bible-AI-E2E-${process.pid}-${Date.now()}`;
  return e2eEnv({
    APPDATA: appData,
    LOCALAPPDATA: localAppData,
    BIBLE_AI_USER_DATA_DIR: userDataDir,
    BIBLE_AI_CREDENTIAL_SERVICE: credentialService,
    BIBLE_AI_DISABLE_PROJECT_ENV: "1",
    BIBLE_AI_MOCK_COUNCIL: "1",
  });
}

function e2eEnv(overrides: Record<string, string>) {
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
  const env: Record<string, string> = {};
  for (const key of keep) {
    if (process.env[key]) env[key] = process.env[key];
  }
  return { ...env, ...overrides };
}

function cleanupE2eCredentials() {
  if (process.platform !== "win32" || !credentialService) return;
  for (const name of [
    "google_api_key",
    "openai_api_key",
    "anthropic_api_key",
    "managed_gateway_token",
  ]) {
    const target = `${name}.${credentialService}`;
    spawnSync("cmdkey.exe", [`/delete:${target}`], {
      stdio: "ignore",
      windowsHide: true,
    });
  }
  credentialService = null;
}

function cleanupE2eProfile() {
  if (!profileRoot) return;
  const tmp = resolve(tmpdir());
  const root = resolve(profileRoot);
  if (root.startsWith(`${tmp}${sep}`) && basename(root).startsWith("bible-ai-e2e-profile-")) {
    rmSync(root, { recursive: true, force: true });
  }
  profileRoot = null;
}

function closeTauriDriver() {
  exiting = true;
  tauriDriverProc?.kill();
  tauriDriverProc = null;
  cleanupE2eCredentials();
  cleanupE2eProfile();
}

// Belt-and-braces: tauri-driver lingers if the test process dies abnormally.
for (const sig of ["exit", "SIGINT", "SIGTERM", "SIGHUP", "SIGBREAK"] as const) {
  process.on(sig as NodeJS.Signals, () => {
    closeTauriDriver();
  });
}

export const config: WebdriverIO.Config = {
  runner: "local",
  hostname: "127.0.0.1",
  port: 4444,
  specs: [
    [
      "./tests/e2e/smoke.spec.ts",
      "./tests/e2e/workspace.spec.ts",
      "./tests/e2e/reader-interactions.spec.ts",
      "./tests/e2e/backup-restore.spec.ts",
      "./tests/e2e/council-mock.spec.ts",
      "./tests/e2e/council-error.spec.ts",
      "./tests/e2e/search-semantic.spec.ts",
      "./tests/e2e/notes-search.spec.ts",
      "./tests/e2e/crossref-weight.spec.ts",
      "./tests/e2e/council-follow-up.spec.ts",
      "./tests/e2e/tags-browse.spec.ts",
      "./tests/e2e/release-readiness.spec.ts",
      "./tests/e2e/settings-validation.spec.ts",
      "./tests/e2e/global-error-notice.spec.ts",
      "./tests/e2e/ui-scale.spec.ts",
      "./tests/e2e/empty-translation-column.spec.ts",
      "./tests/e2e/layout-maxscale.spec.ts",
      "./tests/e2e/contrast-light.spec.ts",
      "./tests/e2e/council-run-map.spec.ts",
      "./tests/e2e/reasoning-explorer.spec.ts",
      "./tests/e2e/council-verdict.spec.ts",
    ],
  ],
  maxInstances: 1,

  capabilities: [
    {
      maxInstances: 1,
      "tauri:options": {
        application: APP_BINARY,
      },
    } as WebdriverIO.Capabilities,
  ],

  logLevel: "warn",
  framework: "mocha",
  reporters: ["spec"],
  waitforTimeout: 15_000,
  connectionRetryCount: 3,

  mochaOpts: {
    ui: "bdd",
    timeout: 120_000,
  },

  beforeSession: () => {
    const env = createE2eEnvironment();
    exiting = false;
    // Spawn tauri-driver directly (no shell wrapper) so kill() reaches the
    // actual process instead of orphaning it inside cmd.exe — orphaned
    // tauri-driver instances hold port 4444 and break subsequent runs.
    tauriDriverProc = spawn("tauri-driver.exe", [], {
      env,
      stdio: ["ignore", process.stdout, process.stderr],
    });
    tauriDriverProc.on("error", (err) => {
      console.error("tauri-driver error:", err);
      process.exit(1);
    });
    tauriDriverProc.on("exit", (code) => {
      if (!exiting) {
        console.error("tauri-driver exited unexpectedly with code:", code);
        process.exit(1);
      }
    });
  },

  afterSession: () => {
    closeTauriDriver();
  },
};
