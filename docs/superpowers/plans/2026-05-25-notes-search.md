# Search Your Notes — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users search the text of their own verse + range notes from the search bar and jump to the note's verse.

**Architecture:** A new `search_notes` command does an all-tokens `LIKE` scan over `user_notes` + `user_range_notes` (recency-ordered), then stitches scripture citations from the read-only `corpus.sqlite`. The frontend adds a `Scripture · My notes` scope toggle; in "My notes" it runs the note search and renders results in a dedicated `NoteSearchResults` component.

**Tech Stack:** Rust (Tauri 2, rusqlite), React 19 + TypeScript, Tailwind v4, WebdriverIO e2e.

**Spec:** `docs/superpowers/specs/2026-05-25-notes-search-design.md`

**Verification note:** No frontend unit-test runner exists. Rust logic uses real `cargo test` (TDD). Frontend tasks are verified by `npm run build` (tsc) and the e2e spec in Task 7. No schema migration is involved (reuses existing note tables).

---

## File Structure

**Backend (`app/src-tauri/src/`)**
- `user_db.rs` — add `NoteMatch` struct, `like_pattern` helper, `search_notes` fn + tests. *(Task 1)*
- `lib.rs` — add `NoteHit` struct, `format_note_citation` helper, the `search_notes` command (user-DB scan + corpus citation stitch), and register it. *(Task 2)*
- `db.rs` — **unchanged** (citation query is inline in lib.rs, mirroring the existing inline corpus query in the `search` command).

**Frontend (`app/src/`)**
- `lib/bible.ts` — `NoteHit` interface + `searchNotes` wrapper. *(Task 3)*
- `features/search/SearchScopeControl.tsx` — **new** Scripture/My-notes toggle. *(Task 4)*
- `features/search/NoteSearchResults.tsx` — **new** results list + `highlightTokens`. *(Task 5)*
- `App.tsx` — scope state, toggle, notes search effect, render branch, `onSelectNote`, hide scripture-only controls in notes scope. *(Task 6)*

**Tests**
- `user_db.rs` `#[cfg(test)]` — `search_notes` + `like_pattern`. *(Task 1)*
- `lib.rs` `#[cfg(test)]` — `format_note_citation`. *(Task 2)*
- `app/tests/e2e/notes-search.spec.ts` — **new**. *(Task 7)*

---

## Task 1: `user_db` — `like_pattern` + `search_notes`

**Files:** Modify `app/src-tauri/src/user_db.rs` (add near the note functions, ~line 8330+). Test: same file's `#[cfg(test)]`.

- [ ] **Step 1: Write the failing tests**

Add to the `#[cfg(test)]` module (use the existing `test_conn()` helper and the public `upsert_note`/`upsert_range_note`):

```rust
#[test]
fn search_notes_matches_all_tokens_case_insensitively() {
    let conn = test_conn();
    upsert_note(&conn, 1_001_001, "God is love").unwrap();
    upsert_range_note(&conn, 1_001_002, 1_001_005, "love your neighbour").unwrap();
    upsert_note(&conn, 1_001_010, "the law and the prophets").unwrap();

    // single token matches both "love" notes, not the third
    let hits = search_notes(&conn, &["love".to_string()], 50).unwrap();
    let bodies: Vec<&str> = hits.iter().map(|h| h.body.as_str()).collect();
    assert!(bodies.contains(&"God is love"));
    assert!(bodies.contains(&"love your neighbour"));
    assert!(!bodies.contains(&"the law and the prophets"));

    // multi-token AND: only the range note has both words
    let hits = search_notes(&conn, &["love".to_string(), "neighbour".to_string()], 50).unwrap();
    assert_eq!(hits.len(), 1);
    assert_eq!(hits[0].kind, "range");
    assert_eq!(hits[0].end_verse_id, Some(1_001_005));

    // case-insensitive
    let hits = search_notes(&conn, &["LOVE".to_string()], 50).unwrap();
    assert_eq!(hits.len(), 2);

    // empty tokens -> empty
    assert!(search_notes(&conn, &[], 50).unwrap().is_empty());
}

#[test]
fn like_pattern_escapes_wildcards() {
    assert_eq!(like_pattern("a_b"), "%a\\_b%");
    assert_eq!(like_pattern("50%"), "%50\\%%");
    assert_eq!(like_pattern("grace"), "%grace%");
}
```

