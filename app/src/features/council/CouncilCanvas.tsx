import type { CouncilResponse } from "../../lib/bible";
import { rankedPositions } from "./explorer/reasoningModel";
import { CouncilQuestion } from "./CouncilQuestion";
import { AgreementBandView, deriveAgreementBand } from "./AgreementBand";
import { RationaleLineView } from "./RationaleLine";
import { EvidenceChips } from "./EvidenceChips";

/**
 * The editorial Council canvas: the question (serif), a qualitative agreement
 * band with colour-coded voices, a plain-language rationale, colour-coded
 * evidence chips, and one calm entry into the reasoning explorer.
 *
 * Replaces the old numeric verdict card. To keep the verdict e2e spec green
 * with zero edits it still exposes `council-verdict-card / -answer /
 * -confidence` — but, unlike the plan's `display:none` sketch, these sit on
 * GENUINELY VISIBLE canvas content because the spec does `waitForDisplayed()`
 * and `getText().length > 0`, which both fail on a `display:none` node. The
 * leader label and band label are part of the editorial canvas anyway, so the
 * testids land naturally on real, visible text. (See implementation report.)
 */
export function CouncilCanvas({
  response,
  question,
  onOpenExplorer,
}: {
  response: CouncilResponse;
  question: string;
  onOpenExplorer: () => void;
}) {
  const leader = rankedPositions(response)[0];
  const band = deriveAgreementBand(response);
  const leaderLabel = leader?.label ?? "No result";

  return (
    <section
      data-testid="council-canvas"
      aria-live="polite"
      aria-label="Council result"
      className="surface-panel rounded-lg p-6 space-y-5 border-l-4 council-canvas-enter"
      style={{ borderLeftColor: "var(--c-leader)" }}
    >
      <CouncilQuestion question={question} />

      <div data-testid="council-verdict-card" className="space-y-3 text-center">
        <p className="text-[0.7rem] uppercase tracking-wider text-neutral-500">
          The Council's leading view
        </p>
        <h2
          data-testid="council-verdict-answer"
          className="text-xl font-semibold text-neutral-100"
        >
          {leaderLabel}
        </h2>
        {/* The band label doubles as the verdict-confidence testid (qualitative,
            not numeric). Visible so the spec's existence/text checks pass. */}
        <p data-testid="council-verdict-confidence" className="sr-canvas-band-label">
          {band.label}
        </p>
      </div>

      <div className="flex flex-col items-center gap-4">
        <AgreementBandView response={response} />
        <RationaleLineView response={response} />
        <EvidenceChips response={response} onOpenExplorer={onOpenExplorer} />
        <button
          type="button"
          data-testid="council-canvas-explore-cta"
          onClick={onOpenExplorer}
          className="btn-secondary px-3 py-1.5 text-sm"
        >
          Trace each voice &amp; verse →
        </button>
      </div>
    </section>
  );
}
