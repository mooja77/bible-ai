import { useEffect, useState } from "react";
import {
  getStrongs,
  getStrongsOccurrences,
  listModuleEntriesForStrongs,
  type ModuleEntry,
  type StrongsEntry,
  type StrongsOccurrence,
} from "../../lib/bible";
import { AddToWorkspaceMenu } from "../workspaces/AddToWorkspaceMenu";

interface Props {
  codes: string[];
  surface: string;
  morph?: string | null;
  onJumpToVerse?: (verseId: number, translationCode: string) => void;
  onClose: () => void;
}

export function StrongsPopup({ codes, surface, morph, onJumpToVerse, onClose }: Props) {
  const [entries, setEntries] = useState<StrongsEntry[] | null>(null);
  const [occurrences, setOccurrences] = useState<StrongsOccurrence[]>([]);
  const [moduleEntries, setModuleEntries] = useState<ModuleEntry[]>([]);

  useEffect(() => {
    setEntries(null);
    if (codes.length === 0) {
      setEntries([]);
      setOccurrences([]);
      setModuleEntries([]);
      return;
    }
    getStrongs(codes)
      .then(setEntries)
      .catch(() => setEntries([]));
    getStrongsOccurrences(codes[0], 60)
      .then(setOccurrences)
      .catch(() => setOccurrences([]));
    listModuleEntriesForStrongs(codes)
      .then(setModuleEntries)
      .catch(() => setModuleEntries([]));
  }, [codes.join(",")]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="surface-panel fixed bottom-4 right-4 z-50 w-[420px] max-h-[60vh] overflow-y-auto rounded-lg backdrop-blur">
      <header className="flex items-baseline justify-between px-4 py-3 border-b border-neutral-800">
        <div>
          <div
            className="text-xl text-amber-200"
            style={{ fontFamily: '"SBL Hebrew", "SBL Greek", serif' }}
          >
            {surface}
          </div>
          {morph && (
            <div className="text-xs text-neutral-500 font-mono mt-0.5">{morph}</div>
          )}
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close Strong's lookup"
          className="text-neutral-500 hover:text-neutral-200 text-sm px-1"
        >
          ×
        </button>
      </header>
      <div className="px-4 py-3 space-y-3">
        {entries === null ? (
          <p className="text-neutral-500 italic text-sm">Loading…</p>
        ) : entries.length === 0 ? (
          <p className="text-neutral-500 italic text-sm">
            No Strong's entries found for codes: {codes.join(", ") || "(none)"}
          </p>
        ) : (
          entries.map((e) => (
            <article key={e.code} className="border-b border-neutral-800 pb-3 last:border-0">
              <header className="flex items-baseline gap-2 mb-1">
                <span className="font-mono text-xs text-amber-300">{e.code}</span>
                <span
                  className="text-base text-neutral-100"
                  style={{ fontFamily: '"SBL Hebrew", "SBL Greek", serif' }}
                >
                  {e.lemma}
                </span>
                {e.translit && (
                  <span className="text-xs text-neutral-400 italic">{e.translit}</span>
                )}
              </header>
              {e.gloss && (
                <p className="text-sm text-amber-200/90 mb-1">{e.gloss}</p>
              )}
              {e.definition && (
                <p className="text-sm text-neutral-300 leading-relaxed">{e.definition}</p>
              )}
            </article>
          ))
        )}

        {occurrences.length > 0 && (
          <section className="border-t border-neutral-800 pt-3">
            <h3 className="text-xs tracking-wider text-neutral-500 mb-2">
              Occurrences ({occurrences.length})
            </h3>
            <ul className="space-y-1.5 max-h-56 overflow-y-auto pr-2">
              {occurrences.map((o) => (
                <li key={`${o.translation_code}-${o.verse_id}-${o.surface}`}>
                  <button
                    type="button"
                    onClick={() => {
                      onJumpToVerse?.(o.verse_id, o.translation_code);
                      onClose();
                    }}
                    className="w-full text-left rounded px-2 py-1 hover:bg-neutral-900"
                  >
                    <span className="font-mono text-xs text-amber-300 mr-2">
                      {o.book_name} {o.chapter}:{o.verse}
                    </span>
                    <span className="text-xs text-neutral-500 mr-2">{o.translation_code}</span>
                    <span className="text-sm text-neutral-300">{o.surface}</span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}

        {moduleEntries.length > 0 && (
          <section className="border-t border-neutral-800 pt-3">
            <h3 className="text-xs tracking-wider text-neutral-500 mb-2">
              Modules
            </h3>
            <ul className="space-y-3">
              {moduleEntries.map((entry) => (
                <li key={entry.id} className="text-sm">
                  <div className="flex items-baseline gap-2">
                    <span className="text-amber-300">{entry.module_title}</span>
                    {entry.title && <span className="text-neutral-500">{entry.title}</span>}
                  </div>
                  <p className="text-neutral-300 mt-1 leading-relaxed">{entry.body}</p>
                  <div className="mt-2">
                    <AddToWorkspaceMenu
                      kind="module_entry"
                      title={entry.title ?? entry.module_title}
                      buttonLabel="Add"
                      payload={{
                        strongs_codes: codes,
                        module_id: entry.module_id,
                        module_title: entry.module_title,
                        title: entry.title,
                        body: entry.body,
                      }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </div>
  );
}
