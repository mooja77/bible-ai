/**
 * Long-running Node sidecar for Bible AI.
 *
 * Communicates with the Tauri Rust host via newline-delimited JSON on stdio:
 * each inbound line is one request, each outbound line is one response. All
 * log output goes to stderr so stdout stays clean as an RPC channel.
 *
 * Request shape:
 *   { "id": string, "type": "council", ...type-specific-fields }
 *
 * Response shape:
 *   { "id": string, "type": "<orig-type>_result", "result": any }
 *   { "id": string, "type": "error", "error": string }
 */

import { fileURLToPath } from "node:url";
import { createInterface } from "node:readline";
import { runCouncil, scopeCouncil } from "./council.mjs";
import { explainPassage } from "./explain.mjs";
import { providerManifest } from "./providers/index.mjs";
import { gatewayHealthEndpoint } from "./providers/gateway.mjs";
import { probeClaudeVoice } from "./providers/claude.mjs";
import { redactSecrets } from "./providers/_shared.mjs";

const log = (...args) => console.error("[sidecar]", ...args);

function send(msg) {
  // Single line per message — Rust reads with BufRead::lines().
  process.stdout.write(JSON.stringify(msg) + "\n");
}

/** Build a progress line correlated to a request id. Exported for testing. */
export function councilProgressLine(id, event) {
  return { id, type: "council_progress", event };
}

function envWithSettings(settings = {}) {
  const env = { ...process.env };
  if (settings.google_api_key) env.GOOGLE_API_KEY = settings.google_api_key;
  if (settings.openai_api_key) env.OPENAI_API_KEY = settings.openai_api_key;
  if (settings.anthropic_api_key) env.ANTHROPIC_API_KEY = settings.anthropic_api_key;
  if (settings.managed_gateway_url) env.MANAGED_GATEWAY_URL = settings.managed_gateway_url;
  if (settings.managed_gateway_token) {
    env.MANAGED_GATEWAY_TOKEN = settings.managed_gateway_token;
  }
  if (settings.openai_model) env.OPENAI_MODEL = settings.openai_model;
  if (settings.gemini_model) env.GEMINI_MODEL = settings.gemini_model;
  if (settings.anthropic_model) env.ANTHROPIC_MODEL = settings.anthropic_model;
  if (settings.claude_model) env.CLAUDE_MODEL = settings.claude_model;
  if (settings.ollama_host) env.OLLAMA_HOST = settings.ollama_host;
  if (settings.ollama_voice_model) env.OLLAMA_VOICE_MODEL = settings.ollama_voice_model;
  return env;
}

async function checkJsonEndpoint({ name, url, headers }) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10_000);
  try {
    const resp = await fetch(url, { headers, signal: controller.signal });
    if (!resp.ok) {
      const body = await resp.text().catch(() => "");
      return {
        configured: true,
        ok: false,
        error: `${name} ${resp.status} ${resp.statusText}: ${body.slice(0, 180)}`,
      };
    }
    return { configured: true, ok: true, error: null };
  } catch (err) {
    return {
      configured: true,
      ok: false,
      error: err?.message ?? String(err),
    };
  } finally {
    clearTimeout(timer);
  }
}

async function checkGateway(env) {
  if (!env.MANAGED_GATEWAY_URL) {
    return { configured: false, ok: false, error: "No managed gateway URL configured" };
  }
  try {
    return await checkJsonEndpoint({
      name: "Managed Gateway",
      url: gatewayHealthEndpoint(env.MANAGED_GATEWAY_URL),
      headers: env.MANAGED_GATEWAY_TOKEN
        ? { Authorization: `Bearer ${env.MANAGED_GATEWAY_TOKEN}` }
        : undefined,
    });
  } catch (err) {
    return {
      configured: true,
      ok: false,
      error: err?.message ?? String(err),
    };
  }
}

const DIAGNOSTIC_SCOPES = new Set([
  "all",
  "claude",
  "google",
  "openai",
  "anthropic",
  "gateway",
  "ollama",
]);

function skippedCheck(configured) {
  return {
    configured,
    ok: false,
    checked: false,
    error: "Not tested in this run",
  };
}

function completedCheck(result) {
  return { ...result, checked: true };
}