- [ ] **Step 2: Run to verify failure**

Run (from `app/`): `cargo test --manifest-path ./src-tauri/Cargo.toml search_notes_matches`
Expected: FAIL — `cannot find function 'search_notes'` / `like_pattern` / `NoteMatch`.

- [ ] **Step 3: Implement**

Add near the other note functions (e.g. just before `get_note`):

```rust
#[derive(Serialize, Clone, Debug, PartialEq)]
pub struct NoteMatch {
    pub kind: String, // "verse" | "range"
    pub verse_id: i64, // verse note: the verse; range note: start_verse_id
    pub end_verse_id: Option<i64>,
    pub body: String,
    pub updated_at: String,
}

/// Build a case-insensitive substring LIKE pattern, escaping SQLite LIKE
/// metacharacters so they match literally (paired with `ESCAPE '\'`).
fn like_pattern(token: &str) -> String {
    let mut out = String::with_capacity(token.len() + 2);
    out.push('%');
    for ch in token.chars() {
        if matches!(ch, '\\' | '%' | '_') {
            out.push('\\');
        }
        out.push(ch);
    }
    out.push('%');
    out
}

/// Find notes whose body contains every token (case-insensitive substring),
/// most-recently-edited first. Spans both the verse-note and range-note tables.
pub fn search_notes(conn: &Connection, tokens: &[String], limit: i64) -> SqlResult<Vec<NoteMatch>> {
    if tokens.is_empty() {
        return Ok(Vec::new());
    }
    let patterns: Vec<String> = tokens.iter().map(|t| like_pattern(t)).collect();
    let cond = patterns
        .iter()
        .map(|_| "body LIKE ? ESCAPE '\\'")
        .collect::<Vec<_>>()
        .join(" AND ");

    let mut out: Vec<NoteMatch> = Vec::new();

    let verse_sql = format!("SELECT verse_id, body, updated_at FROM user_notes WHERE {cond}");
    {
        let mut stmt = conn.prepare(&verse_sql)?;
        let rows = stmt.query_map(rusqlite::params_from_iter(patterns.iter()), |r| {
            Ok(NoteMatch {
                kind: "verse".to_string(),
                verse_id: r.get(0)?,
                end_verse_id: None,
                body: r.get(1)?,
                updated_at: r.get(2)?,
            })
        })?;
        for row in rows {
            out.push(row?);
        }
    }

    let range_sql = format!(
        "SELECT start_verse_id, end_verse_id, body, updated_at FROM user_range_notes WHERE {cond}"
    );
    {
        let mut stmt = conn.prepare(&range_sql)?;
        let rows = stmt.query_map(rusqlite::params_from_iter(patterns.iter()), |r| {
            Ok(NoteMatch {
                kind: "range".to_string(),
                verse_id: r.get(0)?,
                end_verse_id: Some(r.get(1)?),
                body: r.get(2)?,
                updated_at: r.get(3)?,
            })
        })?;
        for row in rows {
            out.push(row?);
        }
    }

    // ISO-8601 timestamps sort lexically == chronologically; newest first.
    out.sort_by(|a, b| b.updated_at.cmp(&a.updated_at));
    out.truncate(limit.max(0) as usize);
    Ok(out)
}
```

- [ ] **Step 4: Run to verify pass**

Run: `cargo test --manifest-path ./src-tauri/Cargo.toml search_notes_matches like_pattern`
Expected: PASS.

- [ ] **Step 5: Gate + commit**

Run: `cargo fmt --manifest-path ./src-tauri/Cargo.toml && cargo clippy --manifest-path ./src-tauri/Cargo.toml --no-deps -- -D warnings && cargo test --manifest-path ./src-tauri/Cargo.toml`
Then:
```bash
git add app/src-tauri/src/user_db.rs
git commit -m "feat(notes): search_notes LIKE scan over verse + range notes"
```

---

## Task 2: `lib.rs` — citation stitch + `search_notes` command

**Files:** Modify `app/src-tauri/src/lib.rs` (add structs/helper near the other note commands ~2847; register in `generate_handler!` ~3436). Test: same file.

- [ ] **Step 1: Write the failing test for the citation helper**

Add a test module near the end of `lib.rs`:

```rust
#[cfg(test)]
mod note_citation_tests {
    use super::format_note_citation;

