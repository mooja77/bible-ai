import type {
  CouncilResponse,
  CouncilPosition,
  CouncilVoice,
  RetrievedEvidence,
} from "../../../lib/bible";

/** A reference to one explorable entity (the nav-stack element). */
export type ExplorerEntity =
  | { type: "outcome" }
  | { type: "position"; label: string }
  | { type: "verse"; verseId: number }
  | { type: "voice"; provider: string }
  | { type: "argument"; positionLabel: string };

const norm = (s: string | undefined | null) => (s ?? "").trim().toLowerCase();

/** Positions sorted by descending final weight (the ranked outcome). */
export function rankedPositions(response: CouncilResponse): CouncilPosition[] {
  return [...(response.synthesis?.positions ?? [])].sort((a, b) => b.weight - a.weight);
}

export function findPosition(response: CouncilResponse, label: string): CouncilPosition | undefined {
  return (response.synthesis?.positions ?? []).find((p) => norm(p.label) === norm(label));
}

export function findVerse(response: CouncilResponse, verseId: number): RetrievedEvidence | undefined {
  return (response.retrieved_evidence ?? []).find((v) => v.verse_id === verseId);
}

export function findVoice(response: CouncilResponse, provider: string): CouncilVoice | undefined {
  return (response.voices ?? []).find((v) => v.provider === provider);
}

/** Voices that argued a position: a voice whose own result has a position whose
 *  label matches this synthesis position's label or one of its
 *  source_position_labels. */
export function positionVoices(response: CouncilResponse, position: CouncilPosition): CouncilVoice[] {
  const targets = new Set<string>([norm(position.label), ...(position.source_position_labels ?? []).map(norm)]);
  return (response.voices ?? []).filter(
    (voice) =>
      voice.status === "ok" &&
      (voice.result?.positions ?? []).some((p) => targets.has(norm(p.label))),
  );
}

/** Supporting / challenging verses for a position, resolved against retrieved
 *  evidence. Falls back to the position's cited evidence verse_ids when the
 *  explicit support/challenge id lists are absent. */
export function positionEvidence(
  response: CouncilResponse,
  position: CouncilPosition,
): { support: RetrievedEvidence[]; challenge: RetrievedEvidence[] } {
  const resolve = (ids: number[] | undefined) =>
    (ids ?? [])
      .map((id) => findVerse(response, id))
      .filter((v): v is RetrievedEvidence => v != null);
  let support = resolve(position.supporting_evidence_ids);
  const challenge = resolve(position.challenging_evidence_ids);
  if (support.length === 0 && position.evidence.length > 0) {
    support = position.evidence
      .map((e) => findVerse(response, e.verse_id))
      .filter((v): v is RetrievedEvidence => v != null);
  }
  return { support, challenge };
}

/** Every position that uses a given verse, with how it uses it. */
export function versePositions(
  response: CouncilResponse,
  verseId: number,
): { position: CouncilPosition; relation: "support" | "challenge" }[] {
  const out: { position: CouncilPosition; relation: "support" | "challenge" }[] = [];
  for (const position of response.synthesis?.positions ?? []) {
    const { support, challenge } = positionEvidence(response, position);
    if (support.some((v) => v.verse_id === verseId)) out.push({ position, relation: "support" });
    else if (challenge.some((v) => v.verse_id === verseId)) out.push({ position, relation: "challenge" });
  }
  return out;
}

/** Retrieval score components as 0–100 ints (raw scores may be 0–1 or absent). */
export function verseScoreParts(verse: RetrievedEvidence): {
  semantic: number;
  keyword: number;
  xref: number;
  combined: number;
} {
  const pct = (n: number | undefined) => Math.round(Math.max(0, Math.min(1, n ?? 0)) * 100);
  return {
    semantic: pct(verse.semantic_score),
    keyword: pct(verse.keyword_score),
    xref: pct(verse.cross_reference_weight),
    combined: pct(verse.score),
  };
}

export function verseCitation(verse: RetrievedEvidence): string {
  return `${verse.book_name} ${verse.chapter}:${verse.verse}`;
}

/** A short human label for a breadcrumb entry. */
export function entityLabel(response: CouncilResponse, entity: ExplorerEntity): string {
  switch (entity.type) {
    case "outcome":
      return "Outcome";
    case "position":
      return entity.label;
    case "verse": {
      const v = findVerse(response, entity.verseId);
      return v ? verseCitation(v) : `Verse ${entity.verseId}`;
    }
    case "voice": {
      const voice = findVoice(response, entity.provider);
      return voice ? voice.display_name : entity.provider;
    }
    case "argument":
      return `${entity.positionLabel} — argument map`;
  }
}
