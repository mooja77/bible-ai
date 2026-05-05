import type {
  CouncilEvidence,
  CouncilEvidenceClassification,
  CouncilPosition,
  CouncilResponse,
  CouncilResult,
  CouncilVoice,
  RetrievedEvidence,
} from "../../lib/bible";

export type EvidenceStatus = "used" | "supporting" | "conflicting" | "ignored";

export interface EvidenceDisplayRow {
  verse_id: number;
  citation: string;
  translation_code: string;
  text: string;
  source: string;
  status: EvidenceStatus;
  reasoning: string;
  score: number | null;
  matched_terms: string[];
  semantic_score: number | null;
  keyword_score: number | null;
  cross_reference_weight: number | null;
  from_verse_id: number | null;
}

export interface PositionEvidenceGroups {
  cited: EvidenceDisplayRow[];
  supporting: EvidenceDisplayRow[];
  challenging: EvidenceDisplayRow[];
  ignored: EvidenceDisplayRow[];
}

export interface VoiceMatrixCell {
  voice: CouncilVoice;
  weight: number | null;
  position: CouncilPosition | null;
}

export interface VoiceMatrixRow {
  position: CouncilPosition;
  final_weight: number;
  cells: VoiceMatrixCell[];
  disagreement: number;
}

export interface RetrievalTraceRow extends EvidenceDisplayRow {
  source_label: string;
}

export interface ConfidenceFactors {
  level: CouncilResult["confidence"];
  rationale: string;
  evidence_coverage: string;
  voice_agreement: string;
  unresolved_tensions: string[];
  provider_failures: string[];
  conflicting_count: number;
}

export function buildCouncilEvidenceIndex(response: CouncilResponse) {
  const index = new Map<number, RetrievedEvidence>();
  for (const evidence of response.retrieved_evidence ?? []) {
    index.set(evidence.verse_id, evidence);
  }
  return index;
}

export function buildPositionEvidenceGroups(
  position: CouncilPosition,
  response: CouncilResponse,
): PositionEvidenceGroups {
  const evidenceIndex = buildCouncilEvidenceIndex(response);
  const classificationIndex = buildClassificationIndex(response.synthesis);
  const citedIds = new Set(position.evidence.map((evidence) => evidence.verse_id));
  const supportingIds = new Set(position.supporting_evidence_ids ?? []);
  const challengingIds = new Set(position.challenging_evidence_ids ?? []);

  for (const entry of response.synthesis.evidence_classification ?? []) {
    if (entry.status === "supporting") supportingIds.add(entry.verse_id);
    if (entry.status === "conflicting") challengingIds.add(entry.verse_id);
  }
  for (const id of citedIds) {
    supportingIds.delete(id);
    challengingIds.delete(id);
  }

  const cited = position.evidence.map((evidence) =>
    rowFromCouncilEvidence(evidence, evidenceIndex.get(evidence.verse_id), classificationIndex),
  );
  const supporting = Array.from(supportingIds)
    .map((id) => rowFromRetrievedEvidence(evidenceIndex.get(id), classificationIndex))
    .filter((row): row is EvidenceDisplayRow => !!row);
  const challenging = Array.from(challengingIds)
    .map((id) => rowFromRetrievedEvidence(evidenceIndex.get(id), classificationIndex))
    .filter((row): row is EvidenceDisplayRow => !!row);
  const ignored = (response.retrieved_evidence ?? [])
    .filter((evidence) => {
      const status = classificationIndex.get(evidence.verse_id)?.status ?? "ignored";
      return status === "ignored" && !citedIds.has(evidence.verse_id);
    })
    .slice(0, 8)
    .map((evidence) => rowFromRetrievedEvidence(evidence, classificationIndex))
    .filter((row): row is EvidenceDisplayRow => !!row);

  return { cited, supporting, challenging, ignored };
}

