import { useEffect, useMemo, useState, type MouseEvent } from "react";
import {
  addBookmark,
  createTheologyLink,
  deleteRangeHighlight,
  deleteRangeNote,
  explainPassage,
  getRangeNote,
  listModuleEntriesForRange,
  listTheologyTopics,
  upsertRangeHighlight,
  upsertRangeNote,
  type Highlight,
  type ModuleEntry,
  type PassageExplanation,
  type RangeHighlight,
  type RangeNote,
  type TheologyTopic,
  type Verse,
  type WordToken,
} from "../../lib/bible";
import { VersePanel } from "./VersePanel";
import { AddToWorkspaceMenu } from "../workspaces/AddToWorkspaceMenu";

interface Props {
  bookName: string;
  chapter: number;
  translationName: string;
  translationCode: string;
  /** ISO language code from the translation ("en", "hbo", "grc", ...). */
  language?: string;
  verses: Verse[];
  loading: boolean;
  /** Optional handler so cross-ref clicks navigate the parent reader. */
  onJumpToVerse?: (verseId: number, translationCode: string) => void;
  /** Highlights for verses in this chapter, keyed by verse_id. */
  highlights?: Highlight[];
  /** Range highlights that overlap this chapter. */
  rangeHighlights?: RangeHighlight[];
  /** Verse_ids that have user notes — render a small indicator. */
  notedVerseIds?: number[];
  /** Range notes that overlap this chapter. */
  rangeNotes?: RangeNote[];
  /** Called after a highlight or note mutation so the parent can refetch. */
  onUserDataChanged?: () => void;
  /** Pre-fill a council question with this verse and switch to council mode. */
  onAskCouncilAboutVerse?: (verseId: number, citation: string) => void;
  /** Word-level Strong's tokens, grouped by verse_id. When present for a
   *  verse, the reader renders words as clickable buttons instead of
   *  running text. */
  wordTokensByVerse?: Map<number, WordToken[]>;
  /** Called when the user clicks a word in word-level mode. */
  onWordClick?: (token: WordToken) => void;
  /** Reader text scale persisted in app settings. */
  fontScale?: number;
  density?: "comfortable" | "compact";
  referenceRangeTarget?: {
    startVerseId: number;
    endVerseId: number;
    requestId: number;
  } | null;
  onReferenceRangeTargetConsumed?: () => void;
  /** When false the big chapter heading is suppressed — multi-column mode
   *  renders one shared heading above the columns instead of repeating it. */
  showChapterHeading?: boolean;
}

/** Hebrew is right-to-left. Everything else we currently ship is LTR. */
function isRtl(language?: string): boolean {
  return language === "hbo" || language === "he" || language === "ar";
}

/** Pick a reasonable system font stack per language. Users with SBL fonts
 *  installed will pick those up first. */
function fontFamilyFor(language?: string): string {
  switch (language) {
    case "hbo":
    case "he":
      return '"SBL Hebrew", "Ezra SIL", "Times New Roman", serif';
    case "grc":
    case "el":
      return '"SBL Greek", "New Athena Unicode", "Times New Roman", serif';
    default:
      return "var(--font-serif)";
  }
}

