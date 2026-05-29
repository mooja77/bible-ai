import { useState } from "react";
import type { CouncilPosition, CouncilResponse, CouncilVoice } from "../../lib/bible";
import { buildPositionEvidenceGroups, countVoiceMentions, formatPercent } from "./councilTransparency";

export function CouncilPositionComparison({
  response,
  onJumpToVerse,
}: {
  response: CouncilResponse;
  onJumpToVerse: (verseId: number, translationCode: string) => void;
}) {
  const sorted = [...response.synthesis.positions].sort((a, b) => b.weight - a.weight);
  const [leftLabel, setLeftLabel] = useState(sorted[0]?.label ?? "");
  const [rightLabel, setRightLabel] = useState(sorted[1]?.label ?? sorted[0]?.label ?? "");
  if (sorted.length < 2) return null;

  const left = sorted.find((position) => position.label === leftLabel) ?? sorted[0];
  const right =
    sorted.find((position) => position.label === rightLabel && position.label !== left.label) ??
    sorted.find((position) => position.label !== left.label) ??
    sorted[1];
  const successfulVoices = response.voices.filter((voice) => voice.status === "ok" && voice.result);

  return (
    <section
      className="border-t border-neutral-800 pt-5"
      data-testid="council-position-comparison"
    >
      <div className="flex items-baseline justify-between gap-3 mb-3">
        <div>
          <h2 className="text-sm tracking-wider text-neutral-400">
            Compare Positions
          </h2>
          <p className="text-xs text-neutral-500 mt-1">
            Put two arguments beside each other to inspect weight, voice support, evidence,
            objections, and stated limits.
          </p>
        </div>
      </div>
      <div className="grid md:grid-cols-2 gap-3 mb-3">
        <PositionSelect
          label="First position"
          value={left.label}
          positions={sorted}
          onChange={setLeftLabel}
        />
        <PositionSelect
          label="Second position"
          value={right.label}
          positions={sorted.filter((position) => position.label !== left.label)}
          onChange={setRightLabel}
        />
      </div>
      <div className="grid md:grid-cols-2 gap-3">
        <PositionComparisonCard
          position={left}
          response={response}
          voices={successfulVoices}
          onJumpToVerse={onJumpToVerse}
        />
        <PositionComparisonCard
          position={right}
          response={response}
          voices={successfulVoices}
          onJumpToVerse={onJumpToVerse}
        />
      </div>
    </section>
  );
}

function PositionSelect({
  label,
  value,
  positions,
  onChange,
}: {
  label: string;
  value: string;
  positions: CouncilPosition[];
  onChange: (value: string) => void;
}) {
  return (
    <label className="block text-xs text-neutral-500">
      {label}
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 w-full bg-neutral-900 border border-neutral-800 rounded px-2 py-1.5 text-sm text-neutral-100"
      >
        {positions.map((position) => (
          <option key={position.label} value={position.label}>
            {position.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function PositionComparisonCard({
  position,
  response,
  voices,
  onJumpToVerse,
}: {
  position: CouncilPosition;
  response: CouncilResponse;
  voices: CouncilVoice[];
  onJumpToVerse: (verseId: number, translationCode: string) => void;
}) {
  const groups = buildPositionEvidenceGroups(position, response);
  const mentions = countVoiceMentions(voices, position.label);
  const firstEvidence = groups.cited[0] ?? groups.supporting[0] ?? groups.challenging[0];

  return (
    <article className="border border-neutral-800 rounded p-4">
      <div className="flex items-baseline justify-between gap-3 mb-2">
        <h3 className="text-sm font-semibold text-neutral-100">{position.label}</h3>
        <span className="font-mono text-sm text-amber-300">
          {formatPercent(position.weight)}
        </span>
      </div>
      <p className="text-sm text-neutral-300 leading-relaxed mb-3">{position.summary}</p>
      <dl className="grid grid-cols-2 gap-2 text-xs mb-3">
        <ComparisonFact label="Voice support" value={`${mentions}/${voices.length || 1}`} />
        <ComparisonFact label="Cited" value={String(groups.cited.length)} />
        <ComparisonFact label="Supporting" value={String(groups.supporting.length)} />
        <ComparisonFact label="Challenging" value={String(groups.challenging.length)} />
      </dl>
      {position.confidence_rationale && (
        <p className="text-xs text-neutral-500 mb-2">
          Confidence: {position.confidence_rationale}
        </p>
      )}
      {position.why_not_higher && (
        <p className="text-xs text-neutral-500 mb-2">
          Limit: {position.why_not_higher}
        </p>
      )}
      {firstEvidence && (
        <button
          type="button"
          onClick={() => onJumpToVerse(firstEvidence.verse_id, firstEvidence.translation_code)}
          className="text-xs text-amber-300 hover:text-amber-200 hover:underline font-mono"
        >
          Inspect {firstEvidence.citation}
        </button>
      )}
    </article>
  );
}

function ComparisonFact({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-neutral-900 rounded px-2 py-1.5">
      <dt className="text-[11px] tracking-wide text-neutral-600">{label}</dt>
      <dd className="text-sm text-neutral-200">{value}</dd>
    </div>
  );
}
