/**
 * Council orchestrator.
 *
 * Flow:
 *   1. Run every available provider's `analyze` in parallel against the same
 *      question + evidence. Each returns a CouncilResult (or an error).
 *   2. Feed the voices' results to Claude for synthesis — cluster aligned
 *      positions, preserve dissent, produce a single final CouncilResult.
 *   3. Return { synthesis, voices: [...], manifest: [...] }.
 *
 * If only one voice is available, we skip synthesis and return that voice's
 * result as the synthesis. (A council of one isn't really a council.)
 */

import {
  availableProviders,
  callClaudeSynthesis,
  providerManifest,
} from "./providers/index.mjs";
import {
  SYNTHESIS_SYSTEM_PROMPT,
  buildSynthesisPrompt,
  parseResponse,
} from "./providers/_shared.mjs";

const log = (...args) => console.error("[council]", ...args);

async function runOneVoice(provider, { question, evidence, env, model }) {
  const started = Date.now();
  try {
    const result = await provider.analyze({ question, evidence, env, model });
    return {
      provider: provider.name,
      display_name: provider.displayName?.({ env, model }) ?? provider.display_name,
      status: "ok",
      result,
      error: null,
      duration_ms: Date.now() - started,
    };
  } catch (err) {
    log(`voice ${provider.name} failed:`, err?.message ?? err);
    return {
      provider: provider.name,
      display_name: provider.display_name,
      status: "error",
      result: null,
      error: err?.message ?? String(err),
      duration_ms: Date.now() - started,
    };
  }
}

async function synthesise({ question, successfulVoices, model, env }) {
  const userPrompt = buildSynthesisPrompt({
    question,
    voiceResults: successfulVoices,
  });
  const rawText = await callClaudeSynthesis({
    systemPrompt: SYNTHESIS_SYSTEM_PROMPT,
    userPrompt,
    model,
    env,
  });
  return parseResponse(rawText, "Synthesis");
}

function citationFromEvidenceRow(row, reason) {
  return {
    verse_id: row.verse_id,
    citation: `${row.book_name} ${row.chapter}:${row.verse}`,
    translation_code: row.translation_code,
    quote: row.text,
    reasoning: reason,
  };
}

function collectArgumentMapVerseIds(position) {
  const nodes = Array.isArray(position?.argument_map?.nodes)
    ? position.argument_map.nodes
    : [];
  return nodes.flatMap((node) =>
    Array.isArray(node?.verse_ids) ? node.verse_ids : [],
  );
}

function ensurePositionEvidence(synthesis, evidence) {
  if (!synthesis || !Array.isArray(synthesis.positions)) return synthesis;
  const evidenceById = new Map(
    evidence
      .filter((row) => Number.isSafeInteger(Number(row?.verse_id)))
      .map((row) => [Number(row.verse_id), row]),
  );
  for (const position of synthesis.positions) {
    if (Array.isArray(position.evidence) && position.evidence.length > 0) continue;
    const candidateIds = [
      ...(Array.isArray(position.supporting_evidence_ids)
        ? position.supporting_evidence_ids
        : []),
      ...(Array.isArray(position.challenging_evidence_ids)
        ? position.challenging_evidence_ids
        : []),
      ...collectArgumentMapVerseIds(position),
    ];
    const seen = new Set();
    const recovered = [];
    for (const rawId of candidateIds) {
      const id = Number(rawId);
      if (!Number.isSafeInteger(id) || seen.has(id)) continue;
      seen.add(id);
      const row = evidenceById.get(id);
      if (!row) continue;
      recovered.push(
        citationFromEvidenceRow(
          row,
          "Recovered from the synthesis verse-id trail so this position remains visibly auditable.",
        ),
      );
      if (recovered.length >= 3) break;
    }
    if (recovered.length > 0) {
      position.evidence = recovered;
    }
  }
  return synthesis;
}

function envWithSettings(settings = {}) {
  const env = { ...process.env };
  if (settings.google_api_key) env.GOOGLE_API_KEY = settings.google_api_key;
  if (settings.openai_api_key) env.OPENAI_API_KEY = settings.openai_api_key;
  if (settings.anthropic_api_key) env.ANTHROPIC_API_KEY = settings.anthropic_api_key;
  if (settings.managed_gateway_url) env.MANAGED_GATEWAY_URL = settings.managed_gateway_url;
  if (settings.managed_gateway_token) {
    env.MANAGED_GATEWAY_TOKEN = settings.managed_gateway_token;
  }
  if (settings.openai_model) env.OPENAI_MODEL = settings.openai_model;
  if (settings.gemini_model) env.GEMINI_MODEL = settings.gemini_model;
  if (settings.anthropic_model) env.ANTHROPIC_MODEL = settings.anthropic_model;
  if (settings.claude_model) env.CLAUDE_MODEL = settings.claude_model;
  if (settings.ollama_host) env.OLLAMA_HOST = settings.ollama_host;
  return env;
}

