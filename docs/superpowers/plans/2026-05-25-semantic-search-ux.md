# Semantic Search in the Search Bar — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the search bar match by Keyword, Meaning, or Both, reusing the already-bundled semantic engine (124k verse embeddings + `db::semantic_search`), with graceful keyword fallback.

**Architecture:** Extend the existing `search` Tauri command — make it `async`, add a `strategy` argument, and return a `SearchResponse` (hits + which strategy actually ran + a degraded flag). Semantic/hybrid embed the query via Ollama and cosine-rank against the bundled embeddings, then merge with FTS. The frontend adds a strategy segmented control, per-result match badges, and a non-blocking "fell back to keyword" notice; the chosen strategy persists in `app_settings`.

**Tech Stack:** Rust (Tauri 2, rusqlite), React 19 + TypeScript, Tailwind v4, WebdriverIO e2e.

**Spec:** `docs/superpowers/specs/2026-05-25-semantic-search-ux-design.md`

**Verification note (read first):** This project has **Rust unit tests** (`cargo test`) and **WDIO e2e**, but **no frontend component unit-test runner**. So: Rust logic is built TDD-style with real `cargo test`; frontend tasks are verified by `npm run build` (the `tsc` type-check is the fast gate) and the end-to-end spec in Task 7. Don't look for a Jest/Vitest setup — there isn't one.

**Refinements over the spec (intentional):**
1. The command takes `ollama_host` + an already-resolved `translation_code` from the frontend instead of reading the user DB, keeping `search` decoupled from user-db state.
2. `SearchResultHit.snippet` is a non-optional `String` (empty for meaning-only hits) rather than `Option<String>`, so the existing `hit.snippet` reads in `SearchResults.tsx` keep working.

---

## File Structure

**Backend (`app/src-tauri/src/`)**
- `user_db.rs` — add `search_strategy` to `AppSettings`, `APP_SETTING_KEYS`, `get_app_settings`, `save_app_settings`. *(Task 1)*
- `lib.rs` — add `SearchResultHit` + `SearchResponse` structs, `merge_search_hits` helper, and rewrite `fn search` to async with strategy/merge/fallback. *(Task 2)*
- `db.rs` — **unchanged** (reuse `search`, `semantic_search`, `VerseSearchScope`).

**Frontend (`app/src/`)**
- `lib/bible.ts` — extend `SearchHit`, add `SearchStrategy` + `SearchResponse`, update the `search()` wrapper. *(Task 3)*
- `features/search/SearchStrategyControl.tsx` — **new** segmented control. *(Task 4)*
- `features/search/SearchResults.tsx` — match badges, meaning rendering, degraded notice. *(Task 5)*
- `App.tsx` — strategy state, settings sync/persist, consume `SearchResponse`, render control. *(Task 6)*

**Tests**
- `app/src-tauri/src/user_db.rs` `#[cfg(test)]` — settings round-trip. *(Task 1)*
- `app/src-tauri/src/lib.rs` `#[cfg(test)]` — `merge_search_hits` + strategy validation. *(Task 2)*
- `app/tests/e2e/search-semantic.spec.ts` — **new** fallback + persistence. *(Task 7)*

---

## Task 1: Persist the `search_strategy` setting

**Files:**
- Modify: `app/src-tauri/src/user_db.rs` (`APP_SETTING_KEYS` ~44, `AppSettings` ~569, `get_app_settings` ~616, `save_app_settings` ~639)
- Test: `app/src-tauri/src/user_db.rs` `#[cfg(test)]` module

- [ ] **Step 1: Write the failing test**

Add to the existing `#[cfg(test)]` tests in `user_db.rs` (near the other settings tests around line 4958):

```rust
#[test]
fn app_settings_round_trip_search_strategy() {
    let conn = Connection::open_in_memory().expect("open");
    apply_schema(&conn).expect("schema");
    let mut s = AppSettings::default();
    s.search_strategy = Some("hybrid".to_string());
    save_app_settings(&conn, &s).expect("save");
    let loaded = get_app_settings(&conn).expect("load");
    assert_eq!(loaded.search_strategy.as_deref(), Some("hybrid"));
}
```

