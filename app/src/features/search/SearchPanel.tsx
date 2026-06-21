import { useEffect, useRef } from "react";
import { useFocusTrap } from "../../lib/useFocusTrap";
import type {
  Book,
  ItemTag,
  NoteHit,
  SearchHit,
  SearchStrategy,
  Translation,
} from "../../lib/bible";
import type { SearchTestamentFilter } from "../../App";
import { SearchInput } from "./SearchInput";
import { SearchScopeControl, type SearchScope } from "./SearchScopeControl";
import { SearchStrategyControl } from "./SearchStrategyControl";
import { SearchResults } from "./SearchResults";
import { NoteSearchResults } from "./NoteSearchResults";

interface Props {
  onClose: () => void;

  // Scope + query
  searchScope: SearchScope;
  setSearchScope: (value: SearchScope) => void;
  searchQuery: string;
  updateSearchQuery: (value: string) => void;
  searchActive: boolean;

  // Strategy (scripture)
  searchStrategy: SearchStrategy;
  onChangeSearchStrategy: (value: SearchStrategy) => void;

  // Filters (scripture)
  translations: Translation[];
  books: Book[];
  searchFilterTranslation: string;
  setSearchFilterTranslation: (value: string) => void;
  searchFilterTestament: SearchTestamentFilter;
  setSearchFilterTestament: (value: SearchTestamentFilter) => void;
  searchFilterBookId: number;
  setSearchFilterBookId: (value: number) => void;

  // Scripture results
  scriptureResults: SearchHit[];
  searchLoading: boolean;
  onSelectSearchHit: (hit: SearchHit) => void;
  searchDegraded: boolean;
  searchDegradedReason: string | null;
  onSaveSearch: () => void;

  // Note results
  noteResults: NoteHit[];
  noteLoading: boolean;
  onSelectNote: (hit: NoteHit) => void;
  noteTags: ItemTag[];
  noteTagFilter: number | null;
  setNoteTagFilter: (id: number | null) => void;
}

export function SearchPanel({
  onClose,
  searchScope,
  setSearchScope,
  searchQuery,
  updateSearchQuery,
  searchActive,
  searchStrategy,
  onChangeSearchStrategy,
  translations,
  books,
  searchFilterTranslation,
  setSearchFilterTranslation,
  searchFilterTestament,
  setSearchFilterTestament,
  searchFilterBookId,
  setSearchFilterBookId,
  scriptureResults,
  searchLoading,
  onSelectSearchHit,
  searchDegraded,
  searchDegradedReason,
  onSaveSearch,
  noteResults,
  noteLoading,
  onSelectNote,
  noteTags,
  noteTagFilter,
  setNoteTagFilter,
}: Props) {
  const rootRef = useRef<HTMLDivElement | null>(null);

  useFocusTrap(rootRef, true);

  // Auto-focus the search input on open.
  useEffect(() => {
    const input = rootRef.current?.querySelector<HTMLInputElement>('input[type="search"]');
    input?.focus();
  }, []);

  return (
    <div
      ref={rootRef}
      data-testid="search-panel"
      role="dialog"
      aria-modal="true"
      aria-label="Search"
      className="fixed inset-x-0 bottom-0 top-12 z-40 bg-black/60 flex items-start justify-center px-4 pt-4 pb-8 search-panel"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          onClose();
        }
      }}
    >
      <div className="surface-panel w-full max-w-4xl rounded-lg overflow-hidden flex flex-col max-h-full">
        <div className="p-4 border-b border-neutral-800 space-y-2 shrink-0">
          <SearchScopeControl value={searchScope} onChange={setSearchScope} />
          <SearchInput value={searchQuery} onChange={updateSearchQuery} />
          {searchScope === "scripture" && (
            <>
              <SearchStrategyControl
                value={searchStrategy}
                onChange={onChangeSearchStrategy}
              />
              {/* Labelled so these read as the search's scope, distinct from the
                  reader's translation picker and book navigation list. */}
              <p className="nav-section-title">Search in</p>
              <div className="grid grid-cols-2 gap-2">
                <select
                  value={searchFilterTranslation}
                  onChange={(e) => setSearchFilterTranslation(e.target.value)}
                  className="settings-input text-xs"
                  aria-label="Search translation"
                >
                  <option value="active">Active translation</option>
                  <option value="all">All translations</option>
                  {translations.map((t) => (
                    <option key={t.code} value={t.code}>
                      {t.code}
                    </option>
                  ))}
                </select>
                <select
                  value={searchFilterTestament}
                  onChange={(e) =>
                    setSearchFilterTestament(e.target.value as SearchTestamentFilter)
                  }
                  className="settings-input text-xs"
                  aria-label="Search testament"
                >
                  <option value="all">All testaments</option>
                  <option value="OT">Old Testament</option>
                  <option value="NT">New Testament</option>
                  <option value="DC">Deuterocanon</option>
                </select>
              </div>
              <select
                value={searchFilterBookId}
                onChange={(e) => setSearchFilterBookId(Number(e.target.value))}
                className="settings-input text-xs"
                aria-label="Search book"
              >
                <option value={0}>All books</option>
                {books.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </>
          )}
        </div>

        {searchActive && (
          <div className="flex-1 overflow-y-auto">
            {searchScope === "notes" ? (
              <NoteSearchResults
                query={searchQuery.trim()}
                results={noteResults}
                loading={noteLoading}
                onSelect={onSelectNote}
                noteTags={noteTags}
                selectedTagId={noteTagFilter}
                onSelectTag={setNoteTagFilter}
              />
            ) : (
              <SearchResults
                query={searchQuery.trim()}
                results={scriptureResults}
                loading={searchLoading}
                onSelect={onSelectSearchHit}
                degraded={searchDegraded}
                degradedReason={searchDegradedReason}
                onSaveSearch={onSaveSearch}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
