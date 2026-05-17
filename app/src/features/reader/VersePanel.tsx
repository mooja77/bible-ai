import { useEffect, useState } from "react";
import {
  deleteHighlight,
  deleteNote,
  getCrossRefs,
  getNote,
  addBookmark,
  createTheologyLink,
  explainPassage,
  listModuleEntriesForVerse,
  listTheologyTopics,
  upsertHighlight,
  upsertNote,
  type ModuleEntry,
  type PassageExplanation,
  type CrossRef,
  type TheologyTopic,
} from "../../lib/bible";
import { AddToWorkspaceMenu } from "../workspaces/AddToWorkspaceMenu";

type Tab = "refs" | "highlight" | "note";

interface Props {
  verseId: number;
  bookName: string;
  chapter: number;
  verse: number;
  verseText: string;
  translationCode: string;
  /** Current highlight colour for this verse, or null/undefined if none. */
  highlightColor?: string | null;
  onJumpToVerse: (verseId: number, translationCode: string) => void;
  onClose: () => void;
  /** Called after any highlight or note mutation so the parent can refetch. */
  onMutated: () => void;
  /** Optional handler so the panel can trigger an "ask the council" with a
   *  pre-filled question about this verse. */
  onAskCouncilAboutVerse?: (verseId: number, citation: string) => void;
}

const HIGHLIGHT_COLORS = [
  { name: "Yellow", value: "#fbbf24" },
  { name: "Green", value: "#34d399" },
  { name: "Blue", value: "#60a5fa" },
  { name: "Pink", value: "#f472b6" },
];

