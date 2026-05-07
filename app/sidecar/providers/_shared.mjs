/**
 * Shared prompts and helpers used by all voice providers.
 * Each provider is a thin wrapper that calls its API, gets back a text
 * response, and uses `extractJson` + `normaliseResult` to produce a
 * CouncilResult object with the same shape across providers.
 */

export const VOICE_SYSTEM_PROMPT = `You are a rigorous theological voice on a council. A user asks a disputed question. Your job is to produce a weighted distribution over positions that a thoughtful, well-read person COULD defend from scripture — not to declare the "right" answer.

Rules:
1. Enumerate every position you find seriously defensible from the evidence, including minority positions. Do not average competing views into a mush; keep distinct positions distinct.
2. Assign each position a weight in [0, 1]. Weights must sum to exactly 1.0. Weights reflect how well evidence + traditional interpretive argument supports that position — not popularity.
3. Every position must cite specific verses from the evidence provided, with a short quote and a one-sentence reasoning. Only cite verses whose verse_id appears in the provided evidence.
4. Preserve dissent. A 6% position is first-class — give its strongest evidence, don't strawman it.
5. In synthesis, name the strongest version of each major view and the central interpretive tension between them. Do not conclude with a winner.
6. Classify every candidate evidence verse as "used", "supporting", "conflicting", or "ignored". Use "used" for verses directly cited in positions, "supporting" for relevant uncited verses, "conflicting" for verses that complicate or push against a position, and "ignored" for low-relevance retrieval noise.
7. Be honest about confidence. If the evidence is thin or the question is under-defined, return "low" confidence and say why in dissent_notes and confidence_rationale.
8. For each position, list additional supporting_evidence_ids and challenging_evidence_ids from the candidate evidence when available. These IDs power user-visible evidence tabs.
9. For each position, explain why_not_higher: the strongest reason this position did not receive a larger weight. This is not hidden reasoning; it is a concise user-facing weakness/limitation.
10. Do not use "high" confidence unless the answer has multiple direct cited passages, few unresolved tensions, and no major provider/evidence gaps. Prefer "medium" or "low" when the evidence is indirect, retrieval is sparse, or serious traditions weigh the same texts differently.
11. Make every user-facing explanation inspectable: name the specific interpretive move that made the leading argument stronger than the nearest alternative. Avoid vague phrases like "the evidence is stronger" unless you say which evidence and why.
12. If the retrieved evidence does not support a real position, do not create uncited doctrinal positions. Return one low-confidence "insufficient retrieved evidence" position with citations to the closest retrieved verses, then explain what evidence is missing in dissent_notes and confidence_rationale.
13. Never return an empty evidence array for a position. If a position cannot cite at least one provided verse_id, merge it into dissent_notes or unresolved_tensions instead of listing it as a position.
14. For each position, include weakest_link, what_would_change_this, interpretive_moves, and an argument_map. These are concise visible reasoning summaries, not hidden chain-of-thought.
15. Include research_trail events that show question framing, retrieval, evidence classification, voice analysis, synthesis, and limitations. Keep each event short and user-facing.

# Output format

Respond with a single JSON object (no prose before or after, no markdown fences) matching this TypeScript shape exactly:

{
  "positions": Array<{
    "label": string,
    "weight": number,
    "summary": string,
    "supporting_evidence_ids": number[],
    "challenging_evidence_ids": number[],
    "why_not_higher": string,
    "confidence_rationale": string,
    "weakest_link": string,
    "what_would_change_this": string,
    "interpretive_moves": string[],
    "argument_map": {
      "nodes": Array<{
        "id": string,
        "kind": "claim" | "support" | "challenge" | "assumption" | "weakness" | "question",
        "label": string,
        "detail": string,
        "verse_ids": number[]
      }>,
      "edges": Array<{
        "from": string,
        "to": string,
        "label": string
      }>
    },
    "evidence": Array<{
      "verse_id": number,
      "citation": string,
      "translation_code": string,
      "quote": string,
      "reasoning": string
    }>
  }>,
  "dissent_notes": string,
  "unresolved_tensions": string[],
  "synthesis": string,
  "confidence": "low" | "medium" | "high",
  "confidence_rationale": string,
  "evidence_classification": Array<{
    "verse_id": number,
    "status": "used" | "supporting" | "conflicting" | "ignored",
    "reasoning": string
  }>,
  "research_trail": Array<{
    "id": string,
    "label": string,
    "detail": string,
    "event_type": "question" | "retrieval" | "evidence" | "voice" | "synthesis" | "judgment" | "limitation",
    "status": "complete" | "warning" | "error",
    "related_position": string | null,
    "related_verse_ids": number[]
  }>
}`;

