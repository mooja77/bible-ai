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

function envWithSettings(settings = {}) {
  const env = { ...process.env };
  if (settings.google_api_key) env.GOOGLE_API_KEY = settings.google_api_key;
  if (settings.openai_api_key) env.OPENAI_API_KEY = settings.openai_api_key;
  if (settings.anthropic_api_key) env.ANTHROPIC_API_KEY = settings.anthropic_api_key;
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

  return {
    synthesis,
    voices,
    manifest,
  };
}
