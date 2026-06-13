// Study Packet v1 builder (EP-016): renders a Council session into the
// multi-file packet defined by docs/study-packet-v1-contract.md. Pure and
// typed; the Rust export_study_packet command writes the returned files as a
// folder and refuses any that still contain forbidden data.

import type {
  CouncilResponse,
  CouncilJudgment,
  CouncilPosition,
  PacketFile,
  RetrievedEvidence,
} from "../../lib/bible";

// Matches the app today; the contract notes sourcing this from release metadata
// is a follow-up (app_version is currently hardcoded in SettingsPanel too).
const APP_VERSION = "0.1.0";
const PACKET_SCHEMA = "bible-ai/study-packet";
const PACKET_SCHEMA_VERSION = "1.0";

function fmtPercent(weight: number | undefined): string {
  if (typeof weight !== "number" || !Number.isFinite(weight)) return "n/a";
  return `${Math.round(weight * 100)}%`;
}

function providerSummary(response: CouncilResponse): string {
  const names = response.manifest
    ?.filter((p) => p.available)
    .map((p) => p.display_name);
  return names && names.length ? names.join(", ") : "none recorded";
}

function renderReadme(question: string, response: CouncilResponse, exportedAt: string): string {
  return [
    "# Study Packet",
    "",
    `- **Question:** ${question}`,
    `- **Exported:** ${exportedAt}`,
    `- **App version:** ${APP_VERSION}`,
    `- **Retrieval:** ${response.retrieval_mode ?? "unknown"}`,
    `- **AI providers:** ${providerSummary(response)}`,
    "",
    "This packet separates content by authorship: Scripture, Source, AI, and User.",
    "",
    "## Contents",
    "- `question.md` - the question and scope (User-authored)",
    "- `passage.md` - Scripture in scope",
    "- `evidence.md` - retrieved evidence (Scripture + retrieval metadata)",
    "- `council.md` - the AI Council's reasoning (AI-authored)",
    "- `judgment.md` - your conclusion (User-authored)",
    "- `sources.md` - translations, providers, and rights",
    "- `manifest.json` - machine-readable metadata",
    "",
  ].join("\n");
}

function renderQuestion(question: string, response: CouncilResponse): string {
  const opts = response.retrieval_options;
  const lines = ["# Question", "", "_User-authored._", "", question, ""];
  if (opts) {
    lines.push("## Scope", "");
    if (opts.translation_code) lines.push(`- Translation: ${opts.translation_code}`);
    if (opts.strategy) lines.push(`- Retrieval strategy requested: ${opts.strategy}`);
    lines.push(`- Cross-references: ${opts.include_cross_refs ? "included" : "excluded"}`);
    lines.push("");
  }
  return lines.join("\n");
}

function renderPassage(response: CouncilResponse): string {
  const opts = response.retrieval_options;
  const scope = opts?.translation_code ? `Translation ${opts.translation_code}.` : "";
  return [
    "# Passage",
    "",
    "_Scripture._",
    "",
    scope || "No single passage was pinned for this study; see `evidence.md` for the verses the Council weighed.",
    "",
  ].join("\n");
}

function renderEvidence(response: CouncilResponse): string {
  const lines = [
    "# Evidence",
    "",
    "_Scripture quotes below; retrieval metadata is system-generated._",
    "",
    `Retrieval mode: ${response.retrieval_mode ?? "unknown"}`,
  ];
  if (response.retrieval_fallback_reason) {
    lines.push(`Retrieval note: ${response.retrieval_fallback_reason}`);
  }
  lines.push(`Evidence verses: ${response.evidence_count ?? response.retrieved_evidence?.length ?? 0}`, "");
  const evidence: RetrievedEvidence[] = response.retrieved_evidence ?? [];
  for (const e of evidence) {
    const ref = `${e.book_name} ${e.chapter}:${e.verse} (${e.translation_code})`;
    lines.push(`### ${ref}`, "", `> ${e.text}`, "", `_source: ${e.source}_`, "");
  }
  if (!evidence.length) lines.push("No retrieved evidence was recorded with this session.", "");
  return lines.join("\n");
}

function renderPosition(p: CouncilPosition): string {
  const lines = [`### ${p.label} - ${fmtPercent(p.weight)}`, ""];
  if (p.summary) lines.push(p.summary, "");
  if (p.why_not_higher) lines.push(`_Why not higher:_ ${p.why_not_higher}`, "");
  if (p.confidence_rationale) lines.push(`_Confidence:_ ${p.confidence_rationale}`, "");
  if (p.weakest_link) lines.push(`_Weakest link:_ ${p.weakest_link}`, "");
  if (p.what_would_change_this) lines.push(`_What would change this:_ ${p.what_would_change_this}`, "");
  return lines.join("\n");
}

