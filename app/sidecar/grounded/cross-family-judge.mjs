// Grounded Council — Channel B: the cross-family judge.
//
// The synthesis is written by Claude (anthropic). Self-grading is weak: a model
// family tends to rate its own reasoning favourably. So an INDEPENDENT family
// (OpenAI gpt-5 or Gemini) cross-examines the synthesis for two things only:
//   1. GROUNDING — does every position's claim actually follow from the cited
//      verses, or does it overreach?
//   2. BALANCE — is genuine dissent preserved, or flattened into false consensus?
//
// Channel B: this can only FLAG, never hard-fail. Fail-soft everywhere — a
// missing key, a failed call, or an unparseable verdict degrades to "no
// cross-family check available", it never breaks a run.

import { collectCitedVerseIds } from "./grounding-floor.mjs";

const FAMILY_BY_NAME = { claude: "anthropic", openai: "openai", gemini: "google", gateway: "gateway" };
// Prefer the clearest cross-family judges of Claude; gateway is opaque (no `complete`).
const JUDGE_PREFERENCE = ["openai", "gemini", "gateway"];

export function familyOf(name) {
  return FAMILY_BY_NAME[name] ?? name;
}

/**
 * Pick a provider whose family differs from the synthesizer and that can do a
 * raw completion. Returns the provider object, or null if none qualifies.
 */
export function selectCrossFamilyJudge(synthesizerName, providers) {
  const synthFamily = familyOf(synthesizerName);
  const eligible = (Array.isArray(providers) ? providers : []).filter(
    (p) => p && typeof p.complete === "function" && familyOf(p.name) !== synthFamily,
  );
  for (const name of JUDGE_PREFERENCE) {
    const found = eligible.find((p) => p.name === name);
    if (found) return found;
  }
  return eligible[0] ?? null;
}

function extractJsonObject(text) {
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

export const JUDGE_SYSTEM_PROMPT = `You are an INDEPENDENT cross-examiner from a DIFFERENT AI family than the one that wrote the analysis below. You did not write it and have no stake in it. Be skeptical and specific — do not be agreeable.

Judge ONLY two things, strictly from the evidence provided:
1. GROUNDING — is every position's claim actually supported by the cited verses? Flag any claim that overreaches beyond what the evidence can bear, or that relies on a verse not in the evidence.
2. BALANCE — is genuine disagreement preserved, or has a defensible minority view been flattened into false consensus?

Output ONLY strict JSON, no prose, in exactly this shape:
{"grounding_faithful": true|false, "ungrounded_claims": ["..."], "balance_preserved": true|false, "overreach": ["..."], "verdict": "sound"|"mixed"|"unsound", "notes": "1-3 sentences"}`;

function idsForPosition(p) {
  return collectCitedVerseIds({ positions: [p] }).map((c) => c.verse_id);
}

export function buildJudgeUserPrompt({ question, evidence, synthesis }) {
  const ev = (Array.isArray(evidence) ? evidence : [])
    .slice(0, 40)
    .map(
      (e) =>
        `(verse_id ${e.verse_id}) ${e.book_name} ${e.chapter}:${e.verse} — ${String(e.text ?? "").slice(0, 200)}`,
    )
    .join("\n");
  const positions = (Array.isArray(synthesis?.positions) ? synthesis.positions : [])
    .map((p) => {
      const ids = idsForPosition(p);
      return `- ${p.label} (weight ${p.weight}): ${p.summary ?? ""}\n  cites verse_ids: ${ids.join(", ") || "none"}`;
    })
    .join("\n");
  return `QUESTION:\n${question}\n\nEVIDENCE (the ONLY verses available — anything else is ungrounded):\n${ev}\n\nSYNTHESIS TO JUDGE:\nLeading synthesis: ${synthesis?.synthesis ?? ""}\nStated confidence: ${synthesis?.confidence ?? ""}\nPositions:\n${positions}\n\nCross-examine grounding and balance per your instructions. Output only the JSON verdict.`;
}

/**
 * Run the cross-family judge. Always resolves (never throws); the result is an
 * advisory verdict block to attach to the response.
 */
export async function runCrossFamilyJudge({ synthesizerName, providers, question, evidence, synthesis, env }) {
  const judge = selectCrossFamilyJudge(synthesizerName, providers);
  if (!judge) {
    return { available: false, reason: "no cross-family provider configured" };
  }
  let raw;
  try {
    raw = await judge.complete({
      systemPrompt: JUDGE_SYSTEM_PROMPT,
      userPrompt: buildJudgeUserPrompt({ question, evidence, synthesis }),
      env,
    });
  } catch {
    return { available: true, parsed: false, judge_provider: judge.name, reason: "judge call failed" };
  }
  const v = extractJsonObject(raw);
  if (!v || typeof v !== "object") {
    return { available: true, parsed: false, judge_provider: judge.name, reason: "unparseable verdict" };
  }
  const verdict = ["sound", "mixed", "unsound"].includes(v.verdict) ? v.verdict : "mixed";
  return {
    available: true,
    parsed: true,
    judge_provider: judge.name,
    judge_family: familyOf(judge.name),
    grounding_faithful: !!v.grounding_faithful,
    balance_preserved: !!v.balance_preserved,
    ungrounded_claims: Array.isArray(v.ungrounded_claims) ? v.ungrounded_claims.slice(0, 10) : [],
    overreach: Array.isArray(v.overreach) ? v.overreach.slice(0, 10) : [],
    verdict,
    notes: typeof v.notes === "string" ? v.notes : "",
  };
}
