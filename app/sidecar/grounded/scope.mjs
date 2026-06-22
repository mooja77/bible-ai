// Grounded Council — Stage 2 lifecycle: the SCOPE pass.
//
// Before any verse is examined, enumerate the candidate positions a fair
// interpreter would take seriously. This gives every voice the SAME position
// frame to address (better coverage + cleaner synthesis clustering) and surfaces
// the interpretive space to the reader up-front (overview-first). Fail-soft: if
// scoping fails, the voices simply proceed without a frame.

import { callClaudeSynthesis } from "../providers/index.mjs";

export const SCOPE_SYSTEM_PROMPT = `You are SCOPING a disputed theological question BEFORE any specific verses are examined. Enumerate the candidate positions a careful, fair interpreter would take seriously — the genuine interpretive options, including minority-but-defensible views. Do NOT decide between them, do not weight them, do not cite verses. Aim for 2-6 distinct positions.

Output ONLY strict JSON, no prose:
{"positions": [{"label": "short name", "description": "one neutral sentence"}]}`;

function parseLooseJsonObject(text) {
  if (typeof text !== "string") return null;
  try {
    return JSON.parse(text);
  } catch {
    /* fall through */
  }
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start >= 0 && end > start) {
    try {
      return JSON.parse(text.slice(start, end + 1));
    } catch {
      /* give up */
    }
  }
  return null;
}

export function normaliseScopePositions(value) {
  const raw = Array.isArray(value?.positions) ? value.positions : [];
  return raw
    .map((p) => ({
      label: typeof p?.label === "string" ? p.label.trim().slice(0, 120) : "",
      description: typeof p?.description === "string" ? p.description.trim().slice(0, 300) : "",
    }))
    .filter((p) => p.label)
    .slice(0, 6);
}

/**
 * Enumerate candidate positions for the question. Always resolves (never throws).
 * @returns {{available: boolean, positions: Array<{label,description}>, parsed?: boolean, reason?: string}}
 */
export async function runScope({ question, model, env }) {
  let raw;
  try {
    raw = await callClaudeSynthesis({
      systemPrompt: SCOPE_SYSTEM_PROMPT,
      userPrompt: `Disputed question: ${question}\n\nList the candidate positions as JSON.`,
      model,
      env,
    });
  } catch {
    return { available: false, positions: [], reason: "scope call failed" };
  }
  const parsed = parseLooseJsonObject(raw);
  const positions = normaliseScopePositions(parsed);
  return { available: positions.length > 0, positions, parsed: !!parsed };
}
