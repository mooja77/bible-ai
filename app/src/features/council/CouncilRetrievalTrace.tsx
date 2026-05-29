import type { CouncilResponse } from "../../lib/bible";
import {
  buildRetrievalTraceRows,
  evidenceStatusClass,
  evidenceStatusTooltip,
  sourceTooltip,
  type EvidenceDisplayRow,
} from "./councilTransparency";
import { HighlightedText, buildRetrievedCitationByVerse } from "./councilHighlight";

export function CouncilRetrievalTrace({
  response,
  onJumpToVerse,
}: {
  response: CouncilResponse;
  onJumpToVerse: (verseId: number, translationCode: string) => void;
}) {
  const rows = buildRetrievalTraceRows(response);
  const citationByVerse = buildRetrievedCitationByVerse(response);
  if (rows.length === 0) return null;
  return (
    <section className="border-t border-neutral-800 pt-5" data-testid="council-retrieval-trace">
      <h2 className="text-sm tracking-wider text-neutral-400 mb-2">
        Retrieval Trace
      </h2>
      <p className="text-xs text-neutral-500 mb-3">
        Retrieval finds candidate passages. The Council still decides whether each passage is
        used, supporting, conflicting, or ignored.
      </p>
      <ul className="space-y-2 max-h-96 overflow-y-auto pr-2">
        {rows.slice(0, 20).map((row) => (
          <li key={`trace-${row.verse_id}-${row.source}`} className="border border-neutral-800 rounded px-3 py-2">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <button
                type="button"
                onClick={() => onJumpToVerse(row.verse_id, row.translation_code)}
                className="font-mono text-xs text-amber-300 hover:text-amber-200"
              >
                {row.citation} ({row.translation_code})
              </button>
              <span
                className="text-[10px] tracking-wide px-1.5 py-0.5 rounded bg-neutral-800 text-neutral-400"
                title={sourceTooltip(row.source)}
              >
                {row.source_label}
              </span>
              <span
                className={"text-[10px] px-1.5 py-0.5 rounded " + evidenceStatusClass(row.status)}
                title={evidenceStatusTooltip(row.status)}
              >
                {row.status}
              </span>
            </div>
            <RetrievalScoreBar row={row} />
            {row.from_verse_id && (
              <p className="text-[11px] text-neutral-600 mt-1">
                Cross-reference from {citationByVerse.get(row.from_verse_id) ?? `verse id ${row.from_verse_id}`}
              </p>
            )}
            <p
              className="text-xs text-neutral-400 mt-1 leading-relaxed"
              style={{ fontFamily: "var(--font-serif)" }}
            >
              <HighlightedText text={row.text} terms={row.matched_terms} />
            </p>
            {row.matched_terms.length > 0 && (
              <p className="text-[11px] text-neutral-600 mt-1">
                Matched terms: {row.matched_terms.join(", ")}
              </p>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

function RetrievalScoreBar({ row }: { row: EvidenceDisplayRow }) {
  const semantic = Math.max(0, Math.min(1, row.semantic_score ?? 0));
  const keyword = Math.max(0, Math.min(1, row.keyword_score ?? 0));
  const crossRef = Math.max(0, Math.min(1, row.cross_reference_weight ?? 0));
  const total = semantic + keyword + crossRef;
  if (total <= 0) return null;
  return (
    <div className="h-1.5 w-full rounded bg-neutral-900 overflow-hidden flex" title="Retrieval contribution">
      {keyword > 0 && <div className="bg-sky-500/70" style={{ width: `${(keyword / total) * 100}%` }} />}
      {semantic > 0 && <div className="bg-emerald-500/70" style={{ width: `${(semantic / total) * 100}%` }} />}
      {crossRef > 0 && <div className="bg-amber-500/70" style={{ width: `${(crossRef / total) * 100}%` }} />}
    </div>
  );
}
