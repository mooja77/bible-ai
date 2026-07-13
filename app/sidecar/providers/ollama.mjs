/**
 * Local Ollama voice — a FREE Council voice (and cross-family judge / kill-test
 * skeptic) running entirely on the user's machine via the Ollama HTTP API. No API
 * key, no per-token billing.
 *
 * Off by default: only available when OLLAMA_VOICE_MODEL names a pulled chat model
 * (so nothing changes for users who only use Ollama for retrieval embeddings).
 * Its family is "ollama" — distinct from anthropic/openai/google — so a single
 * local voice is enough to unlock multi-voice synthesis, the independence grapher,
 * the cross-family judge, and the kill-test, all without a paid provider.
 */

import {
  createRequestAbort,
  parseResponse,
  VOICE_SYSTEM_PROMPT,
  buildVoicePrompt,
} from "./_shared.mjs";

const DEFAULT_HOST = "http://localhost:11434";
// Local 27B-class models are slow; be generous so a thorough voice isn't killed.
const DEFAULT_TIMEOUT_MS = 600_000;
// Avoid inheriting a model's enormous maximum context (131K/262K is common),
// which can spill an otherwise-GPU-resident model into system RAM. Council
// prompts fit comfortably inside 8K; operators can raise this when needed.
const DEFAULT_NUM_CTX = 8192;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export function resolveHost(env = process.env) {
  return (env.OLLAMA_HOST?.trim() || DEFAULT_HOST).replace(/\/$/, "");
}

export function resolveModel(env = process.env) {
  return env.OLLAMA_VOICE_MODEL?.trim() || "";
}

export function resolveContextSize(env = process.env) {
  const parsed = Number(env.OLLAMA_NUM_CTX);
  return Number.isInteger(parsed) && parsed >= 2048 ? parsed : DEFAULT_NUM_CTX;
}

function timeoutMs(env = process.env) {
  const parsed = Number(env.OLLAMA_TIMEOUT_MS);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_TIMEOUT_MS;
}

/**
 * One Ollama /api/chat call (non-streaming). `json` asks Ollama to constrain the
 * output to valid JSON (local models need the help); `think:false` suppresses the
 * chain-of-thought some models emit by default (faster, cleaner output).
 */
export async function callOllama({
  host,
  model,
  systemPrompt,
  userPrompt,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  numCtx = DEFAULT_NUM_CTX,
  json = true,
  signal,
}) {
  const url = `${host}/api/chat`;
  let lastError = null;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const request = createRequestAbort(timeoutMs, signal);
    try {
      const resp = await fetch(url, {
        method: "POST",
        signal: request.signal,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          stream: false,
          think: false,
          ...(json ? { format: "json" } : {}),
          options: { temperature: 0.3, num_ctx: numCtx },
        }),
      });
      if (!resp.ok) {
        const errText = await resp.text().catch(() => "");
        throw new Error(`Ollama ${resp.status} ${resp.statusText}: ${errText.slice(0, 300)}`);
      }
      const data = await resp.json();
      const text = data?.message?.content;
      if (!text) {
        throw new Error(`Ollama: no message content (${JSON.stringify(data).slice(0, 200)})`);
      }
      return text;
    } catch (err) {
      lastError = err;
      if (signal?.aborted) throw signal.reason instanceof Error ? signal.reason : err;
      if (attempt < 1) {
        await sleep(1000);
        continue;
      }
    } finally {
      request.cleanup();
    }
  }
  throw lastError ?? new Error("Ollama: request failed");
}

export const ollama = {
  name: "ollama",
  family: "ollama",
  display_name: "Local (Ollama)",
  displayName: ({ env = process.env } = {}) => `Local (${resolveModel(env) || "Ollama"})`,
  // Opt-in: only a configured chat model turns the local voice on.
  isAvailable: (env = process.env) => !!resolveModel(env),
  async analyze({ question, evidence, env = process.env, scopedPositions, signal }) {
    const userPrompt = buildVoicePrompt({ question, evidence, scopedPositions });
    let lastError = null;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const text = await callOllama({
        host: resolveHost(env),
        model: resolveModel(env),
        systemPrompt: VOICE_SYSTEM_PROMPT,
        userPrompt,
        timeoutMs: timeoutMs(env),
        numCtx: resolveContextSize(env),
        signal,
      });
      try {
        return parseResponse(text, "Ollama");
      } catch (error) {
        lastError = error;
      }
    }
    throw lastError ?? new Error("Ollama: response could not be parsed");
  },
  // Raw completion for the cross-family judge + kill-test (returns model text).
  async complete({ systemPrompt, userPrompt, env = process.env }) {
    return callOllama({
      host: resolveHost(env),
      model: resolveModel(env),
      systemPrompt,
      userPrompt,
      timeoutMs: timeoutMs(env),
      numCtx: resolveContextSize(env),
    });
  },
};
