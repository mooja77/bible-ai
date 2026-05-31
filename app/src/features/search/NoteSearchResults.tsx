import type { NoteHit, ItemTag, Tag } from "../../lib/bible";
import { TagFilterBar } from "../tags/TagControls";

interface Props {
  query: string;
  results: NoteHit[];
  loading: boolean;
  onSelect: (hit: NoteHit) => void;
  noteTags: ItemTag[];
  selectedTagId: number | null;
  onSelectTag: (id: number | null) => void;
}

// Split text into chunks, marking case-insensitive occurrences of any token.
// Purely presentational (emits text/<mark> chunks, never raw HTML).
function highlightTokens(text: string, tokens: string[]) {
  const cleaned = tokens.map((t) => t.trim()).filter(Boolean);
  if (cleaned.length === 0) return [{ text, highlight: false }];
  const escaped = cleaned.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const splitter = new RegExp(`(${escaped.join("|")})`, "gi");
  const lowered = new Set(cleaned.map((t) => t.toLowerCase()));
  return text
    .split(splitter)
    .filter((part) => part.length > 0)
    .map((part) => ({ text: part, highlight: lowered.has(part.toLowerCase()) }));
}

export function NoteSearchResults({
  query,
  results,
  loading,
  onSelect,
  noteTags,
  selectedTagId,
  onSelectTag,
}: Props) {
  const tokens = query.trim().split(/\s+/).filter(Boolean);

  // Filter vocabulary = the distinct tags actually applied to notes.
  const filterTags: Tag[] = [];
  const seen = new Set<number>();
  for (const it of noteTags) {
    if (!seen.has(it.tag_id)) {
      seen.add(it.tag_id);
      filterTags.push({ id: it.tag_id, name: it.name, created_at: "" });
    }
  }

  const visible = results.filter(
    (hit) =>
      selectedTagId === null ||
      noteTags.some((it) => it.item_id === hit.verse_id && it.tag_id === selectedTagId),
  );

  return (
    <div className="max-w-4xl mx-auto px-6 py-6">
      <header className="surface-panel rounded-lg px-4 py-3 mb-4 flex items-center justify-between gap-3">
        <div>
          <p className="text-xs tracking-wider text-neutral-500">My notes</p>
          <h2 className="text-xl font-semibold text-neutral-100">
            Notes matching <span className="text-amber-300">{query}</span>
          </h2>
        </div>
        <span className="text-xs text-neutral-500">
          {loading ? "searching…" : `${visible.length} note${visible.length === 1 ? "" : "s"}`}
        </span>
      </header>

      <TagFilterBar allTags={filterTags} selectedTagId={selectedTagId} onSelect={onSelectTag} />

      {!loading && visible.length === 0 ? (
        <div className="soft-card px-4 py-5 text-sm text-neutral-500">
          {results.length === 0
            ? "No notes match. Try a different or shorter word."
            : "No notes match that tag."}
        </div>
      ) : (
        <ul className="space-y-2">
          {visible.map((hit) => {
            const chips = noteTags.filter((it) => it.item_id === hit.verse_id);
            return (
              <li key={`${hit.kind}-${hit.verse_id}-${hit.end_verse_id ?? ""}`}>
                <button
                  type="button"
                  onClick={() => onSelect(hit)}
                  data-testid="note-result"
                  className="soft-card soft-card-hover px-3 py-3 w-full text-left"
                >
                  <div className="flex flex-wrap items-baseline gap-2 text-xs text-neutral-400 mb-1">
                    <span className="meta-pill text-emerald-300 border-emerald-500/40">note</span>
                    <span>{hit.citation}</span>
                    {chips.map((c) => (
                      <span
                        key={c.tag_id}
                        data-testid="note-result-tag"
                        className="px-1.5 py-0.5 rounded text-[0.6875rem] bg-neutral-800 text-neutral-300"
                      >
                        {c.name}
                      </span>
                    ))}
                  </div>
                  <p className="text-neutral-200 text-sm leading-relaxed">
                    {highlightTokens(hit.body, tokens).map((chunk, i) =>
                      chunk.highlight ? <mark key={i}>{chunk.text}</mark> : <span key={i}>{chunk.text}</span>,
                    )}
                  </p>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