(If the test helper to build the schema is named differently — check the other tests in this module and reuse the same setup call they use, e.g. `apply_schema`/`open_user_db_in_memory`.)

- [ ] **Step 2: Run test to verify it fails**

Run: `cd app && cargo test --manifest-path ./src-tauri/Cargo.toml app_settings_round_trip_search_strategy`
Expected: FAIL — `no field 'search_strategy' on type AppSettings`.

- [ ] **Step 3: Implement the field + plumbing**

In `APP_SETTING_KEYS` (line ~44), add `"search_strategy",` after `"sync_scroll",`.

In `struct AppSettings` (line ~586), add after `pub sync_scroll: Option<bool>,`:

```rust
    pub search_strategy: Option<String>,
```

In `get_app_settings` (line ~635), add inside the returned struct, after `sync_scroll,`:

```rust
        search_strategy: get_setting(conn, "search_strategy")?,
```

In `save_app_settings` (line ~666), add after the `sync_scroll` upsert:

```rust
    // Clamp to a known strategy; anything unknown persists as keyword.
    let search_strategy = settings
        .search_strategy
        .as_deref()
        .map(str::trim)
        .map(|v| match v {
            "semantic" | "hybrid" => v,
            _ => "keyword",
        });
    upsert_setting(conn, "search_strategy", search_strategy)?;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd app && cargo test --manifest-path ./src-tauri/Cargo.toml app_settings_round_trip_search_strategy`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/src-tauri/src/user_db.rs
git commit -m "feat(search): persist search_strategy app setting"
```

---

## Task 2: Backend `search` command — strategy, merge, graceful fallback

**Files:**
- Modify: `app/src-tauri/src/lib.rs` (`fn search` ~677; add structs + helper just above it)
- Test: `app/src-tauri/src/lib.rs` `#[cfg(test)]`

- [ ] **Step 1: Write the failing test for the pure merge helper**

Add a new test module near the end of `lib.rs` (after the last existing `#[cfg(test)]` block):

```rust
#[cfg(test)]
mod search_merge_tests {
    use super::{merge_search_hits, SearchResultHit};
    use crate::db::{SearchHit, SemanticHit};

    fn sem(verse_id: i64, score: f32) -> SemanticHit {
        SemanticHit {
            verse_id,
            translation_code: "KJV".into(),
            book_id: 1,
            book_name: "Genesis".into(),
            book_osis: "Gen".into(),
            chapter: 1,
            verse: verse_id,
            text: format!("verse {verse_id}"),
            score,
        }
    }
    fn kw(verse_id: i64) -> SearchHit {
        SearchHit {
            verse_id,
            translation_code: "KJV".into(),
            book_id: 1,
            book_name: "Genesis".into(),
            book_osis: "Gen".into(),
            chapter: 1,
            verse: verse_id,
            text: format!("verse {verse_id}"),
            snippet: format!("<mark>verse</mark> {verse_id}"),
        }
    }

    #[test]
    fn merges_both_then_meaning_then_keyword_and_dedupes() {
        // semantic: 10 (score .9), 11 (.8); keyword: 11, 12
        let out = merge_search_hits(vec![sem(10, 0.9), sem(11, 0.8)], vec![kw(11), kw(12)], 50);
        let kinds: Vec<(&str, i64)> = out
            .iter()
            .map(|h| (h.match_kind.as_str(), h.verse_id))
            .collect();
        // verse 11 is in both -> "both" first; then meaning-only 10; then keyword-only 12
        assert_eq!(kinds, vec![("both", 11), ("meaning", 10), ("keyword", 12)]);
        // "both" carries the keyword snippet and a semantic score
        let both = &out[0];
        assert!(both.snippet.contains("<mark>"));
        assert!(both.semantic_score.is_some());
        // meaning-only has no snippet
        assert_eq!(out[1].snippet, "");
    }

    #[test]
    fn respects_limit() {
        let out = merge_search_hits(vec![sem(1, 0.9)], vec![kw(2), kw(3)], 2);
        assert_eq!(out.len(), 2);
    }
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd app && cargo test --manifest-path ./src-tauri/Cargo.toml search_merge_tests`
Expected: FAIL — `cannot find function 'merge_search_hits'` / `SearchResultHit` not found.

