import { useState } from "react";
import type { CouncilJudgment, CouncilResponse, PositionUserRating } from "../../lib/bible";
import { formatCouncilTransparencyMarkdown } from "./councilTransparency";

export function CopyAsMarkdownButton({
  response,
  question,
  judgment,
}: {
  response: CouncilResponse;
  question: string;
  judgment?: CouncilJudgment | null;
}) {
  const [copied, setCopied] = useState(false);
  const onCopy = async () => {
    const md = renderResponseAsMarkdown(response, question, judgment);
    try {
      await navigator.clipboard.writeText(md);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard API may be unavailable in some webviews */
    }
  };
  return (
    <button
      type="button"
      onClick={onCopy}
      className="btn-secondary px-2 py-0.5 text-xs"
    >
      {copied ? "Copied ✓" : "Copy as markdown"}
    </button>
  );
}

function renderResponseAsMarkdown(
  r: CouncilResponse,
  question: string,
  judgment?: CouncilJudgment | null,
): string {
  const lines: string[] = [];
  lines.push(`# Council: ${question}`, "");
  if (r.retrieval_mode) {
    lines.push(`*Retrieval: ${r.retrieval_mode}, ${r.evidence_count ?? "?"} evidence verses*`, "");
  }
  if (r.retrieval_fallback_reason) {
    lines.push(`> Retrieval note: ${r.retrieval_fallback_reason}`, "");
  }
  const synth = r.synthesis;
  lines.push(`## Synthesis (confidence: ${synth.confidence})`, "");
  const sortedPositions = [...synth.positions].sort((a, b) => b.weight - a.weight);
  for (const p of sortedPositions) {
    const pct = Math.round(p.weight * 100);
    lines.push(`### ${p.label} — ${pct}%`, "", p.summary, "");
    for (const e of p.evidence) {
      lines.push(`- **${e.citation}** (${e.translation_code}) — _"${e.quote}"_  \n  ${e.reasoning}`);
    }
    lines.push("");
  }
  if (synth.synthesis) lines.push("## Narrative synthesis", "", synth.synthesis, "");
  if (synth.unresolved_tensions?.length) {
    lines.push("## Unresolved tensions", "");
    for (const t of synth.unresolved_tensions) lines.push(`- ${t}`);
    lines.push("");
  }
  if (synth.dissent_notes) lines.push("## Dissent notes", "", synth.dissent_notes, "");
  appendJudgmentMarkdown(lines, judgment);
  lines.push(formatCouncilTransparencyMarkdown(r, question));
  lines.push("---", `## Voices`, "");
  for (const v of r.voices) {
    lines.push(
      `- **${v.display_name}** — ${v.status}${v.status === "ok" ? ` (${(v.duration_ms / 1000).toFixed(1)}s)` : ` — ${v.error ?? ""}`}`,
    );
  }
  return lines.join("\n");
}

function appendJudgmentMarkdown(lines: string[], judgment?: CouncilJudgment | null) {
  if (!judgment) return;
  lines.push("## My judgment", "");
  if (judgment.before_judgment) {
    lines.push("### Before reviewing the Council", "", judgment.before_judgment, "");
  }
  if (judgment.after_judgment) {
    lines.push("### After reviewing the Council", "", judgment.after_judgment, "");
  }
  if (judgment.personal_conclusion) {
    lines.push("### Personal conclusion", "", judgment.personal_conclusion, "");
  }
  if (typeof judgment.confidence === "number") {
    lines.push(`**Personal confidence:** ${judgment.confidence}%`, "");
  }
  if (judgment.changed_mind_note) {
    lines.push("### What changed", "", judgment.changed_mind_note, "");
  }
  if (judgment.open_questions) {
    lines.push("### Open questions", "", judgment.open_questions, "");
  }
  const positionJudgments = judgment.position_judgments ?? [];
  if (positionJudgments.length > 0) {
    lines.push("### Position notes", "");
    for (const position of positionJudgments) {
      lines.push(`- **${position.position_label}:** ${formatPositionRating(position.user_rating)}`);
      if (position.persuasive_evidence) {
        lines.push(`  - Persuasive evidence: ${position.persuasive_evidence}`);
      }
      if (position.weak_points) {
        lines.push(`  - Weak points: ${position.weak_points}`);
      }
      if (position.notes) {
        lines.push(`  - Notes: ${position.notes}`);
      }
    }
    lines.push("");
  }
}

function formatPositionRating(value: PositionUserRating) {
  switch (value) {
    case "persuasive":
      return "Persuasive";
    case "weak":
      return "Weak";
    case "needs_study":
      return "Needs more study";
    case "disagree":
      return "I disagree";
    case "unclear":
    default:
      return "Unclear";
  }
}
