/**
 * Gemini voice — direct REST call to generativelanguage.googleapis.com.
 * Uses GOOGLE_API_KEY from the environment.
 * The free tier on Google AI Studio is usually enough for a few calls per
 * minute, which is plenty for a council.
 */

import {
  createRequestAbort,
  parseResponse,
  VOICE_SYSTEM_PROMPT,
  buildVoicePrompt,
} from "./_shared.mjs";

// gemini-2.5-flash is free-tier eligible; gemini-2.5-pro is paid only.
// Override via GEMINI_MODEL if you have billing enabled.
const DEFAULT_MODEL = "gemini-2.5-flash";
const DEFAULT_TIMEOUT_MS = 600_000;

function resolveModel(env = process.env) {
  return env.GEMINI_MODEL || DEFAULT_MODEL;
}

function timeoutMs(env = process.env) {
  const parsed = Number(env.GEMINI_TIMEOUT_MS);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_TIMEOUT_MS;
}

function endpointFor(model) {
  return `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
}

async function callGemini({
  apiKey,
  systemPrompt,
  userPrompt,
  model,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  signal,
}) {
  const maxAttempts = 3;
  let lastError = null;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    // Per-attempt timeout: without it a hung Gemini endpoint never settles,
    // stalling the whole council until the sidecar's outer deadline.
    const request = createRequestAbort(timeoutMs, signal);
    try {
      const resp = await fetch(endpointFor(model), {
        method: "POST",
        signal: request.signal,
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemPrompt }] },
          contents: [{ role: "user", parts: [{ text: userPrompt }] }],
          generationConfig: { responseMimeType: "application/json" },
        }),
      });

      if (!resp.ok) {
        const errText = await resp.text().catch(() => "");
        const httpError = new Error(
          `Gemini ${resp.status} ${resp.statusText}: ${errText.slice(0, 300)}`,
        );
        // Tag so the catch below does not retry a non-retryable status.
        httpError.retryable = resp.status === 429 || resp.status >= 500;
        lastError = httpError;
        if (httpError.retryable && attempt < maxAttempts) {
          await delay(1500 * attempt);
          continue;
        }
        throw httpError;
      }

      const data = await resp.json();
      const parts = data?.candidates?.[0]?.content?.parts;
      const text = Array.isArray(parts)
        ? parts.map((p) => p?.text ?? "").filter(Boolean).join("\n")
        : null;
      if (!text) {
        throw new Error(`Gemini: no text in response (${JSON.stringify(data).slice(0, 300)})`);
      }
      return text;
    } catch (err) {
      lastError = err;
      if (signal?.aborted) throw signal.reason instanceof Error ? signal.reason : err;
      // Classified non-retryable HTTP error: fail fast. Network/abort errors
      // carry no `retryable` flag and stay retryable.
      if (err?.retryable === false) {
        throw err;
      }
      if (attempt < maxAttempts) {
        await delay(1500 * attempt);
        continue;
      }
    } finally {
      request.cleanup();
    }
  }
  throw lastError ?? new Error("Gemini: request failed");
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export const gemini = {
  name: "gemini",
  family: "google",
  display_name: `Gemini (${resolveModel()})`,
  displayName: ({ env = process.env } = {}) => `Gemini (${resolveModel(env)})`,
  isAvailable: (env) => !!env.GOOGLE_API_KEY,
  async analyze({ question, evidence, env, scopedPositions, signal }) {
    const userPrompt = buildVoicePrompt({ question, evidence, scopedPositions });
    const text = await callGemini({
      apiKey: env.GOOGLE_API_KEY,
      systemPrompt: VOICE_SYSTEM_PROMPT,
      userPrompt,
      model: resolveModel(env),
      timeoutMs: timeoutMs(env),
      signal,
    });
    return parseResponse(text, "Gemini");
  },
  // Raw completion for the cross-family judge (returns model text, not a CouncilResult).
  async complete({ systemPrompt, userPrompt, env = process.env }) {
    return callGemini({
      apiKey: env.GOOGLE_API_KEY,
      systemPrompt,
      userPrompt,
      model: resolveModel(env),
      timeoutMs: timeoutMs(env),
    });
  },
};
