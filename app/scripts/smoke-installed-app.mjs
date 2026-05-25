import { existsSync, mkdtempSync, readdirSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join, resolve } from "node:path";
import { spawn, spawnSync } from "node:child_process";

if (process.platform !== "win32") {
  console.error("Installed release smoke is only supported on Windows.");
  process.exit(1);
}

const appRoot = resolve(import.meta.dirname, "..");
const nsisDir = join(appRoot, "src-tauri", "target", "release", "bundle", "nsis");
const installer = findFirstFile(nsisDir, /\.exe$/i);
const tempRoot = mkdtempSync(join(tmpdir(), "bible-ai-install-smoke-"));
const installDir = join(tempRoot, "Install");
const profileRoot = join(tempRoot, "Profile");
const appData = join(profileRoot, "AppData", "Roaming");
const localAppData = join(profileRoot, "AppData", "Local");
const userDataDir = join(appData, "com.jm.bibleai");
const minRunMs = Number(process.env.RELEASE_SMOKE_MS ?? 8000);
const credentialService = `Bible-AI-Install-Smoke-${process.pid}-${Date.now()}`;

if (!installer) {
  cleanup();
  console.error(`Installed release smoke failed: no NSIS installer found in ${nsisDir}`);
  process.exit(1);
}

try {
  await run(installer, ["/S", `/D=${installDir}`], {
    timeoutMs: 180_000,
    label: `installer ${basename(installer)}`,
  });

  const appExe = findFirstFile(installDir, /(^app|Bible AI).*\.exe$/i, /uninstall/i);
  if (!appExe) {
    throw new Error(`installed app executable not found in ${installDir}`);
  }

  await assertAppStaysRunning(appExe, minRunMs);

  const uninstaller = findFirstFile(installDir, /uninstall.*\.exe$/i);
  if (!uninstaller) {
    throw new Error(`uninstaller not found in ${installDir}`);
  }
  await run(uninstaller, ["/S"], {
    timeoutMs: 120_000,
    label: `uninstaller ${basename(uninstaller)}`,
  });

  console.log(
    `Installed release smoke passed: installed ${basename(installer)}, launched ${basename(
      appExe,
    )} for ${minRunMs}ms, and ran the uninstaller.`,
  );
} catch (error) {
  console.error(`Installed release smoke failed: ${error.message}`);
  process.exitCode = 1;
} finally {
  cleanup();
}

async function assertAppStaysRunning(appExe, ms) {
  const child = spawn(appExe, [], {
    cwd: installDir,
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

  await onceReadyOrError(child);
  await delay(ms);

  if (exited) {
    throw new Error(
      `installed app exited before ${ms}ms with code ${exitCode} signal ${exitSignal}`,
    );
  }

  child.kill();
  await delay(1000);
  if (!exited) await taskkill(child.pid);
}

function run(command, args, { timeoutMs, label }) {
  return new Promise((resolveRun, rejectRun) => {
    const child = spawn(command, args, { stdio: "ignore", windowsHide: true });
    const timeout = setTimeout(() => {
      child.kill();
      rejectRun(new Error(`${label} timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    child.on("error", (error) => {
      clearTimeout(timeout);
      rejectRun(error);
    });
    child.on("exit", (code, signal) => {
      clearTimeout(timeout);
      if (code === 0) resolveRun();
      else rejectRun(new Error(`${label} exited with code ${code} signal ${signal}`));
    });
  });
}

function onceReadyOrError(child) {
  return new Promise((resolveReady, rejectReady) => {
    child.once("spawn", resolveReady);
    child.once("error", rejectReady);
  });
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

async function taskkill(pid) {
  if (!pid) return;
  try {
    await run("taskkill.exe", ["/PID", String(pid), "/T", "/F"], {
      timeoutMs: 15_000,
      label: `taskkill ${pid}`,
    });
  } catch {
    // Best-effort process cleanup. The later uninstall step will report locked files.
  }
}

function findFirstFile(root, pattern, excludePattern = null) {
  if (!existsSync(root)) return null;
  const entries = readdirSync(root, { withFileTypes: true });
  for (const entry of entries) {
    const path = join(root, entry.name);
    if (entry.isDirectory()) {
      const nested = findFirstFile(path, pattern, excludePattern);
      if (nested) return nested;
      continue;
    }
    if (!entry.isFile()) continue;
    if (excludePattern?.test(entry.name)) continue;
    if (pattern.test(entry.name) && statSync(path).size > 0) return path;
  }
  return null;
}

function delay(ms) {
  return new Promise((resolveDelay) => setTimeout(resolveDelay, ms));
}

function cleanup() {
  cleanupCredentials();
  try {
    rmSync(tempRoot, { recursive: true, force: true, maxRetries: 3, retryDelay: 250 });
  } catch {
    // Best-effort cleanup. Installer smoke failures should remain focused on app behavior.
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
