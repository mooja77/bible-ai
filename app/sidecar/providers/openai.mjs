/**
 * OpenAI voice — direct REST call to /v1/chat/completions. No SDK dep.
 * Uses OPENAI_API_KEY from the environment.
 */

import { parseResponse, VOICE_SYSTEM_PROMPT, buildVoicePrompt } from "./_shared.mjs";

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

async function callOpenAI({ apiKey, systemPrompt, userPrompt, model, timeoutMs = DEFAULT_TIMEOUT_MS }) {
  let lastError = null;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const resp = await fetch(ENDPOINT, {
        method: "POST",
        signal: controller.signal,
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
        lastError = new Error(`OpenAI ${resp.status} ${resp.statusText}: ${errText.slice(0, 300)}`);
        if (RETRYABLE_STATUS.has(resp.status) && attempt < 2) {
          await sleep(1500 * (attempt + 1));
          continue;
        }
        throw lastError;
      }

      const data = await resp.json();
      const text = data?.choices?.[0]?.message?.content;
      if (!text) {
        throw new Error(`OpenAI: no message content in response (${JSON.stringify(data).slice(0, 300)})`);
      }
      return text;
    } catch (err) {
      lastError = err;
      if (attempt < 2) {
        await sleep(1500 * (attempt + 1));
        continue;
      }
    } finally {
      clearTimeout(timeout);
    }
  }
  throw lastError ?? new Error("OpenAI: request failed");
}

export const openai = {
  name: "openai",
  display_name: `OpenAI (${resolveModel()})`,
  displayName: ({ env = process.env } = {}) => `OpenAI (${resolveModel(env)})`,
  isAvailable: (env) => !!env.OPENAI_API_KEY,
  async analyze({ question, evidence, env }) {
    const userPrompt = buildVoicePrompt({ question, evidence });
    const text = await callOpenAI({
      apiKey: env.OPENAI_API_KEY,
      systemPrompt: VOICE_SYSTEM_PROMPT,
      userPrompt,
      model: resolveModel(env),
      timeoutMs: timeoutMs(env),
    });
    return parseResponse(text, "OpenAI");
  },
};
