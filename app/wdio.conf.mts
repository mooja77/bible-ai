/**
 * WebdriverIO + tauri-driver E2E test runner.
 *
 * Mirrors the official Tauri 2 + WebdriverIO example:
 *   - Capabilities use ONLY `tauri:options.application` (no browserName).
 *   - tauri-driver is spawned per-session in `beforeSession`, not globally.
 *   - The app binary is produced by `npm run tauri build -- --debug --no-bundle`,
 *     which goes through Tauri's build pipeline (so the WebView resolves
 *     `frontendDist` instead of staring at an empty page).
 *
 * Prereqs:
 *   - `tauri-driver.exe`  on PATH (~/.cargo/bin)
 *   - `msedgedriver.exe`  on PATH, version-matched to installed Edge
 */

import { spawn, type ChildProcess } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Built by `npm run tauri build -- --debug --no-bundle`. The binary path is
// the same as a plain `cargo build` would produce, but the artefact is built
// through Tauri's pipeline so the WebView loads our frontend bundle.
const APP_BINARY = resolve(__dirname, "src-tauri/target/debug/app.exe");

process.env.BIBLE_AI_MOCK_COUNCIL = "1";

let tauriDriverProc: ChildProcess | null = null;
let exiting = false;

function closeTauriDriver() {
  exiting = true;
  tauriDriverProc?.kill();
  tauriDriverProc = null;
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
      "./tests/e2e/release-readiness.spec.ts",
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
    // Spawn tauri-driver directly (no shell wrapper) so kill() reaches the
    // actual process instead of orphaning it inside cmd.exe — orphaned
    // tauri-driver instances hold port 4444 and break subsequent runs.
    tauriDriverProc = spawn("tauri-driver.exe", [], {
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
