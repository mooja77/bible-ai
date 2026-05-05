import type { CouncilResponse, StudyWorkspace } from "../../lib/bible";
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
          stripHtml(String(payload.snippet ?? payload.text ?? "")).trim(),
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
            `- **${result.citation}** (${result.translation_code}) — ${stripHtml(result.snippet ?? result.text ?? "").trim()}`,
          );
        }
        if (searchResultsFromPayload(payload).length > 0) lines.push("");
        break;
      case "note":
      case "freeform":
        lines.push(String(payload.body ?? payload.text ?? "").trim(), "");
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
        lines.push("```json", JSON.stringify(payload, null, 2), "```", "");
        break;
    }
  }

  return lines.join("\n");
}

function stripHtml(value: string): string {
  return value.replace(/<[^>]*>/g, "");
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

  if (response) {
    lines.push(
      formatCouncilTransparencyMarkdown(
        response as unknown as CouncilResponse,
        String(payload.question ?? "Saved Council result"),
      ),
    );
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
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