    #[test]
    fn formats_single_and_ranges() {
        assert_eq!(format_note_citation("Genesis", 1, 1, None), "Genesis 1:1");
        assert_eq!(format_note_citation("Genesis", 1, 1, Some((1, 5))), "Genesis 1:1-5");
        assert_eq!(format_note_citation("Genesis", 1, 31, Some((2, 1))), "Genesis 1:31-2:1");
    }
}
```

- [ ] **Step 2: Run to verify failure**

Run: `cargo test --manifest-path ./src-tauri/Cargo.toml note_citation_tests`
Expected: FAIL — `cannot find function 'format_note_citation'`.

- [ ] **Step 3: Add the struct, helper, and command**

Add near the note commands (e.g. just above `fn get_note` at ~2847):

```rust
#[derive(serde::Serialize)]
pub struct NoteHit {
    pub kind: String, // "verse" | "range"
    pub verse_id: i64,
    pub end_verse_id: Option<i64>,
    pub citation: String,
    pub book_id: i64,
    pub chapter: i64,
    pub verse: i64,
    pub body: String,
    pub updated_at: String,
}

/// "Genesis 1:1" / "Genesis 1:1-5" (same chapter) / "Genesis 1:31-2:1" (cross-chapter).
/// `end` is (end_chapter, end_verse) for range notes; same-book is assumed.
fn format_note_citation(book: &str, chapter: i64, verse: i64, end: Option<(i64, i64)>) -> String {
    match end {
        None => format!("{book} {chapter}:{verse}"),
        Some((ec, ev)) if ec == chapter => format!("{book} {chapter}:{verse}-{ev}"),
        Some((ec, ev)) => format!("{book} {chapter}:{verse}-{ec}:{ev}"),
    }
}

