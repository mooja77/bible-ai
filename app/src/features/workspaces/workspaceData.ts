import type {
  CouncilJudgment,
  CouncilResponse,
  StudyItem,
  StudyWorkspace,
  StudyWorkspaceSummary,
} from "../../lib/bible";

export function workspaceSummaryMatches(workspace: StudyWorkspaceSummary, query: string) {
  return `${workspace.title} ${workspace.item_count}`.toLowerCase().includes(query);
}

export function studyItemMatches(item: StudyItem, query: string) {
  return `${item.kind} ${item.title ?? ""} ${payloadSearchText(item.payload)}`
    .toLowerCase()
    .includes(query);
}

export function payloadSearchText(payload: Record<string, unknown>) {
  const values = [
    payload.title,
    payload.body,
    payload.text,
    payload.snippet,
    payload.citation,
    payload.question,
    payload.summary,
    payload.synthesis,
    payload.query,
    payload.module_title,
  ];
  return values
    .filter((value): value is string => typeof value === "string")
    .join(" ");
}

export function payloadString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

// Only accept a real number or a plain decimal-digit string. Number() coercion
// would otherwise admit hex ("0x10"), booleans, and single-element arrays ([5]).
function readIntegerPayloadValue(value: unknown): number | null {
  if (typeof value === "number") {
    return Number.isSafeInteger(value) ? value : null;
  }
  if (typeof value === "string" && /^-?\d+$/.test(value.trim())) {
    const parsed = Number(value.trim());
    return Number.isSafeInteger(parsed) ? parsed : null;
  }
  return null;
}

export function positiveIntegerPayloadValue(value: unknown) {
  const parsed = readIntegerPayloadValue(value);
  return parsed != null && parsed > 0 ? parsed : null;
}

export function nonNegativeIntegerPayloadValue(value: unknown) {
  const parsed = readIntegerPayloadValue(value);
  return parsed != null && parsed >= 0 ? parsed : null;
}

export function stripSnippetMarkup(value: string) {
  return value.replace(/<\/?mark>/gi, "");
}

export function mergeWorkspaceJudgments(
  workspace: StudyWorkspace | null,
  judgments: CouncilJudgment[],
): StudyWorkspace | null {
  if (!workspace || judgments.length === 0) return workspace;
  const bySessionId = new Map(judgments.map((judgment) => [judgment.council_session_id, judgment]));
  return {
    ...workspace,
    items: workspace.items.map((item) => {
      if (item.kind !== "council_result" && item.kind !== "council_session") return item;
      const sessionId = workspaceCouncilSessionId(item.payload);
      const judgment = sessionId ? bySessionId.get(sessionId) : null;
      if (!judgment) return item;
      return {
        ...item,
        payload: {
          ...item.payload,
          judgment,
        },
      };
    }),
  };
}

export function workspaceCouncilSessionId(payload: Record<string, unknown>) {
  const direct = numericPayloadValue(payload.session_id ?? payload.council_session_id);
  if (direct) return direct;
  const response = payload.response;
  if (!response || typeof response !== "object" || Array.isArray(response)) return null;
  return numericPayloadValue((response as Record<string, unknown>).session_id);
}

export function numericPayloadValue(value: unknown) {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0
    ? value
    : null;
}

export function isCouncilResponse(value: unknown): value is CouncilResponse {
  if (!isObjectRecord(value) || !Array.isArray(value.voices) || !Array.isArray(value.manifest)) {
    return false;
  }
  const synthesis = value.synthesis;
  if (!isObjectRecord(synthesis) || !Array.isArray(synthesis.positions)) {
    return false;
  }
  return (
    isCouncilConfidence(synthesis.confidence) &&
    synthesis.positions.every(isCouncilPositionLike) &&
    value.voices.every(isCouncilVoiceLike) &&
    value.manifest.every(isCouncilProviderLike)
  );
}

function isCouncilVoiceLike(value: unknown) {
  if (!isObjectRecord(value)) return false;
  if (typeof value.provider !== "string" || typeof value.display_name !== "string") {
    return false;
  }
  if (value.status === "error" || value.status === "skipped") return true;
  if (value.status !== "ok") return false;
  const result = value.result;
  return (
    isObjectRecord(result) &&
    Array.isArray(result.positions) &&
    result.positions.every(isCouncilPositionLike)
  );
}

function isCouncilPositionLike(value: unknown) {
  if (!isObjectRecord(value)) return false;
  if (
    typeof value.label !== "string" ||
    typeof value.summary !== "string" ||
    typeof value.weight !== "number" ||
    !Number.isFinite(value.weight) ||
    !Array.isArray(value.evidence)
  ) {
    return false;
  }
  return value.evidence.every(
    (entry) =>
      isObjectRecord(entry) &&
      typeof entry.verse_id === "number" &&
      Number.isSafeInteger(entry.verse_id) &&
      entry.verse_id > 0 &&
      typeof entry.citation === "string" &&
      typeof entry.translation_code === "string" &&
      typeof entry.quote === "string" &&
      typeof entry.reasoning === "string",
  );
}

function isCouncilProviderLike(value: unknown) {
  return (
    isObjectRecord(value) &&
    typeof value.name === "string" &&
    typeof value.display_name === "string" &&
    typeof value.available === "boolean"
  );
}

function isCouncilConfidence(value: unknown) {
  return value === "low" || value === "medium" || value === "high";
}

export function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}
