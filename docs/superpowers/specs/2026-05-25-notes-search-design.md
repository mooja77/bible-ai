# Search Your Notes — Design

- **Date:** 2026-05-25
- **Status:** Approved (design); ready for implementation plan
- **Theme:** "Surface hidden features" enhancement pass, sub-project 2
- **Owner:** John Moore

## Problem

Users can write notes on verses (`user_notes`, one per verse) and on verse ranges
(`user_range_notes`), but there is **no way to find them again by content**. As soon as a note
scrolls out of the chapter where it was written, it is effectively lost — you must remember which
verse you attached it to. This is a basic capability gap for a study tool.

## Goals

1. Let the user search the text of their own notes and jump to the verse a matching note belongs to.
2. Surface it where users already look for things: the existing search bar, via a scope toggle.
3. Show each result with its scripture citation and the matched text highlighted.

## Non-goals (YAGNI)

- Searching bookmarks (their `label`), workspace items, theology conclusions, or council notes —
  "My notes" means the note feature only. Bookmark-label search is an easy future add.
- Stemming / relevance ranking / fuzzy matching (substring + recency is enough for personal notes).
- A full notes browser/management view (the dedicated-panel option was not chosen).
- Persisting the chosen scope across sessions (defaults to Scripture each launch).
- Any schema change or migration (this reuses the existing note tables as-is).

## Approach

**Substring scan (`LIKE`), all-words-present, recency-ordered.** A new `search_notes` command
splits the query into whitespace tokens and returns notes whose `body` contains *every* token
(case-insensitive), most-recently-edited first. Chosen over FTS5 because note volume is small, it
needs **zero index maintenance / no migration / no write-path sync** (the maintenance surface that
caused a bug in the previous sub-project), and substring matching matches the intuitive "find my
note containing X." FTS5 remains a clean future upgrade if note volume/relevance ever demands it.

## Backend design (`app/src-tauri`)

### Token → LIKE matching (in `user_db.rs`)

Helper that turns a raw query into escaped `LIKE` patterns:
- Split on whitespace; drop empty tokens. If no tokens → return empty results.
- For each token, escape SQLite `LIKE` metacharacters and wrap: `like_pattern("a_b") => "%a\_b%"`,
  using `ESCAPE '\'`. Escape `\`, `%`, `_`.
- A note matches when **every** token's pattern matches its `body` (AND).

### `user_db::search_notes`

```rust
#[derive(Serialize, Clone)]
pub struct NoteMatch {
    pub kind: String,            // "verse" | "range"
    pub verse_id: i64,           // verse note: the verse; range note: start_verse_id
    pub end_verse_id: Option<i64>, // range note only
    pub body: String,
    pub updated_at: String,
}

pub fn search_notes(conn, tokens: &[String], limit: i64) -> SqlResult<Vec<NoteMatch>>
```

- Query `user_notes` (`SELECT verse_id, body, updated_at ... WHERE body LIKE ?1 ESCAPE '\' AND body
  LIKE ?2 ESCAPE '\' ...`) → `kind="verse"`, `end_verse_id=None`.
- Query `user_range_notes` (`SELECT start_verse_id, end_verse_id, body, updated_at ...` with the
  same AND-of-LIKEs) → `kind="range"`.
- Concatenate, sort by `updated_at` DESC, truncate to `limit`.
- The number of `LIKE` clauses is dynamic (one per token); build the SQL + params accordingly.

### Citation resolution + the command (in `lib.rs`)

`user.sqlite` notes carry only `verse_id`s; the citation lives in the read-only `corpus.sqlite`.

```rust
#[derive(Serialize)]
pub struct NoteHit {
    pub kind: String,            // "verse" | "range"
    pub verse_id: i64,
    pub end_verse_id: Option<i64>,
    pub citation: String,        // "Genesis 1:1" or "Genesis 1:1–5" / cross-chapter form
    pub book_id: i64,
    pub chapter: i64,
    pub verse: i64,
    pub body: String,
    pub updated_at: String,
}

#[tauri::command]
fn search_notes(app, state: tauri::State<UserDbState>, query: String, limit: Option<i64>)
    -> Result<Vec<NoteHit>, String>
```

- Validate query length (≤500, reuse the search guard); `bounded_limit(limit, 50, 200)`.
- `with_user_db(&app, &state, |conn| user_db::search_notes(conn, &tokens, limit))`.
- `open_corpus(&app)`; resolve citations for the distinct verse ids (start + end) via one
  `SELECT v.id, v.book_id, b.name, v.chapter, v.verse FROM verses v JOIN books b ON b.id = v.book_id
  WHERE v.id IN (...)`. Build a map `verse_id -> (book_id, book_name, chapter, verse)`.
