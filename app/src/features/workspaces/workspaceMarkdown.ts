import type { CouncilJudgment, CouncilResponse, StudyWorkspace } from "../../lib/bible";
import { formatCouncilTransparencyMarkdown } from "../council/councilTransparency";

export function renderWorkspaceMarkdown(workspace: StudyWorkspace): string {
  const lines: string[] = [];
  lines.push(`# ${workspace.title}`, "");
  if (workspace.description) lines.push(workspace.description, "");
  lines.push(`_Exported ${new Date().toISOString()}_`, "");

  for (const item of workspace.items) {
    const title = item.title ?? item.kind;
    lines.push(`## ${title}`, "");
    const payload = item.payload;
    switch (item.kind) {
      case "verse":
      case "verse_range":
        lines.push(
          `**${payload.citation ?? title}** (${payload.translation_code ?? ""})`,
          "",
          String(payload.text ?? "").trim(),
          "",
        );
        break;
      case "search_hit":
        if (payload.query) lines.push(`**Search query:** ${payload.query}`, "");
        lines.push(
          `**${payload.citation ?? title}** (${payload.translation_code ?? ""})`,
          "",
          stripSnippetMarkup(String(payload.snippet ?? payload.text ?? "")).trim(),
          "",
        );
        break;
      case "search":
        lines.push(
          `**Search query:** ${payload.query ?? title}`,
          "",
          `Results when saved: ${payload.result_count ?? 0}`,
          "",
        );
        for (const result of searchResultsFromPayload(payload)) {
          lines.push(
            `- **${result.citation}** (${result.translation_code}) — ${stripSnippetMarkup(result.snippet ?? result.text ?? "").trim()}`,
          );
        }
        if (searchResultsFromPayload(payload).length > 0) lines.push("");
        break;
      case "note":
      case "freeform":
        if (payload.type === "resource_entry") {
          lines.push(`**Source:** ${payload.source_title ?? "Resource"}`, "");
          if (payload.collection_title) lines.push(`**Collection:** ${payload.collection_title}`, "");
          if (payload.license) lines.push(`**License:** ${payload.license}`, "");
          lines.push(String(payload.body ?? payload.text ?? "").trim(), "");
          if (payload.attribution) {
            lines.push("**Attribution:**", "", String(payload.attribution), "");
          }
          const shareAlike = resourceShareAlikeRequirements(payload);
          if (shareAlike) {
            lines.push("**Share-alike requirements:**", "", shareAlike, "");
          }
        } else if (payload.type === "guided_study") {
          const focusQuestion = String(payload.focus_question ?? "").trim();
          if (focusQuestion) {
            lines.push("**Guided study question:**", "", focusQuestion, "");
          }
          lines.push(String(payload.body ?? "").trim(), "");
          const cards = Array.isArray(payload.review_cards) ? payload.review_cards : [];
          if (cards.length > 0) {
            lines.push("**Review cards:**", "");
            for (const card of cards) {
              const c = asRecord(card);
              if (!c) continue;
              lines.push(`- **${String(c.prompt ?? "Review")}:** ${String(c.answer ?? "")}`);
            }
            lines.push("");
          }
        } else {
          lines.push(String(payload.body ?? payload.text ?? "").trim(), "");
        }
        break;
      case "council_result":
      case "council_session":
        lines.push(`**Question:** ${payload.question ?? title}`, "");
        lines.push(String(payload.summary ?? payload.synthesis ?? "Council result saved."), "");
        appendCouncilSources(lines, payload);
        break;
      case "explanation":
        lines.push(`**Passage:** ${payload.citation ?? title}`, "");
        lines.push(String(payload.summary ?? "Explanation saved.").trim(), "");
        if (payload.context) lines.push(String(payload.context).trim(), "");
        if (Array.isArray(payload.cautions) && payload.cautions.length > 0) {
          lines.push("**Cautions:**", "");
          for (const caution of payload.cautions) lines.push(`- ${String(caution)}`);
          lines.push("");
        }
        break;
      case "module_entry":
        lines.push(`**Module:** ${payload.module_title ?? "Module"}`, "");
        if (payload.citation) {
          lines.push(`**Source:** ${formatSource(payload)}`, "");
        }
        if (Array.isArray(payload.strongs_codes) && payload.strongs_codes.length > 0) {
          lines.push(`**Strong's:** ${payload.strongs_codes.map(String).join(", ")}`, "");
        }
        if (payload.title) lines.push(`**Entry:** ${payload.title}`, "");
        lines.push(String(payload.body ?? "").trim(), "");
        break;
      default:
        lines.push("```json", JSON.stringify(sanitizeExportValue(payload), null, 2), "```", "");
        break;
    }
  }

  return sanitizeExportText(lines.join("\n"));
}

function stripSnippetMarkup(value: string): string {
  return value.replace(/<\/?mark>/gi, "");
}

function formatSource(payload: Record<string, unknown>): string {
  const citation = String(payload.citation ?? "");
  const translation = String(payload.translation_code ?? "");
  return translation ? `${citation} (${translation})` : citation;
}

