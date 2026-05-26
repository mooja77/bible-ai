import { useState } from "react";
import type {
  Book,
  Bookmark,
  ReadingHistoryItem,
  SavedSearch,
  StudyWorkspaceSummary,
  Tag,
  ItemTag,
} from "../../lib/bible";
import { TagFilterBar, ItemTagRow } from "../tags/TagControls";
import { formatVerseId } from "../../lib/verse";

export function NavigationShortcuts({
  books,
  bookmarks,
  history,
  savedSearches,
  workspaces,
  onJumpToVerse,
  onJumpToChapter,
  onRunSavedSearch,
  onRenameSavedSearch,
  onDeleteSavedSearch,
  onOpenWorkspace,
  tags,
  bookmarkTags,
  bookmarkTagFilter,
  onSetBookmarkTagFilter,
  onAttachBookmarkTag,
  onDetachBookmarkTag,
}: {
  books: Book[];
  bookmarks: Bookmark[];
  history: ReadingHistoryItem[];
  savedSearches: SavedSearch[];
  workspaces: StudyWorkspaceSummary[];
  onJumpToVerse: (verseId: number, translationCode: string) => void;
  onJumpToChapter: (bookId: number, chapter: number, translationCodes: string) => void;
  onRunSavedSearch: (search: SavedSearch) => void;
  onRenameSavedSearch: (search: SavedSearch, title: string) => Promise<void> | void;
  onDeleteSavedSearch: (search: SavedSearch) => Promise<void> | void;
  onOpenWorkspace: (workspaceId: number) => void;
  tags: Tag[];
  bookmarkTags: ItemTag[];
  bookmarkTagFilter: number | null;
  onSetBookmarkTagFilter: (id: number | null) => void;
  onAttachBookmarkTag: (bookmarkId: number, name: string) => void;
  onDetachBookmarkTag: (bookmarkId: number, tagId: number) => void;
}) {
  const [editingSavedSearchId, setEditingSavedSearchId] = useState<number | null>(null);
  const [editingSavedSearchTitle, setEditingSavedSearchTitle] = useState("");
  const [savedSearchBusyId, setSavedSearchBusyId] = useState<number | null>(null);

  const beginSavedSearchEdit = (search: SavedSearch) => {
    setEditingSavedSearchId(search.id);
    setEditingSavedSearchTitle(search.title);
  };

  const saveSavedSearchTitle = async (search: SavedSearch) => {
    const title = editingSavedSearchTitle.trim();
    if (!title) return;
    setSavedSearchBusyId(search.id);
    try {
      await onRenameSavedSearch(search, title);
      setEditingSavedSearchId(null);
      setEditingSavedSearchTitle("");
    } finally {
      setSavedSearchBusyId(null);
    }
  };

  return (
    <div className="mt-6 space-y-5">
      {bookmarks.length > 0 && (
        <section>
          <h3 className="text-xs tracking-wider text-neutral-500 mb-2">Bookmarks</h3>
          <TagFilterBar
            allTags={tags}
            selectedTagId={bookmarkTagFilter}
            onSelect={onSetBookmarkTagFilter}
          />
          <ul className="space-y-1">
            {bookmarks
              .filter(
                (b) =>
                  bookmarkTagFilter === null ||
                  bookmarkTags.some(
                    (it) => it.item_id === b.id && it.tag_id === bookmarkTagFilter,
                  ),
              )
              .slice(0, 8)
              .map((b) => (
                <li key={b.id}>
                  <button
                    type="button"
                    onClick={() => onJumpToVerse(b.verse_id, "KJV")}
                    className="w-full text-left text-xs text-neutral-300 hover:text-amber-200 truncate"
                  >
                    {b.label ?? formatVerseId(b.verse_id, books)}
                  </button>
                  <ItemTagRow
                    testIdPrefix="bookmark"
                    tags={bookmarkTags.filter((it) => it.item_id === b.id)}
                    allTags={tags}
                    onAttach={(name) => onAttachBookmarkTag(b.id, name)}
                    onDetach={(tagId) => onDetachBookmarkTag(b.id, tagId)}
                  />
                </li>
              ))}
          </ul>
        </section>
      )}
      {history.length > 0 && (
        <section>
          <h3 className="text-xs tracking-wider text-neutral-500 mb-2">Recent</h3>
          <ul className="space-y-1">
            {history.map((h) => {
              const book = books.find((b) => b.id === h.book_id);
              return (
                <li key={h.id}>
                  <button
                    type="button"
                    onClick={() => onJumpToChapter(h.book_id, h.chapter, h.translation_codes)}
                    className="w-full text-left text-xs text-neutral-400 hover:text-neutral-200 truncate"
                  >
                    {book?.name ?? `Book ${h.book_id}`} {h.chapter}
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      )}
      {savedSearches.length > 0 && (
        <section>
          <h3 className="text-xs tracking-wider text-neutral-500 mb-2">
            Saved Searches
          </h3>
          <ul className="space-y-1">
            {savedSearches.slice(0, 8).map((s) => (
              <li key={s.id}>
                {editingSavedSearchId === s.id ? (
                  <div className="space-y-1">
                    <input
                      aria-label={`Saved search title: ${s.title}`}
                      value={editingSavedSearchTitle}
                      onChange={(e) => setEditingSavedSearchTitle(e.target.value)}
                      className="settings-input text-xs"
                    />
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        aria-label={`Save saved search ${s.title}`}
                        onClick={() => void saveSavedSearchTitle(s)}
                        disabled={!editingSavedSearchTitle.trim() || savedSearchBusyId === s.id}
                        className="text-xs text-amber-300 hover:text-amber-200 disabled:text-neutral-600"
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        aria-label={`Cancel saved search rename ${s.title}`}
                        onClick={() => {
                          setEditingSavedSearchId(null);
                          setEditingSavedSearchTitle("");
                        }}
                        className="text-xs text-neutral-500 hover:text-neutral-300"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => onRunSavedSearch(s)}
                      className="min-w-0 flex-1 text-left text-xs text-neutral-400 hover:text-amber-200 truncate"
                    >
                      {s.title}
                    </button>
                    <button
                      type="button"
                      aria-label={`Rename saved search ${s.title}`}
                      onClick={() => beginSavedSearchEdit(s)}
                      className="shrink-0 text-xs text-neutral-600 hover:text-neutral-300"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      aria-label={`Delete saved search ${s.title}`}
                      onClick={async () => {
                        setSavedSearchBusyId(s.id);
                        try {
                          await onDeleteSavedSearch(s);
                        } finally {
                          setSavedSearchBusyId(null);
                        }
                      }}
                      disabled={savedSearchBusyId === s.id}
                      className="shrink-0 text-xs text-neutral-600 hover:text-red-300 disabled:text-neutral-700"
                    >
                      Del
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
      {workspaces.length > 0 && (
        <section>
          <h3 className="text-xs tracking-wider text-neutral-500 mb-2">
            Workspaces
          </h3>
          <ul className="space-y-1">
            {workspaces.slice(0, 8).map((w) => (
              <li key={w.id}>
                <button
                  type="button"
                  onClick={() => onOpenWorkspace(w.id)}
                  className="w-full text-left text-xs text-neutral-400 hover:text-amber-200 truncate"
                >
                  {w.title}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
