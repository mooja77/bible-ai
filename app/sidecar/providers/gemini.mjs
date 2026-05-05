/**
 * Gemini voice — direct REST call to generativelanguage.googleapis.com.
 * Uses GOOGLE_API_KEY from the environment.
 * The free tier on Google AI Studio is usually enough for a few calls per
 * minute, which is plenty for a council.
 */

import { parseResponse, VOICE_SYSTEM_PROMPT, buildVoicePrompt } from "./_shared.mjs";

// gemini-2.5-flash is free-tier eligible; gemini-2.5-pro is paid only.
// Override via GEMINI_MODEL if you have billing enabled.
const DEFAULT_MODEL = "gemini-2.5-flash";

function resolveModel(env = process.env) {
  return env.GEMINI_MODEL || DEFAULT_MODEL;
}

function endpointFor(model) {
  return `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
}

async function callGemini({ apiKey, systemPrompt, userPrompt, model }) {
  const maxAttempts = 3;
  let lastError = null;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const resp = await fetch(endpointFor(model), {
      method: "POST",
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
      lastError = new Error(`Gemini ${resp.status} ${resp.statusText}: ${errText.slice(0, 300)}`);
      if (attempt < maxAttempts && (resp.status === 429 || resp.status >= 500)) {
        await delay(1500 * attempt);
        continue;
      }
      throw lastError;
    }

    const data = await resp.json();
    const parts = data?.candidates?.[0]?.content?.parts;
    const text = Array.isArray(parts)
      ? parts.map((p) => p?.text ?? "").filter(Boolean).join("\n")
      : null;
    if (!text) {
      throw new Error(
        `Gemini: no text in response (${JSON.stringify(data).slice(0, 300)})`,
      );
    }
    return text;
  }
  throw lastError ?? new Error("Gemini: request failed");
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export const gemini = {
  name: "gemini",
  display_name: `Gemini (${resolveModel()})`,
  displayName: ({ env = process.env } = {}) => `Gemini (${resolveModel(env)})`,
  isAvailable: (env) => !!env.GOOGLE_API_KEY,
  async analyze({ question, evidence, env }) {
    const userPrompt = buildVoicePrompt({ question, evidence });
    const text = await callGemini({
      apiKey: env.GOOGLE_API_KEY,
      systemPrompt: VOICE_SYSTEM_PROMPT,
      userPrompt,
      model: resolveModel(env),
    });
    return parseResponse(text, "Gemini");
  },
};
