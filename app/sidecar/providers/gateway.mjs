/**
 * Managed Gateway voice.
 *
 * This is for team/public deployments where the app talks to an app-specific
 * backend instead of asking each user to manage direct provider API keys.
 */

import {
  VOICE_SYSTEM_PROMPT,
  buildVoicePrompt,
  normaliseResult,
  parseResponse,
} from "./_shared.mjs";

const SCHEMA = "bible-ai-council-result-v1";

function configuredUrl(env = process.env) {
  return env.MANAGED_GATEWAY_URL?.trim() || "";
}

export function gatewayEndpoint(baseUrl) {
  const trimmed = String(baseUrl ?? "").trim().replace(/\/+$/, "");
  if (!trimmed) throw new Error("Managed Gateway: URL is not configured");
  const url = new URL(trimmed);
  if (url.pathname.endsWith("/council/voice")) return url.toString();
  url.pathname = `${url.pathname.replace(/\/+$/, "")}/council/voice`;
  return url.toString();
}

export function gatewayHealthEndpoint(baseUrl) {
  const trimmed = String(baseUrl ?? "").trim().replace(/\/+$/, "");
  if (!trimmed) throw new Error("Managed Gateway: URL is not configured");
  const url = new URL(trimmed);
  url.pathname = url.pathname.replace(/\/council\/voice\/?$/, "").replace(/\/+$/, "");
  url.pathname = `${url.pathname}/health`;
  return url.toString();
}

function authHeaders(env = process.env) {
  const token = env.MANAGED_GATEWAY_TOKEN?.trim();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function resultFromPayload(payload) {
  if (payload?.result) return normaliseResult(payload.result, "Managed Gateway");
  if (payload?.positions) return normaliseResult(payload, "Managed Gateway");
  if (typeof payload?.text === "string") return parseResponse(payload.text, "Managed Gateway");
  if (typeof payload?.content === "string") {
    return parseResponse(payload.content, "Managed Gateway");
  }
  throw new Error("Managed Gateway: response did not include result, positions, text, or content");
}

const DEFAULT_TIMEOUT_MS = 600_000;

function gatewayTimeoutMs(env = process.env) {
  const parsed = Number(env.MANAGED_GATEWAY_TIMEOUT_MS);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_TIMEOUT_MS;
}

async function callGateway({ question, evidence, env = process.env, scopedPositions }) {
  // Bound the request: a hung gateway would otherwise never settle and
  // stall the whole council until the sidecar's outer deadline.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), gatewayTimeoutMs(env));
  let resp;
  let text;
  try {
    resp = await fetch(gatewayEndpoint(configuredUrl(env)), {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        ...authHeaders(env),
      },
      body: JSON.stringify({
        schema: SCHEMA,
        question,
        evidence,
        system_prompt: VOICE_SYSTEM_PROMPT,
        user_prompt: buildVoicePrompt({ question, evidence, scopedPositions }),
      }),
    });
    text = await resp.text();
  } finally {
    clearTimeout(timer);
  }

  if (!resp.ok) {
    throw new Error(`Managed Gateway ${resp.status} ${resp.statusText}: ${text.slice(0, 300)}`);
  }

  try {
    return resultFromPayload(JSON.parse(text));
  } catch (err) {
    if (err instanceof SyntaxError) return parseResponse(text, "Managed Gateway");
    throw err;
  }
}

export const gateway = {
  name: "gateway",
  display_name: "Managed Gateway",
  displayName: ({ env = process.env } = {}) => {
    try {
      return `Managed Gateway (${new URL(configuredUrl(env)).host})`;
    } catch {
      return "Managed Gateway";
    }
  },
  isAvailable: (env = process.env) => !!configuredUrl(env),
  async analyze({ question, evidence, env, scopedPositions }) {
    return callGateway({ question, evidence, env, scopedPositions });
  },
};
