/**
 * Claude voice — uses @anthropic-ai/claude-agent-sdk, which authenticates via
 * the user's Claude Code subscription (no API key billing). This is also the
 * orchestrator used for synthesis.
 */

import { query } from "@anthropic-ai/claude-agent-sdk";
import { parseResponse, VOICE_SYSTEM_PROMPT, buildVoicePrompt } from "./_shared.mjs";

// Sonnet by default — Opus is excellent but its latency (~5 min on a council
// prompt) makes a multi-voice + synthesis flow feel broken. Sonnet runs in
// ~15–30s, the synthesis step doesn't need Opus-level depth, and the user
// can still pass model:"opus" explicitly when they want it.
const CLAUDE_CODE_MODEL = process.env.CLAUDE_MODEL || "sonnet";
const ANTHROPIC_API_MODEL = "claude-sonnet-4-6";
const ANTHROPIC_API_TIMEOUT_MS = 600_000;
const ANTHROPIC_API_MODEL_ALIASES = {
  sonnet: ANTHROPIC_API_MODEL,
  opus: "claude-opus-4-7",
  haiku: "claude-haiku-4-5-20251001",
};

function resolveModel(model, env = process.env) {
  if (env.ANTHROPIC_API_KEY) {
    const candidate = env.ANTHROPIC_MODEL || model || ANTHROPIC_API_MODEL;
    return ANTHROPIC_API_MODEL_ALIASES[candidate] || candidate;
  }
  return model || env.CLAUDE_MODEL || CLAUDE_CODE_MODEL;
}

function anthropicTimeoutMs(env = process.env) {
  const parsed = Number(env.ANTHROPIC_TIMEOUT_MS);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : ANTHROPIC_API_TIMEOUT_MS;
}

function resultToText(msg) {
  const r = msg?.result;
  if (typeof r === "string") return r;
  if (r?.text) return r.text;
  if (r?.message) return r.message;
  if (msg?.message?.content) {
    const content = msg.message.content;
    if (Array.isArray(content)) {
      return content
        .map((c) => (typeof c === "string" ? c : c?.text ?? ""))
        .filter(Boolean)
        .join("\n");
    }
  }
  try {
    return JSON.stringify(r ?? msg);
  } catch {
    return "";
  }
}

async function callClaude({ systemPrompt, userPrompt, model = CLAUDE_CODE_MODEL }) {
  const iter = query({
    prompt: userPrompt,
    options: {
      model,
      maxTurns: 1,
      allowedTools: [],
      // Disable everything the SDK might otherwise auto-load. With user-level
      // MCP servers configured globally (windows-mcp, playwright, etc.), the
      // default spawn tried to connect to all of them, ballooning latency
      // from ~15s to >5min. Empty objects/arrays here keep the spawn lean.
      settingSources: [],
      mcpServers: {},
      plugins: [],
      hooks: {},
      agents: {},
      systemPrompt,
    },
  });

  let rawText = null;
  let lastMsg = null;
  for await (const msg of iter) {
    lastMsg = msg;
    if (msg.type === "result") {
      rawText = resultToText(msg);
      break;
    }
    if (msg.type === "assistant" && !rawText) {
      rawText = resultToText(msg);
    }
  }

  if (!rawText) {
    throw new Error(`Claude: no text response (last msg type: ${lastMsg?.type ?? "none"})`);
  }
  return rawText;
}

async function callAnthropicApi({
  apiKey,
  systemPrompt,
  userPrompt,
  model,
  timeoutMs = ANTHROPIC_API_TIMEOUT_MS,
}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
  const resp = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    signal: controller.signal,
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: 16000,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    }),
  });
  if (!resp.ok) {
    const errText = await resp.text().catch(() => "");
    throw new Error(`Anthropic ${resp.status} ${resp.statusText}: ${errText.slice(0, 300)}`);
  }
  const data = await resp.json();
  const text = Array.isArray(data?.content)
    ? data.content.map((part) => part?.text ?? "").filter(Boolean).join("\n")
    : "";
  if (!text) {
    throw new Error(`Anthropic: no text content in response (${JSON.stringify(data).slice(0, 300)})`);
  }
  return text;
  } finally {
    clearTimeout(timeout);
  }
}

async function callClaudeVoice({ systemPrompt, userPrompt, env = process.env, model }) {
  if (env.ANTHROPIC_API_KEY) {
    return callAnthropicApi({
      apiKey: env.ANTHROPIC_API_KEY,
      systemPrompt,
      userPrompt,
      model: resolveModel(model, env),
      timeoutMs: anthropicTimeoutMs(env),
    });
  }
  return callClaude({ systemPrompt, userPrompt, model: resolveModel(model, env) });
}

export const claude = {
  name: "claude",
  display_name: `Claude (${CLAUDE_CODE_MODEL})`,
  displayName: ({ env = process.env, model } = {}) =>
    env.ANTHROPIC_API_KEY
      ? `Claude API (${resolveModel(model, env)})`
      : `Claude Code (${resolveModel(model, env)})`,
  // Via Claude Code subscription — no API key check needed. Allow opt-out
  // via DISABLE_CLAUDE_VOICE for testing or when the parent process is
  // already a Claude Code session (subscription contention).
  isAvailable: (env = process.env) =>
    !!env.ANTHROPIC_API_KEY || env.DISABLE_CLAUDE_VOICE !== "1",
  async analyze({ question, evidence, env = process.env, model }) {
    const userPrompt = buildVoicePrompt({ question, evidence });
    const rawText = await callClaudeVoice({
      systemPrompt: VOICE_SYSTEM_PROMPT,
      userPrompt,
      env,
      model,
    });
    return parseResponse(rawText, "Claude");
  },
};

// Exported for the synthesis step in council.mjs.
export async function callClaudeSynthesis({ systemPrompt, userPrompt, model, env = process.env }) {
  return callClaudeVoice({ systemPrompt, userPrompt, model, env });
}