function mockCouncilResult({ question, evidence, model }) {
  const first = evidence[0] ?? {};
  const second = evidence[1] ?? first;
  const citation = `${first.book_name ?? "Genesis"} ${first.chapter ?? 1}:${first.verse ?? 1}`;
  const secondCitation = `${second.book_name ?? "Genesis"} ${second.chapter ?? 1}:${second.verse ?? 1}`;
  const evidenceClassification = evidence.map((item, index) => ({
    verse_id: item.verse_id,
    status: index === 0 ? "used" : index === 1 ? "conflicting" : "ignored",
    reasoning:
      index === 0
        ? "Mock mode cites this verse directly in the returned position."
        : index === 1
          ? "Mock mode marks this verse as a visible complicating datum for comparison."
        : "Mock mode keeps additional retrieved verses visible but does not cite them.",
  }));
  const consensusPosition = {
    label: "Mock consensus",
    weight: 0.75,
    summary: `Deterministic test-mode analysis for: ${question}`,
    supporting_evidence_ids: [first.verse_id ?? 1001001],
    challenging_evidence_ids: [second.verse_id ?? first.verse_id ?? 1001001],
    why_not_higher:
      "Mock mode caps this position below total certainty because a visible minority reading is preserved for comparison.",
    confidence_rationale:
      "Mock mode is deterministic and the cited evidence is intentionally simple, so confidence is high for test coverage rather than theological certainty.",
    weakest_link:
      "The mock consensus depends on one leading retrieved verse, so the argument is intentionally narrow.",
    what_would_change_this:
      "A larger set of directly conflicting passages would reduce the consensus weight in the mock result.",
    interpretive_moves: [
      "Treats the first retrieved passage as the clearest direct evidence.",
      "Keeps a minority position visible rather than collapsing the disagreement.",
    ],
    argument_map: {
      nodes: [
        {
          id: "mock-consensus-claim",
          kind: "claim",
          label: "Consensus claim",
          detail: "The leading mock position follows the clearest retrieved citation.",
          verse_ids: [first.verse_id ?? 1001001],
        },
        {
          id: "mock-consensus-support",
          kind: "support",
          label: "Primary support",
          detail: "The first retrieved verse is cited directly and receives the strongest visible support.",
          verse_ids: [first.verse_id ?? 1001001],
        },
        {
          id: "mock-consensus-weakness",
          kind: "weakness",
          label: "Visible weakness",
          detail: "The argument is capped because the mock minority still has inspectable evidence.",
          verse_ids: [second.verse_id ?? first.verse_id ?? 1001001],
        },
      ],
      edges: [
        { from: "mock-consensus-support", to: "mock-consensus-claim", label: "supports" },
        { from: "mock-consensus-weakness", to: "mock-consensus-claim", label: "limits" },
      ],
    },
    cluster_id: "mock-consensus",
    source_position_labels: ["Mock consensus"],
    evidence: [
      {
        verse_id: first.verse_id ?? 1001001,
        citation,
        translation_code: first.translation_code ?? "KJV",
        quote: first.text ?? "In the beginning God created the heaven and the earth.",
        reasoning: "This evidence is supplied by the local corpus and returned by mock mode.",
      },
    ],
  };
  const minorityPosition = {
    label: "Mock minority",
    weight: 0.25,
    summary: "A preserved minority position shows how the Council keeps weaker arguments inspectable.",
    supporting_evidence_ids: [second.verse_id ?? first.verse_id ?? 1001001],
    challenging_evidence_ids: [first.verse_id ?? 1001001],
    why_not_higher:
      "The minority view receives less weight because mock mode gives it fewer direct citations and less voice support.",
    confidence_rationale:
      "The minority view is retained for auditability but has limited support in the deterministic mock response.",
    weakest_link:
      "The minority view has fewer direct citations and receives lower support in the mock voice matrix.",
    what_would_change_this:
      "More direct support from retrieved evidence or another voice would increase the minority weight.",
    interpretive_moves: [
      "Uses a complicating verse to keep disagreement visible.",
      "Treats lower evidence density as a reason for reduced weight.",
    ],
    argument_map: {
      nodes: [
        {
          id: "mock-minority-claim",
          kind: "claim",
          label: "Minority claim",
          detail: "A lower-weighted position remains visible for comparison.",
          verse_ids: [second.verse_id ?? first.verse_id ?? 1001001],
        },
        {
          id: "mock-minority-support",
          kind: "support",
          label: "Minority support",
          detail: "The second retrieved passage is retained as minority support.",
          verse_ids: [second.verse_id ?? first.verse_id ?? 1001001],
        },
        {
          id: "mock-minority-challenge",
          kind: "challenge",
          label: "Challenge",
          detail: "The leading citation is stronger in the deterministic mock result.",
          verse_ids: [first.verse_id ?? 1001001],
        },
      ],
      edges: [
        { from: "mock-minority-support", to: "mock-minority-claim", label: "supports" },
        { from: "mock-minority-challenge", to: "mock-minority-claim", label: "challenges" },
      ],
    },
    cluster_id: "mock-minority",
    source_position_labels: ["Mock minority"],
    evidence: [
      {
        verse_id: second.verse_id ?? first.verse_id ?? 1001001,
        citation: secondCitation,
        translation_code: second.translation_code ?? first.translation_code ?? "KJV",
        quote:
          second.text ??
          first.text ??
          "In the beginning God created the heaven and the earth.",
        reasoning: "This citation is retained so the lower-weighted view can still be inspected.",
      },
    ],
  };
  const result = {
    positions: [consensusPosition, minorityPosition],
    dissent_notes: "Mock mode preserves a lower-weighted position to exercise the audit trail.",
    unresolved_tensions: ["Mock mode exposes why one position was weighted above another."],
    synthesis: "Mock Council response rendered through the normal sidecar, history, and UI path.",
    confidence: "high",
    confidence_rationale:
      "Mock mode has high operational confidence because all values are deterministic and designed to exercise the visible audit workflow.",
    evidence_classification: evidenceClassification,
    research_trail: [
      {
        id: "mock-question",
        label: "Question framed",
        detail: `The Council received the question: ${question}`,
        event_type: "question",
        status: "complete",
        related_position: null,
        related_verse_ids: [],
      },
      {
        id: "mock-retrieval",
        label: "Evidence retrieved",
        detail: `${evidence.length} candidate evidence rows were passed to the mock Council.`,
        event_type: "retrieval",
        status: "complete",
        related_position: null,
        related_verse_ids: evidence.map((item) => item.verse_id).filter(Boolean),
      },
      {
        id: "mock-evidence-classification",
        label: "Evidence classified",
        detail: "Mock mode classified used, conflicting, and ignored evidence so the audit views can be tested.",
        event_type: "evidence",
        status: "complete",
        related_position: null,
        related_verse_ids: evidenceClassification.map((item) => item.verse_id),
      },
      {
        id: "mock-synthesis",
        label: "Positions weighted",
        detail: "The synthesis preserved a 75/25 split and exposed why the leading argument ranked higher.",
        event_type: "synthesis",
        status: "complete",
        related_position: "Mock consensus",
        related_verse_ids: [first.verse_id ?? 1001001],
      },
      {
        id: "mock-limitation",
        label: "Limitation retained",
        detail: "The result is deterministic test output, not a real theological conclusion.",
        event_type: "limitation",
        status: "warning",
        related_position: null,
        related_verse_ids: [],
      },
    ],
  };
  return {
    synthesis: result,
    voices: [
      {
        provider: "mock",
        display_name: `Mock Council (${model ?? "default"})`,
        status: "ok",
        result,
        error: null,
        duration_ms: 1,
      },
    ],
    manifest: [
      {
        name: "mock",
        display_name: "Mock Council",
        available: true,
      },
    ],
  };
}

