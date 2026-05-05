import { useEffect, useMemo, useState } from "react";
import type { SearchHit } from "../../lib/bible";
import { AddToWorkspaceMenu } from "../workspaces/AddToWorkspaceMenu";

interface Props {
  query: string;
  results: SearchHit[];
  loading: boolean;
  onSelect: (hit: SearchHit) => void;
  onSaveSearch?: () => void;
}

export function SearchResults({ query, results, loading, onSelect, onSaveSearch }: Props) {
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const selectedHits = useMemo(
    () => results.filter((hit) => selectedKeys.has(searchHitKey(hit))),
    [results, selectedKeys],
  );

  useEffect(() => {
    setSelectedKeys(new Set());
  }, [query]);

  const toggleSelected = (hit: SearchHit) => {
    const key = searchHitKey(hit);
    setSelectedKeys((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  return (
    <div className="max-w-3xl mx-auto px-6 py-6">
      <header className="mb-4 border-b border-neutral-800 pb-3 flex items-baseline justify-between">
        <h2 className="text-xl font-semibold text-neutral-100">
          Search: <span className="text-amber-300">{query}</span>
        </h2>
        <div className="flex items-center gap-3">
          <span className="text-xs text-neutral-500">
            {loading ? "searching…" : `${results.length} result${results.length === 1 ? "" : "s"}`}
          </span>
          {selectedHits.length > 0 && (
            <>
              <span className="text-xs text-neutral-500">
                {selectedHits.length} selected
              </span>
              <AddToWorkspaceMenu
                kind="search"
                title={`Selected results: ${query}`}
                buttonLabel="Add selected"
                triggerTestId="add-selected-search-results-to-workspace"
                payload={{
                  query,
                  result_count: selectedHits.length,
                  selected_results: selectedHits.map((hit) => ({
                    verse_id: hit.verse_id,
                    citation: `${hit.book_name} ${hit.chapter}:${hit.verse}`,
                    translation_code: hit.translation_code,
                    book_id: hit.book_id,
                    chapter: hit.chapter,
                    verse: hit.verse,
                    text: hit.text,
                    snippet: hit.snippet,
                  })),
                }}
              />
            </>
          )}
          {onSaveSearch && (
            <button
              type="button"
              onClick={onSaveSearch}
              className="px-2 py-1 text-xs rounded border border-neutral-800 hover:border-neutral-700 text-neutral-300"
            >
              Save
            </button>
          )}
          <AddToWorkspaceMenu
            kind="search"
            title={`Search: ${query}`}
            buttonLabel="Add"
            triggerTestId="add-search-to-workspace"
            payload={{
              query,
              result_count: results.length,
              top_results: results.slice(0, 10).map((hit) => ({
                verse_id: hit.verse_id,
                citation: `${hit.book_name} ${hit.chapter}:${hit.verse}`,
                translation_code: hit.translation_code,
                snippet: hit.snippet,
              })),
            }}
          />
        </div>
      </header>

      {!loading && results.length === 0 ? (
        <p className="text-neutral-500 italic">No matches.</p>
      ) : (
        <ul className="divide-y divide-neutral-800">
          {results.map((hit) => (
            <li key={searchHitKey(hit)}>
              <div className="py-3 hover:bg-neutral-900/60 rounded px-2 transition-colors">
                <div className="flex items-start justify-between gap-3">
                  <input
                    type="checkbox"
                    aria-label={`Select ${hit.book_name} ${hit.chapter}:${hit.verse}`}
                    checked={selectedKeys.has(searchHitKey(hit))}
                    onChange={() => toggleSelected(hit)}
                    className="mt-1"
                  />
                  <button
                    type="button"
                    onClick={() => onSelect(hit)}
                    data-testid="search-result"
                    className="flex-1 text-left"
                  >
                    <div className="flex items-baseline gap-2 text-xs text-neutral-400 mb-1">
                      <span className="font-mono">{hit.translation_code}</span>
                      <span className="text-neutral-600">·</span>
                      <span>
                        {hit.book_name} {hit.chapter}:{hit.verse}
                      </span>
                    </div>
                    <p
                      className="text-neutral-200 text-sm leading-relaxed"
                      style={{ fontFamily: "var(--font-serif)" }}
                      dangerouslySetInnerHTML={{ __html: hit.snippet }}
                    />
                  </button>
                  <AddToWorkspaceMenu
                    kind="search_hit"
                    title={`${hit.book_name} ${hit.chapter}:${hit.verse}`}
                    buttonLabel="Add"
                    triggerTestId="add-search-hit-to-workspace"
                    payload={{
                      query,
                      verse_id: hit.verse_id,
                      citation: `${hit.book_name} ${hit.chapter}:${hit.verse}`,
                      translation_code: hit.translation_code,
                      book_id: hit.book_id,
                      chapter: hit.chapter,
                      verse: hit.verse,
                      text: hit.text,
                      snippet: hit.snippet,
                    }}
                  />
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function searchHitKey(hit: SearchHit) {
  return `${hit.translation_code}-${hit.verse_id}`;
}