export function buildVoiceAgreementMatrix(response: CouncilResponse): VoiceMatrixRow[] {
  const voices = response.voices.filter((voice) => voice.status === "ok" && voice.result);
  return [...response.synthesis.positions]
    .sort((a, b) => b.weight - a.weight)
    .map((position) => {
      const cells = voices.map((voice) => {
        const matched = voice.result?.positions.find((candidate) =>
          positionsMatch(candidate, position),
        );
        return {
          voice,
          position: matched ?? null,
          weight: matched ? Number(matched.weight) || 0 : null,
        };
      });
      const weights = cells.map((cell) => cell.weight ?? 0);
      const disagreement =
        weights.length > 0 ? Math.max(...weights) - Math.min(...weights) : 0;
      return {
        position,
        final_weight: Number(position.weight) || 0,
        cells,
        disagreement,
      };
    });
}

export function buildRetrievalTraceRows(response: CouncilResponse): RetrievalTraceRow[] {
  const classificationIndex = buildClassificationIndex(response.synthesis);
  return (response.retrieved_evidence ?? [])
    .map((evidence) => {
      const row = rowFromRetrievedEvidence(evidence, classificationIndex);
      if (!row) return null;
      return {
        ...row,
        source_label: sourceLabel(evidence.source),
      };
    })
    .filter((row): row is RetrievalTraceRow => !!row);
}

export function buildConfidenceFactors(response: CouncilResponse): ConfidenceFactors {
  const matrix = buildVoiceAgreementMatrix(response);
  const maxDisagreement = Math.max(0, ...matrix.map((row) => row.disagreement));
  const counts = countEvidenceClassifications(response.synthesis, response.retrieved_evidence ?? []);
  const providerFailures = response.voices
    .filter((voice) => voice.status === "error")
    .map((voice) => `${voice.display_name}: ${voice.error ?? "error"}`);
  const rationale =
    response.synthesis.confidence_rationale?.trim() ||
    fallbackConfidenceRationale(response, maxDisagreement, counts.conflicting);

  return {
    level: response.synthesis.confidence,
    rationale,
    evidence_coverage: `${counts.used} used, ${counts.supporting} supporting, ${counts.conflicting} conflicting, ${counts.ignored} ignored`,
    voice_agreement:
      matrix.length === 0
        ? "No voice matrix data is available."
        : `Largest voice spread is ${formatPercent(maxDisagreement)} across matching positions.`,
    unresolved_tensions: response.synthesis.unresolved_tensions ?? [],
    provider_failures: providerFailures,
    conflicting_count: counts.conflicting,
  };
}

