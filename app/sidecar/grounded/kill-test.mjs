// Grounded Council — Channel B: the KILL-TEST skeptic.
//
// TRIANGULON runs an adversarial pass whose ONLY job is to destroy the leading
// claim — if the strongest attack fails, the claim has earned its confidence; if
// it lands, that is flagged before the answer is trusted. The Council's analogue:
// a hostile-but-fair skeptic mounts the STRONGEST scriptural case AGAINST the
// leading position, names its single most vulnerable claim, and rules whether the
// position SURVIVES.
//
// Channel B: advisory only — it can FLAG and feed confidence read-down, never
// hard-fail. Fail-soft everywhere (no provider / failed call / unparseable result
// degrades to "no kill-test available"). The one non-deterministic soft-layer
// member: it needs a provider that can do a raw completion.

import { familyOf, selectCrossFamilyJudge } from "./cross-family-judge.mjs";
import { collectCitedVerseIds } from "./grounding-floor.mjs";

const SEVERITIES = ["none", "minor", "serious", "fatal"];

/**
 * Pick the skeptic. Prefer a DIFFERENT family than the synthesizer (a cleaner
 * adversary), but fall back to any provider that can do a raw completion — the
 * kill-test is an adversarial role, so even a same-family skeptic adds signal.
 */
export function selectSkeptic(synthesizerName, providers) {
  const crossFamily = selectCrossFamilyJudge(synthesizerName, providers);
  if (crossFamily) return crossFamily;
  return (Array.isArray(providers) ? providers : []).find(
    (p) => p && typeof p.complete === "function",
  ) ?? null;
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

function leadingPosition(synthesis) {
  const positions = Array.isArray(synthesis?.positions) ? synthesis.positions : [];
  if (positions.length === 0) return null;
  return positions.reduce((best, p) =>
    (Number(p?.weight) || 0) > (Number(best?.weight) || 0) ? p : best,
  );
}

export const KILL_TEST_SYSTEM_PROMPT = `You are a hostile but FAIR theological skeptic. Your only job is to DESTROY the leading position below — mount the strongest possible case AGAINST it, using ONLY the evidence provided. Do not be agreeable; assume the position is wrong and try to prove it.

Do this:
1. State the STRONGEST counter-argument against the leading position (the best disconfirming reading of the cited verses, or the strongest verse it fails to account for).
2. Name the SINGLE most vulnerable claim the position depends on.
3. Rule whether the position SURVIVES your strongest attack, and how damaging the attack is.

severity = "fatal" (the position cannot stand), "serious" (a major claim is undermined), "minor" (a small qualification), or "none" (the attack fails; the position holds).

Output ONLY strict JSON, no prose, in exactly this shape:
{"strongest_counter": "...", "vulnerable_claim": "...", "survives": true|false, "severity": "none"|"minor"|"serious"|"fatal", "notes": "1-2 sentences"}`;

export function buildKillTestPrompt({ question, evidence, position }) {
  const ev = (Array.isArray(evidence) ? evidence : [])
    .slice(0, 40)
    .map(
      (e) =>
        `(verse_id ${e.verse_id}) ${e.book_name} ${e.chapter}:${e.verse} — ${String(e.text ?? "").slice(0, 200)}`,
    )
    .join("\n");
  const ids = position ? collectCitedVerseIds({ positions: [position] }).map((c) => c.verse_id) : [];
  return `QUESTION:\n${question}\n\nEVIDENCE (the ONLY verses available — you may not invoke anything else):\n${ev}\n\nLEADING POSITION TO DESTROY:\n${position?.label ?? ""} (weight ${position?.weight ?? ""})\n${position?.summary ?? ""}\nIt cites verse_ids: ${ids.join(", ") || "none"}\nIts stated weakest link: ${position?.weakest_link ?? "(none stated)"}\n\nMount your strongest attack per your instructions. Output only the JSON.`;
}

/**
 * Run the kill-test skeptic against the leading position. Always resolves; the
 * result is an advisory block to attach to the response and feed confidence.
 */
export async function runKillTest({ synthesizerName, providers, question, evidence, synthesis, env }) {
  const position = leadingPosition(synthesis);
  if (!position) {
    return { available: false, reason: "no leading position to test" };
  }
  const skeptic = selectSkeptic(synthesizerName, providers);
  if (!skeptic) {
    return { available: false, reason: "no provider available for the kill-test" };
  }
  let raw;
  try {
    raw = await skeptic.complete({
      systemPrompt: KILL_TEST_SYSTEM_PROMPT,
      userPrompt: buildKillTestPrompt({ question, evidence, position }),
      env,
    });
  } catch {
    return { available: true, parsed: false, skeptic_provider: skeptic.name, reason: "kill-test call failed" };
  }
  const v = extractJsonObject(raw);
  if (!v || typeof v !== "object") {
    return { available: true, parsed: false, skeptic_provider: skeptic.name, reason: "unparseable kill-test" };
  }
  const severity = SEVERITIES.includes(v.severity) ? v.severity : "minor";
  return {
    available: true,
    parsed: true,
    skeptic_provider: skeptic.name,
    skeptic_family: familyOf(skeptic.name),
    target_label: position.label,
    survives: v.survives !== false,
    severity,
    strongest_counter: typeof v.strongest_counter === "string" ? v.strongest_counter : "",
    vulnerable_claim: typeof v.vulnerable_claim === "string" ? v.vulnerable_claim : "",
    notes: typeof v.notes === "string" ? v.notes : "",
  };
}

export const __test = { leadingPosition, selectSkeptic, SEVERITIES };