function searchResultsFromPayload(payload: Record<string, unknown>) {
  const raw = payload.selected_results ?? payload.top_results;
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((item): item is Record<string, unknown> => !!item && typeof item === "object")
    .slice(0, 10)
    .map((item) => ({
      citation: String(item.citation ?? "Result"),
      translation_code: String(item.translation_code ?? ""),
      snippet: typeof item.snippet === "string" ? item.snippet : undefined,
      text: typeof item.text === "string" ? item.text : undefined,
    }));
}

function resourceShareAlikeRequirements(payload: Record<string, unknown>) {
  const value =
    payload.share_alike_requirements ??
    payload.shareAlikeRequirements ??
    asRecord(payload.metadata)?.share_alike_requirements;
  return typeof value === "string" && value.trim() && value.trim() !== "None."
    ? value.trim()
    : null;
}

function appendCouncilSources(lines: string[], payload: Record<string, unknown>) {
  const response = asRecord(payload.response);
  const synthesis = asRecord(response?.synthesis);
  const confidence = String(payload.confidence ?? synthesis?.confidence ?? "");
  if (confidence) lines.push(`**Confidence:** ${confidence}`, "");

  const positions = Array.isArray(synthesis?.positions) ? synthesis.positions : [];
  if (positions.length > 0) {
    lines.push("**Positions:**", "");
    for (const position of positions) {
      const p = asRecord(position);
      if (!p) continue;
      const label = String(p.label ?? "Position");
      const summary = String(p.summary ?? "").trim();
      lines.push(`- **${label}:** ${summary}`);
    }
    lines.push("");
  }

  const dissentNotes = String(synthesis?.dissent_notes ?? "").trim();
  if (dissentNotes) {
    lines.push("**Dissent notes:**", "", dissentNotes, "");
  }

  const unresolvedTensions = Array.isArray(synthesis?.unresolved_tensions)
    ? synthesis.unresolved_tensions.map(String).filter(Boolean)
    : [];
  if (unresolvedTensions.length > 0) {
    lines.push("**Unresolved tensions:**", "");
    for (const tension of unresolvedTensions) lines.push(`- ${tension}`);
    lines.push("");
  }

  const cited = uniqueCouncilEvidence(
    positions.flatMap((position) => {
      const p = asRecord(position);
      return Array.isArray(p?.evidence) ? p.evidence : [];
    }),
  );
  if (cited.length > 0) {
    lines.push("**Cited evidence:**", "");
    for (const evidence of cited) {
      const quote = evidence.quote ? ` — ${evidence.quote}` : "";
      lines.push(`- **${evidence.citation}** (${evidence.translation_code})${quote}`);
    }
    lines.push("");
  }

  const retrieved = uniqueRetrievedEvidence(response?.retrieved_evidence);
  if (retrieved.length > 0) {
    lines.push("**Retrieved evidence:**", "");
    for (const evidence of retrieved.slice(0, 10)) {
      lines.push(`- **${evidence.citation}** (${evidence.translation_code})`);
    }
    lines.push("");
  }

  appendCouncilJudgment(lines, payload.judgment);
  appendArgumentAnnotations(lines, payload.argument_annotations);
  if (isCouncilResponse(response)) {
    lines.push(
      formatCouncilTransparencyMarkdown(
        response,
        String(payload.question ?? "Saved Council result"),
      ),
    );
  }
}

function appendArgumentAnnotations(lines: string[], value: unknown) {
  if (!Array.isArray(value) || value.length === 0) return;
  lines.push("**Argument annotations:**", "");
  for (const item of value) {
    const annotation = asRecord(item);
    if (!annotation) continue;
    const note = String(annotation.annotation ?? "").trim();
    if (!note) continue;
    lines.push(`- **${String(annotation.node_id ?? "node")}:** ${note}`);
  }
  lines.push("");
}

