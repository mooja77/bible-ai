import type { CouncilResponse } from "../../lib/bible";
import { rankedPositions, positionEvidence, verseCitation } from "./explorer/reasoningModel";

/** Build a plain-language "Because … therefore …" rationale for the leading
 *  view (Directive 7: explainable, not numeric). Null-guards mock/sparse data:
 *  no leader → "" ; single-voice or no evidence → graceful fallbacks. */
export function buildRationaleLine(response: CouncilResponse): string {
  const leader = rankedPositions(response)[0];
  if (!leader) return "";

  const summary =
    leader.summary ||
    `${(response.synthesis?.synthesis ?? "").slice(0, 200)}…`;

  const successVoices = (response.voices ?? []).filter((v) => v.status === "ok");
  const singleVoice =
    response.synthesis_mode === "single_voice" || successVoices.length <= 1;

  const support = positionEvidence(response, leader).support.slice(0, 3);
  const citations = support.map(verseCitation).join(", ");

  // Sparse mock with no evidence at all: the plainest possible phrasing.
  if (!citations && singleVoice) {
    return `The Council found: ${summary}`;
  }

  const core = citations
    ? `Because ${citations}, the leading view holds: ${summary}`
    : `The leading view holds: ${summary}`;

  return singleVoice ? `From a single voice — ${core}` : core;
}

/** Renders the rationale sentence; null when there is nothing to say. */
export function RationaleLineView({ response }: { response: CouncilResponse }) {
  const line = buildRationaleLine(response);
  if (!line) return null;
  return (
    <p
      data-testid="council-rationale"
      className="text-[0.95rem] text-neutral-200 leading-relaxed"
    >
      {line}
    </p>
  );
}
