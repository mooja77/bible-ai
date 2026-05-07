import { useEffect, useMemo, useState } from "react";
import {
  createTheologyLink,
  listTheologyTopics,
  type SearchHit,
  type TheologyTopic,
} from "../../lib/bible";
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
  const [theologyTopics, setTheologyTopics] = useState<TheologyTopic[]>([]);
  const [theologyTopicId, setTheologyTopicId] = useState<number | null>(null);
  const [theologyStatus, setTheologyStatus] = useState("");
  const selectedHits = useMemo(
    () => results.filter((hit) => selectedKeys.has(searchHitKey(hit))),
    [results, selectedKeys],
  );

  useEffect(() => {
    listTheologyTopics()
      .then((topics) => {
        setTheologyTopics(topics);
        setTheologyTopicId((current) => current ?? topics[0]?.id ?? null);
      })
      .catch(() => setTheologyTopics([]));
  }, []);

  useEffect(() => {
    setSelectedKeys(new Set());
    setTheologyStatus("");
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

  const linkSelectedToTheology = async () => {
    if (!theologyTopicId || selectedHits.length === 0) return;
    setTheologyStatus("Linking...");
    try {
      await Promise.all(
        selectedHits.map((hit) => {
          const citation = `${hit.book_name} ${hit.chapter}:${hit.verse}`;
          return createTheologyLink({
            topic_id: theologyTopicId,
            link_kind: "verse",
            target_id: hit.verse_id,
            title: `Search: ${query} - ${citation}`,
            payload_json: JSON.stringify({
              source: "search",
              query,
              verse_id: hit.verse_id,
              citation,
              translation_code: hit.translation_code,
              book_id: hit.book_id,
              chapter: hit.chapter,
              verse: hit.verse,
              text: hit.text,
              snippet: hit.snippet,
            }),
          });
        }),
      );
      const topic = theologyTopics.find((item) => item.id === theologyTopicId);
      setTheologyStatus(
        `Linked ${selectedHits.length} search result${selectedHits.length === 1 ? "" : "s"} to ${
          topic?.title ?? "Theology"
        }.`,
      );
    } catch (e) {
      setTheologyStatus(String(e));
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-6 py-6">
      <header className="surface-panel rounded-lg px-4 py-3 mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wider text-neutral-500">Search</p>
          <h2 className="text-xl font-semibold text-neutral-100">
            Search: <span className="text-amber-300">{query}</span>
          </h2>
        </div>
        <div className="flex flex-wrap items-center gap-3">
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
              {theologyTopics.length > 0 && (
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    value={theologyTopicId ?? ""}
                    onChange={(e) => setTheologyTopicId(Number(e.target.value) || null)}
                    className="settings-input text-xs w-36"
                    aria-label="Search theology topic"
                  >
                    {theologyTopics.map((topic) => (
                      <option key={topic.id} value={topic.id}>
                        {topic.title}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={linkSelectedToTheology}
                    disabled={!theologyTopicId}
                    className="btn-secondary px-2 py-1 text-xs"
                    data-testid="link-selected-search-results-to-theology"
                  >
                    Link to Theology
                  </button>
                </div>
              )}
            </>
          )}
          {onSaveSearch && (
            <button
              type="button"
              onClick={onSaveSearch}
              className="btn-secondary px-2 py-1 text-xs"
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
        {theologyStatus && (
          <p className="basis-full text-xs text-neutral-400" data-testid="search-theology-status">
            {theologyStatus}
          </p>
        )}
      </header>

      {!loading && results.length === 0 ? (
        <div className="soft-card px-4 py-5 text-sm text-neutral-500">
          No matches. Try a shorter phrase, another translation, or a broader testament/book filter.
        </div>
      ) : (
        <ul className="space-y-2">
          {results.map((hit) => (
            <li key={searchHitKey(hit)}>
              <div className="soft-card soft-card-hover px-3 py-3">
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
                    className="flex-1 text-left min-w-0"
                  >
                    <div className="flex flex-wrap items-baseline gap-2 text-xs text-neutral-400 mb-1">
                      <span className="meta-pill font-mono">{hit.translation_code}</span>
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