export async function runDiagnostics({ settings = {}, model = "sonnet", scope = "all" }) {
  const env = envWithSettings(settings);
  const normalizedScope = DIAGNOSTIC_SCOPES.has(scope) ? scope : "all";
  const shouldCheck = (name) => normalizedScope === "all" || normalizedScope === name;

  // When an Anthropic API key is present, the models endpoint verifies both
  // the key and the Claude voice without spending tokens on a generation.
  // Claude Code subscription mode still needs its small liveness probe.
  const needsAnthropicEndpoint =
    !!env.ANTHROPIC_API_KEY && (shouldCheck("anthropic") || shouldCheck("claude"));
  const anthropicPromise = needsAnthropicEndpoint
    ? checkJsonEndpoint({
        name: "Anthropic",
        url: "https://api.anthropic.com/v1/models",
        headers: {
          "x-api-key": env.ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01",
        },
      })
    : null;

  const claudePromise = shouldCheck("claude")
    ? env.ANTHROPIC_API_KEY
      ? anthropicPromise.then((result) => ({ ...result, mode: "api" }))
      : probeClaudeVoice({ env })
    : Promise.resolve(
        skippedCheck(!!env.ANTHROPIC_API_KEY || env.DISABLE_CLAUDE_VOICE !== "1"),
      );
  const googlePromise = shouldCheck("google")
    ? env.GOOGLE_API_KEY
      ? checkJsonEndpoint({
          name: "Google",
          url: "https://generativelanguage.googleapis.com/v1beta/models",
          headers: { "x-goog-api-key": env.GOOGLE_API_KEY },
        })
      : Promise.resolve({ configured: false, ok: false, error: "No Google API key configured" })
    : Promise.resolve(skippedCheck(!!env.GOOGLE_API_KEY));
  const openaiPromise = shouldCheck("openai")
    ? env.OPENAI_API_KEY
      ? checkJsonEndpoint({
          name: "OpenAI",
          url: "https://api.openai.com/v1/models",
          headers: { Authorization: `Bearer ${env.OPENAI_API_KEY}` },
        })
      : Promise.resolve({ configured: false, ok: false, error: "No OpenAI API key configured" })
    : Promise.resolve(skippedCheck(!!env.OPENAI_API_KEY));
  const anthropicCheckPromise = shouldCheck("anthropic")
    ? anthropicPromise ??
      Promise.resolve({ configured: false, ok: false, error: "No Anthropic API key configured" })
    : Promise.resolve(skippedCheck(!!env.ANTHROPIC_API_KEY));
  const gatewayPromise = shouldCheck("gateway")
    ? checkGateway(env)
    : Promise.resolve(skippedCheck(!!env.MANAGED_GATEWAY_URL));
  const ollamaHost = (env.OLLAMA_HOST || "http://localhost:11434").replace(/\/$/, "");
  const ollamaPromise = shouldCheck("ollama")
    ? checkJsonEndpoint({ name: "Ollama", url: `${ollamaHost}/api/tags` }).then((result) => ({
        ...result,
        host: ollamaHost,
      }))
    : Promise.resolve(skippedCheck(true));

  const [claude, google, openai, anthropic, gateway, ollama] = await Promise.all([
    claudePromise,
    googlePromise,
    openaiPromise,
    anthropicCheckPromise,
    gatewayPromise,
    ollamaPromise,
  ]);
  const checks = {
    claude: claude.checked === false ? claude : completedCheck(claude),
    google: google.checked === false ? google : completedCheck(google),
    openai: openai.checked === false ? openai : completedCheck(openai),
    anthropic: anthropic.checked === false ? anthropic : completedCheck(anthropic),
    gateway: gateway.checked === false ? gateway : completedCheck(gateway),
    ollama: ollama.checked === false ? ollama : completedCheck(ollama),
  };

  return {
    sidecar: {
      ok: true,
      node: process.version,
      platform: process.platform,
      arch: process.arch,
    },
    providers: providerManifest(env, model),
    checks,
  };
}

async function handle(msg) {
  if (!msg || typeof msg !== "object") {
    return { id: msg?.id ?? null, type: "error", error: "invalid message" };
  }
  const id = msg.id;
  try {
    switch (msg.type) {
      case "ping":
        return { id, type: "pong", result: { now: Date.now() } };
      case "diagnostics": {
        const settings = msg.settings ?? {};
        const env = envWithSettings(settings);
        const result = await runDiagnostics({
          settings,
          model: msg.model ?? "sonnet",
          scope: msg.scope ?? "all",
        });
        return { id, type: "diagnostics_result", result: redactSecrets(result, env) };
      }
      case "explain": {
        return {
          id,
          type: "explain_result",
          result: explainPassage({ passage: msg.passage ?? [] }),
        };
      }
      case "council_scope": {
        // Stage 2b leg 1: enumerate candidate positions so the host can retrieve
        // targeted evidence per position before the full council request.
        const result = await scopeCouncil({
          question: msg.question,
          model: msg.model ?? "sonnet",
          settings: msg.settings ?? {},
        });
        return { id, type: "council_scope_result", result };
      }
      case "council": {
        const result = await runCouncil({
          question: msg.question,
          evidence: msg.evidence ?? [],
          model: msg.model ?? "sonnet",
          settings: msg.settings ?? {},
          // Stage 2b leg 2: host-provided positions + per-position evidence bundles.
          scopedPositions: msg.scoped_positions,
          positionEvidence: msg.position_evidence,
          onEvent: (event) => send(councilProgressLine(id, event)),
        });
        return { id, type: "council_result", result };
      }
      default:
        return { id, type: "error", error: `unknown request type: ${msg.type}` };
    }
  } catch (err) {
    const env = envWithSettings(msg.settings ?? {});
    const error = redactSecrets(err?.message ?? String(err), env);
    log("handler error:", error);
    return { id, type: "error", error };
  }
}

async function main() {
  log("ready");
  const rl = createInterface({ input: process.stdin, crlfDelay: Infinity });
  for await (const line of rl) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    let msg;
    try {
      msg = JSON.parse(trimmed);
    } catch {
      send({ id: null, type: "error", error: "malformed JSON" });
      continue;
    }
    const reply = await handle(msg);
    send(reply);
  }
  log("stdin closed, exiting");
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((err) => {
    log("fatal:", redactSecrets(err?.message ?? String(err)));
    process.exit(1);
  });
}
