import type { CouncilResponse } from "../../lib/bible";
import { rankedPositions, positionVoices } from "./explorer/reasoningModel";

/** A qualitative read on how much the voices agreed (Directive 7: bands, not
 *  "75%"). `label` is the headline phrase; `detail` is the supporting count;
 *  `confidence` is the small/muted synthesis confidence word. */
export interface AgreementBand {
  label: string;
  detail: string;
  confidence: string;
  /** number of voices that concurred with the leading view */
  concurring: number;
  /** total successful (status === "ok") voices, floored at 1 for display */
  total: number;
}

/** Translate the raw Council result into a plain-language agreement band.
 *  Null-guards mock/sparse data: single-voice mode and a `positionVoices()`
 *  that returns 0 still produce a sensible band. */
export function deriveAgreementBand(response: CouncilResponse): AgreementBand {
  const leader = rankedPositions(response)[0];
  const confidence = response.synthesis?.confidence ?? "unknown";
  if (!leader) {
    return { label: "No result", detail: "", confidence, concurring: 0, total: 0 };
  }

  const successVoices = (response.voices ?? []).filter((v) => v.status === "ok");
  const total = successVoices.length || 1;
  const concurring = positionVoices(response, leader).length;
  const ratio = concurring / Math.max(total, 1);

  let label: string;
  if (ratio === 1 && total >= 2) label = "Strong agreement";
  else if (ratio === 1 && total === 1) label = "Single voice";
  else if (ratio >= 0.67 && total >= 2) label = "Broad agreement";
  else if (ratio >= 0.5 && total >= 2) label = "Lean";
  else label = "Contested";

  const detail =
    response.synthesis_mode === "single_voice"
      ? "Single voice analysis"
      : `${concurring} of ${total} voices concur`;

  return { label, detail, confidence, concurring, total };
}

/** The visible per-voice grammar: a colour-coded dot + the voice's text label,
 *  so colour is never the sole signal. Cycles through the four AA-safe voice
 *  accent tokens. */
const VOICE_TOKENS = ["var(--c-voice-a)", "var(--c-voice-b)", "var(--c-voice-c)", "var(--c-voice-d)"];

function VoiceDots({ response }: { response: CouncilResponse }) {
  const voices = (response.voices ?? []).filter((v) => v.status === "ok");
  if (voices.length === 0) return null;
  return (
    <ul className="flex flex-wrap items-center gap-x-3 gap-y-1">
      {voices.map((voice, i) => {
        const color = VOICE_TOKENS[i % VOICE_TOKENS.length];
        return (
          <li key={voice.provider} className="flex items-center gap-1.5">
            <span
              className="inline-block w-2.5 h-2.5 rounded-full shrink-0"
              style={{ backgroundColor: color }}
              aria-hidden="true"
            />
            <span
              className="text-xs text-neutral-400"
              aria-label={`Voice: ${voice.display_name}`}
            >
              {voice.display_name}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

/** Renders the agreement band: a bold qualitative headline, a small muted
 *  confidence word, the concurring-count detail, and the colour-coded voices. */
export function AgreementBandView({ response }: { response: CouncilResponse }) {
  const band = deriveAgreementBand(response);
  return (
    <div data-testid="council-agreement-band" role="status" className="space-y-2">
      <div className="flex items-baseline gap-2 flex-wrap">
        <span className="text-base font-semibold text-neutral-100">{band.label}</span>
        {band.confidence ? (
          <span className="text-xs text-neutral-500">{band.confidence} confidence</span>
        ) : null}
        {band.detail ? (
          <span className="text-xs text-neutral-500">· {band.detail}</span>
        ) : null}
      </div>
      <VoiceDots response={response} />
    </div>
  );
}