export function ChapterReader({
  bookName,
  chapter,
  translationName,
  translationCode,
  language,
  verses,
  loading,
  onJumpToVerse,
  highlights,
  rangeHighlights,
  notedVerseIds,
  rangeNotes,
  onUserDataChanged,
  onAskCouncilAboutVerse,
  wordTokensByVerse,
  onWordClick,
  fontScale = 1,
  density = "comfortable",
  referenceRangeTarget,
  onReferenceRangeTargetConsumed,
  showChapterHeading = true,
}: Props) {
  const rtl = isRtl(language);
  const [selectedVerse, setSelectedVerse] = useState<Verse | null>(null);
  const [rangeAnchor, setRangeAnchor] = useState<Verse | null>(null);
  const [selectedRange, setSelectedRange] = useState<[number, number] | null>(null);
  const highlightByVerseId = new Map((highlights ?? []).map((h) => [h.verse_id, h.color]));
  const notedSet = new Set(notedVerseIds ?? []);
  const rangeVerses = useMemo(() => {
    if (!selectedRange) return [];
    const [start, end] = selectedRange;
    return verses.filter((v) => v.verse_id >= start && v.verse_id <= end);
  }, [selectedRange, verses]);
  const rangeCitation =
    rangeVerses.length > 0
      ? `${bookName} ${chapter}:${rangeVerses[0].verse}-${rangeVerses[rangeVerses.length - 1].verse}`
      : null;

  useEffect(() => {
    if (!referenceRangeTarget) return;
    const hasStart = verses.some((v) => v.verse_id === referenceRangeTarget.startVerseId);
    const hasEnd = verses.some((v) => v.verse_id === referenceRangeTarget.endVerseId);
    if (!hasStart || !hasEnd) return;
    setSelectedVerse(null);
    setRangeAnchor(null);
    setSelectedRange([
      referenceRangeTarget.startVerseId,
      referenceRangeTarget.endVerseId,
    ]);
    onReferenceRangeTargetConsumed?.();
  }, [
    onReferenceRangeTargetConsumed,
    referenceRangeTarget,
    referenceRangeTarget?.requestId,
    verses,
  ]);

  const onVerseNumberClick = (event: MouseEvent, verse: Verse) => {
    if (event.shiftKey && rangeAnchor) {
      const start = Math.min(rangeAnchor.verse_id, verse.verse_id);
      const end = Math.max(rangeAnchor.verse_id, verse.verse_id);
      setSelectedVerse(null);
      setSelectedRange([start, end]);
      return;
    }
    setSelectedRange(null);
    setRangeAnchor(verse);
    setSelectedVerse(selectedVerse?.verse_id === verse.verse_id ? null : verse);
  };

  return (
    <article
      className={
        "reader-panel max-w-3xl mx-auto " +
        (density === "compact" ? "px-4 py-5" : "px-6 py-8")
      }
    >
      <header
        className={
          "border-b border-neutral-800/80 " +
          (density === "compact" ? "mb-4 pb-3" : "mb-6 pb-4")
        }
      >
        {showChapterHeading && (
          <h1
            className={
              "font-semibold text-neutral-100 " +
              (density === "compact" ? "text-2xl" : "text-3xl")
            }
          >
            {bookName} {chapter}
          </h1>
        )}
        <div className="flex flex-wrap items-center gap-2 mt-2">
          <span className="meta-pill">{translationCode}</span>
          <span className="text-sm text-neutral-500">{translationName}</span>
        </div>
      </header>

      {loading ? (
        <div className="space-y-3" aria-label="Loading chapter">
          <div className="h-4 w-5/6 rounded bg-neutral-800/70 animate-pulse" />
          <div className="h-4 w-11/12 rounded bg-neutral-800/50 animate-pulse" />
          <div className="h-4 w-2/3 rounded bg-neutral-800/40 animate-pulse" />
        </div>
      ) : verses.length === 0 ? (
        <p className="text-neutral-500 italic">No verses for this chapter.</p>
      ) : (
        <div
          dir={rtl ? "rtl" : "ltr"}
          lang={language}
          className={
            "text-neutral-200 " +
            (density === "compact" ? "leading-normal " : "leading-relaxed ") +
            (rtl ? "text-xl" : density === "compact" ? "text-base" : "text-lg")
          }
          style={{
            fontFamily: fontFamilyFor(language),
            fontSize: `${fontScale}em`,
          }}
        >
          {verses.map((v) => {
            const isSelected = selectedVerse?.verse_id === v.verse_id;
            const hi = highlightByVerseId.get(v.verse_id);
            const rangeHi = rangeHighlights?.find(
              (r) => v.verse_id >= r.start_verse_id && v.verse_id <= r.end_verse_id,
            );
            const hasNote =
              notedSet.has(v.verse_id) ||
              !!rangeNotes?.some(
                (n) => v.verse_id >= n.start_verse_id && v.verse_id <= n.end_verse_id,
              );
            const tokens = wordTokensByVerse?.get(v.verse_id);
            const inRange =
              selectedRange &&
              v.verse_id >= selectedRange[0] &&
              v.verse_id <= selectedRange[1];
            return (
              <span
                key={v.verse_id}
                id={`v-${v.verse_id}`}
                className={
                  "mx-0.5 rounded px-0.5 transition-colors " +
                  (inRange || isSelected ? "ring-1 ring-amber-400/30" : "")
                }
                style={
                  inRange
                    ? { backgroundColor: "rgba(251, 191, 36, 0.18)" }
                    : rangeHi
                      ? { backgroundColor: `${rangeHi.color}2e` }
                      : hi
                        ? { backgroundColor: `${hi}33` /* ~20% alpha */ }
                        : undefined
                }
              >
                <button
                  type="button"
                  onClick={(event) => onVerseNumberClick(event, v)}
                  aria-label={`Verse ${v.verse} actions`}
                  className={
                    "text-xs mx-1 px-1 rounded select-none align-super cursor-pointer transition-colors hover:bg-amber-500/20 " +
                    (isSelected
                      ? "text-amber-200 font-semibold bg-amber-500/15"
                      : "text-amber-400/70 hover:text-amber-300")
                  }
                  style={{ fontFamily: "var(--font-sans)" }}
                >
                  {v.verse}
                  {hasNote && <span className="ml-0.5 text-amber-300/80">•</span>}
                </button>
                {tokens && tokens.length > 0 && onWordClick ? (
                  tokens.map((t) => (
                    <button
                      key={`${t.verse_id}-${t.position}`}
                      type="button"
                      onClick={() => onWordClick(t)}
                      title={t.lemma ?? undefined}
                      data-testid="word-token"
                      className="mx-0.5 px-0.5 rounded hover:bg-amber-500/20 transition-colors"
                    >
                      {t.surface}
                    </button>
                  ))
                ) : (
                  <>{v.text}{" "}</>
                )}
              </span>
            );
          })}
        </div>
      )}

      {rangeVerses.length > 0 && rangeCitation && (
        <RangeActionBar
          citation={rangeCitation}
          translationCode={translationCode}
          verses={rangeVerses}
          onClear={() => setSelectedRange(null)}
          onChanged={() => onUserDataChanged?.()}
          onAskCouncilAboutVerse={onAskCouncilAboutVerse}
        />
      )}

      {selectedVerse && (
        <VersePanel
          verseId={selectedVerse.verse_id}
          bookName={bookName}
          chapter={selectedVerse.chapter}
          verse={selectedVerse.verse}
          verseText={selectedVerse.text}
          translationCode={translationCode}
          highlightColor={highlightByVerseId.get(selectedVerse.verse_id) ?? null}
          onJumpToVerse={(vid, code) => {
            onJumpToVerse?.(vid, code);
            setSelectedVerse(null);
          }}
          onClose={() => setSelectedVerse(null)}
          onMutated={() => onUserDataChanged?.()}
          onAskCouncilAboutVerse={
            onAskCouncilAboutVerse
              ? (vid, citation) => {
                  onAskCouncilAboutVerse(vid, citation);
                  setSelectedVerse(null);
                }
              : undefined
          }
        />
      )}
    </article>
  );
}

