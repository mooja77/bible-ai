# Study Tags E2 — Tag Verse Notes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Tag verse notes from the Note tab (reusing a generalized tag row) and filter the note-search results by tag.

**Architecture:** Generalize `BookmarkTagRow` → presentational `ItemTagRow` (parameterized `testIdPrefix`); `NoteTab` self-fetches its tags and renders `ItemTagRow`; `NoteSearchResults` gains a tag filter derived from the notes' own tags. Frontend-only (the `item_type='note'` backend already exists).

**Tech Stack:** React 19 + TypeScript, WebdriverIO e2e.

**Spec:** `docs/superpowers/specs/2026-05-26-study-tags-notes-design.md`

**Verification:** `npm run build` + full `npm run check` + `npm run test:e2e:build` (incl. the E1 bookmark e2e as a regression check that the refactor preserved its selectors).

---

## File Structure

- `app/src/features/tags/TagControls.tsx` — `BookmarkTagRow` → `ItemTagRow`. *(Task 1)*
- `app/src/App.tsx` — bookmark call site update; note-search tag state + props. *(Task 1 + Task 3)*
- `app/src/features/reader/VersePanel.tsx` — `NoteTab` tagging. *(Task 2)*
- `app/src/features/search/NoteSearchResults.tsx` — tag filter + chips. *(Task 3)*
- `app/tests/e2e/notes-search.spec.ts` — tag a note + filter. *(Task 4)*

---

## Task 1: Generalize the tag row + update the bookmark call site

- [ ] **Step 1: `TagControls.tsx` — rename `BookmarkTagRow` → `ItemTagRow`.** Replace the whole `BookmarkTagRow` component with:

```tsx
export function ItemTagRow({
  testIdPrefix,
  tags,
  allTags,
  onAttach,
  onDetach,
}: {
  testIdPrefix: string;
  tags: ItemTag[];
  allTags: Tag[];
  onAttach: (name: string) => void;
  onDetach: (tagId: number) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [value, setValue] = useState("");
  const datalistId = `tag-options-${testIdPrefix}`;

  const submit = () => {
    const name = value.trim();
    setValue("");
    setAdding(false);
    if (name) onAttach(name);
  };

  return (
    <div className="flex flex-wrap items-center gap-1 mt-1">
      {tags.map((t) => (
        <span
          key={t.tag_id}
          data-testid={`${testIdPrefix}-tag-chip`}
          className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] bg-neutral-800 text-neutral-300"
        >
          {t.name}
          <button
            type="button"
            onClick={() => onDetach(t.tag_id)}
            aria-label={`Remove tag ${t.name}`}
            className="text-neutral-500 hover:text-red-400"
          >
            ×
          </button>
        </span>
      ))}
      {adding ? (
        <>
          <input
            autoFocus
            list={datalistId}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                submit();
              } else if (e.key === "Escape") {
                setValue("");
                setAdding(false);
              }
            }}
            onBlur={submit}
            placeholder="tag…"
            aria-label="Add tag"
            data-testid={`${testIdPrefix}-tag-input`}
            className="settings-input h-5 w-20 text-[11px] px-1"
          />
          <datalist id={datalistId}>
            {allTags.map((t) => (
              <option key={t.id} value={t.name} />
            ))}
          </datalist>
        </>
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          aria-label="Add tag"
          data-testid={`${testIdPrefix}-add-tag`}
          className="px-1 text-[11px] text-neutral-500 hover:text-amber-300"
        >
          + tag
        </button>
      )}
    </div>
  );
}
```

(`TagFilterBar` is unchanged. Keep the imports `import { useState } from "react"; import type { Tag, ItemTag } from "../../lib/bible";`.)

- [ ] **Step 2: `App.tsx` — update the bookmark usage.** Change the import `BookmarkTagRow` → `ItemTagRow` in the `./features/tags/TagControls` import. At the bookmark render, replace:

```tsx
                  <BookmarkTagRow
                    bookmarkId={b.id}
                    tags={bookmarkTags.filter((it) => it.item_id === b.id)}
                    allTags={tags}
                    onAttach={onAttachBookmarkTag}
                    onDetach={onDetachBookmarkTag}
                  />
```

with:

```tsx
                  <ItemTagRow
                    testIdPrefix="bookmark"
                    tags={bookmarkTags.filter((it) => it.item_id === b.id)}
                    allTags={tags}
                    onAttach={(name) => onAttachBookmarkTag(b.id, name)}
                    onDetach={(tagId) => onDetachBookmarkTag(b.id, tagId)}
                  />
```