- Assemble `NoteHit`s. Citation: verse → `"{book} {chapter}:{verse}"`; range → start–end (same
  chapter: `"{book} {c}:{v1}–{v2}"`; cross-chapter: `"{book} {c1}:{v1}–{c2}:{v2}"`). `book_id`/
  `chapter`/`verse` are the start verse's, used by the frontend to navigate.
- If a note's verse id is missing from corpus (shouldn't happen), skip it (defensive).

## Frontend design (`app/src`)

### Scope toggle

A `searchScope: "scripture" | "notes"` state in `App.tsx` (default `"scripture"`, **not persisted**).
A small `SearchScopeControl` (segmented, mirroring `SearchStrategyControl`) — **Scripture · My notes**
— rendered above the search box. When scope is `"notes"`: hide `SearchStrategyControl` and the
scripture scope filters (translation/testament/book — they don't apply); the search box drives a
notes search instead.

### Notes search flow

- `lib/bible.ts`: `NoteHit` interface + `searchNotes(query, limit?) => invoke<NoteHit[]>("search_notes", { query, limit })`.
- The search effect branches on `searchScope`: `"notes"` → debounced `searchNotes(query)` into
  `noteResults`/`noteLoading` (separate state from scripture `searchResults`), with the same
  request-id staleness guard. Empty query clears note results.
- Render branch: scope `"notes"` → `<NoteSearchResults results={noteResults} loading={...}
  query={...} onSelect={onSelectNote} />`; else the existing `<SearchResults>`.

### `NoteSearchResults` component (new, dedicated)

Keeps the scripture `SearchResults` focused. Each hit: the `citation`, a "note" badge, and the
note `body` with the query tokens highlighted client-side (a `highlightTokens(body, tokens)` helper
that wraps case-insensitive matches in `<mark>`, reusing the existing `<mark>` styling). Clicking a
hit calls `onSelect(hit)` → `App` navigates to the note's verse (book/chapter + scroll to verse),
reusing the same jump logic as `onSelectSearchHit`.

## Data flow

```
scope = "My notes"; user types "grace works"
  → App notes-search effect → bible.ts searchNotes("grace works")
  → invoke("search_notes") → with_user_db: scan user_notes + user_range_notes
       WHERE body LIKE %grace% AND body LIKE %works%  (recency order, limit)
  → open_corpus: resolve citations for matched verse ids
  → Vec<NoteHit> → NoteSearchResults: citation + "note" badge + highlighted body
  → click → navigate to the verse
```

## Error handling

- Empty / whitespace-only query → empty results (no error), note list cleared.
- Query > 500 chars → `Err` (reuse the search guard).
- Note referencing a verse id absent from corpus → that hit is skipped (defensive), others returned.
- User DB / corpus errors → surfaced as `Err(String)` like the other commands.

## Testing

- **Rust unit tests** (in-memory user DB, mirroring existing note tests in `user_db.rs`):
  - inserts a verse note "God is love", a range note "love your neighbour", a non-matching note
    "the law"; `search_notes(["love"])` returns the two love notes, not "the law";
  - multi-token AND: `search_notes(["love","neighbour"])` returns only the range note;
  - case-insensitivity: `search_notes(["LOVE"])` matches;
  - recency: the most-recently-updated matching note sorts first;
  - `like_pattern` escaping: `%`/`_` in a token are matched literally, not as wildcards.
- **E2E (WDIO):** in the reader, open a verse's note tab and save a note containing a distinctive
  word; switch the search scope to "My notes"; type that word; assert a `NoteSearchResults` hit
  appears showing the citation; (optionally) click it and assert navigation to that verse. Mirror
  existing specs' conventions and note-creation steps.
- Full `npm run check` green; `npm run check:full` (e2e) before merge.

## Risks & mitigations

- **`LIKE` is a new pattern** (codebase uses FTS elsewhere) → documented and deliberate for
  note-scale; isolated to one command; FTS upgrade path noted.
- **Cross-DB stitch** (user notes ↔ corpus citations) → resolved in the command with one batched
  corpus `IN (...)` query; defensive skip on missing ids.
- **Two search states in `App.tsx`** (`searchResults` vs `noteResults`) → kept separate and only
  one is rendered per scope; the existing scripture search path is untouched (default scope).
- **Highlight correctness** → client-side `highlightTokens` is purely presentational; escape/render
  carefully so note text with `<`/`>` is shown as text (React escapes by default); the helper
  splits on token matches and emits text/`<mark>` chunks rather than setting raw HTML.

## Rollout

Single feature branch `notes-search`. No schema migration. Land backend + frontend + tests
together; the feature is only reachable when the user flips the scope toggle (default Scripture, so
existing behaviour is unchanged). Verify with `npm run check:full` before merge to `main`.
