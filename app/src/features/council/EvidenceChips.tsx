import type { CouncilResponse } from "../../lib/bible";
import { rankedPositions, positionEvidence, verseCitation } from "./explorer/reasoningModel";

/** Colour-coded evidence chips for the leading view: ▲ supporting verses
 *  (emerald) and ▼ verses in tension (rose). Each chip opens the reasoning
 *  explorer. Returns null when the leader has no resolvable evidence — keeping
 *  the canvas clean for sparse/mock results. */
export function EvidenceChips({
  response,
  onOpenExplorer,
}: {
  response: CouncilResponse;
  onOpenExplorer: () => void;
}) {
  const leader = rankedPositions(response)[0];
  if (!leader) return null;

  const { support, challenge } = positionEvidence(response, leader);
  const supportChips = support.slice(0, 4);
  const challengeChips = challenge.slice(0, 4);
  if (supportChips.length === 0 && challengeChips.length === 0) return null;

  return (
    <div
      data-testid="council-evidence-chips"
      className="flex flex-wrap gap-2"
    >
      {supportChips.map((verse) => (
        <button
          key={`s-${verse.verse_id}`}
          type="button"
          onClick={onOpenExplorer}
          className="meta-pill text-xs hover:bg-[var(--surface-card-hover)] transition-colors"
          style={{ color: "var(--c-support)" }}
          aria-label={`Supporting verse ${verseCitation(verse)} — trace in the reasoning explorer`}
        >
          <span aria-hidden="true">▲</span> {verseCitation(verse)}
        </button>
      ))}
      {challengeChips.map((verse) => (
        <button
          key={`c-${verse.verse_id}`}
          type="button"
          onClick={onOpenExplorer}
          className="meta-pill text-xs hover:bg-[var(--surface-card-hover)] transition-colors"
          style={{ color: "var(--c-challenge)" }}
          aria-label={`Verse in tension ${verseCitation(verse)} — trace in the reasoning explorer`}
        >
          <span aria-hidden="true">▼</span> {verseCitation(verse)}
        </button>
      ))}
    </div>
  );
}