export const SYNTHESIS_SYSTEM_PROMPT = `You are the orchestrator of a theological council. Several independent voices have each produced weighted analyses of the same disputed question. Your job is to synthesise them into a single final distribution that is faithful to all of them.

Rules:
1. CLUSTER aligned positions across voices. If two voices both name something like "Complementarian" and "Traditional view of male eldership," treat them as the same position and merge.
2. AVERAGE the weights within a cluster across the voices that named it. If a voice did not name a position, treat it as assigning weight 0 to that position for averaging purposes — DO NOT invent agreement that wasn't there.
3. PRESERVE DISSENT. A position named by only one voice must survive in the output, at the weight it received divided by the number of voices, unless the other voices explicitly rejected it.
4. FINAL WEIGHTS must sum to exactly 1.0.
5. CITATIONS: carry through the strongest 2–4 citations per final position, drawn from the voices' evidence (you may re-use or pick the clearest one).
6. EVIDENCE CLASSIFICATION: merge voice classifications. Mark verses cited in final positions as "used"; mark uncited but relevant verses as "supporting"; mark verses that materially complicate a final position as "conflicting"; mark retrieval noise as "ignored".
7. In the synthesis paragraph, describe the central interpretive tension — what the voices agreed on, what they diverged on, and why.
8. In dissent_notes, call out any position that emerged from only one voice or where voices materially disagreed. This is the audit trail.
9. Pick confidence as the lowest confidence reported by any voice that contributed a major position.
10. Carry forward each final position's strongest supporting_evidence_ids, challenging_evidence_ids, why_not_higher, and confidence_rationale from the contributing voices. If a field is missing, infer a concise user-facing fallback from the visible voice summaries and evidence only.
11. If only a narrow margin separates the top positions, say so directly in dissent_notes and keep confidence below "high" unless the voices and citations clearly justify otherwise.
12. Do not hide provider failures or sparse evidence behind a smooth synthesis. Mention those limits in confidence_rationale using only visible provider status and evidence data.
13. Never emit a final position with an empty evidence array. If a voice supplied an uncited position, either attach the closest cited evidence from that voice's supporting_evidence_ids or move that claim into dissent_notes/unresolved_tensions.
14. Preserve or infer weakest_link, what_would_change_this, interpretive_moves, argument_map, and research_trail from visible voice outputs only.

# Output format

Same schema as an individual voice: a single JSON object, no prose, no fences, with "positions", "dissent_notes", "unresolved_tensions", "synthesis", "confidence", "confidence_rationale", and "evidence_classification".`;

export function buildVoicePrompt({ question, evidence }) {
  const lines = [
    `Disputed question: ${question}`,
    "",
    "Candidate evidence (verses retrieved by keyword/concept search — you choose which to cite):",
    "",
  ];
  for (const e of evidence) {
    lines.push(
      `  [${e.translation_code}] ${e.book_name} ${e.chapter}:${e.verse} (verse_id ${e.verse_id})  —  ${e.text}`,
    );
  }
  lines.push(
    "",
    "Return structured JSON per the schema. Weights must sum to 1.0. Only cite verse_ids from the evidence above.",
  );
  return lines.join("\n");
}

export function buildSynthesisPrompt({ question, voiceResults }) {
  const lines = [
    `Disputed question: ${question}`,
    "",
    `${voiceResults.length} independent voices produced analyses. Each block below is one voice's full response:`,
    "",
  ];
  for (const v of voiceResults) {
    lines.push(`## Voice: ${v.display_name}`, "```json", JSON.stringify(v.result, null, 2), "```", "");
  }
  lines.push(
    "Synthesise into a single final JSON result per the synthesis rules. Cluster aligned positions, preserve dissent, weights sum to 1.0.",
  );
  return lines.join("\n");
}