export function formatCouncilTransparencyMarkdown(
  response: CouncilResponse,
  question: string,
): string {
  const lines: string[] = [];
  const matrix = buildVoiceAgreementMatrix(response);
  const trace = buildRetrievalTraceRows(response);
  const factors = buildConfidenceFactors(response);
  const counts = countEvidenceClassifications(response.synthesis, response.retrieved_evidence ?? []);
  const voicesRun = response.voices.filter((voice) => voice.status === "ok").length;

  lines.push("## Council Process", "");
  lines.push(`- Question: ${question}`);
  lines.push(`- Evidence considered: ${response.evidence_count ?? response.retrieved_evidence?.length ?? 0}`);
  lines.push(`- Voices run: ${voicesRun}`);
  lines.push(`- Preserved positions: ${response.synthesis.positions.length}`);
  lines.push(`- Conflicting passages: ${counts.conflicting}`, "");

  const sorted = [...response.synthesis.positions].sort((a, b) => b.weight - a.weight);
  const leader = sorted[0];
  const runnerUp = sorted[1];
  if (leader) {
    lines.push("## Why This Won", "");
    lines.push(`The synthesis assigned **${leader.label}** the largest final weight.`);
    if (runnerUp) {
      lines.push(
        `It leads **${runnerUp.label}** by ${formatPercent(leader.weight - runnerUp.weight)}.`,
      );
    }
    lines.push(`Final weight: ${formatPercent(leader.weight)}.`);
    lines.push(`Cited passages: ${leader.evidence.length}.`);
    if (leader.why_not_higher) {
      lines.push(`Limitation: ${leader.why_not_higher}`);
    }
    lines.push("");
  }

  if (leader && runnerUp) {
    lines.push("## Position Comparison", "");
    lines.push("| Measure | Leading argument | Nearest alternative |");
    lines.push("|---|---|---|");
    lines.push(`| Position | ${escapeCell(leader.label)} | ${escapeCell(runnerUp.label)} |`);
    lines.push(
      `| Weight | ${formatPercent(leader.weight)} | ${formatPercent(runnerUp.weight)} |`,
    );
    lines.push(`| Cited passages | ${leader.evidence.length} | ${runnerUp.evidence.length} |`);
    lines.push(
      `| Why not higher | ${escapeCell(leader.why_not_higher ?? "-")} | ${escapeCell(runnerUp.why_not_higher ?? "-")} |`,
    );
    lines.push("");
  }

  if (matrix.length > 0) {
    const voices = response.voices.filter((voice) => voice.status === "ok" && voice.result);
    lines.push("## Voice Agreement Matrix", "");
    lines.push(
      `| Position | Final | ${voices.map((voice) => escapeCell(voice.display_name)).join(" | ")} | Disagreement |`,
    );
    lines.push(`|---|---:|${voices.map(() => "---:").join("|")}|---:|`);
    for (const row of matrix) {
      lines.push(
        `| ${escapeCell(row.position.label)} | ${formatPercent(row.final_weight)} | ${row.cells
          .map((cell) => (cell.weight === null ? "-" : formatPercent(cell.weight)))
          .join(" | ")} | ${formatPercent(row.disagreement)} |`,
      );
    }
    lines.push("");
  }

  lines.push("## Evidence by Position", "");
  for (const position of sorted) {
    const groups = buildPositionEvidenceGroups(position, response);
    lines.push(`### ${position.label}`, "");
    appendEvidenceGroup(lines, "Cited", groups.cited);
    appendEvidenceGroup(lines, "Supporting", groups.supporting);
    appendEvidenceGroup(lines, "Challenging", groups.challenging);
    if (position.why_not_higher) {
      lines.push(`**Why not higher:** ${position.why_not_higher}`, "");
    }
  }

  if (trace.length > 0) {
    lines.push("## Retrieval Trace", "");
    lines.push("| Citation | Source | Status | Score | Reason |");
    lines.push("|---|---|---|---:|---|");
    for (const row of trace.slice(0, 20)) {
      lines.push(
        `| ${escapeCell(row.citation)} | ${escapeCell(row.source_label)} | ${row.status} | ${
          row.score === null ? "-" : row.score.toFixed(2)
        } | ${escapeCell(row.reasoning)} |`,
      );
    }
    lines.push("");
  }

  lines.push("## Confidence Rationale", "");
  lines.push(`Confidence is **${factors.level}**. ${factors.rationale}`, "");
  lines.push(`- Evidence coverage: ${factors.evidence_coverage}`);
  lines.push(`- Voice agreement: ${factors.voice_agreement}`);
  if (factors.unresolved_tensions.length > 0) {
    lines.push("- Unresolved tensions:");
    for (const tension of factors.unresolved_tensions) lines.push(`  - ${tension}`);
  }
  lines.push("");

  return lines.join("\n");
}

export function countEvidenceClassifications(
  synthesis: CouncilResult,
  evidence: RetrievedEvidence[],
) {
  const usedVerseIds = new Set(
    synthesis.positions.flatMap((position) =>
      position.evidence.map((entry) => entry.verse_id),
    ),
  );
  const counts: Record<EvidenceStatus, number> = {
    used: 0,
    supporting: 0,
    conflicting: 0,
    ignored: 0,
  };
  if ((synthesis.evidence_classification ?? []).length === 0) {
    for (const item of evidence) {
      if (usedVerseIds.has(item.verse_id)) counts.used += 1;
      else counts.ignored += 1;
    }
    return counts;
  }
  for (const item of synthesis.evidence_classification ?? []) {
    counts[item.status] += 1;
  }
  return counts;
}

export function positionsMatch(candidate: CouncilPosition, finalPosition: CouncilPosition) {
  if (candidate.cluster_id && finalPosition.cluster_id) {
    return candidate.cluster_id === finalPosition.cluster_id;
  }
  const labels = [
    finalPosition.label,
    ...(finalPosition.source_position_labels ?? []),
  ].map(normalizeLabel);
  const candidateLabels = [
    candidate.label,
    ...(candidate.source_position_labels ?? []),
  ].map(normalizeLabel);
  return candidateLabels.some((candidateLabel) =>
    labels.some(
      (label) =>
        candidateLabel === label ||
        candidateLabel.includes(label) ||
        label.includes(candidateLabel),
    ),
  );
}

