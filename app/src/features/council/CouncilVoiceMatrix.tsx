import { useState } from "react";
import type { CouncilPosition, CouncilResponse } from "../../lib/bible";
import { buildVoiceAgreementMatrix, formatPercent, labelsOverlap } from "./councilTransparency";

export function CouncilVoiceMatrix({
  response,
  selectedPositionLabel,
  onSelectPosition,
  onJumpToVerse,
}: {
  response: CouncilResponse;
  selectedPositionLabel: string | null;
  onSelectPosition: (label: string) => void;
  onJumpToVerse: (verseId: number, translationCode: string) => void;
}) {
  const [selected, setSelected] = useState<{
    row: string;
    cell: number;
    position: CouncilPosition;
  } | null>(null);
  const rows = buildVoiceAgreementMatrix(response);
  const voices = response.voices.filter((voice) => voice.status === "ok" && voice.result);
  if (rows.length === 0) return null;

  return (
    <section className="border-t border-neutral-800 pt-5" data-testid="council-voice-matrix">
      <h2 className="text-sm tracking-wider text-neutral-400 mb-2">
        Voice Agreement Matrix
      </h2>
      <p className="text-xs text-neutral-500 mb-3">
        This compares the final synthesis against each independent voice. A blank cell means
        that voice did not name a matching position.
      </p>
      <div className="overflow-x-auto border border-neutral-800 rounded">
        <table className="w-full text-xs min-w-[520px]">
          <thead className="bg-neutral-900 text-neutral-500">
            <tr>
              <th className="text-left font-medium px-2 py-2">Position</th>
              <th className="text-right font-medium px-2 py-2">Final</th>
              {voices.map((voice) => (
                <th key={voice.provider} className="text-right font-medium px-2 py-2">
                  {voice.display_name}
                </th>
              ))}
              <th className="text-right font-medium px-2 py-2">Disagreement</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const isFocused = selectedPositionLabel
                ? labelsOverlap(row.position.label, selectedPositionLabel)
                : false;
              return (
              <tr
                key={row.position.label}
                onClick={() => onSelectPosition(row.position.label)}
                className={
                  "border-t border-neutral-800 cursor-pointer " +
                  (isFocused ? "bg-amber-500/[0.07]" : "hover:bg-neutral-900/50")
                }
              >
                <td className="px-2 py-2 text-neutral-200">
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      onSelectPosition(row.position.label);
                    }}
                    className="text-left hover:text-amber-200"
                    title="Focus this position in the synthesis cards"
                  >
                    {row.position.label}
                  </button>
                </td>
                <td className="px-2 py-2 text-right font-mono text-amber-300">
                  {formatPercent(row.final_weight)}
                </td>
                {row.cells.map((cell, index) => (
                  <td key={cell.voice.provider} className="px-1 py-1 text-right">
                    {cell.position ? (
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          onSelectPosition(row.position.label);
                          setSelected({
                            row: row.position.label,
                            cell: index,
                            position: cell.position as CouncilPosition,
                          });
                        }}
                        className="w-full rounded px-2 py-1 font-mono text-emerald-100"
                        title={`Inspect ${cell.voice.display_name}'s matching position`}
                        style={{
                          backgroundColor: `rgba(16, 185, 129, ${0.12 + (cell.weight ?? 0) * 0.35})`,
                        }}
                      >
                        {formatPercent(cell.weight ?? 0)}
                      </button>
                    ) : (
                      <span className="text-neutral-700">-</span>
                    )}
                  </td>
                ))}
                <td className="px-2 py-2 text-right font-mono text-neutral-400">
                  {formatPercent(row.disagreement)}
                </td>
              </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {selectedPositionLabel && (
        <p
          className="text-xs text-amber-200 mt-2"
          data-testid="council-matrix-focus"
        >
          Focused position: {selectedPositionLabel}. The matching synthesis card is highlighted above.
        </p>
      )}
      {response.voices.some((voice) => voice.status !== "ok") && (
        <p className="text-xs text-neutral-500 mt-2">
          Failed or skipped voices remain visible in the audit trail below.
        </p>
      )}
      {selected && (
        <div className="border border-neutral-800 rounded p-3 mt-3">
          <div className="text-xs tracking-wide text-neutral-500 mb-1">
            Provider cell detail
          </div>
          <h3 className="text-sm font-semibold text-neutral-100">{selected.position.label}</h3>
          <p className="text-sm text-neutral-300 mt-1">{selected.position.summary}</p>
          {selected.position.evidence.length > 0 && (
            <ul className="space-y-1 mt-2">
              {selected.position.evidence.map((evidence) => (
                <li key={`${selected.row}-${selected.cell}-${evidence.verse_id}`} className="text-xs">
                  <button
                    type="button"
                    onClick={() => onJumpToVerse(evidence.verse_id, evidence.translation_code)}
                    className="text-amber-300 hover:text-amber-200 font-mono"
                  >
                    {evidence.citation}
                  </button>{" "}
                  <span className="text-neutral-500">{evidence.reasoning}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
