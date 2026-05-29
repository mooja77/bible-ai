import { useState } from "react";
import type { CouncilProviderInfo, CouncilVoice } from "../../lib/bible";
import { CouncilResultView } from "./CouncilResultView";

export function VoicesAuditTrail({
  voices,
  manifest,
  onJumpToVerse,
}: {
  voices: CouncilVoice[];
  manifest: CouncilProviderInfo[];
  onJumpToVerse: (verseId: number, translationCode: string) => void;
}) {
  // Merge: one row per manifest entry. If the provider ran, attach its voice data.
  const rows = manifest.map((m) => {
    const voice = voices.find((v) => v.provider === m.name);
    return { manifest: m, voice };
  });

  return (
    <section className="border-t border-neutral-800 pt-5">
      <h2 className="text-sm tracking-wider text-neutral-400 mb-3">
        Voices (audit trail)
      </h2>
      <ul className="space-y-2">
        {rows.map((r) => (
          <VoiceRow
            key={r.manifest.name}
            manifest={r.manifest}
            voice={r.voice}
            onJumpToVerse={onJumpToVerse}
          />
        ))}
      </ul>
    </section>
  );
}

function VoiceRow({
  manifest,
  voice,
  onJumpToVerse,
}: {
  manifest: CouncilProviderInfo;
  voice?: CouncilVoice;
  onJumpToVerse: (verseId: number, translationCode: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  if (!manifest.available) {
    return (
      <li className="border border-neutral-900 rounded px-3 py-2 text-sm text-neutral-600">
        <span className="font-mono text-xs mr-2">{manifest.name}</span>
        {manifest.display_name} — no key configured
      </li>
    );
  }

  if (!voice) {
    return (
      <li className="border border-neutral-900 rounded px-3 py-2 text-sm text-neutral-500">
        <span className="font-mono text-xs mr-2">{manifest.name}</span>
        {manifest.display_name} — available but did not run
      </li>
    );
  }

  const isError = voice.status === "error";
  const canExpand = voice.status === "ok" && voice.result;

  return (
    <li className="border border-neutral-800 rounded">
      <button
        type="button"
        onClick={() => canExpand && setExpanded((x) => !x)}
        disabled={!canExpand}
        className={
          "w-full flex items-center justify-between px-3 py-2 text-sm " +
          (canExpand ? "hover:bg-neutral-900/60 cursor-pointer" : "cursor-default")
        }
      >
        <div className="flex items-center gap-2">
          <span
            className={
              "font-mono text-xs w-16 text-left " +
              (isError ? "text-red-400" : "text-emerald-400")
            }
          >
            {isError ? "✗ error" : "✓ ok"}
          </span>
          <span className="text-neutral-100">{voice.display_name}</span>
          {isError && voice.error_category && (
            <span className="meta-pill text-xs text-red-300 border-red-500/40">
              {voice.error_category}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-neutral-500">
            {(voice.duration_ms / 1000).toFixed(1)}s
          </span>
          {canExpand && (
            <span className="text-neutral-500 text-xs">{expanded ? "▾" : "▸"}</span>
          )}
        </div>
      </button>
      {isError && (
        <div className="px-3 py-2 border-t border-neutral-800 text-xs">
          {voice.error_hint && (
            <p className="text-amber-200 mb-1">{voice.error_hint}</p>
          )}
          <p className="text-red-300">{voice.error}</p>
        </div>
      )}
      {expanded && voice.result && (
        <div className="border-t border-neutral-800 p-4">
          <CouncilResultView
            result={voice.result}
            heading={`${voice.display_name} — independent analysis`}
            onJumpToVerse={onJumpToVerse}
          />
        </div>
      )}
    </li>
  );
}
