import type { CouncilResponse } from "../../lib/bible";
import { rankedPositions } from "./explorer/reasoningModel";

/** The calm headline of a Council result: the leading position, its confidence
 *  and weight, and a one-line summary. The dense analysis sits below, collapsed. */
export function CouncilVerdictCard({ response }: { response: CouncilResponse }) {
  const positions = rankedPositions(response);
  const leader = positions[0];
  if (!leader) return null;
  const confidence = response.synthesis?.confidence ?? "unknown";
  const others = positions.length - 1;
  return (
    <section
      data-testid="council-verdict-card"
      className="surface-panel rounded-lg p-5 border-l-4"
      style={{ borderLeftColor: "var(--c-leader)" }}
      aria-label="Council verdict"
    >
      <div className="flex items-baseline justify-between gap-3 flex-wrap">
        <p className="text-[0.7rem] uppercase tracking-wider text-neutral-500">The Council's leading view</p>
        <span data-testid="council-verdict-confidence" className="meta-pill">{confidence} confidence</span>
      </div>
      <h2 data-testid="council-verdict-answer" className="text-xl font-semibold text-neutral-100 mt-1">
        {leader.label}
      </h2>
      <div className="flex items-center gap-2 mt-2">
        <span className="font-mono text-lg text-amber-300">{Math.round(leader.weight * 100)}%</span>
        {others > 0 ? (
          <span className="text-xs text-neutral-500">· {others} other view{others === 1 ? "" : "s"} weighed &amp; kept visible</span>
        ) : null}
      </div>
      {leader.summary ? (
        <p className="text-sm text-neutral-300 leading-relaxed mt-3">{leader.summary}</p>
      ) : null}
    </section>
  );
}