#[tauri::command]
fn search_notes(
    app: AppHandle,
    state: tauri::State<'_, UserDbState>,
    query: String,
    limit: Option<i64>,
) -> Result<Vec<NoteHit>, String> {
    let query = query.trim();
    if query.len() > 500 {
        return Err("search query is too long".to_string());
    }
    let tokens: Vec<String> = query.split_whitespace().map(str::to_string).collect();
    let limit = bounded_limit(limit, 50, 200);
    if tokens.is_empty() {
        return Ok(Vec::new());
    }

    let matches =
        with_user_db(&app, &state, |conn| user_db::search_notes(conn, &tokens, limit))?;
    if matches.is_empty() {
        return Ok(Vec::new());
    }

    // Collect the distinct verse ids (start + end) to resolve citations for.
    let mut ids: Vec<i64> = Vec::new();
    for m in &matches {
        ids.push(m.verse_id);
        if let Some(e) = m.end_verse_id {
            ids.push(e);
        }
    }
    ids.sort_unstable();
    ids.dedup();

    // Resolve book/chapter/verse + book name from the read-only corpus.
    let mut refs: std::collections::HashMap<i64, (i64, String, i64, i64)> =
        std::collections::HashMap::new();
    {
        let conn = open_corpus(&app)?;
        let placeholders = ids.iter().map(|_| "?").collect::<Vec<_>>().join(",");
        let sql = format!(
            "SELECT v.id, v.book_id, b.name, v.chapter, v.verse
             FROM verses v JOIN books b ON b.id = v.book_id
             WHERE v.id IN ({placeholders})"
        );
        let mut stmt = conn.prepare(&sql).map_err(|e| e.to_string())?;
        let rows = stmt
            .query_map(rusqlite::params_from_iter(ids.iter()), |r| {
                Ok((
                    r.get::<_, i64>(0)?,
                    r.get::<_, i64>(1)?,
                    r.get::<_, String>(2)?,
                    r.get::<_, i64>(3)?,
                    r.get::<_, i64>(4)?,
                ))
            })
            .map_err(|e| e.to_string())?;
        for row in rows {
            let (id, book_id, name, chapter, verse) = row.map_err(|e| e.to_string())?;
            refs.insert(id, (book_id, name, chapter, verse));
        }
    }

    // Assemble hits, preserving the recency order from search_notes.
    let mut hits: Vec<NoteHit> = Vec::new();
    for m in matches {
        let Some((book_id, book_name, chapter, verse)) = refs.get(&m.verse_id).cloned() else {
            continue; // note references a verse absent from corpus; skip defensively
        };
        let end = m
            .end_verse_id
            .and_then(|e| refs.get(&e).map(|(_, _, ec, ev)| (*ec, *ev)));
        let citation = format_note_citation(&book_name, chapter, verse, end);
        hits.push(NoteHit {
            kind: m.kind,
            verse_id: m.verse_id,
            end_verse_id: m.end_verse_id,
            citation,
            book_id,
            chapter,
            verse,
            body: m.body,
            updated_at: m.updated_at,
        });
    }
    Ok(hits)
}
```

- [ ] **Step 4: Register the command**

In the `tauri::generate_handler![ ... ]` list (~line 3436, where `search,` is), add `search_notes,` (e.g. right after `search,`).

- [ ] **Step 5: Run citation test + verify it passes**

Run: `cargo test --manifest-path ./src-tauri/Cargo.toml note_citation_tests`
Expected: PASS.

- [ ] **Step 6: Full Rust gate + commit**

Run: `cargo fmt --manifest-path ./src-tauri/Cargo.toml && cargo clippy --manifest-path ./src-tauri/Cargo.toml --no-deps -- -D warnings && cargo test --manifest-path ./src-tauri/Cargo.toml`
Expected: clean + all tests pass.
```bash
git add app/src-tauri/src/lib.rs
git commit -m "feat(notes): search_notes command with corpus citation stitch"
```

---

## Task 3: Frontend types + `searchNotes` wrapper

**Files:** Modify `app/src/lib/bible.ts` (near the `Note`/`RangeNote` types ~874 and note wrappers ~888).

- [ ] **Step 1: Add the type + wrapper**

After the existing note wrappers (e.g. after `listRangeNotesForChapter`, around line 910), add:

```ts
export interface NoteHit {
  kind: "verse" | "range";
  verse_id: number;
  end_verse_id: number | null;
  citation: string;
  book_id: number;
  chapter: number;
  verse: number;
  body: string;
  updated_at: string;
}

export const searchNotes = (query: string, limit = 50) =>
  invoke<NoteHit[]>("search_notes", { query, limit });
```

- [ ] **Step 2: Type-check**

Run (from `app/`): `npx tsc --noEmit`
Expected: no errors (this only adds exports).

- [ ] **Step 3: Commit**

```bash
git add app/src/lib/bible.ts
git commit -m "feat(notes): NoteHit type + searchNotes wrapper"
```

---

## Task 4: `SearchScopeControl` component

**Files:** Create `app/src/features/search/SearchScopeControl.tsx`.

- [ ] **Step 1: Create the component** (mirrors `SearchStrategyControl.tsx`)

```tsx
export type SearchScope = "scripture" | "notes";

const OPTIONS: Array<{ value: SearchScope; label: string }> = [
  { value: "scripture", label: "Scripture" },
  { value: "notes", label: "My notes" },
];

interface Props {
  value: SearchScope;
  onChange: (value: SearchScope) => void;
}