const RANGE_HIGHLIGHT_COLORS = [
  { name: "Amber", value: "#f59e0b" },
  { name: "Green", value: "#22c55e" },
  { name: "Blue", value: "#38bdf8" },
  { name: "Rose", value: "#fb7185" },
];

export function RangeActionBar({
  citation,
  translationCode,
  verses,
  onClear,
  onChanged,
  onAskCouncilAboutVerse,
}: {
  citation: string;
  translationCode: string;
  verses: Verse[];
  onClear: () => void;
  onChanged: () => void;
  onAskCouncilAboutVerse?: (verseId: number, citation: string) => void;
}) {
  const text = verses.map((v) => `${v.verse} ${v.text}`).join(" ");
  const startVerseId = verses[0].verse_id;
  const endVerseId = verses[verses.length - 1].verse_id;
  const [noteOpen, setNoteOpen] = useState(false);
  const [noteBody, setNoteBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [explaining, setExplaining] = useState(false);
  const [explanation, setExplanation] = useState<PassageExplanation | null>(null);
  const [moduleEntries, setModuleEntries] = useState<ModuleEntry[]>([]);
  const [theologyTopics, setTheologyTopics] = useState<TheologyTopic[]>([]);
  const [theologyTopicId, setTheologyTopicId] = useState<number | null>(null);

  useEffect(() => {
    if (!noteOpen) return;
    let cancelled = false;
    getRangeNote(startVerseId, endVerseId)
      .then((note) => {
        if (!cancelled) setNoteBody(note?.body ?? "");
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [endVerseId, noteOpen, startVerseId]);

  useEffect(() => {
    let cancelled = false;
    listModuleEntriesForRange(startVerseId, endVerseId)
      .then((entries) => {
        if (!cancelled) setModuleEntries(entries);
      })
      .catch(() => {
        if (!cancelled) setModuleEntries([]);
      });
    return () => {
      cancelled = true;
    };
  }, [endVerseId, startVerseId]);

  useEffect(() => {
    let cancelled = false;
    listTheologyTopics()
      .then((topics) => {
        if (cancelled) return;
        setTheologyTopics(topics);
        setTheologyTopicId((current) => current ?? topics[0]?.id ?? null);
      })
      .catch(() => {
        if (!cancelled) setTheologyTopics([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const setRangeColor = async (color: string) => {
    if (busy) return;
    setBusy(true);
    setStatus(null);
    try {
      await upsertRangeHighlight(startVerseId, endVerseId, color);
      onChanged();
      setStatus("Range highlighted");
    } finally {
      setBusy(false);
    }
  };

  const clearRangeColor = async () => {
    if (busy) return;
    setBusy(true);
    setStatus(null);
    try {
      await deleteRangeHighlight(startVerseId, endVerseId);
      onChanged();
      setStatus("Range highlight cleared");
    } finally {
      setBusy(false);
    }
  };

  const bookmarkRange = async () => {
    if (busy) return;
    setBusy(true);
    setStatus(null);
    try {
      await addBookmark(startVerseId, endVerseId, citation);
      onChanged();
      setStatus("Range bookmarked");
    } finally {
      setBusy(false);
    }
  };

  const saveRangeNote = async () => {
    if (busy) return;
    setBusy(true);
    setStatus(null);
    try {
      const trimmed = noteBody.trim();
      if (trimmed) {
        await upsertRangeNote(startVerseId, endVerseId, trimmed);
        setStatus("Range note saved");
      } else {
        await deleteRangeNote(startVerseId, endVerseId);
        setStatus("Range note cleared");
      }
      onChanged();
    } finally {
      setBusy(false);
    }
  };

  const explainRange = async () => {
    if (explaining) return;
    setExplaining(true);
    setStatus(null);
    try {
      setExplanation(await explainPassage(translationCode, startVerseId, endVerseId));
    } finally {
      setExplaining(false);
    }
  };

  const addRangeToTheology = async () => {
    if (!theologyTopicId) return;
    setStatus(null);
    await createTheologyLink({
      topic_id: theologyTopicId,
      link_kind: "verse_range",
      target_id: startVerseId,
      title: citation,
      payload_json: JSON.stringify({
        start_verse_id: startVerseId,
        end_verse_id: endVerseId,
        citation,
        translation_code: translationCode,
        text,
      }),
    });
    const topic = theologyTopics.find((item) => item.id === theologyTopicId);
    setStatus(`Range linked to ${topic?.title ?? "Theology"}`);
  };

  return (
    <div
      data-testid="range-action-bar"
      className="surface-panel sticky bottom-4 z-20 mt-6 rounded-lg px-4 py-3 space-y-3"
    >
      <div className="flex flex-wrap items-center gap-2">
        <div className="min-w-48 flex-1 mr-auto">
          <p className="text-sm text-neutral-100">{citation}</p>
          <p className="text-xs text-neutral-500">
            {verses.length} verse{verses.length === 1 ? "" : "s"} selected
          </p>
        </div>
        <button
          type="button"
          onClick={() => navigator.clipboard.writeText(`${citation} (${translationCode})\n${text}`)}
            className="btn-secondary px-2 py-1 text-xs"
        >
          Copy
        </button>
        {onAskCouncilAboutVerse && (
          <button
            type="button"
            onClick={() => onAskCouncilAboutVerse(startVerseId, citation)}
            className="btn-primary px-2 py-1 text-xs"
          >
            Council
          </button>
        )}
        <AddToWorkspaceMenu
          kind="verse_range"
          title={citation}
          buttonLabel="Add"
          triggerTestId="add-range-to-workspace"
          menuPlacement="top"
          payload={{
            start_verse_id: startVerseId,
            end_verse_id: endVerseId,
            citation,
            translation_code: translationCode,
            text,
          }}
        />
        {theologyTopics.length > 0 && (
          <>
            <select
              value={theologyTopicId ?? ""}
              onChange={(e) => setTheologyTopicId(Number(e.target.value) || null)}
              aria-label="Theology topic for selected range"
              className="settings-input h-7 max-w-44 text-xs"
            >
              {theologyTopics.map((topic) => (
                <option key={topic.id} value={topic.id}>
                  {topic.title}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={addRangeToTheology}
              disabled={!theologyTopicId}
              className="btn-secondary px-2 py-1 text-xs"
            >
              Add range to Theology
            </button>
          </>
        )}
        <button
          type="button"
          onClick={bookmarkRange}
          disabled={busy}
          className="btn-secondary px-2 py-1 text-xs disabled:opacity-50"
        >
          Bookmark
        </button>
        <button
          type="button"
          onClick={() => setNoteOpen((v) => !v)}
          className="btn-secondary px-2 py-1 text-xs"
        >
          Note
        </button>
        <button
          type="button"
          onClick={explainRange}
          disabled={explaining}
          className="btn-secondary px-2 py-1 text-xs disabled:opacity-50"
        >
          {explaining ? "Explaining..." : "Explain"}
        </button>
        <button
          type="button"
          onClick={onClear}
          className="btn-ghost px-2 py-1 text-xs"
        >
          Clear
        </button>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-xs text-neutral-500">Highlight</span>
        {RANGE_HIGHLIGHT_COLORS.map((c) => (
          <button
            key={c.value}
            type="button"
            onClick={() => setRangeColor(c.value)}
            disabled={busy}
            aria-label={`Highlight range ${c.name}`}
            className="w-5 h-5 rounded-full border border-neutral-700 hover:scale-110 transition-transform disabled:opacity-50"
            style={{ backgroundColor: c.value }}
          />
        ))}
        <button
          type="button"
          onClick={clearRangeColor}
          disabled={busy}
          className="px-2 py-1 text-xs text-neutral-500 hover:text-neutral-200 disabled:opacity-50"
        >
          Clear highlight
        </button>
        {status && <span className="text-xs text-emerald-300">{status}</span>}
      </div>
      {noteOpen && (
        <div className="space-y-2">
          <textarea
            aria-label={`Range note for ${citation}`}
            value={noteBody}
            onChange={(e) => setNoteBody(e.target.value)}
            onBlur={saveRangeNote}
            rows={3}
            placeholder="Add a note for this range..."
            className="w-full bg-neutral-900 border border-neutral-800 rounded px-3 py-2 text-sm text-neutral-100 placeholder:text-neutral-500 focus:outline-none focus:border-amber-500/50 resize-y"
          />
          <div className="flex items-center justify-between">
            <span className="text-xs text-neutral-500">
              {busy ? "Saving..." : "Auto-saves on blur"}
            </span>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={saveRangeNote}
                disabled={busy}
                className="text-xs text-amber-300 hover:text-amber-200 disabled:opacity-50"
              >
                Save note
              </button>
              <button
                type="button"
                onClick={async () => {
                  setNoteBody("");
                  await deleteRangeNote(startVerseId, endVerseId);
                  onChanged();
                  setStatus("Range note cleared");
                }}
                disabled={busy}
                className="text-xs text-red-400/80 hover:text-red-300 disabled:opacity-50"
              >
                Delete note
              </button>
            </div>
          </div>
        </div>
      )}
      {moduleEntries.length > 0 && (
        <section className="border-t border-neutral-800 pt-3" data-testid="range-module-results">
          <h4 className="text-sm uppercase tracking-wider text-neutral-400 mb-2">
            Modules
          </h4>
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
                    menuPlacement="top"
                    triggerTestId="add-range-module-to-workspace"
                    payload={{
                      start_verse_id: startVerseId,
                      end_verse_id: endVerseId,
                      citation,
                      translation_code: translationCode,
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
      {explanation && (
        <section className="border-t border-neutral-800 pt-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h4 className="text-sm font-semibold text-neutral-100">
                Explanation: {explanation.citation}
              </h4>
              <p className="text-sm text-neutral-300 mt-2">{explanation.summary}</p>
              <p className="text-xs text-neutral-500 mt-2">{explanation.context}</p>
            </div>
            <AddToWorkspaceMenu
              kind="explanation"
              title={`Explanation: ${citation}`}
              buttonLabel="Add"
              payload={{
                ...explanation,
                start_verse_id: startVerseId,
                end_verse_id: endVerseId,
                citation,
                translation_code: translationCode,
              }}
            />
          </div>
        </section>
      )}
    </div>
  );
}