/** Pull the first JSON object out of a string, tolerating markdown fences and
 *  surrounding prose. Returns the JSON substring or null. */
export function extractJson(s) {
  if (!s) return null;
  const fenced = s.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) return fenced[1].trim();
  const first = s.indexOf("{");
  const last = s.lastIndexOf("}");
  if (first >= 0 && last > first) return s.slice(first, last + 1);
  return null;
}

/** LLMs (especially Gemini) often emit "JSON" with JS-isms strict JSON.parse
 *  rejects: line/block comments, trailing commas. This is a conservative
 *  pre-processor that strips them WITHOUT touching string contents (so a
 *  comma inside a quoted string is left alone). */
export function sanitiseJsonText(text) {
  let out = "";
  let i = 0;
  let inStr = false;
  let strCh = '"';
  while (i < text.length) {
    const c = text[i];
    if (inStr) {
      out += c;
      if (c === "\\" && i + 1 < text.length) {
        out += text[i + 1];
        i += 2;
        continue;
      }
      if (c === strCh) inStr = false;
      i++;
      continue;
    }
    if (c === '"' || c === "'") {
      inStr = true;
      strCh = c;
      out += c;
      i++;
      continue;
    }
    if (c === "/" && text[i + 1] === "/") {
      // Line comment — skip to newline
      while (i < text.length && text[i] !== "\n") i++;
      continue;
    }
    if (c === "/" && text[i + 1] === "*") {
      // Block comment — skip to */
      i += 2;
      while (i < text.length && !(text[i] === "*" && text[i + 1] === "/")) i++;
      i += 2;
      continue;
    }
    if (c === ",") {
      // Look ahead past whitespace; if next non-ws is } or ], drop comma.
      let j = i + 1;
      while (j < text.length && /\s/.test(text[j])) j++;
      if (j < text.length && (text[j] === "}" || text[j] === "]")) {
        i++;
        continue;
      }
    }
    out += c;
    i++;
  }
  return out;
}

/** Validate and normalise a CouncilResult-ish object. Throws on structural
 *  problems. Renormalises weights to sum to 1. */
export function normaliseResult(obj, sourceLabel = "voice") {
  if (!obj || typeof obj !== "object") {
    throw new Error(`${sourceLabel}: result is not an object`);
  }
  if (!Array.isArray(obj.positions) || obj.positions.length === 0) {
    throw new Error(`${sourceLabel}: positions array missing or empty`);
  }
  const total = obj.positions.reduce((s, p) => s + (Number(p.weight) || 0), 0);
  if (total > 0 && Math.abs(total - 1) > 0.01) {
    for (const p of obj.positions) {
      p.raw_weight = p.weight;
      p.weight = (Number(p.weight) || 0) / total;
    }
  }
  obj.positions = obj.positions.map((position) => ({
    ...position,
    supporting_evidence_ids: normaliseNumberArray(position?.supporting_evidence_ids),
    challenging_evidence_ids: normaliseNumberArray(position?.challenging_evidence_ids),
    why_not_higher:
      typeof position?.why_not_higher === "string" ? position.why_not_higher : "",
    confidence_rationale:
      typeof position?.confidence_rationale === "string" ? position.confidence_rationale : "",
    weakest_link: typeof position?.weakest_link === "string" ? position.weakest_link : "",
    what_would_change_this:
      typeof position?.what_would_change_this === "string"
        ? position.what_would_change_this
        : "",
    interpretive_moves: Array.isArray(position?.interpretive_moves)
      ? position.interpretive_moves.filter((value) => typeof value === "string")
      : [],
    argument_map: normaliseArgumentMap(position?.argument_map, position?.label),
    cluster_id: typeof position?.cluster_id === "string" ? position.cluster_id : undefined,
    source_position_labels: Array.isArray(position?.source_position_labels)
      ? position.source_position_labels.filter((value) => typeof value === "string")
      : [],
  }));
  obj.dissent_notes = obj.dissent_notes ?? "";
  obj.unresolved_tensions = Array.isArray(obj.unresolved_tensions)
    ? obj.unresolved_tensions
    : [];
  obj.synthesis = obj.synthesis ?? "";
  obj.confidence = ["low", "medium", "high"].includes(obj.confidence) ? obj.confidence : "medium";
  obj.confidence_rationale =
    typeof obj.confidence_rationale === "string" ? obj.confidence_rationale : "";
  const allowedEvidenceStatuses = new Set(["used", "supporting", "conflicting", "ignored"]);
  obj.evidence_classification = Array.isArray(obj.evidence_classification)
    ? obj.evidence_classification
        .map((entry) => ({
          verse_id: Number(entry?.verse_id) || 0,
          status: allowedEvidenceStatuses.has(entry?.status) ? entry.status : "ignored",
          reasoning: typeof entry?.reasoning === "string" ? entry.reasoning : "",
        }))
        .filter((entry) => entry.verse_id > 0)
    : [];
  obj.research_trail = Array.isArray(obj.research_trail)
    ? obj.research_trail
        .map((entry, index) => ({
          id: typeof entry?.id === "string" ? entry.id : `event-${index + 1}`,
          label: typeof entry?.label === "string" ? entry.label : "Council event",
          detail: typeof entry?.detail === "string" ? entry.detail : "",
          event_type: normaliseTrailType(entry?.event_type),
          status: ["complete", "warning", "error"].includes(entry?.status)
            ? entry.status
            : "complete",
          related_position:
            typeof entry?.related_position === "string" ? entry.related_position : null,
          related_verse_ids: normaliseNumberArray(entry?.related_verse_ids),
        }))
        .filter((entry) => entry.detail)
    : [];
  return obj;
}