- [ ] **Step 3: Add the structs and the merge helper**

Insert just above `fn search(` (line ~676, after its `#[tauri::command]` is removed in Step 5 — for now place these above the attribute):

```rust
#[derive(serde::Serialize, Clone)]
pub struct SearchResultHit {
    pub verse_id: i64,
    pub translation_code: String,
    pub book_id: i64,
    pub book_name: String,
    pub book_osis: String,
    pub chapter: i64,
    pub verse: i64,
    pub text: String,
    /// Empty for meaning-only hits; otherwise the FTS snippet (may contain <mark>).
    pub snippet: String,
    /// "keyword" | "meaning" | "both"
    pub match_kind: String,
    /// Cosine similarity 0..1, present for meaning/both.
    pub semantic_score: Option<f32>,
}

#[derive(serde::Serialize)]
pub struct SearchResponse {
    pub hits: Vec<SearchResultHit>,
    pub strategy_requested: String,
    pub strategy_used: String,
    pub degraded: bool,
    pub degraded_reason: Option<String>,
}

/// Merge semantic + keyword hits, deduped by verse_id.
/// Order: verses matched both ways first (in semantic-score order), then
/// meaning-only (semantic-score order), then keyword-only (FTS order).
fn merge_search_hits(
    semantic: Vec<db::SemanticHit>,
    keyword: Vec<db::SearchHit>,
    limit: usize,
) -> Vec<SearchResultHit> {
    use std::collections::{HashMap, HashSet};
    let mut kw_by_id: HashMap<i64, db::SearchHit> = HashMap::new();
    let mut kw_order: Vec<i64> = Vec::new();
    for h in keyword {
        if !kw_by_id.contains_key(&h.verse_id) {
            kw_order.push(h.verse_id);
        }
        kw_by_id.insert(h.verse_id, h);
    }

    let mut both: Vec<SearchResultHit> = Vec::new();
    let mut meaning: Vec<SearchResultHit> = Vec::new();
    let mut seen: HashSet<i64> = HashSet::new();
    for s in semantic {
        // semantic_search already returns descending score order
        if !seen.insert(s.verse_id) {
            continue;
        }
        let (match_kind, snippet) = match kw_by_id.get(&s.verse_id) {
            Some(k) => ("both", k.snippet.clone()),
            None => ("meaning", String::new()),
        };
        let hit = SearchResultHit {
            verse_id: s.verse_id,
            translation_code: s.translation_code,
            book_id: s.book_id,
            book_name: s.book_name,
            book_osis: s.book_osis,
            chapter: s.chapter,
            verse: s.verse,
            text: s.text,
            snippet,
            match_kind: match_kind.to_string(),
            semantic_score: Some(s.score),
        };
        if match_kind == "both" {
            both.push(hit);
        } else {
            meaning.push(hit);
        }
    }

    let mut out: Vec<SearchResultHit> = both;
    out.append(&mut meaning);
    for id in kw_order {
        if !seen.insert(id) {
            continue;
        }
        if let Some(k) = kw_by_id.remove(&id) {
            out.push(SearchResultHit {
                verse_id: k.verse_id,
                translation_code: k.translation_code,
                book_id: k.book_id,
                book_name: k.book_name,
                book_osis: k.book_osis,
                chapter: k.chapter,
                verse: k.verse,
                text: k.text,
                snippet: k.snippet,
                match_kind: "keyword".to_string(),
                semantic_score: None,
            });
        }
    }
    out.truncate(limit);
    out
}
```

- [ ] **Step 4: Run the merge test to verify it passes**

Run: `cd app && cargo test --manifest-path ./src-tauri/Cargo.toml search_merge_tests`
Expected: PASS (both tests).

- [ ] **Step 5: Rewrite `fn search` as the async, strategy-aware command**