export function formatPercent(value: number) {
  return `${Math.round((Number(value) || 0) * 100)}%`;
}

function appendEvidenceGroup(lines: string[], heading: string, rows: EvidenceDisplayRow[]) {
  lines.push(`#### ${heading}`, "");
  if (rows.length === 0) {
    lines.push(`No ${heading.toLowerCase()} evidence was identified.`, "");
    return;
  }
  for (const row of rows) {
    lines.push(`- **${row.citation}** (${row.translation_code}) [${row.status}] — ${row.text}`);
    if (row.reasoning) lines.push(`  ${row.reasoning}`);
  }
  lines.push("");
}

function buildClassificationIndex(result: CouncilResult) {
  return new Map<number, CouncilEvidenceClassification>(
    (result.evidence_classification ?? []).map((entry) => [entry.verse_id, entry]),
  );
}

function rowFromCouncilEvidence(
  evidence: CouncilEvidence,
  retrieved: RetrievedEvidence | undefined,
  classificationIndex: Map<number, CouncilEvidenceClassification>,
): EvidenceDisplayRow {
  const classified = classificationIndex.get(evidence.verse_id);
  return {
    verse_id: evidence.verse_id,
    citation: evidence.citation,
    translation_code: evidence.translation_code,
    text: retrieved?.text ?? evidence.quote,
    source: retrieved?.source ?? "cited",
    status: classified?.status ?? "used",
    reasoning: evidence.reasoning || classified?.reasoning || "",
    score: numberOrNull(retrieved?.score),
    matched_terms: retrieved?.matched_terms ?? [],
    semantic_score: numberOrNull(retrieved?.semantic_score),
    keyword_score: numberOrNull(retrieved?.keyword_score),
    cross_reference_weight: numberOrNull(retrieved?.cross_reference_weight),
    from_verse_id: retrieved?.from_verse_id ?? null,
  };
}

function rowFromRetrievedEvidence(
  evidence: RetrievedEvidence | undefined,
  classificationIndex: Map<number, CouncilEvidenceClassification>,
): EvidenceDisplayRow | null {
  if (!evidence) return null;
  const classified = classificationIndex.get(evidence.verse_id);
  return {
    verse_id: evidence.verse_id,
    citation: citationFromRetrieved(evidence),
    translation_code: evidence.translation_code,
    text: evidence.text,
    source: evidence.source,
    status: classified?.status ?? "ignored",
    reasoning: classified?.reasoning ?? "",
    score: numberOrNull(evidence.score),
    matched_terms: evidence.matched_terms ?? [],
    semantic_score: numberOrNull(evidence.semantic_score),
    keyword_score: numberOrNull(evidence.keyword_score),
    cross_reference_weight: numberOrNull(evidence.cross_reference_weight),
    from_verse_id: evidence.from_verse_id ?? null,
  };
}

function fallbackConfidenceRationale(
  response: CouncilResponse,
  maxDisagreement: number,
  conflictingCount: number,
) {
  const failures = response.voices.filter((voice) => voice.status === "error").length;
  if (response.synthesis.confidence === "low") {
    return "The answer is marked low confidence because the visible evidence or voice agreement is limited.";
  }
  if (maxDisagreement >= 0.25) {
    return "Confidence is limited by meaningful disagreement between independent voices.";
  }
  if (conflictingCount > 0) {
    return "Confidence accounts for retrieved passages that complicate at least one position.";
  }
  if (failures > 0) {
    return "Confidence accounts for provider failures during the Council run.";
  }
  return "Confidence is based on the available cited evidence and the visible agreement in the Council response.";
}

function citationFromRetrieved(evidence: RetrievedEvidence) {
  return `${evidence.book_name} ${evidence.chapter}:${evidence.verse}`;
}

function sourceLabel(source: string) {
  if (source === "explicit-reference") return "explicit reference";
  if (source === "fts") return "keyword";
  if (source === "cross-ref") return "cross-reference";
  return source || "retrieved";
}

function numberOrNull(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function normalizeLabel(label: string) {
  return label.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function escapeCell(value: unknown) {
  return String(value ?? "").replace(/\|/g, "\\|").replace(/\r?\n/g, " ");
}