(The `onAttachBookmarkTag(bookmarkId, name)` / `onDetachBookmarkTag(bookmarkId, tagId)` handlers are unchanged — the closures supply `b.id`.)

- [ ] **Step 3:** `npm run build` → tsc clean + vite build. Commit:

```bash
git add app/src/features/tags/TagControls.tsx app/src/App.tsx
git commit -m "refactor(tags): generalize BookmarkTagRow to ItemTagRow (testIdPrefix)"
```

---

## Task 2: Tag verse notes in `NoteTab` (`VersePanel.tsx`)

READ `NoteTab` (~line 562) first. It self-fetches the note via `getNote(verseId)` and renders a `<div className="space-y-2 py-1">` with a textarea + a status/delete row.

- [ ] **Step 1: Imports.** Add to the `../../lib/bible` import block in `VersePanel.tsx`: `createTag`, `tagItem`, `untagItem`, `listTags`, `listItemTags`, `type Tag`, `type ItemTag`. Add `import { ItemTagRow } from "../tags/TagControls";`.

- [ ] **Step 2: Tag state + fetch in `NoteTab`.** After the existing `useState`s, add:

```tsx
  const [allTags, setAllTags] = useState<Tag[]>([]);
  const [noteTags, setNoteTags] = useState<ItemTag[]>([]);
```

Add a verseId-guarded fetch effect (next to the existing note-load effect):

```tsx
  useEffect(() => {
    let cancelled = false;
    Promise.all([listTags(), listItemTags("note")])
      .then(([all, links]) => {
        if (cancelled) return;
        setAllTags(all);
        setNoteTags(links.filter((it) => it.item_id === verseId));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [verseId]);
```

And a reload + attach/detach helpers (after `save`):

```tsx
  const reloadNoteTags = async () => {
    const [all, links] = await Promise.all([listTags(), listItemTags("note")]);
    setAllTags(all);
    setNoteTags(links.filter((it) => it.item_id === verseId));
  };

  const attachNoteTag = async (name: string) => {
    const t = await createTag(name);
    await tagItem(t.id, "note", verseId);
    await reloadNoteTags();
  };

  const detachNoteTag = async (tagId: number) => {
    await untagItem(tagId, "note", verseId);
    await reloadNoteTags();
  };
```

- [ ] **Step 3: Render the tag row.** Inside `NoteTab`'s returned `<div className="space-y-2 py-1">`, add as the last child (after the status/delete `<div>`):

```tsx
      <ItemTagRow
        testIdPrefix="note"
        tags={noteTags}
        allTags={allTags}
        onAttach={attachNoteTag}
        onDetach={detachNoteTag}
      />
```

- [ ] **Step 4:** `npm run build` → tsc clean + vite build. Commit:

```bash
git add app/src/features/reader/VersePanel.tsx
git commit -m "feat(tags): tag verse notes from the Note tab"
```

---

## Task 3: Tag filter on note search

- [ ] **Step 1: `App.tsx` state.** Near `const [noteResults, setNoteResults] = useState<NoteHit[]>([]);` (~245) add:

```tsx
  const [noteTags, setNoteTags] = useState<ItemTag[]>([]);
  const [noteTagFilter, setNoteTagFilter] = useState<number | null>(null);
```

(Confirm `ItemTag` is imported in `App.tsx` — it is, from E1.)

- [ ] **Step 2: `App.tsx` load + reset.** In the note-search effect (~514): in the early-return branch (`if (searchScope !== "notes" || !trimmed) { … }`), add `setNoteTags([]);` and `setNoteTagFilter(null);`. Inside the debounce timeout, after the `searchNotes(...)` chain, also fetch note tags:

```tsx
      listItemTags("note")
        .then((links) => {
          if (requestId === noteRequestId.current) setNoteTags(links);
        })
        .catch(() => {});
```

(`listItemTags` must be imported in `App.tsx` — it is, from E1.)

- [ ] **Step 3: `App.tsx` props.** At `<NoteSearchResults … />` (~1365) add:

```tsx
              noteTags={noteTags}
              selectedTagId={noteTagFilter}
              onSelectTag={setNoteTagFilter}
```

- [ ] **Step 4: `NoteSearchResults.tsx` — filter + chips.** Replace the file with:

```tsx
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
                        className="px-1.5 py-0.5 rounded text-[11px] bg-neutral-800 text-neutral-300"
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
```

- [ ] **Step 5:** `npm run build` → tsc clean + vite build. Commit:

```bash
git add app/src/App.tsx app/src/features/search/NoteSearchResults.tsx
git commit -m "feat(tags): filter note search by tag + show note tags on hits"
```

---

## Task 4: E2E — tag a verse note and filter note search

**Files:** extend `app/tests/e2e/notes-search.spec.ts`. The existing test creates a verse note with `DISTINCTIVE_WORD`, saves on blur, then finds it in "My notes" search.

- [ ] **Step 1: Tag the note before closing the panel.** After the `Saved` confirmation (`await savedStatus.waitForDisplayed(...)`) and BEFORE `const closeBtn = await $('button[aria-label="Close verse panel"]');`, insert:

```ts
    // Tag the note from the Note tab.
    const tagName = `notetag${Date.now()}`;
    await $('[data-testid="note-add-tag"]').click();
    const noteTagInput = await $('[data-testid="note-tag-input"]');
    await noteTagInput.waitForDisplayed({ timeout: 5_000 });
    await noteTagInput.setValue(tagName);
    await browser.keys("Enter");
    const noteChip = await $(`[data-testid="note-tag-chip"]*=${tagName}`);
    await noteChip.waitForDisplayed({ timeout: 10_000 });
```

- [ ] **Step 2: Assert the tag in note search.** After the existing note-result assertions (after `await expect(noteResult).toHaveText("Genesis", …)`), and BEFORE the "Clear the search" teardown, insert:

```ts
    // The note-search hit shows the tag, and filtering by it keeps the note visible.
    await expect(await $('[data-testid="note-result-tag"]*=' + tagName)).toBeDisplayed();
    // TagFilterBar renders inside note search too; its tag is a <button> (hit chips are <span>),
    // so `button=<tagName>` uniquely targets the filter chip:
    await (await $('button=' + tagName)).click();
    await expect(await $('[data-testid="note-result"]')).toBeDisplayed();
```

Note: `TagFilterBar` uses `data-testid="bookmark-tag-filter"` (a shared id from E1). If selecting the filter chip by `button=${tagName}` is ambiguous (the tag also appears as a chip on the hit, but chips on hits are `<span>`, not `<button>`, so `button=${tagName}` uniquely matches the filter bar's button), proceed; otherwise scope via the filter container. After clicking, the note result must still be displayed. (Then the existing teardown clears the search + resets scope.)

- [ ] **Step 3:** Run (from `app/`, ~10 min, 600000 ms timeout): `npm run test:e2e:build`. Expect the extended note test + the E1 bookmark-tag test + all pre-existing specs pass. INFRA failure → BLOCKED.

- [ ] **Step 4: Commit**

```bash
git add app/tests/e2e/notes-search.spec.ts
git commit -m "test(tags): e2e for tagging a verse note and filtering note search"
```

---

## Task 5: Full gate + finish

- [ ] **Step 1:** `npm run check` (from `app/`) → exit 0. (Capture the REAL exit code — do not read `$?` through a pipe to `tail`; redirect to a file then check `$?`, or use pwsh `$LASTEXITCODE`.)
- [ ] **Step 2:** Set the spec `Status:` to `Implemented`; commit `docs(tags): mark study-tags-notes spec implemented`.
- [ ] **Step 3:** Finish the branch (finishing-a-development-branch): verify tests → merge to main.

---

## Self-Review (plan author)

- **Spec coverage:** generalize row → `ItemTagRow` w/ `testIdPrefix` (Task 1) ✓; tag verse notes in Note tab via self-fetch (Task 2) ✓; note-search tag filter derived from notes' tags + chips on hits (Task 3) ✓; verse notes only, no backend change ✓; e2e tags a note + filters, E1 bookmark e2e preserved by `testIdPrefix="bookmark"` (Task 4) ✓.
- **Type/name consistency:** `ItemTagRow` props (`testIdPrefix`, `tags: ItemTag[]`, `allTags: Tag[]`, `onAttach(name)`, `onDetach(tagId)`) used identically at the bookmark site (closures bind `b.id`) and in `NoteTab`; `NoteSearchResults` filter predicate `it.item_id === hit.verse_id && it.tag_id === selectedTagId` matches `ItemTag{item_id,tag_id,name}` + `NoteHit.verse_id`; `tagItem(t.id, "note", verseId)` uses the validated `item_type`.
- **Placeholder scan:** full code for components; App.tsx note-search edits are anchored to the existing effect/early-return/call-site; the e2e filter-chip selector has an explicit disambiguation note (`button=` matches the filter bar, `<span>` chips don't).