Replace the entire existing command (the `#[tauri::command]` + `fn search(...) -> Result<Vec<db::SearchHit>, String> { ... }`, lines ~676–710) with:

```rust
#[tauri::command]
async fn search(
    app: AppHandle,
    query: String,
    translation_code: Option<String>,
    limit: Option<i64>,
    book_id: Option<i64>,
    testament: Option<String>,
    strategy: Option<String>,
    ollama_host: Option<String>,
) -> Result<SearchResponse, String> {
    let query = query.trim().to_string();
    if query.len() > 500 {
        return Err("search query is too long".to_string());
    }
    if let Some(book_id) = book_id {
        validate_book_id(book_id)?;
    }
    let testament = normalize_testament_filter(testament)?;
    let requested = strategy
        .as_deref()
        .map(str::trim)
        .map(str::to_ascii_lowercase)
        .unwrap_or_else(|| "keyword".to_string());
    if !matches!(requested.as_str(), "keyword" | "semantic" | "hybrid") {
        return Err("unsupported search strategy".to_string());
    }
    let limit = bounded_limit(limit, 50, 200);
    let translation = translation_code
        .as_deref()
        .map(str::trim)
        .filter(|v| !v.is_empty());

    if query.is_empty() {
        return Ok(SearchResponse {
            hits: Vec::new(),
            strategy_requested: requested.clone(),
            strategy_used: requested,
            degraded: false,
            degraded_reason: None,
        });
    }

    let scope = db::VerseSearchScope {
        book_id,
        testament: testament.as_deref(),
        ..db::VerseSearchScope::default()
    };

    let use_semantic = matches!(requested.as_str(), "semantic" | "hybrid");
    let use_fts = matches!(requested.as_str(), "keyword" | "hybrid");
    let mut degraded = false;
    let mut degraded_reason: Option<String> = None;

    // --- Semantic pass ---
    let semantic_hits: Vec<db::SemanticHit> = if use_semantic {
        match translation {
            None => {
                degraded = true;
                degraded_reason =
                    Some("Meaning search needs a specific translation — showing keyword results".to_string());
                Vec::new()
            }
            Some(tr) => {
                let has_embeddings: i64 = {
                    let conn = open_corpus(&app)?;
                    conn.query_row(
                        "SELECT COUNT(*) FROM verse_embeddings WHERE translation_code = ?1 AND model = ?2",
                        rusqlite::params![tr, EMBED_MODEL],
                        |r| r.get(0),
                    )
                    .map_err(|e| e.to_string())?
                };
                if has_embeddings == 0 {
                    degraded = true;
                    degraded_reason =
                        Some(format!("No meaning index for {tr} — showing keyword results"));
                    Vec::new()
                } else {
                    match ollama::embed_with_host(EMBED_MODEL, &query, ollama_host.as_deref()).await {
                        Ok(q_emb) => {
                            let conn = open_corpus(&app)?;
                            db::semantic_search(
                                &conn,
                                &q_emb,
                                tr,
                                EMBED_MODEL,
                                limit as usize,
                                scope,
                            )
                            .map_err(|e| e.to_string())?
                        }
                        Err(e) => {
                            eprintln!("[search] semantic retrieval failed: {e}");
                            degraded = true;
                            degraded_reason = Some(
                                "Meaning search needs Ollama running — showing keyword results"
                                    .to_string(),
                            );
                            Vec::new()
                        }
                    }
                }
            }
        }
    } else {
        Vec::new()
    };

    // --- Keyword/FTS pass --- (also runs as the fallback when semantic degraded)
    let need_fts = use_fts || (use_semantic && degraded);
    let keyword_hits: Vec<db::SearchHit> = if need_fts {
        let conn = open_corpus(&app)?;
        db::search(&conn, &query, translation, limit, scope).map_err(|e| e.to_string())?
    } else {
        Vec::new()
    };

    let strategy_used = if degraded {
        "keyword".to_string()
    } else {
        requested.clone()
    };
    let hits = merge_search_hits(semantic_hits, keyword_hits, limit as usize);

    Ok(SearchResponse {
        hits,
        strategy_requested: requested,
        strategy_used,
        degraded,
        degraded_reason,
    })
}
```

