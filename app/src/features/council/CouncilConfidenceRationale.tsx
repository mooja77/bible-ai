import type { CouncilResponse } from "../../lib/bible";
import { buildConfidenceFactors } from "./councilTransparency";
import { ConfidenceBadge } from "./CouncilResultView";

export function CouncilConfidenceRationale({ response }: { response: CouncilResponse }) {
  const factors = buildConfidenceFactors(response);
  return (
    <section
      className="border-t border-neutral-800 pt-5"
      data-testid="council-confidence-rationale"
    >
      <div className="flex items-baseline gap-2 mb-2">
        <h2 className="text-sm tracking-wider text-neutral-400">
          Confidence Rationale
        </h2>
        <ConfidenceBadge confidence={factors.level} />
      </div>
      <p className="text-sm text-neutral-300 leading-relaxed mb-3">
        Confidence is {factors.level} because {factors.rationale}
      </p>
      <ul className="grid md:grid-cols-2 gap-2 text-xs text-neutral-500">
        <li className="border border-neutral-800 rounded px-3 py-2">
          Evidence coverage: {factors.evidence_coverage}
        </li>
        <li className="border border-neutral-800 rounded px-3 py-2">
          Voice agreement: {factors.voice_agreement}
        </li>
        <li className="border border-neutral-800 rounded px-3 py-2">
          Conflicting evidence: {factors.conflicting_count}
        </li>
        <li className="border border-neutral-800 rounded px-3 py-2">
          Provider failures: {factors.provider_failures.length}
        </li>
      </ul>
      {factors.unresolved_tensions.length > 0 && (
        <div className="mt-3">
          <h3 className="text-xs tracking-wide text-neutral-500 mb-1">
            Unresolved tensions
          </h3>
          <ul className="list-disc list-inside text-xs text-neutral-400 space-y-1">
            {factors.unresolved_tensions.map((tension) => (
              <li key={tension}>{tension}</li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