function renderCouncil(response: CouncilResponse): string {
  const s = response.synthesis;
  const lines = [
    "# Council",
    "",
    "_AI-authored. Quoted Scripture remains Scripture._",
    "",
    `## Synthesis (confidence: ${s.confidence})`,
    "",
    s.synthesis || "(no synthesis text)",
    "",
  ];
  if (s.confidence_rationale) lines.push(`_Confidence rationale:_ ${s.confidence_rationale}`, "");
  lines.push("## Positions", "");
  for (const p of s.positions ?? []) lines.push(renderPosition(p));
  if (s.dissent_notes) lines.push("## Dissent", "", s.dissent_notes, "");
  if (s.unresolved_tensions?.length) {
    lines.push("## Unresolved tensions", "");
    for (const t of s.unresolved_tensions) lines.push(`- ${t}`);
    lines.push("");
  }
  return lines.join("\n");
}

function renderJudgment(judgment: CouncilJudgment | null): string {
  const lines = ["# Judgment", "", "_User-authored._", ""];
  if (!judgment) {
    lines.push("No user judgment was recorded for this session yet.", "");
    return lines.join("\n");
  }
  if (judgment.before_judgment) lines.push("## Before", "", judgment.before_judgment, "");
  if (judgment.personal_conclusion) lines.push("## Conclusion", "", judgment.personal_conclusion, "");
  if (judgment.after_judgment) lines.push("## After", "", judgment.after_judgment, "");
  if (typeof judgment.confidence === "number") lines.push(`- Confidence: ${judgment.confidence}`, "");
  if (judgment.changed_mind_note) lines.push("## Changed view", "", judgment.changed_mind_note, "");
  if (judgment.open_questions) lines.push("## Open questions", "", judgment.open_questions, "");
  return lines.join("\n");
}

function renderSources(response: CouncilResponse): string {
  const lines = ["# Sources", "", "_Source metadata and rights._", ""];
  const translations = new Set<string>();
  for (const e of response.retrieved_evidence ?? []) translations.add(e.translation_code);
  if (response.retrieval_options?.translation_code) {
    translations.add(response.retrieval_options.translation_code);
  }
  lines.push("## Translations", "");
  if (translations.size) for (const t of translations) lines.push(`- ${t}`);
  else lines.push("- none recorded");
  lines.push("", "## AI providers", "");
  for (const p of response.manifest ?? []) {
    lines.push(`- ${p.display_name} (${p.available ? "used" : "unavailable"})`);
  }
  lines.push(
    "",
    "See `docs/content-bom.md` for source rights and decision classes once finalized.",
    "",
  );
  return lines.join("\n");
}

function buildManifest(
  question: string,
  response: CouncilResponse,
  exportedAt: string,
): Record<string, unknown> {
  const translations = Array.from(
    new Set((response.retrieved_evidence ?? []).map((e) => e.translation_code)),
  );
  return {
    schema: PACKET_SCHEMA,
    schema_version: PACKET_SCHEMA_VERSION,
    title: question.slice(0, 120),
    question,
    exported_at: exportedAt,
    app_version: APP_VERSION,
    session_id: response.session_id ?? null,
    ai: {
      providers: (response.manifest ?? []).map((p) => ({
        name: p.name,
        display_name: p.display_name,
        available: p.available,
      })),
      synthesis_mode: response.synthesis_mode ?? null,
      confidence: response.synthesis?.confidence ?? null,
    },
    retrieval: {
      mode: response.retrieval_mode ?? null,
      requested_strategy: response.retrieval_options?.strategy ?? null,
      fallback_reason: response.retrieval_fallback_reason ?? null,
      evidence_count: response.evidence_count ?? response.retrieved_evidence?.length ?? 0,
    },
    translations,
    content_labels: ["scripture", "source", "ai", "user"],
    files: [
      "README.md",
      "question.md",
      "passage.md",
      "evidence.md",
      "council.md",
      "judgment.md",
      "sources.md",
    ],
  };
}

/** Render a Council session into the Study Packet v1 file set. */
export function buildStudyPacketFiles(
  question: string,
  response: CouncilResponse,
  judgment: CouncilJudgment | null,
  exportedAt: string = new Date().toISOString(),
): PacketFile[] {
  return [
    { name: "README.md", content: renderReadme(question, response, exportedAt) },
    { name: "question.md", content: renderQuestion(question, response) },
    { name: "passage.md", content: renderPassage(response) },
    { name: "evidence.md", content: renderEvidence(response) },
    { name: "council.md", content: renderCouncil(response) },
    { name: "judgment.md", content: renderJudgment(judgment) },
    { name: "sources.md", content: renderSources(response) },
    {
      name: "manifest.json",
      content: JSON.stringify(buildManifest(question, response, exportedAt), null, 2),
    },
  ];
}
