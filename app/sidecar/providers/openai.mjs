/**
 * OpenAI voice — direct REST call to /v1/chat/completions. No SDK dep.
 * Uses OPENAI_API_KEY from the environment.
 */

import { parseResponse, VOICE_SYSTEM_PROMPT, buildVoicePrompt } from "./_shared.mjs";

const DEFAULT_MODEL = "gpt-5";
const ENDPOINT = "https://api.openai.com/v1/chat/completions";

function resolveModel(env = process.env) {
  return env.OPENAI_MODEL || DEFAULT_MODEL;
}

async function callOpenAI({ apiKey, systemPrompt, userPrompt, model }) {
  const resp = await fetch(ENDPOINT, {
    method: "POST",
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
    throw new Error(`OpenAI ${resp.status} ${resp.statusText}: ${errText.slice(0, 300)}`);
  }

  const data = await resp.json();
  const text = data?.choices?.[0]?.message?.content;
  if (!text) {
    throw new Error(`OpenAI: no message content in response (${JSON.stringify(data).slice(0, 300)})`);
  }
  return text;
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
    });
    return parseResponse(text, "OpenAI");
  },
};
