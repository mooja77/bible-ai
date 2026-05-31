import type { CouncilResult, RetrievedEvidence } from "../../lib/bible";
import {
  evidenceStatusClass,
  evidenceStatusLabel,
  evidenceStatusTooltip,
  sourceDisplay,
  sourceTooltip,
} from "./councilTransparency";

export function CouncilEvidenceAudit({
  evidence,
  synthesis,
  onJumpToVerse,
}: {
  evidence: RetrievedEvidence[];
  synthesis: CouncilResult;
  onJumpToVerse: (verseId: number, translationCode: string) => void;
}) {
  const used = new Set(
    synthesis.positions.flatMap((p) => p.evidence.map((e) => e.verse_id)),
  );
  const classifications = new Map(
    (synthesis.evidence_classification ?? []).map((entry) => [entry.verse_id, entry]),
  );
  if (evidence.length === 0) return null;
  return (
    <section className="border-t border-neutral-800 pt-5">
      <h2 className="text-sm tracking-wider text-neutral-400 mb-3">
        Retrieved Evidence
      </h2>
      <ul className="space-y-2 max-h-96 overflow-y-auto pr-2">
        {evidence.map((e) => {
          const classified = classifications.get(e.verse_id);
          const status = classified?.status ?? (used.has(e.verse_id) ? "used" : "ignored");
          return (
            <li
              key={`${e.source}-${e.translation_code}-${e.verse_id}`}
              className="border border-neutral-800 rounded px-3 py-2"
            >
              <div className="flex items-center gap-2 mb-1">
                <button
                  type="button"
                  onClick={() => onJumpToVerse(e.verse_id, e.translation_code)}
                  className="font-mono text-xs text-amber-300 hover:text-amber-200"
                >
                  {e.book_name} {e.chapter}:{e.verse} ({e.translation_code})
                </button>
                <span
                  className="text-[0.625rem] tracking-wide text-neutral-500"
                  title={sourceTooltip(e.source)}
                >
                  {sourceDisplay(e.source)}
                </span>
                <span
                  className={
                    "ml-auto text-[0.625rem] px-1.5 py-0.5 rounded " +
                    evidenceStatusClass(status)
                  }
                  title={evidenceStatusTooltip(status)}
                >
                  {evidenceStatusLabel(status)}
                </span>
              </div>
              <p
                className="text-sm text-neutral-300 leading-relaxed"
                style={{ fontFamily: "var(--font-serif)" }}
              >
                {e.text}
              </p>
              {classified?.reasoning && (
                <p className="text-xs text-neutral-500 mt-1">{classified.reasoning}</p>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