export function VersePanel({
  verseId,
  bookName,
  chapter,
  verse,
  verseText,
  translationCode,
  highlightColor,
  onJumpToVerse,
  onClose,
  onMutated,
  onAskCouncilAboutVerse,
}: Props) {
  const [tab, setTab] = useState<Tab>("refs");
  const [bookmarked, setBookmarked] = useState(false);
  const [bookmarkLabel, setBookmarkLabel] = useState("");
  const [explanation, setExplanation] = useState<PassageExplanation | null>(null);
  const [explaining, setExplaining] = useState(false);
  const [moduleEntries, setModuleEntries] = useState<ModuleEntry[]>([]);
  const [theologyTopics, setTheologyTopics] = useState<TheologyTopic[]>([]);
  const [theologyTopicId, setTheologyTopicId] = useState<number | null>(null);
  const [theologyLinkStatus, setTheologyLinkStatus] = useState("");
  const citation = `${bookName} ${chapter}:${verse}`;

  useEffect(() => {
    listModuleEntriesForVerse(verseId)
      .then(setModuleEntries)
      .catch(() => setModuleEntries([]));
  }, [verseId]);

  useEffect(() => {
    listTheologyTopics()
      .then((topics) => {
        setTheologyTopics(topics);
        setTheologyTopicId((current) => current ?? topics[0]?.id ?? null);
      })
      .catch(() => setTheologyTopics([]));
  }, []);

  const addVerseToTheology = async () => {
    if (!theologyTopicId) return;
    setTheologyLinkStatus("Saving...");
    try {
      await createTheologyLink({
        topic_id: theologyTopicId,
        link_kind: "verse",
        target_id: verseId,
        title: citation,
        payload_json: JSON.stringify({
          verse_id: verseId,
          citation,
          translation_code: translationCode,
          text: verseText,
        }),
      });
      const topic = theologyTopics.find((item) => item.id === theologyTopicId);
      setTheologyLinkStatus(`Linked to ${topic?.title ?? "Theology"}`);
    } catch (e) {
      setTheologyLinkStatus(String(e));
    }
  };

  return (
    <aside className="soft-card px-6 py-4 mt-6">
      <header className="flex items-baseline justify-between mb-3">
        <h3 className="text-sm tracking-wider text-neutral-400">
          Verse <span className="text-amber-300">{citation}</span>
        </h3>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close verse panel"
          className="text-neutral-500 hover:text-neutral-200 text-sm"
        >
          ×
        </button>
      </header>

      <div className="flex flex-wrap gap-1 mb-3 border-b border-neutral-800">
        <TabButton label="Cross-refs" active={tab === "refs"} onClick={() => setTab("refs")} />
        <TabButton label="Highlight" active={tab === "highlight"} onClick={() => setTab("highlight")} />
        <TabButton label="Note" active={tab === "note"} onClick={() => setTab("note")} />
        {onAskCouncilAboutVerse && (
          <button
            type="button"
            onClick={() => onAskCouncilAboutVerse(verseId, citation)}
            className="px-2 py-1 text-xs text-amber-300 hover:bg-neutral-900 rounded"
          >
            Ask the Council →
          </button>
        )}
        <input
          aria-label="Bookmark label"
          value={bookmarkLabel}
          onChange={(e) => setBookmarkLabel(e.target.value)}
          placeholder="Bookmark label"
          className="settings-input h-7 max-w-40 text-xs"
        />
        <button
          type="button"
          onClick={async () => {
            await addBookmark(verseId, null, bookmarkLabel.trim() || citation);
            setBookmarked(true);
            onMutated();
          }}
          className="px-2 py-1 text-xs text-neutral-300 hover:bg-neutral-900 rounded"
        >
          {bookmarked ? "Bookmarked" : "Bookmark"}
        </button>
        <button
          type="button"
          onClick={async () => {
            setExplaining(true);
            try {
              setExplanation(await explainPassage(translationCode, verseId));
            } finally {
              setExplaining(false);
            }
          }}
          data-testid="explain-verse"
          className="px-2 py-1 text-xs text-neutral-300 hover:bg-neutral-900 rounded"
        >
          {explaining ? "Explaining..." : "Explain"}
        </button>
        <AddToWorkspaceMenu
          kind="verse"
          title={citation}
          buttonLabel="Add"
          payload={{
            verse_id: verseId,
            citation,
            translation_code: translationCode,
            text: verseText,
          }}
        />
        {theologyTopics.length > 0 && (
          <>
            <select
              value={theologyTopicId ?? ""}
              onChange={(e) => setTheologyTopicId(Number(e.target.value))}
              aria-label="Theology topic for selected verse"
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
              onClick={addVerseToTheology}
              disabled={!theologyTopicId}
              className="px-2 py-1 text-xs text-neutral-300 hover:bg-neutral-900 rounded"
            >
              Add to Theology
            </button>
          </>
        )}
      </div>
      {theologyLinkStatus && (
        <p className="mb-3 text-xs text-neutral-500">{theologyLinkStatus}</p>
      )}

      {tab === "refs" && <CrossRefsTab verseId={verseId} onJumpToVerse={onJumpToVerse} />}
      {tab === "highlight" && (
        <HighlightTab
          verseId={verseId}
          current={highlightColor}
          onChanged={onMutated}
        />
      )}
      {tab === "note" && <NoteTab verseId={verseId} onChanged={onMutated} />}
      {moduleEntries.length > 0 && (
        <section className="mt-4 border-t border-neutral-800 pt-3">
          <h4 className="text-sm tracking-wider text-neutral-400 mb-2">
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
                    payload={{
                      verse_id: verseId,
                      citation,
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
        <section className="mt-4 border-t border-neutral-800 pt-3">
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
                verse_id: verseId,
                citation,
                translation_code: translationCode,
              }}
            />
          </div>
        </section>
      )}
    </aside>
  );
}

function TabButton({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "px-3 py-1.5 text-xs border-b-2 transition-colors " +
        (active
          ? "border-amber-500 text-amber-200"
          : "border-transparent text-neutral-400 hover:text-neutral-200")
      }
    >
      {label}
    </button>
  );
}