export async function runCouncil({ question, evidence, model, settings }) {
  if (!question || typeof question !== "string") {
    throw new Error("council: question is required");
  }
  if (!Array.isArray(evidence) || evidence.length === 0) {
    throw new Error("council: evidence array is empty");
  }

  if (process.env.BIBLE_AI_MOCK_COUNCIL === "1") {
    return mockCouncilResult({ question, evidence, model });
  }

  const env = envWithSettings(settings);
  const available = availableProviders(env);
  const manifest = providerManifest(env, model);

  if (available.length === 0) {
    throw new Error(
      "council: no providers available — check that Claude Code is logged in and/or your .env keys are set",
    );
  }

  log(`running ${available.length} voice(s):`, available.map((p) => p.name).join(", "));

  const voices = await Promise.all(
    available.map((p) => runOneVoice(p, { question, evidence, env, model })),
  );

  const ok = voices.filter((v) => v.status === "ok" && v.result);
  if (ok.length === 0) {
    throw new Error(
      "council: all voices failed — first error: " + (voices[0]?.error ?? "unknown"),
    );
  }

  let synthesis;
  if (ok.length === 1) {
    // Only one successful voice — no meaningful synthesis. Pass through.
    synthesis = ok[0].result;
  } else {
    try {
      synthesis = await synthesise({ question, successfulVoices: ok, model, env });
    } catch (err) {
      log("synthesis failed, falling back to first voice:", err?.message ?? err);
      synthesis = ok[0].result;
    }
  }
  synthesis = ensurePositionEvidence(synthesis, evidence);

  return {
    synthesis,
    voices,
    manifest,
  };
}