function normaliseArgumentMap(value, positionLabel = "Position") {
  if (!value || typeof value !== "object") return undefined;
  const nodes = Array.isArray(value.nodes)
    ? value.nodes
        .map((node, index) => ({
          id: typeof node?.id === "string" ? node.id : `node-${index + 1}`,
          kind: normaliseNodeKind(node?.kind),
          label: typeof node?.label === "string" ? node.label : `${positionLabel} node`,
          detail: typeof node?.detail === "string" ? node.detail : "",
          verse_ids: normaliseNumberArray(node?.verse_ids),
        }))
        .filter((node) => node.detail || node.label)
    : [];
  const nodeIds = new Set(nodes.map((node) => node.id));
  const edges = Array.isArray(value.edges)
    ? value.edges
        .map((edge) => ({
          from: typeof edge?.from === "string" ? edge.from : "",
          to: typeof edge?.to === "string" ? edge.to : "",
          label: typeof edge?.label === "string" ? edge.label : "",
        }))
        .filter((edge) => nodeIds.has(edge.from) && nodeIds.has(edge.to))
    : [];
  return nodes.length ? { nodes, edges } : undefined;
}

function normaliseNodeKind(value) {
  return ["claim", "support", "challenge", "assumption", "weakness", "question"].includes(value)
    ? value
    : "claim";
}

function normaliseTrailType(value) {
  return ["question", "retrieval", "evidence", "voice", "synthesis", "judgment", "limitation"].includes(
    value,
  )
    ? value
    : "synthesis";
}

function normaliseNumberArray(value) {
  if (!Array.isArray(value)) return [];
  return Array.from(
    new Set(
      value
        .map((item) => Number(item))
        .filter((item) => Number.isSafeInteger(item) && item > 0),
    ),
  );
}

export function parseResponse(text, sourceLabel) {
  const jsonText = extractJson(text);
  if (!jsonText) {
    throw new Error(`${sourceLabel}: no JSON found in response. Raw: ${text.slice(0, 300)}`);
  }
  let parsed;
  try {
    parsed = JSON.parse(jsonText);
  } catch (firstErr) {
    // LLM output frequently has trailing commas or comments; strict JSON.parse
    // rejects them. Try sanitising before giving up.
    try {
      parsed = JSON.parse(sanitiseJsonText(jsonText));
    } catch {
      throw new Error(
        `${sourceLabel}: invalid JSON (${firstErr.message}). Raw: ${jsonText.slice(0, 300)}`,
      );
    }
  }
  return normaliseResult(parsed, sourceLabel);
}
