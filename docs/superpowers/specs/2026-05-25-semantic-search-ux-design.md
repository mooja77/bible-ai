# Semantic Search in the Search Bar — Design

- **Date:** 2026-05-25
- **Status:** Approved (design); ready for implementation plan
- **Theme:** "Surface hidden features" enhancement pass, sub-project 1
- **Owner:** John Moore

## Problem

Every install bundles **124,458 verse embeddings** (5 translations, `nomic-embed-text`, 768-dim)
in `corpus.sqlite`, plus a complete semantic-search engine in Rust
(`db::semantic_search`, cosine similarity over the embedding BLOBs) and a query-embedding
client (`ollama::embed_with_host`). Today this engine is wired **only** into the Council's
evidence retrieval (`lib.rs` `retrieve_evidence`, used by `ask_council`).

The standalone search bar uses a separate command — `fn search` (`lib.rs:677`) — which is
**keyword / FTS5 only**. Users can never run a meaning-based search, so the bundled embeddings
are dead weight for the most common task in the app. There is no way to find a verse by concept
when the exact words differ ("God's patience with sinners" won't surface verses that never use
those words).

## Goals

1. Let the user choose how the search bar matches: **Keyword**, **Meaning**, or **Both**.
2. Show *why* each result matched (keyword snippet vs. meaning match) so results are trustworthy.
3. Degrade gracefully when the meaning engine is unavailable (Ollama not running, or the chosen
   translation has no embeddings): fall back to keyword and tell the user, never error out.
4. Remember the user's chosen strategy across sessions.

## Non-goals (YAGNI)

- Searching multiple translations semantically at once (embeddings are per-translation; meaning
  search runs against one translation).
- New embedding models, re-ranking models, or re-embedding the corpus.
- Pagination / infinite scroll of results (tracked separately under the robustness theme).
- Client-side query embedding (the Rust host already owns the Ollama call).
- Touching the Council retrieval path.

## Approach

**Extend the existing `search` command** (chosen over a parallel command or a shared-core
refactor). Keyword behavior and results stay identical; semantic/hybrid reuse the engine the
Council already uses. This keeps one unified search and the smallest new surface, and avoids
risking the flagship Council path.

The command becomes `async` (semantic needs to `await` the Ollama embed) and gains an optional
`strategy` argument. It returns a small response object instead of a bare list, so it can report
which strategy actually ran and whether it degraded.

## Backend design (`app/src-tauri`)

### Command

```
#[tauri::command]
async fn search(
    app, query, translation_code, limit, book_id, testament,
    strategy: Option<String>,   // "keyword" (default) | "semantic" | "hybrid"
) -> Result<SearchResponse, String>
```

- Validate `strategy` ∈ {keyword, semantic, hybrid}; default `keyword`. Reuse existing query
  length / book / testament validation.
- **Translation resolution:** semantic needs a concrete translation. Use `translation_code` if
  given, else fall back to `settings.retrieval_translation` (default `KJV`). Keyword is unchanged.

### Response and hit shape

```
struct SearchResponse {
    hits: Vec<SearchResultHit>,
    strategy_requested: String,     // what the user asked for
    strategy_used: String,          // what actually ran ("keyword" if it fell back)
    degraded: bool,
    degraded_reason: Option<String> // e.g. "Ollama not reachable", "no embeddings for KJV"
}

struct SearchResultHit {            // db::SearchHit + meaning fields
    verse_id, translation_code, book_id, book_name, book_osis, chapter, verse, text,
    snippet: Option<String>,        // present for keyword/both (may contain <mark>); None for meaning-only
    match_kind: String,             // "keyword" | "meaning" | "both"
    semantic_score: Option<f32>,    // cosine 0..1, present for meaning/both
}
```

Note: there is no `keyword_score`. `db::SearchHit` carries no numeric FTS score — the evidence
of a keyword match is the `<mark>` snippet, not a number — so we do not invent one. `match_kind`
plus `snippet` fully convey keyword matching.

This is a deliberate contract change: keyword *results* are byte-for-byte the same, but the
command now returns `SearchResponse` instead of `Vec<SearchHit>`. The only callers are our own
`search()` wrapper in `lib/bible.ts` and `App.tsx`; both are updated.

### Retrieval logic (mirrors `retrieve_evidence`, simplified for search)

1. `use_semantic = strategy ∈ {semantic, hybrid}`; `use_fts = strategy ∈ {keyword, hybrid}`.
2. `has_embeddings` guard: `SELECT COUNT(*) FROM verse_embeddings WHERE translation_code=? AND model=?`.
   If `use_semantic` but no embeddings → set `degraded`, reason "no embeddings for <translation>",
   and run keyword only.
3. **Semantic pass** (when possible): `ollama::embed_with_host(EMBED_MODEL, query, ollama_host)`
   → `db::semantic_search(...)`. On embed error: log to stderr, set `degraded`, reason
   "meaning search unavailable (Ollama not reachable)", and continue with keyword (for `hybrid`)
   or return keyword results (for `semantic`).