function CrossRefsTab({
  verseId,
  onJumpToVerse,
}: {
  verseId: number;
  onJumpToVerse: (verseId: number, translationCode: string) => void;
}) {
  const [refs, setRefs] = useState<CrossRef[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setRefs(null);
    setError(null);
    getCrossRefs(verseId, "KJV", 20)
      .then(setRefs)
      .catch((e) => setError(String(e)));
  }, [verseId]);

  if (error) return <p className="text-red-400 text-sm">{error}</p>;
  if (refs === null) return <p className="text-neutral-500 italic text-sm">Loading…</p>;
  if (refs.length === 0)
    return <p className="text-neutral-500 italic text-sm">No cross-references.</p>;

  return (
    <ul className="space-y-1.5 max-h-[60vh] overflow-y-auto pr-2">
      {refs.map((r) => (
        <li key={`${r.from_verse_id}-${r.to_verse_id}-${r.source}`}>
          <button
            type="button"
            onClick={() => onJumpToVerse(r.to_verse_id, "KJV")}
            className="w-full text-left text-sm hover:bg-neutral-900/60 rounded px-2 py-1 transition-colors"
          >
            <span className="font-mono text-xs text-amber-300 mr-2">
              {r.book_name} {r.chapter}:{r.verse}
            </span>
            <span
              className="text-neutral-300"
              style={{ fontFamily: "var(--font-serif)" }}
            >
              {r.text || "(verse not in this translation)"}
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}

function HighlightTab({
  verseId,
  current,
  onChanged,
}: {
  verseId: number;
  current?: string | null;
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState(false);

  const setColor = async (color: string) => {
    if (busy) return;
    setBusy(true);
    try {
      await upsertHighlight(verseId, color);
      onChanged();
    } finally {
      setBusy(false);
    }
  };

  const clear = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await deleteHighlight(verseId);
      onChanged();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex items-center gap-3 py-2">
      {HIGHLIGHT_COLORS.map((c) => {
        const isCurrent = current === c.value;
        return (
          <button
            key={c.value}
            type="button"
            onClick={() => setColor(c.value)}
            disabled={busy}
            aria-label={`Highlight ${c.name}`}
            className={
              "w-8 h-8 rounded-full border-2 transition-transform " +
              (isCurrent ? "border-white scale-110" : "border-neutral-700 hover:scale-105")
            }
            style={{ backgroundColor: c.value }}
          />
        );
      })}
      {current && (
        <button
          type="button"
          onClick={clear}
          disabled={busy}
          className="ml-auto px-3 py-1 rounded text-xs text-neutral-400 hover:text-neutral-200 hover:bg-neutral-900"
        >
          Clear highlight
        </button>
      )}
    </div>
  );
}

function NoteTab({
  verseId,
  onChanged,
}: {
  verseId: number;
  onChanged: () => void;
}) {
  const [body, setBody] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [savedTick, setSavedTick] = useState(0);

  useEffect(() => {
    setLoaded(false);
    getNote(verseId)
      .then((n) => {
        setBody(n?.body ?? "");
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, [verseId]);

  const save = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const trimmed = body.trim();
      if (trimmed.length === 0) {
        await deleteNote(verseId);
      } else {
        await upsertNote(verseId, trimmed);
      }
      onChanged();
      setSavedTick((t) => t + 1);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-2 py-1">
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        onBlur={save}
        placeholder={loaded ? "Add a note for this verse…" : "Loading…"}
        disabled={!loaded}
        rows={4}
        className="w-full bg-neutral-900 border border-neutral-800 rounded px-3 py-2 text-sm text-neutral-100 placeholder:text-neutral-500 focus:outline-none focus:border-amber-500/50 resize-y"
      />
      <div className="flex items-center justify-between text-xs text-neutral-500">
        <span>{busy ? "Saving…" : savedTick > 0 ? "Saved ✓" : "Auto-saves on blur"}</span>
        {body && (
          <button
            type="button"
            onClick={async () => {
              setBody("");
              await deleteNote(verseId);
              onChanged();
            }}
            disabled={busy}
            className="text-red-400/80 hover:text-red-300"
          >
            Delete note
          </button>
        )}
      </div>
    </div>
  );
}
