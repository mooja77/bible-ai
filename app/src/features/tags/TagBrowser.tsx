import { useEffect, useState } from "react";
import {
  listTagsWithCounts,
  listTaggedItems,
  type TagCount,
  type TaggedItem,
} from "../../lib/bible";

export function TagBrowser({ onJumpToVerse }: { onJumpToVerse: (verseId: number) => void }) {
  const [tagCounts, setTagCounts] = useState<TagCount[]>([]);
  const [selectedTagId, setSelectedTagId] = useState<number | null>(null);
  const [items, setItems] = useState<TaggedItem[]>([]);
  const [loadingItems, setLoadingItems] = useState(false);

  useEffect(() => {
    listTagsWithCounts()
      .then(setTagCounts)
      .catch(() => setTagCounts([]));
  }, []);

  useEffect(() => {
    if (selectedTagId === null) {
      setItems([]);
      return;
    }
    let cancelled = false;
    setLoadingItems(true);
    listTaggedItems(selectedTagId)
      .then((rows) => {
        if (!cancelled) setItems(rows);
      })
      .catch(() => {
        if (!cancelled) setItems([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingItems(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedTagId]);

  return (
    <div className="max-w-4xl mx-auto px-6 py-6" data-testid="tag-browser">
      <header className="editorial-page-header mb-6">
        <span className="section-kicker">Study organization</span>
        <h1>Tags</h1>
      </header>

      {tagCounts.length === 0 ? (
        <div className="soft-card px-4 py-5 text-sm text-neutral-500">
          No tags yet. Tag bookmarks (sidebar) or verse notes (the Note tab) to organize them here.
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-[14rem_1fr]">
          <nav className="space-y-1" aria-label="Tags">
            {tagCounts.map((t) => (
              <button
                key={t.id}
                type="button"
                data-testid="tag-browser-tag"
                onClick={() => setSelectedTagId(t.id)}
                aria-pressed={selectedTagId === t.id}
                className={
                  "w-full flex items-center justify-between gap-2 px-2 py-1.5 rounded text-sm transition-colors " +
                  (selectedTagId === t.id ? "topic-pill-active" : "topic-pill-idle")
                }
              >
                <span className="truncate">{t.name}</span>
                <span className="text-xs text-neutral-500">{t.count}</span>
              </button>
            ))}
          </nav>

          <section>
            {selectedTagId === null ? (
              <div className="soft-card px-4 py-5 text-sm text-neutral-500">Select a tag.</div>
            ) : loadingItems ? (
              <p className="text-neutral-500 italic text-sm">Loading…</p>
            ) : items.length === 0 ? (
              <div className="soft-card px-4 py-5 text-sm text-neutral-500">
                No items with this tag.
              </div>
            ) : (
              <ul className="space-y-2">
                {items.map((item, i) => (
                  <li key={`${item.item_type}-${item.verse_id}-${i}`}>
                    <button
                      type="button"
                      data-testid="tag-browser-item"
                      onClick={() => onJumpToVerse(item.verse_id)}
                      className="soft-card soft-card-hover px-3 py-3 w-full text-left"
                    >
                      <div className="flex flex-wrap items-baseline gap-2 text-xs text-neutral-400 mb-1">
                        <span
                          className={
                            "meta-pill " +
                            (item.item_type === "bookmark"
                              ? "text-amber-300 border-amber-500/40"
                              : "text-emerald-300 border-emerald-500/40")
                          }
                        >
                          {item.item_type}
                        </span>
                        <span>{item.citation}</span>
                      </div>
                      {item.preview && (
                        <p className="text-neutral-300 text-sm leading-relaxed truncate">
                          {item.preview}
                        </p>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