export function SearchScopeControl({ value, onChange }: Props) {
  return (
    <div
      role="group"
      aria-label="Search scope"
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
            data-testid={`search-scope-${opt.value}`}
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
Expected: no errors from this file.

- [ ] **Step 3: Commit**

```bash
git add app/src/features/search/SearchScopeControl.tsx
git commit -m "feat(notes): add Scripture/My-notes scope control"
```

---

## Task 5: `NoteSearchResults` component (+ highlight)

**Files:** Create `app/src/features/search/NoteSearchResults.tsx`.

- [ ] **Step 1: Create the component**

```tsx
import type { NoteHit } from "../../lib/bible";

interface Props {
  query: string;
  results: NoteHit[];
  loading: boolean;
  onSelect: (hit: NoteHit) => void;
}

// Split text into chunks, marking case-insensitive matches of any token.
// Purely presentational; returns text + highlight chunks (never raw HTML).
function highlightTokens(text: string, tokens: string[]) {
  const cleaned = tokens.map((t) => t.trim()).filter(Boolean);
  if (cleaned.length === 0) return [{ text, highlight: false }];
  const escaped = cleaned.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const re = new RegExp(`(${escaped.join("|")})`, "gi");
  return text
    .split(re)
    .filter((part) => part.length > 0)
    .map((part) => ({ text: part, highlight: re.test(part) && cleaned.some((t) => part.toLowerCase() === t.toLowerCase()) }));
}

export function NoteSearchResults({ query, results, loading, onSelect }: Props) {
  const tokens = query.trim().split(/\s+/).filter(Boolean);
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
          {loading ? "searching…" : `${results.length} note${results.length === 1 ? "" : "s"}`}
        </span>
      </header>

      {!loading && results.length === 0 ? (
        <div className="soft-card px-4 py-5 text-sm text-neutral-500">
          No notes match. Try a different or shorter word.
        </div>
      ) : (
        <ul className="space-y-2">
          {results.map((hit) => (
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
                </div>
                <p className="text-neutral-200 text-sm leading-relaxed">
                  {highlightTokens(hit.body, tokens).map((chunk, i) =>
                    chunk.highlight ? (
                      <mark key={i}>{chunk.text}</mark>
                    ) : (
                      <span key={i}>{chunk.text}</span>
                    ),
                  )}
                </p>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `cd app && npx tsc --noEmit`
Expected: no errors from this file.

- [ ] **Step 3: Commit**

```bash
git add app/src/features/search/NoteSearchResults.tsx
git commit -m "feat(notes): NoteSearchResults with client-side highlight"
```

---

## Task 6: Wire `App.tsx`

**Files:** Modify `app/src/App.tsx` (imports ~43-50; state ~204-229; refs near `searchRequestId`; the scripture search effect ~403-458; the search-panel render ~986+ near `SearchInput`/`SearchStrategyControl`; the results render ~1255+ near `<SearchResults>`; `onSelectSearchHit` ~680).

- [ ] **Step 1: Imports**

After the `SearchStrategyControl` import, add:

```tsx
import { SearchScopeControl, type SearchScope } from "./features/search/SearchScopeControl";
import { NoteSearchResults } from "./features/search/NoteSearchResults";
```
And add `type NoteHit,` and `searchNotes,` to the `./lib/bible` import list.

- [ ] **Step 2: State + refs**

Near the other search state (after `searchDegradedReason`), add:

```tsx
  const [searchScope, setSearchScope] = useState<SearchScope>("scripture");
  const [noteResults, setNoteResults] = useState<NoteHit[]>([]);
  const [noteLoading, setNoteLoading] = useState(false);
```
Near `const searchRequestId = useRef(0);` / `searchTimer`, add matching refs:

```tsx
  const noteRequestId = useRef(0);
  const noteTimer = useRef<number | null>(null);
```

- [ ] **Step 3: Gate the scripture effect to scripture scope**

In the existing scripture search effect, right after `const trimmed = searchQuery.trim();` and the empty-query early return, add a scope guard so scripture search doesn't run (and results clear) when scope is notes:

```tsx
    if (searchScope !== "scripture") {
      setSearchResults([]);
      setSearchLoading(false);
      return;
    }
```
Add `searchScope` to that effect's dependency array.

- [ ] **Step 4: Add the notes search effect**

Add a new effect (next to the scripture one):

```tsx
  useEffect(() => {
    if (noteTimer.current) window.clearTimeout(noteTimer.current);
    const requestId = ++noteRequestId.current;
    const trimmed = searchQuery.trim();
    if (searchScope !== "notes" || !trimmed) {
      setNoteResults([]);
      setNoteLoading(false);
      return;
    }
    setNoteLoading(true);
    noteTimer.current = window.setTimeout(() => {
      noteTimer.current = null;
      searchNotes(trimmed, 100)
        .then((hits) => {
          if (requestId === noteRequestId.current) setNoteResults(hits);
        })
        .catch((e) => {
          if (requestId === noteRequestId.current) setError(String(e));
        })
        .finally(() => {
          if (requestId === noteRequestId.current) setNoteLoading(false);
        });
    }, 250);
    return () => {
      if (noteTimer.current) window.clearTimeout(noteTimer.current);
    };
  }, [searchQuery, searchScope]);
```

- [ ] **Step 5: Render the scope toggle + hide scripture-only controls**

Just before `<SearchInput value={searchQuery} onChange={updateSearchQuery} />`, add the scope toggle:

```tsx
          <div className="mb-2">
            <SearchScopeControl value={searchScope} onChange={setSearchScope} />
          </div>
```
Then wrap the scripture-only controls — the `SearchStrategyControl` block (added previously, the `<div className="mt-2"><SearchStrategyControl .../></div>`), the `<p className="nav-section-title">Search in</p>` label, and the translation/testament/book filter `<div>`/`<select>`s — in a single conditional so they only show in scripture scope:

```tsx
          {searchScope === "scripture" && (
            <>
              {/* existing SearchStrategyControl div, "Search in" label, and filter selects */}
            </>
          )}
```
(Move those existing elements inside this fragment; do not duplicate them.)

- [ ] **Step 6: `onSelectNote` handler**

Near `onSelectSearchHit` (~680), add:

```tsx
  const onSelectNote = (hit: NoteHit) =>
    jumpToVerse(hit.verse_id, activeTranslations[0] ?? "KJV");
```

- [ ] **Step 7: Branch the results render**

Where `<SearchResults ... />` is rendered (inside the `searchActive` branch, ~1255), wrap so notes scope shows the note results instead:

```tsx
          {searchScope === "notes" ? (
            <NoteSearchResults
              query={searchQuery.trim()}
              results={noteResults}
              loading={noteLoading}
              onSelect={onSelectNote}
            />
          ) : (
            <SearchResults
              /* ...all existing SearchResults props unchanged... */
            />
          )}
```
(Keep the existing `<SearchResults>` element and its props exactly; only wrap it in the ternary.)

- [ ] **Step 8: Build**

Run (from `app/`): `npm run build`
Expected: `tsc` clean + `vite build` succeeds.

- [ ] **Step 9: Commit**

```bash
git add app/src/App.tsx
git commit -m "feat(notes): wire scope toggle + note search into App"
```

---

## Task 7: E2E — create a note, search it

**Files:** Create `app/tests/e2e/notes-search.spec.ts` and register it in `app/wdio.conf.mts`.

Context: the reader lets you open a verse's panel and write a note (component `VersePanel`, a "note" tab with a textarea + save). FIRST read `app/tests/e2e/reader-interactions.spec.ts` to copy how it reaches the reader, selects a verse, and interacts with the verse panel/note tab (reuse its exact selectors and onboarding/tour handling). Note hooks added by this feature: `[data-testid="search-scope-scripture"]` / `[data-testid="search-scope-notes"]`, `[data-testid="note-result"]`. Search box: `input[type="search"]`.

- [ ] **Step 1: Write the spec**

Mirror the existing specs' structure. Outline (adapt selectors to what `reader-interactions.spec.ts` actually uses for opening a verse + note tab + saving):

```ts
import { browser, $, expect } from "@wdio/globals";

describe("Search your notes", () => {
  it("finds a note by its text and shows its citation", async () => {
    // (reuse the existing spec's steps to: reach the reader, open a verse,
    //  open its note tab, type a distinctive note, and save it)
    // ... create a note containing the word "zephaniahtest" ...

    // Switch search scope to My notes and search the distinctive word.
    const searchBox = await $('input[type="search"]');
    await searchBox.setValue("zephaniahtest");
    const notesScope = await $('[data-testid="search-scope-notes"]');
    await notesScope.click();
    await expect(notesScope).toHaveAttribute("aria-pressed", "true");

    // A note result appears.
    const result = await $('[data-testid="note-result"]');
    await result.waitForDisplayed({ timeout: 15000 });
    await expect(result).toHaveText(expect.stringContaining("zephaniahtest"), { containing: true, ignoreCase: true });
  });
});
```

Use a distinctive nonsense word for the note body so the assertion is unambiguous. If creating a note in e2e proves impractical with the current harness (e.g. the note save flow is hard to drive), instead assert the empty path deterministically: switch to "My notes" with a query that matches nothing and assert the "No notes match" empty-state renders — and report that as a reduced-but-passing test. Prefer the full create-then-find flow if achievable.

- [ ] **Step 2: Register + run**

Add the spec to the `specs` array in `app/wdio.conf.mts` (before `release-readiness.spec.ts`). Run (from `app/`, allow ~10 min): `npm run test:e2e:build`
Expected: the new spec passes and all pre-existing specs still pass. If it fails for infra reasons (driver/build), report BLOCKED with details rather than thrashing.

- [ ] **Step 3: Commit**

```bash
git add app/tests/e2e/notes-search.spec.ts app/wdio.conf.mts
git commit -m "test(notes): e2e for note search"
```

---

## Task 8: Full gate + finish

- [ ] **Step 1: Full check gate**

Run (from `app/`): `npm run check`
Expected: exit 0.

- [ ] **Step 2: Manual smoke (optional)**

Launch the app, write a note on a verse, switch the search scope to "My notes", search a word from it, confirm the note appears with its citation and the word highlighted, and that clicking navigates to the verse.

- [ ] **Step 3: Update spec status**

In `docs/superpowers/specs/2026-05-25-notes-search-design.md`, set `Status:` to `Implemented`. Commit:
```bash
git add docs/superpowers/specs/2026-05-25-notes-search-design.md
git commit -m "docs(notes): mark notes-search spec implemented"
```

- [ ] **Step 4: Finish the branch** via the finishing-a-development-branch workflow (verify tests → present merge/PR options).

---

## Self-Review (completed by plan author)

- **Spec coverage:** search both note tables (Task 1) ✓; all-tokens substring, case-insensitive, recency (Task 1) ✓; citation stitch from corpus + range citation (Task 2) ✓; scope toggle hiding scripture-only controls (Task 6 Steps 5/7) ✓; dedicated `NoteSearchResults` with highlight + click-to-verse (Tasks 5, 6) ✓; session-only scope, no persistence (Task 6 state default, never saved) ✓; no schema migration ✓; tests (Tasks 1, 2, 7) ✓; non-goals respected (no bookmarks, no FTS, no notes browser) ✓.
- **Type consistency:** Rust `NoteMatch` → command builds `NoteHit`; Rust `NoteHit` fields (snake_case, `end_verse_id: Option<i64>`, `book_id/chapter/verse`) mirror the TS `NoteHit` (`end_verse_id: number | null`); `searchNotes(query, limit)` invoke args (`query`, `limit`) match the command params; `SearchScope` type shared from `SearchScopeControl`; `kind` values `"verse"|"range"` consistent across `search_notes`, `NoteHit`, and the React key.
- **Placeholder scan:** Task 7's note-creation steps are intentionally adaptive (must mirror the real reader spec) with an explicit deterministic fallback; every other step has complete code and exact commands.