4. **FTS pass** (when `use_fts`): existing `db::search` with the raw query (search bar passes the
   user's literal query; we do **not** apply `question_to_fts_query`, which is tuned for
   natural-language Council questions).
5. **Merge & dedupe by `verse_id`:** a verse present in both passes → `match_kind="both"`, carries
   `semantic_score` and the FTS snippet. Semantic-only → `match_kind="meaning"`, `snippet=None`.
   Keyword-only → `match_kind="keyword"`. **Hybrid order (concrete, no cross-scale normalization):**
   `both` hits first (by `semantic_score` desc), then `meaning`-only (by `semantic_score` desc),
   then `keyword`-only (in `db::search`'s native FTS order). Pure modes keep that mode's native
   order. Respect `limit` (reuse `bounded_limit(limit, 50, 200)`).

### Settings

Add `search_strategy` to `AppSettings` (`user_db.rs:570`), to the allowed-keys list
(`user_db.rs:51`), and to load/save (`get_setting`/`upsert_setting`). Validate ∈
{keyword, semantic, hybrid}; default `keyword`.

## Frontend design (`app/src`)

### Strategy control

New `SearchStrategyControl` component (segmented control) rendered next to the search box in the
`App.tsx` search panel, beside the existing translation/testament/book filters. Plain-language
labels — **Keyword · Meaning · Both** — not "semantic/FTS". `aria-pressed` per segment; arrow-key
navigation between segments.

### Results (`SearchResults.tsx`)

- Each hit shows a `match_kind` badge: a "meaning match" badge (with a faint score bar from
  `semantic_score`) for meaning hits; the existing `<mark>` snippet for keyword/both.
- Meaning-only hits have no snippet → render the verse `text` plus the badge.
- When `response.degraded`, show an inline notice above results:
  *"Meaning search needs Ollama running — showing keyword results instead"* (text from
  `degraded_reason`). Non-blocking; results still render.

### State & persistence

- `App.tsx` holds `searchStrategy`, initialized from `settings.search_strategy` (default
  `keyword`), persisted via `saveAppSettings` on change (same debounced save chain as other
  reader settings).
- `lib/bible.ts` `search()` wrapper updated: new `strategy` arg, returns `SearchResponse`;
  `SearchHit` type gains the optional meaning fields and `snippet` becomes optional.

### Optional polish (nice-to-have, not required for v1)

Proactively probe Ollama (existing `check_ollama` diagnostic) to annotate the Meaning/Both
segments as "needs Ollama" before a search runs. v1 may rely solely on the post-search `degraded`
flag for correctness.

## Data flow

```
User types query + picks "Meaning"
  → App.tsx search effect → bible.ts search(query, translation, limit, book, testament, "semantic")
  → invoke("search", …) → Rust async search
      → resolve translation → has_embeddings? → embed_with_host (Ollama) → semantic_search
      → (hybrid also: db::search FTS) → merge/dedupe → SearchResponse
  → SearchResults renders hits + badges; degraded notice if fallback happened
```

## Error handling

- Ollama unreachable / slow / errors → caught, logged to stderr, `degraded=true`, keyword
  results returned. Never surfaces a hard error for a search.
- Translation without embeddings → `degraded=true` with a specific reason; keyword results.
- Invalid `strategy` string → command returns `Err` (programmer error; the UI only sends valid values).
- Empty query → returns empty `hits` (unchanged from today).

## Testing

- **Rust unit tests** (mirror the existing `db.rs` semantic test that seeds an in-memory
  `verse_embeddings` table):
  - merge dedupes by `verse_id` and sets `match_kind="both"` when a verse is in both passes;
  - `semantic` with no embeddings for the translation → `degraded=true`, keyword results,
    `strategy_used="keyword"`;
  - keyword path returns the same hits as before (regression guard).
- **Sidecar tests:** none (no sidecar involvement).
- **E2E (WDIO):** Ollama does not run in CI, so this deterministically exercises the fallback:
  switch to "Meaning", run a query, assert (a) the degraded notice appears and (b) keyword
  results still render; assert the chosen strategy persists across an app reload. Existing
  keyword-search e2e stays green (default unchanged).
- Full `npm run check` must pass; `npm run check:full` (e2e) before merge.

## Risks & mitigations

- **Contract change on `search`** → only our wrapper + `App.tsx` call it; update both; keyword UX
  identical so existing e2e is unaffected.
- **`search` becomes async** → Tauri supports async commands; the frontend already awaits.
- **Meaning search latency** (one Ollama embed per query) → it's a single short embed; show the
  existing search loading state; fallback covers the offline case.
- **Per-translation embeddings surprise** → meaning search uses the active retrieval translation;
  surface that subtly (e.g., the badge/empty-state copy can mention the translation).

## Rollout

Single feature branch `semantic-search-ux`. Land backend + settings + frontend together behind no
flag (the default strategy is `keyword`, so behavior only changes when the user opts in). Verify
with `npm run check:full` before merge to `main`.
