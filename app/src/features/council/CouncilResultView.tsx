import { useState } from "react";
import type { CouncilPosition, CouncilResponse, CouncilResult } from "../../lib/bible";
import {
  buildPositionEvidenceGroups,
  countVoiceMentions,
  evidenceStatusClass,
  evidenceStatusLabel,
  evidenceStatusTooltip,
  formatPercent,
  labelsOverlap,
  sourceDisplay,
  sourceTooltip,
  type EvidenceDisplayRow,
} from "./councilTransparency";
import { HighlightedText, buildEvidenceTermsByVerse } from "./councilHighlight";

function SynthesisModeBanner({ response }: { response: CouncilResponse }) {
  const mode = response.synthesis_mode;
  if (mode !== "single_voice" && mode !== "synthesis_failed") return null;
  const voice = response.synthesis_voice ?? "one voice";
  const message =
    mode === "single_voice"
      ? `Only one Council voice was available, so this is ${voice}'s analysis — not a multi-voice consensus.`
      : `The synthesis step failed, so this shows ${voice}'s analysis instead of a combined consensus.`;
  return (
    <div
      data-testid="synthesis-mode-banner"
      className="soft-card border-amber-500/40 bg-amber-500/10 px-3 py-2 mb-3 text-xs text-amber-200"
    >
      {message}
    </div>
  );
}

export function CouncilResultView({
  result,
  heading,
  response,
  selectedPositionLabel,
  onJumpToVerse,
}: {
  result: CouncilResult;
  heading: string;
  response?: CouncilResponse;
  selectedPositionLabel?: string | null;
  onJumpToVerse: (verseId: number, translationCode: string) => void;
}) {
  const sorted = [...result.positions].sort((a, b) => b.weight - a.weight);

  return (
    <div className="space-y-6">
      <section className="border-t border-neutral-800 pt-5">
        <div className="flex items-baseline gap-3 mb-3">
          <h2 className="text-sm tracking-wider text-neutral-400">{heading}</h2>
          <ConfidenceBadge confidence={result.confidence} />
        </div>
        {response && <SynthesisModeBanner response={response} />}
        {response && (
          <CouncilWinnerSummary response={response} onJumpToVerse={onJumpToVerse} />
        )}
        <ul className="space-y-4">
          {sorted.map((p, i) => (
            <PositionCard
              key={i}
              position={p}
              response={response}
              highlighted={selectedPositionLabel ? labelsOverlap(p.label, selectedPositionLabel) : false}
              onJumpToVerse={onJumpToVerse}
            />
          ))}
        </ul>
      </section>

      {result.synthesis && (
        <section>
          <h3 className="text-sm tracking-wider text-neutral-400 mb-2">
            Narrative synthesis
          </h3>
          <p
            className="text-neutral-200 leading-relaxed"
            style={{ fontFamily: "var(--font-serif)" }}
          >
            {result.synthesis}
          </p>
        </section>
      )}

      {result.unresolved_tensions && result.unresolved_tensions.length > 0 && (
        <section>
          <h3 className="text-sm tracking-wider text-neutral-400 mb-2">
            Unresolved tensions
          </h3>
          <ul className="list-disc list-inside text-sm text-neutral-300 space-y-1">
            {result.unresolved_tensions.map((t, i) => (
              <li key={i}>{t}</li>
            ))}
          </ul>
        </section>
      )}

      {result.dissent_notes && (
        <section>
          <h3 className="text-sm tracking-wider text-neutral-400 mb-2">
            Dissent notes
          </h3>
          <p className="text-sm text-neutral-300 leading-relaxed">{result.dissent_notes}</p>
        </section>
      )}
    </div>
  );
}

export function ConfidenceBadge({ confidence }: { confidence: "low" | "medium" | "high" }) {
  return (
    <span
      className={
        "text-xs px-2 py-0.5 rounded " +
        (confidence === "high"
          ? "bg-emerald-500/20 text-emerald-200"
          : confidence === "medium"
            ? "bg-amber-500/20 text-amber-200"
            : "bg-neutral-700/40 text-neutral-400")
      }
    >
      confidence: {confidence}
    </span>
  );
}