- [ ] **Step 6: Run the full Rust gate**

Run: `cd app && cargo fmt --manifest-path ./src-tauri/Cargo.toml && cargo clippy --manifest-path ./src-tauri/Cargo.toml --no-deps -- -D warnings && cargo test --manifest-path ./src-tauri/Cargo.toml`
Expected: fmt clean, clippy clean, all tests PASS (including `search_merge_tests`).

- [ ] **Step 7: Commit**

```bash
git add app/src-tauri/src/lib.rs
git commit -m "feat(search): async search command with keyword/semantic/hybrid + fallback"
```

---

## Task 3: Frontend types + `search()` wrapper

**Files:**
- Modify: `app/src/lib/bible.ts` (`SearchHit` ~30, `search` ~63)

- [ ] **Step 1: Extend `SearchHit` and add response types**

Replace the `SearchHit` interface (lines ~30–41) with:

```ts
export type SearchStrategy = "keyword" | "semantic" | "hybrid";

export interface SearchHit {
  verse_id: number;
  translation_code: string;
  book_id: number;
  book_name: string;
  book_osis: string;
  chapter: number;
  verse: number;
  text: string;
  /** May contain <mark>...</mark>. Empty string for meaning-only hits. */
  snippet: string;
  /** "keyword" | "meaning" | "both" */
  match_kind: "keyword" | "meaning" | "both";
  /** Cosine similarity 0..1, present for meaning/both. */
  semantic_score?: number;
}

export interface SearchResponse {
  hits: SearchHit[];
  strategy_requested: SearchStrategy;
  strategy_used: SearchStrategy;
  degraded: boolean;
  degraded_reason: string | null;
}
```

- [ ] **Step 2: Update the `search()` wrapper**

Replace the `search` export (lines ~63–76) with:

```ts
export const search = (
  query: string,
  translationCode: string | null,
  limit = 50,
  bookId?: number | null,
  testament?: Testament | null,
  strategy: SearchStrategy = "keyword",
  ollamaHost?: string | null,
) =>
  invoke<SearchResponse>("search", {
    query,
    translationCode,
    limit,
    bookId,
    testament,
    strategy,
    ollamaHost: ollamaHost ?? null,
  });
```

- [ ] **Step 3: Type-check**

Run: `cd app && npx tsc --noEmit`
Expected: errors **only** in `App.tsx` and `SearchResults.tsx` (they still treat the result as `SearchHit[]`). These are fixed in Tasks 5–6. No errors in `bible.ts`.

- [ ] **Step 4: Commit**

```bash
git add app/src/lib/bible.ts
git commit -m "feat(search): SearchResponse + match_kind types in bible.ts"
```

---

## Task 4: `SearchStrategyControl` component

**Files:**
- Create: `app/src/features/search/SearchStrategyControl.tsx`

- [ ] **Step 1: Create the component**