function appendCouncilJudgment(lines: string[], value: unknown) {
  const judgment = asRecord(value) as (CouncilJudgment & Record<string, unknown>) | null;
  if (!judgment) return;
  lines.push("**My judgment:**", "");
  if (judgment.before_judgment) {
    lines.push(`- Before: ${judgment.before_judgment}`);
  }
  if (judgment.after_judgment) {
    lines.push(`- After: ${judgment.after_judgment}`);
  }
  if (judgment.personal_conclusion) {
    lines.push(`- Conclusion: ${judgment.personal_conclusion}`);
  }
  if (typeof judgment.confidence === "number") {
    lines.push(`- Personal confidence: ${judgment.confidence}%`);
  }
  if (judgment.changed_mind_note) {
    lines.push(`- What changed: ${judgment.changed_mind_note}`);
  }
  if (judgment.open_questions) {
    lines.push(`- Open questions: ${judgment.open_questions}`);
  }
  const positions = Array.isArray(judgment.position_judgments)
    ? judgment.position_judgments
    : [];
  for (const position of positions) {
    const p = asRecord(position);
    if (!p) continue;
    lines.push(`- ${String(p.position_label ?? "Position")}: ${String(p.user_rating ?? "")}`);
    if (p.notes) lines.push(`  - Notes: ${String(p.notes)}`);
  }
  lines.push("");
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function isCouncilResponse(value: unknown): value is CouncilResponse {
  const response = asRecord(value);
  if (!response || !Array.isArray(response.voices) || !Array.isArray(response.manifest)) {
    return false;
  }
  const synthesis = asRecord(response.synthesis);
  if (!synthesis || !Array.isArray(synthesis.positions)) {
    return false;
  }
  return (
    isCouncilConfidence(synthesis.confidence) &&
    synthesis.positions.every(isCouncilPositionLike) &&
    response.voices.every(isCouncilVoiceLike) &&
    response.manifest.every(isCouncilProviderLike)
  );
}

function isCouncilVoiceLike(value: unknown) {
  const voice = asRecord(value);
  if (!voice) return false;
  if (typeof voice.provider !== "string" || typeof voice.display_name !== "string") {
    return false;
  }
  if (voice.status === "error" || voice.status === "skipped") return true;
  if (voice.status !== "ok") return false;
  const result = asRecord(voice.result);
  return (
    !!result &&
    Array.isArray(result.positions) &&
    result.positions.every(isCouncilPositionLike)
  );
}

function isCouncilPositionLike(value: unknown) {
  const position = asRecord(value);
  if (
    !position ||
    typeof position.label !== "string" ||
    typeof position.summary !== "string" ||
    typeof position.weight !== "number" ||
    !Number.isFinite(position.weight) ||
    !Array.isArray(position.evidence)
  ) {
    return false;
  }
  return position.evidence.every((entry) => {
    const evidence = asRecord(entry);
    return (
      !!evidence &&
      typeof evidence.verse_id === "number" &&
      Number.isSafeInteger(evidence.verse_id) &&
      evidence.verse_id > 0 &&
      typeof evidence.citation === "string" &&
      typeof evidence.translation_code === "string" &&
      typeof evidence.quote === "string" &&
      typeof evidence.reasoning === "string"
    );
  });
}

function isCouncilProviderLike(value: unknown) {
  const provider = asRecord(value);
  return (
    !!provider &&
    typeof provider.name === "string" &&
    typeof provider.display_name === "string" &&
    typeof provider.available === "boolean"
  );
}

function isCouncilConfidence(value: unknown) {
  return value === "low" || value === "medium" || value === "high";
}

function uniqueCouncilEvidence(values: unknown[]) {
  const seen = new Set<string>();
  const rows: Array<{ citation: string; translation_code: string; quote: string }> = [];
  for (const value of values) {
    const evidence = asRecord(value);
    if (!evidence) continue;
    const citation = String(evidence.citation ?? "");
    if (!citation) continue;
    const translation_code = String(evidence.translation_code ?? "");
    const key = `${citation}:${translation_code}`;
    if (seen.has(key)) continue;
    seen.add(key);
    rows.push({
      citation,
      translation_code,
      quote: String(evidence.quote ?? "").trim(),
    });
  }
  return rows;
}

function uniqueRetrievedEvidence(value: unknown) {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const rows: Array<{ citation: string; translation_code: string }> = [];
  for (const item of value) {
    const evidence = asRecord(item);
    if (!evidence) continue;
    const citation =
      typeof evidence.citation === "string"
        ? evidence.citation
        : `${String(evidence.book_name ?? "Book")} ${String(evidence.chapter ?? "")}:${String(evidence.verse ?? "")}`.trim();
    if (!citation) continue;
    const translation_code = String(evidence.translation_code ?? "");
    const key = `${citation}:${translation_code}`;
    if (seen.has(key)) continue;
    seen.add(key);
    rows.push({ citation, translation_code });
  }
  return rows;
}

function sanitizeExportValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sanitizeExportValue);
  if (!value || typeof value !== "object") {
    return typeof value === "string" ? sanitizeExportText(value) : value;
  }
  const output: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value)) {
    if (isSecretExportKey(key)) {
      output[key] = "[redacted]";
    } else {
      output[key] = sanitizeExportValue(item);
    }
  }
  return output;
}

function sanitizeExportText(value: string): string {
  return value
    .replace(
      /\b[A-Z0-9_-]*(?:API[-_]?KEY|TOKEN|SECRET|PASSWORD|CREDENTIAL)[A-Z0-9_-]*\s*[:=]\s*(?:"[^"\r\n]*"?|'[^'\r\n]*'?|[^\s`'"]+)/gi,
      "[redacted secret]",
    )
    .replace(
      /\b(?:google_api_key|openai_api_key|anthropic_api_key|managed_gateway_token)\b/gi,
      "[redacted setting]",
    )
    .replace(/\b[A-Za-z]:\\[^\r\n`*?"<>|]+/g, "[redacted local path]")
    .replace(/\b\/(?:Users|home|tmp|var|etc)\/[^\s`]+/g, "[redacted local path]");
}

function isSecretExportKey(key: string) {
  const lower = key.toLowerCase();
  return (
    lower.includes("api_key") ||
    lower.includes("token") ||
    lower.includes("secret") ||
    lower.includes("password") ||
    lower === "env" ||
    lower === "environment"
  );
}