function CouncilWinnerSummary({
  response,
  onJumpToVerse,
}: {
  response: CouncilResponse;
  onJumpToVerse: (verseId: number, translationCode: string) => void;
}) {
  const sorted = [...response.synthesis.positions].sort((a, b) => b.weight - a.weight);
  const leader = sorted[0];
  const runnerUp = sorted[1] ?? null;
  if (!leader) return null;

  const groups = buildPositionEvidenceGroups(leader, response);
  const successfulVoices = response.voices.filter((voice) => voice.status === "ok" && voice.result);
  const leaderMentions = countVoiceMentions(successfulVoices, leader.label);
  const gap = runnerUp ? leader.weight - runnerUp.weight : leader.weight;
  const primaryEvidence = leader.evidence[0];

  return (
    <div
      className="border border-amber-500/30 bg-amber-500/[0.06] rounded p-4 mb-4"
      data-testid="council-winner-summary"
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <div className="text-xs tracking-wide text-amber-300 mb-1">
            Why this ranked highest
          </div>
          <h3 className="text-base font-semibold text-neutral-100">{leader.label}</h3>
        </div>
        <span className="font-mono text-sm text-amber-200">
          {formatPercent(leader.weight)}
        </span>
      </div>
      <div className="grid md:grid-cols-4 gap-2 text-xs">
        <WinnerMetric
          label="Lead"
          value={runnerUp ? formatPercent(gap) : "Only view"}
          detail={runnerUp ? `over ${runnerUp.label}` : "No runner-up was returned"}
        />
        <WinnerMetric
          label="Voice support"
          value={`${leaderMentions}/${successfulVoices.length || 1}`}
          detail="independent voices named a matching view"
        />
        <WinnerMetric
          label="Evidence"
          value={`${groups.cited.length + groups.supporting.length}`}
          detail={`${groups.challenging.length} challenge${groups.challenging.length === 1 ? "" : "s"} kept visible`}
        />
        <WinnerMetric
          label="Confidence"
          value={response.synthesis.confidence}
          detail={response.synthesis.confidence_rationale ?? "See rationale below"}
        />
      </div>
      <p className="text-sm text-neutral-300 leading-relaxed mt-3">{leader.summary}</p>
      {primaryEvidence && (
        <button
          type="button"
          onClick={() =>
            onJumpToVerse(primaryEvidence.verse_id, primaryEvidence.translation_code)
          }
          className="mt-3 text-xs text-amber-300 hover:text-amber-200 hover:underline font-mono"
        >
          Inspect leading citation: {primaryEvidence.citation}
        </button>
      )}
    </div>
  );
}

function WinnerMetric({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="border border-neutral-800 rounded px-3 py-2 bg-neutral-950/50">
      <div className="text-[11px] tracking-wide text-neutral-500">{label}</div>
      <div className="text-sm font-semibold text-neutral-100">{value}</div>
      <p className="text-[11px] text-neutral-500 line-clamp-2">{detail}</p>
    </div>
  );
}

function PositionCard({
  position,
  response,
  highlighted = false,
  onJumpToVerse,
}: {
  position: CouncilPosition;
  response?: CouncilResponse;
  highlighted?: boolean;
  onJumpToVerse: (verseId: number, translationCode: string) => void;
}) {
  const pct = Math.round(position.weight * 100);
  const evidenceTermsByVerse = response ? buildEvidenceTermsByVerse(response) : new Map();
  return (
    <li
      className={
        "border rounded p-4 transition-colors " +
        (highlighted
          ? "border-amber-500/50 bg-amber-500/[0.06]"
          : "border-neutral-800")
      }
      data-testid={highlighted ? "council-focused-position" : undefined}
    >
      <header className="flex items-baseline justify-between gap-3 mb-2">
        <h3 className="text-base font-semibold text-neutral-100">{position.label}</h3>
        <span className="text-sm font-mono text-amber-300">{pct}%</span>
      </header>
      <div className="w-full bg-neutral-900 rounded-full h-1.5 mb-3 overflow-hidden">
        <div className="h-full bg-amber-500/60" style={{ width: `${pct}%` }} />
      </div>
      <p className="text-sm text-neutral-300 leading-relaxed mb-3">{position.summary}</p>
      {position.why_not_higher && (
        <p className="text-xs text-neutral-500 border-l border-neutral-800 pl-3 mb-3">
          Why not higher: {position.why_not_higher}
        </p>
      )}
      {position.evidence.length > 0 && (
        <ul className="space-y-2 border-t border-neutral-800 pt-3">
          {position.evidence.map((e, i) => (
            <li key={i} className="text-sm">
              <button
                type="button"
                onClick={() => onJumpToVerse(e.verse_id, e.translation_code)}
                className="text-amber-300 hover:text-amber-200 hover:underline font-mono text-xs"
              >
                {e.citation} ({e.translation_code})
              </button>
              <span
                className="text-neutral-300 italic ml-2"
                style={{ fontFamily: "var(--font-serif)" }}
              >
                "
                <HighlightedText
                  text={e.quote}
                  terms={evidenceTermsByVerse.get(e.verse_id) ?? []}
                />
                "
              </span>
              <p className="text-xs text-neutral-500 mt-0.5">{e.reasoning}</p>
            </li>
          ))}
        </ul>
      )}
      {response && (
        <CouncilEvidenceTabs
          position={position}
          response={response}
          onJumpToVerse={onJumpToVerse}
        />
      )}
    </li>
  );
}

