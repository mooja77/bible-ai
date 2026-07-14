/**
 * OpenAI voice — direct REST call to /v1/chat/completions. No SDK dep.
 * Uses OPENAI_API_KEY from the environment.
 */

import {
  createRequestAbort,
  parseResponse,
  VOICE_SYSTEM_PROMPT,
  buildVoicePrompt,
} from "./_shared.mjs";

const DEFAULT_MODEL = "gpt-5";
const ENDPOINT = "https://api.openai.com/v1/chat/completions";
const RETRYABLE_STATUS = new Set([408, 409, 425, 429, 500, 502, 503, 504]);
const DEFAULT_TIMEOUT_MS = 600_000;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function resolveModel(env = process.env) {
  return env.OPENAI_MODEL || DEFAULT_MODEL;
}

function timeoutMs(env = process.env) {
  const parsed = Number(env.OPENAI_TIMEOUT_MS);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_TIMEOUT_MS;
}

async function callOpenAI({
  apiKey,
  systemPrompt,
  userPrompt,
  model,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  signal,
}) {
  let lastError = null;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const request = createRequestAbort(timeoutMs, signal);
    try {
      const resp = await fetch(ENDPOINT, {
        method: "POST",
        signal: request.signal,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
        }),
      });

      if (!resp.ok) {
        const errText = await resp.text().catch(() => "");
        const httpError = new Error(
          `OpenAI ${resp.status} ${resp.statusText}: ${errText.slice(0, 300)}`,
        );
        // Tag so the catch below does not blindly retry a non-retryable
        // status (e.g. 401 invalid key burning three attempts).
        httpError.retryable = RETRYABLE_STATUS.has(resp.status);
        lastError = httpError;
        if (httpError.retryable && attempt < 2) {
          await sleep(1500 * (attempt + 1));
          continue;
        }
        throw httpError;
      }

      const data = await resp.json();
      const text = data?.choices?.[0]?.message?.content;
      if (!text) {
        throw new Error(`OpenAI: no message content in response (${JSON.stringify(data).slice(0, 300)})`);
      }
      return text;
    } catch (err) {
      lastError = err;
      if (signal?.aborted) throw signal.reason instanceof Error ? signal.reason : err;
      // A classified non-retryable HTTP error: fail fast, don't retry.
      // Network/abort errors carry no `retryable` flag and stay retryable.
      if (err?.retryable === false) {
        throw err;
      }
      if (attempt < 2) {
        await sleep(1500 * (attempt + 1));
        continue;
      }
    } finally {
      request.cleanup();
    }
  }
  throw lastError ?? new Error("OpenAI: request failed");
}

export const openai = {
  name: "openai",
  family: "openai",
  display_name: `OpenAI (${resolveModel()})`,
  displayName: ({ env = process.env } = {}) => `OpenAI (${resolveModel(env)})`,
  isAvailable: (env) => !!env.OPENAI_API_KEY,
  async analyze({ question, evidence, env, scopedPositions, signal }) {
    const userPrompt = buildVoicePrompt({ question, evidence, scopedPositions });
    const text = await callOpenAI({
      apiKey: env.OPENAI_API_KEY,
      systemPrompt: VOICE_SYSTEM_PROMPT,
      userPrompt,
      model: resolveModel(env),
      timeoutMs: timeoutMs(env),
      signal,
    });
    return parseResponse(text, "OpenAI");
  },
  // Raw completion for the cross-family judge (returns model text, not a CouncilResult).
  async complete({ systemPrompt, userPrompt, env = process.env }) {
    return callOpenAI({
      apiKey: env.OPENAI_API_KEY,
      systemPrompt,
      userPrompt,
      model: resolveModel(env),
      timeoutMs: timeoutMs(env),
    });
  },
};