```tsx
import type { SearchStrategy } from "../../lib/bible";

const OPTIONS: Array<{ value: SearchStrategy; label: string; hint: string }> = [
  { value: "keyword", label: "Keyword", hint: "Exact word matches" },
  { value: "semantic", label: "Meaning", hint: "Related by meaning (needs Ollama)" },
  { value: "hybrid", label: "Both", hint: "Keyword and meaning combined" },
];

interface Props {
  value: SearchStrategy;
  onChange: (value: SearchStrategy) => void;
}

export function SearchStrategyControl({ value, onChange }: Props) {
  return (
    <div
      role="group"
      aria-label="Search mode"
      className="flex rounded-md border border-[color:var(--border-subtle)] overflow-hidden text-xs"
    >
      {OPTIONS.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            aria-pressed={active}
            title={opt.hint}
            data-testid={`search-strategy-${opt.value}`}
            className={
              "flex-1 px-2 py-1 transition-colors " +
              (active
                ? "bg-amber-500/15 text-amber-300 font-medium"
                : "text-neutral-400 hover:text-neutral-200")
            }
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `cd app && npx tsc --noEmit`
Expected: no **new** errors from this file (the App.tsx/SearchResults.tsx errors from Task 3 remain until Tasks 5–6).

- [ ] **Step 3: Commit**

```bash
git add app/src/features/search/SearchStrategyControl.tsx
git commit -m "feat(search): add Keyword/Meaning/Both strategy control"
```

---

## Task 5: `SearchResults` — match badges, meaning rendering, degraded notice

**Files:**
- Modify: `app/src/features/search/SearchResults.tsx`

- [ ] **Step 1: Add the new props**

Replace the `Props` interface (lines ~10–16) with:

```tsx
interface Props {
  query: string;
  results: SearchHit[];
  loading: boolean;
  onSelect: (hit: SearchHit) => void;
  onSaveSearch?: () => void;
  degraded?: boolean;
  degradedReason?: string | null;
}
```

And update the destructure (line ~18):

```tsx
export function SearchResults({
  query,
  results,
  loading,
  onSelect,
  onSaveSearch,
  degraded = false,
  degradedReason,
}: Props) {
```

- [ ] **Step 2: Render the degraded notice**

Immediately after the closing `</header>` (line ~201) and before the `{!loading && results.length === 0 ...}` block, insert:

```tsx
      {degraded && (
        <div
          data-testid="search-degraded-notice"
          className="soft-card border-amber-500/40 bg-amber-500/10 px-3 py-2 mb-3 text-xs text-amber-200"
        >
          {degradedReason ?? "Meaning search unavailable — showing keyword results."}
        </div>
      )}
```

- [ ] **Step 3: Render the per-result match badge and meaning text**

Replace the result `<p>` snippet block (lines ~233–238) with a badge + conditional rendering:

```tsx
                    <div className="flex flex-wrap items-baseline gap-2 text-xs text-neutral-400 mb-1">
                      <span className="meta-pill font-mono">{hit.translation_code}</span>
                      <span className="text-neutral-600">·</span>
                      <span>
                        {hit.book_name} {hit.chapter}:{hit.verse}
                      </span>
                      {(hit.match_kind === "meaning" || hit.match_kind === "both") && (
                        <span
                          data-testid="match-kind-badge"
                          className="meta-pill text-emerald-300 border-emerald-500/40"
                          title={
                            hit.semantic_score != null
                              ? `Meaning match (${Math.round(hit.semantic_score * 100)}%)`
                              : "Meaning match"
                          }
                        >
                          {hit.match_kind === "both" ? "keyword + meaning" : "meaning"}
                        </span>
                      )}
                    </div>
                    <p
                      className="text-neutral-200 text-sm leading-relaxed"
                      style={{ fontFamily: "var(--font-serif)" }}
                    >
                      {hit.snippet ? <SnippetText value={hit.snippet} /> : hit.text}
                    </p>
```

(Note: this block sits inside the `<button>` that already opens at line ~220; only the inner `<div className="flex flex-wrap items-baseline ...">` and the `<p>` are replaced. Keep the surrounding `<button>` and `AddToWorkspaceMenu` intact.)

- [ ] **Step 4: Type-check**

Run: `cd app && npx tsc --noEmit`
Expected: errors now only in `App.tsx` (Task 6). `SearchResults.tsx` is clean.

- [ ] **Step 5: Commit**

```bash
git add app/src/features/search/SearchResults.tsx
git commit -m "feat(search): match-kind badges + degraded notice in results"
```

---

## Task 6: Wire `App.tsx` — strategy state, persistence, consume `SearchResponse`

**Files:**
- Modify: `app/src/App.tsx` (imports ~20/43-44, state ~204-227, settings load ~271-279, search effect ~388-422, search panel render ~986, SearchResults usage ~1218)

- [ ] **Step 1: Import the control and the type**

In the `./lib/bible` import (around line 20), add `type SearchStrategy,` and `type SearchResponse,` to the import list. After the `SearchInput` import (line 43), add:

```tsx
import { SearchStrategyControl } from "./features/search/SearchStrategyControl";
```

- [ ] **Step 2: Add strategy + degraded state**

After `const [searchFilterBookId, setSearchFilterBookId] = useState(0);` (line ~224) add:

```tsx
  const [searchStrategy, setSearchStrategy] = useState<SearchStrategy>("keyword");
  const [searchDegraded, setSearchDegraded] = useState(false);
  const [searchDegradedReason, setSearchDegradedReason] = useState<string | null>(null);
```

- [ ] **Step 3: Sync strategy from loaded settings**

After the settings are loaded into state (`setSettings(savedSettings);`, line ~279), add:

```tsx
        if (
          savedSettings.search_strategy === "keyword" ||
          savedSettings.search_strategy === "semantic" ||
          savedSettings.search_strategy === "hybrid"
        ) {
          setSearchStrategy(savedSettings.search_strategy);
        }
```

- [ ] **Step 4: Update the search effect to pass strategy and consume `SearchResponse`**

Replace the body of the search effect (lines ~388–422) with:

```tsx
  useEffect(() => {
    if (searchTimer.current) window.clearTimeout(searchTimer.current);
    const requestId = ++searchRequestId.current;
    const trimmed = searchQuery.trim();
    if (!trimmed) {
      setSearchResults([]);
      setSearchLoading(false);
      setSearchDegraded(false);
      setSearchDegradedReason(null);
      return;
    }
    setSearchLoading(true);
    const filterPrimary =
      searchFilterTranslation === "all"
        ? null
        : searchFilterTranslation === "active"
          ? (activeTranslations[0] ?? null)
          : searchFilterTranslation;
    // Meaning/hybrid need a concrete translation (embeddings are per-translation).
    const primary =
      searchStrategy !== "keyword" && !filterPrimary
        ? (activeTranslations[0] ?? "KJV")
        : filterPrimary;
    searchTimer.current = window.setTimeout(() => {
      searchTimer.current = null;
      runSearch(
        trimmed,
        primary,
        60,
        searchFilterBookId || null,
        searchFilterTestament === "all" ? null : searchFilterTestament,
        searchStrategy,
        settings.ollama_host ?? null,
      )
        .then((resp: SearchResponse) => {
          if (requestId !== searchRequestId.current) return;
          setSearchResults(resp.hits);
          setSearchDegraded(resp.degraded);
          setSearchDegradedReason(resp.degraded_reason);
        })
        .catch((e) => {
          if (requestId === searchRequestId.current) setError(String(e));
        })
        .finally(() => {
          if (requestId === searchRequestId.current) setSearchLoading(false);
        });
    }, 250);
```

Then add `searchStrategy` and `settings.ollama_host` to the effect's dependency array (the `}, [...])` line that closes this effect — append `searchStrategy, settings.ollama_host` to the existing deps).

- [ ] **Step 5: Render the strategy control in the search panel**

Immediately after `<SearchInput value={searchQuery} onChange={updateSearchQuery} />` (line ~986), add:

```tsx
          <div className="mt-2">
            <SearchStrategyControl
              value={searchStrategy}
              onChange={(next) => {
                setSearchStrategy(next);
                saveSettingsPatch({ search_strategy: next });
              }}
            />
          </div>
```

- [ ] **Step 6: Pass degraded info to `SearchResults`**

In the `<SearchResults ... />` usage (line ~1218), add these props alongside the existing ones:

```tsx
            degraded={searchDegraded}
            degradedReason={searchDegradedReason}
```

- [ ] **Step 7: Type-check + build**

Run: `cd app && npm run build`
Expected: `tsc` passes (no errors) and `vite build` succeeds.

- [ ] **Step 8: Commit**

```bash
git add app/src/App.tsx
git commit -m "feat(search): wire strategy control, persistence, and degraded state"
```

---

## Task 7: End-to-end spec — fallback + persistence

**Files:**
- Create: `app/tests/e2e/search-semantic.spec.ts`

Context: Ollama does not run in CI, so selecting "Meaning" deterministically degrades to keyword. This spec verifies (a) the degraded notice appears, (b) keyword results still render, and (c) the strategy persists across reload. Follow the structure of the existing specs (e.g. `app/tests/e2e/reader-interactions.spec.ts`) for app boot/setup helpers.

- [ ] **Step 1: Write the spec**

```ts
import { browser, $, expect } from "@wdio/globals";

describe("Semantic search UX", () => {
  it("falls back to keyword when Ollama is unavailable, and persists the choice", async () => {
    // Open the search bar and run a query.
    const searchBox = await $('input[type="search"]');
    await searchBox.setValue("love");

    // Switch to "Meaning".
    const meaning = await $('[data-testid="search-strategy-semantic"]');
    await meaning.click();
    await expect(meaning).toHaveAttribute("aria-pressed", "true");

    // The degraded notice appears (Ollama isn't running in CI)...
    const notice = await $('[data-testid="search-degraded-notice"]');
    await notice.waitForDisplayed({ timeout: 15000 });

    // ...and keyword results still render.
    const firstResult = await $('[data-testid="search-result"]');
    await firstResult.waitForDisplayed({ timeout: 15000 });

    // Reload and confirm "Meaning" is still selected (persisted in app_settings).
    await browser.reloadSession();
    const meaningAfter = await $('[data-testid="search-strategy-semantic"]');
    await expect(meaningAfter).toHaveAttribute("aria-pressed", "true");
  });
});
```

(If `reloadSession` is not how the other specs restart the app, mirror their restart/persistence approach instead. Reuse any shared "complete onboarding / dismiss tour" helper the other specs call before interacting.)

- [ ] **Step 2: Build the debug app and run e2e**

Run: `cd app && npm run test:e2e:build`
Expected: the new spec passes, and all pre-existing specs still pass (keyword default unchanged).

- [ ] **Step 3: Commit**

```bash
git add app/tests/e2e/search-semantic.spec.ts
git commit -m "test(search): e2e for meaning-search fallback + persistence"
```

---

## Task 8: Full gate + finish

- [ ] **Step 1: Run the full check gate**

Run: `cd app && npm run check`
Expected: exit 0 (TS build, cargo fmt/check/test, clippy `-D warnings`, node `--check`, sidecar tests).

- [ ] **Step 2: Manual smoke (optional but recommended)**

With Ollama running locally (`ollama serve` + `ollama pull nomic-embed-text`), launch the app, search a concept (e.g. "God's patience with sinners"), switch to **Meaning**, and confirm verses surface that don't contain those exact words, with a "meaning" badge. Switch to **Both** and confirm keyword + meaning results merge.

- [ ] **Step 3: Update the spec status**

In `docs/superpowers/specs/2026-05-25-semantic-search-ux-design.md`, change `Status:` to `Implemented`. Commit:

```bash
git add docs/superpowers/specs/2026-05-25-semantic-search-ux-design.md
git commit -m "docs(search): mark semantic-search spec implemented"
```

- [ ] **Step 4: Open PR / merge**

Push `semantic-search-ux` and open a PR to `main` (or fast-forward merge), per the repo's flow. Ensure `npm run check:full` is green before merge.

---

## Self-Review (completed by plan author)

- **Spec coverage:** strategy selection (Tasks 4, 6) ✓; show why matched / badges (Task 5) ✓; graceful Ollama/no-embeddings fallback never erroring (Task 2 + 5 notice) ✓; persistence (Tasks 1, 6) ✓; per-translation constraint handled by frontend resolution (Task 6 Step 4) ✓; testing (Tasks 2, 7) ✓; non-goals respected (no pagination, no multi-translation semantic, no Council changes) ✓.
- **Type consistency:** Rust `SearchResultHit`/`SearchResponse` (snake_case) mirror TS `SearchHit`/`SearchResponse`; `match_kind` values `keyword|meaning|both` consistent across `merge_search_hits`, `SearchResults.tsx`, and the badge; `search()` arg order (query, translationCode, limit, bookId, testament, strategy, ollamaHost) matches the `runSearch(...)` call in Task 6 and the Rust command param order. `snippet: string` (empty for meaning) consistent backend↔frontend.
- **Placeholder scan:** no TBD/TODO; every code step has complete code; commands have expected output.