function CouncilEvidenceTabs({
  position,
  response,
  onJumpToVerse,
}: {
  position: CouncilPosition;
  response: CouncilResponse;
  onJumpToVerse: (verseId: number, translationCode: string) => void;
}) {
  const [activeTab, setActiveTab] = useState<keyof ReturnType<typeof buildPositionEvidenceGroups>>("cited");
  const groups = buildPositionEvidenceGroups(position, response);
  const rows = groups[activeTab];
  const tabs: Array<[keyof typeof groups, string]> = [
    ["cited", "Cited"],
    ["supporting", "Supporting"],
    ["challenging", "Challenging"],
    ["ignored", "Ignored"],
  ];

  return (
    <div className="border-t border-neutral-800 mt-3 pt-3" data-testid="council-evidence-tabs">
      <div className="flex flex-wrap gap-1 mb-3">
        {tabs.map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setActiveTab(key)}
            className={
              "px-2 py-1 rounded border text-xs " +
              (activeTab === key
                ? "border-amber-500/50 bg-amber-500/15 text-amber-100"
                : "border-neutral-800 text-neutral-400 hover:border-neutral-700")
            }
          >
            {label} ({groups[key].length})
          </button>
        ))}
      </div>
      {activeTab === "challenging" && (
        <p className="text-xs text-neutral-500 mb-2">
          These passages complicate or limit the argument. They do not automatically disprove it.
        </p>
      )}
      {rows.length === 0 ? (
        <p className="text-xs text-neutral-500">
          {activeTab === "challenging"
            ? "No challenging evidence was identified for this position."
            : activeTab === "supporting"
              ? "No additional supporting passages were classified beyond the cited evidence."
              : `No ${activeTab} evidence is available for this saved result.`}
        </p>
      ) : (
        <ul className="space-y-2">
          {rows.map((row) => (
            <EvidenceDisplayItem
              key={`${activeTab}-${row.verse_id}-${row.source}`}
              row={row}
              onJumpToVerse={onJumpToVerse}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function EvidenceDisplayItem({
  row,
  onJumpToVerse,
}: {
  row: EvidenceDisplayRow;
  onJumpToVerse: (verseId: number, translationCode: string) => void;
}) {
  return (
    <li className="border border-neutral-900 rounded px-3 py-2 text-sm">
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
          {sourceDisplay(row.source)}
        </span>
        <span
          className={"text-[10px] px-1.5 py-0.5 rounded " + evidenceStatusClass(row.status)}
          title={evidenceStatusTooltip(row.status)}
        >
          {evidenceStatusLabel(row.status)}
        </span>
      </div>
      <p
        className="text-neutral-300 leading-relaxed"
        style={{ fontFamily: "var(--font-serif)" }}
      >
        <HighlightedText text={row.text} terms={row.matched_terms} />
      </p>
      {row.reasoning && <p className="text-xs text-neutral-500 mt-1">{row.reasoning}</p>}
      {row.matched_terms.length > 0 && (
        <p className="text-[11px] text-neutral-600 mt-1">
          Matched terms: {row.matched_terms.join(", ")}
        </p>
      )}
    </li>
  );
}

