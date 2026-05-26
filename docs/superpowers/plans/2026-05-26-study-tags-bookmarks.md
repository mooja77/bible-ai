# Study Tags E1 — Tag Foundation + Tag Bookmarks Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a normalized tag system to `user.sqlite` and wire it end-to-end for bookmarks — create tags, attach/detach to bookmarks, show chips, and filter the sidebar bookmark list by tag.

**Architecture:** New `tags` + polymorphic `item_tags` tables (schema v14), Rust query fns + Tauri commands, `bible.ts` wrappers, a small `features/tags/TagControls.tsx` UI module, and `App.tsx` sidebar wiring. Backup/export integration is deliberately out of scope (see spec).

**Tech Stack:** Rust (rusqlite) + Tauri 2, React 19 + TypeScript, WebdriverIO e2e.

**Spec:** `docs/superpowers/specs/2026-05-26-study-tags-bookmarks-design.md`

**Verification:** Rust unit tests (`cargo test`, part of `npm run check`) + `npm run build` + full `npm run check` + `npm run test:e2e:build`.

---

## File Structure

- `app/src-tauri/src/user_db.rs` — schema + version bump, `Tag`/`ItemTag` structs, tag fns, `delete_bookmark` cleanup, unit tests. *(Task 1)*
- `app/src-tauri/src/lib.rs` — 6 tag commands + `item_type` validation + registration. *(Task 2)*
- `app/src/lib/bible.ts` — `Tag`/`ItemTag` types + 6 wrappers. *(Task 3)*
- `app/src/features/tags/TagControls.tsx` — **new**; `TagFilterBar` + `BookmarkTagRow`. *(Task 4)*
- `app/src/App.tsx` — state, load, handlers, prop threading, render. *(Task 5)*
- `app/tests/e2e/reader-interactions.spec.ts` — new tag e2e. *(Task 6)*

---

## Task 1: Schema + Rust tag fns + tests (`user_db.rs`)

- [ ] **Step 1: Bump the schema version.** Change `pub const USER_SCHEMA_VERSION: i64 = 13;` to `14`.

- [ ] **Step 2: Add the tables to the `USER_SCHEMA` batch.** Inside the `USER_SCHEMA` string (the big `r#"..."#` ending at the `idx_module_entries_key` index, ~line 366), append before the closing `"#`:

```sql

CREATE TABLE IF NOT EXISTS tags (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE COLLATE NOCASE,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS item_tags (
  tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  item_type TEXT NOT NULL CHECK (item_type IN ('bookmark', 'note', 'range_note', 'study_item')),
  item_id INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (tag_id, item_type, item_id)
);

CREATE INDEX IF NOT EXISTS idx_item_tags_item ON item_tags(item_type, item_id);
```

(Do **not** modify `USER_TABLES` — backup/export is out of scope.)

- [ ] **Step 3: Add structs + fns.** In the `// ---------- Bookmarks and reading history ----------` area (or a new `// ---------- Tags ----------` section), add:

```rust
#[derive(Serialize, Clone)]
pub struct Tag {
    pub id: i64,
    pub name: String,
    pub created_at: String,
}

#[derive(Serialize, Clone)]
pub struct ItemTag {
    pub item_id: i64,
    pub tag_id: i64,
    pub name: String,
}

/// Find-or-create a tag by (case-insensitive) name. Returns the existing or new row.
pub fn create_tag(conn: &Connection, name: &str) -> SqlResult<Tag> {
    let name = name.trim();
    if name.is_empty() {
        // Mirror the existing blank-field rejection convention used by insert_session.
        return Err(rusqlite::Error::InvalidParameterName(
            "tag name must not be empty".into(),
        ));
    }
    conn.execute(
        "INSERT INTO tags (name) VALUES (?) ON CONFLICT(name) DO NOTHING",
        params![name],
    )?;
    conn.query_row(
        "SELECT id, name, created_at FROM tags WHERE name = ?",
        params![name],
        |r| {
            Ok(Tag {
                id: r.get(0)?,
                name: r.get(1)?,
                created_at: r.get(2)?,
            })
        },
    )
}

pub fn list_tags(conn: &Connection) -> SqlResult<Vec<Tag>> {
    let mut stmt = conn.prepare(
        "SELECT id, name, created_at FROM tags ORDER BY name COLLATE NOCASE",
    )?;
    let rows = stmt.query_map([], |r| {
        Ok(Tag {
            id: r.get(0)?,
            name: r.get(1)?,
            created_at: r.get(2)?,
        })
    })?;
    rows.collect()
}

pub fn delete_tag(conn: &Connection, id: i64) -> SqlResult<usize> {
    // ON DELETE CASCADE removes the item_tags links.
    conn.execute("DELETE FROM tags WHERE id = ?", params![id])
}

pub fn tag_item(conn: &Connection, tag_id: i64, item_type: &str, item_id: i64) -> SqlResult<usize> {
    conn.execute(
        "INSERT INTO item_tags (tag_id, item_type, item_id) VALUES (?, ?, ?)
         ON CONFLICT DO NOTHING",
        params![tag_id, item_type, item_id],
    )
}

pub fn untag_item(conn: &Connection, tag_id: i64, item_type: &str, item_id: i64) -> SqlResult<usize> {
    conn.execute(
        "DELETE FROM item_tags WHERE tag_id = ? AND item_type = ? AND item_id = ?",
        params![tag_id, item_type, item_id],
    )
}

pub fn list_item_tags(conn: &Connection, item_type: &str) -> SqlResult<Vec<ItemTag>> {
    let mut stmt = conn.prepare(
        "SELECT it.item_id, t.id, t.name
         FROM item_tags it JOIN tags t ON t.id = it.tag_id
         WHERE it.item_type = ?
         ORDER BY it.item_id, t.name COLLATE NOCASE",
    )?;
    let rows = stmt.query_map(params![item_type], |r| {
        Ok(ItemTag {
            item_id: r.get(0)?,
            tag_id: r.get(1)?,
            name: r.get(2)?,
        })
    })?;
    rows.collect()
}
```

**Note (convention):** if `insert_session` uses a different error type for blank-field rejection than `rusqlite::Error::InvalidParameterName`, match that instead — the only requirement is `create_tag(conn, "  ")` returns `Err`.

- [ ] **Step 4: Clean up `item_tags` on bookmark delete.** Replace the body of `delete_bookmark`:

```rust
pub fn delete_bookmark(conn: &Connection, id: i64) -> SqlResult<usize> {
    conn.execute(
        "DELETE FROM item_tags WHERE item_type = 'bookmark' AND item_id = ?",
        params![id],
    )?;
    conn.execute("DELETE FROM bookmarks WHERE id = ?", params![id])
}
```

- [ ] **Step 5: Unit tests.** In the `#[cfg(test)] mod tests` (where `add_bookmark_updates_...` lives), add tests using `let conn = test_conn();`:

```rust
    #[test]
    fn create_tag_is_find_or_create_case_insensitive() {
        let conn = test_conn();
        let a = create_tag(&conn, "Grace").expect("create");
        let b = create_tag(&conn, "  grace ").expect("find-or-create (trimmed, case-insensitive)");
        assert_eq!(a.id, b.id);
        assert_eq!(list_tags(&conn).expect("list").len(), 1);
        assert!(create_tag(&conn, "   ").is_err());
    }

    #[test]
    fn tag_item_is_idempotent_and_listed_grouped() {
        let conn = test_conn();
        let id = add_bookmark(&conn, 1_001_001, None, Some("b")).expect("bookmark");
        let t = create_tag(&conn, "alpha").expect("tag");
        assert_eq!(tag_item(&conn, t.id, "bookmark", id).expect("tag_item"), 1);
        assert_eq!(tag_item(&conn, t.id, "bookmark", id).expect("idempotent"), 0);
        let links = list_item_tags(&conn, "bookmark").expect("list");
        assert_eq!(links.len(), 1);
        assert_eq!(links[0].item_id, id);
        assert_eq!(links[0].name, "alpha");
        assert_eq!(untag_item(&conn, t.id, "bookmark", id).expect("untag"), 1);
        assert!(list_item_tags(&conn, "bookmark").expect("list2").is_empty());
    }

    #[test]
    fn delete_tag_cascades_links() {
        let conn = test_conn();
        let id = add_bookmark(&conn, 1_001_001, None, Some("b")).expect("bookmark");
        let t = create_tag(&conn, "beta").expect("tag");
        tag_item(&conn, t.id, "bookmark", id).expect("tag_item");
        delete_tag(&conn, t.id).expect("delete_tag");
        assert!(list_item_tags(&conn, "bookmark").expect("list").is_empty());
    }

    #[test]
    fn delete_bookmark_clears_its_item_tags() {
        let conn = test_conn();
        let id = add_bookmark(&conn, 1_001_001, None, Some("b")).expect("bookmark");
        let t = create_tag(&conn, "gamma").expect("tag");
        tag_item(&conn, t.id, "bookmark", id).expect("tag_item");
        delete_bookmark(&conn, id).expect("delete_bookmark");
        assert!(list_item_tags(&conn, "bookmark").expect("list").is_empty());
        // The tag itself remains in the vocabulary.
        assert_eq!(list_tags(&conn).expect("tags").len(), 1);
    }
```

- [ ] **Step 6:** Run `cargo test --manifest-path ./src-tauri/Cargo.toml` (from `app/`). Expect all tests pass (new + existing).

- [ ] **Step 7: Commit**

```bash
git add app/src-tauri/src/user_db.rs
git commit -m "feat(tags): tags + item_tags schema and query fns (user.sqlite v14)"
```

---

## Task 2: Tauri commands (`lib.rs`)

- [ ] **Step 1: Add `item_type` validation + the 6 commands.** Near the bookmark commands (~line 1228), add:

```rust
const TAGGABLE_ITEM_TYPES: &[&str] = &["bookmark", "note", "range_note", "study_item"];

fn validate_item_type(item_type: &str) -> Result<(), String> {
    if TAGGABLE_ITEM_TYPES.contains(&item_type) {
        Ok(())
    } else {
        Err(format!("unknown item_type: {item_type}"))
    }
}

#[tauri::command]
fn list_tags(
    app: AppHandle,
    state: tauri::State<'_, UserDbState>,
) -> Result<Vec<user_db::Tag>, String> {
    with_user_db(&app, &state, |conn| user_db::list_tags(conn).map_err(|e| e.to_string()))
}

#[tauri::command]
fn create_tag(
    app: AppHandle,
    state: tauri::State<'_, UserDbState>,
    name: String,
) -> Result<user_db::Tag, String> {
    if name.trim().is_empty() {
        return Err("tag name must not be empty".into());
    }
    with_user_db(&app, &state, |conn| user_db::create_tag(conn, &name).map_err(|e| e.to_string()))
}

#[tauri::command]
fn delete_tag(
    app: AppHandle,
    state: tauri::State<'_, UserDbState>,
    id: i64,
) -> Result<usize, String> {
    with_user_db(&app, &state, |conn| user_db::delete_tag(conn, id).map_err(|e| e.to_string()))
}

#[tauri::command]
fn tag_item(
    app: AppHandle,
    state: tauri::State<'_, UserDbState>,
    tag_id: i64,
    item_type: String,
    item_id: i64,
) -> Result<usize, String> {
    validate_item_type(&item_type)?;
    with_user_db(&app, &state, |conn| {
        user_db::tag_item(conn, tag_id, &item_type, item_id).map_err(|e| e.to_string())
    })
}

#[tauri::command]
fn untag_item(
    app: AppHandle,
    state: tauri::State<'_, UserDbState>,
    tag_id: i64,
    item_type: String,
    item_id: i64,
) -> Result<usize, String> {
    validate_item_type(&item_type)?;
    with_user_db(&app, &state, |conn| {
        user_db::untag_item(conn, tag_id, &item_type, item_id).map_err(|e| e.to_string())
    })
}

#[tauri::command]
fn list_item_tags(
    app: AppHandle,
    state: tauri::State<'_, UserDbState>,
    item_type: String,
) -> Result<Vec<user_db::ItemTag>, String> {
    validate_item_type(&item_type)?;
    with_user_db(&app, &state, |conn| {
        user_db::list_item_tags(conn, &item_type).map_err(|e| e.to_string())
    })
}
```

- [ ] **Step 2: Register** the 6 commands in the `tauri::generate_handler![ ... ]` list, immediately after `delete_bookmark,` (~line 3833):

```rust
            list_tags,
            create_tag,
            delete_tag,
            tag_item,
            untag_item,
            list_item_tags,
```

- [ ] **Step 3:** Run `cargo check --manifest-path ./src-tauri/Cargo.toml` (from `app/`). Expect clean.

- [ ] **Step 4: Commit**

```bash
git add app/src-tauri/src/lib.rs
git commit -m "feat(tags): Tauri commands for tags + item tagging"
```

---

## Task 3: Frontend API (`bible.ts`)

- [ ] **Step 1:** In `app/src/lib/bible.ts`, near the Bookmarks section, add:

```ts
export interface Tag {
  id: number;
  name: string;
  created_at: string;
}

export interface ItemTag {
  item_id: number;
  tag_id: number;
  name: string;
}

export const listTags = () => invoke<Tag[]>("list_tags");
export const createTag = (name: string) => invoke<Tag>("create_tag", { name });
export const deleteTag = (id: number) => invoke<number>("delete_tag", { id });
export const tagItem = (tagId: number, itemType: string, itemId: number) =>
  invoke<number>("tag_item", { tagId, itemType, itemId });
export const untagItem = (tagId: number, itemType: string, itemId: number) =>
  invoke<number>("untag_item", { tagId, itemType, itemId });
export const listItemTags = (itemType: string) =>
  invoke<ItemTag[]>("list_item_tags", { itemType });
```

(Confirm the camelCase→snake_case arg mapping matches an existing wrapper such as `addBookmark`/`createSavedSearch`; Tauri converts by default.)

- [ ] **Step 2:** `npm run build` → expect tsc clean (these are unused so far). Commit:

```bash
git add app/src/lib/bible.ts
git commit -m "feat(tags): bible.ts tag types + invoke wrappers"
```

---

## Task 4: Tag UI components (`features/tags/TagControls.tsx`)

- [ ] **Step 1:** Create `app/src/features/tags/TagControls.tsx`:

```tsx
import { useState } from "react";
import type { Tag, ItemTag } from "../../lib/bible";

export function TagFilterBar({
  allTags,
  selectedTagId,
  onSelect,
}: {
  allTags: Tag[];
  selectedTagId: number | null;
  onSelect: (id: number | null) => void;
}) {
  if (allTags.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-1 mb-2" data-testid="bookmark-tag-filter">
      {allTags.map((t) => {
        const active = selectedTagId === t.id;
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => onSelect(active ? null : t.id)}
            aria-pressed={active}
            className={
              "px-1.5 py-0.5 rounded text-[11px] border transition-colors " +
              (active
                ? "border-amber-500 text-amber-200 bg-amber-500/10"
                : "border-neutral-700 text-neutral-400 hover:text-neutral-200")
            }
          >
            {t.name}
          </button>
        );
      })}
      {selectedTagId !== null && (
        <button
          type="button"
          onClick={() => onSelect(null)}
          className="px-1 text-[11px] text-neutral-500 hover:text-neutral-300"
        >
          Clear
        </button>
      )}
    </div>
  );
}

export function BookmarkTagRow({
  bookmarkId,
  tags,
  allTags,
  onAttach,
  onDetach,
}: {
  bookmarkId: number;
  tags: ItemTag[];
  allTags: Tag[];
  onAttach: (bookmarkId: number, name: string) => void;
  onDetach: (bookmarkId: number, tagId: number) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [value, setValue] = useState("");
  const datalistId = `tag-options-${bookmarkId}`;

  const submit = () => {
    const name = value.trim();
    setValue("");
    setAdding(false);
    if (name) onAttach(bookmarkId, name);
  };

  return (
    <div className="flex flex-wrap items-center gap-1 mt-1">
      {tags.map((t) => (
        <span
          key={t.tag_id}
          data-testid="bookmark-tag-chip"
          className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] bg-neutral-800 text-neutral-300"
        >
          {t.name}
          <button
            type="button"
            onClick={() => onDetach(bookmarkId, t.tag_id)}
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
            data-testid="bookmark-tag-input"
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
          aria-label="Add tag to bookmark"
          data-testid="bookmark-add-tag"
          className="px-1 text-[11px] text-neutral-500 hover:text-amber-300"
        >
          + tag
        </button>
      )}
    </div>
  );
}
```

- [ ] **Step 2:** `npm run build` → tsc clean. Commit:

```bash
git add app/src/features/tags/TagControls.tsx
git commit -m "feat(tags): TagFilterBar + BookmarkTagRow components"
```

---

## Task 5: Wire into `App.tsx`

READ `App.tsx` around the bookmark state (~247), `refreshNavigationLists` (~330), the `NavigationShortcuts` call site (~1241), its signature (~1751), and its Bookmarks render (~1800).

- [ ] **Step 1: Imports.** Add to the `bible.ts` import block: `type Tag`, `type ItemTag`, `listTags`, `listItemTags`, `createTag`, `tagItem`, `untagItem`. Add a new import: `import { TagFilterBar, BookmarkTagRow } from "./features/tags/TagControls";`. (Do **not** import `deleteTag` — unused in E1; it stays exported for later.)

- [ ] **Step 2: State.** Near `const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);` add:

```tsx
  const [tags, setTags] = useState<Tag[]>([]);
  const [bookmarkTags, setBookmarkTags] = useState<ItemTag[]>([]);
  const [bookmarkTagFilter, setBookmarkTagFilter] = useState<number | null>(null);
```

- [ ] **Step 3: Load.** In `refreshNavigationLists`, extend the `Promise.all`. Current:

```tsx
    const [b, h, s, w] = await Promise.all([
      listBookmarks().catch(() => [] as Bookmark[]),
      listReadingHistory(8).catch(() => [] as ReadingHistoryItem[]),
      listSavedSearches().catch(() => [] as SavedSearch[]),
      listStudyWorkspaces().catch(() => [] as StudyWorkspaceSummary[]),
    ]);
    if (requestId !== navigationRequestId.current) return;
    setBookmarks(b);
    setReadingHistory(h);
    setSavedSearches(s);
    setWorkspaceShortcuts(w);
```

Replace with:

```tsx
    const [b, h, s, w, tg, bt] = await Promise.all([
      listBookmarks().catch(() => [] as Bookmark[]),
      listReadingHistory(8).catch(() => [] as ReadingHistoryItem[]),
      listSavedSearches().catch(() => [] as SavedSearch[]),
      listStudyWorkspaces().catch(() => [] as StudyWorkspaceSummary[]),
      listTags().catch(() => [] as Tag[]),
      listItemTags("bookmark").catch(() => [] as ItemTag[]),
    ]);
    if (requestId !== navigationRequestId.current) return;
    setBookmarks(b);
    setReadingHistory(h);
    setSavedSearches(s);
    setWorkspaceShortcuts(w);
    setTags(tg);
    setBookmarkTags(bt);
```

- [ ] **Step 4: Handlers.** Immediately after `refreshNavigationLists` is defined, add:

```tsx
  const onAttachBookmarkTag = async (bookmarkId: number, name: string) => {
    try {
      const tag = await createTag(name);
      await tagItem(tag.id, "bookmark", bookmarkId);
      await refreshNavigationLists();
    } catch (e) {
      setError(String(e));
    }
  };

  const onDetachBookmarkTag = async (bookmarkId: number, tagId: number) => {
    try {
      await untagItem(tagId, "bookmark", bookmarkId);
      await refreshNavigationLists();
    } catch (e) {
      setError(String(e));
    }
  };
```

(`setError` is the existing error state setter used elsewhere in `App.tsx`.)

- [ ] **Step 5: Pass props at the `<NavigationShortcuts … />` call site** (~1241). Add:

```tsx
            tags={tags}
            bookmarkTags={bookmarkTags}
            bookmarkTagFilter={bookmarkTagFilter}
            onSetBookmarkTagFilter={setBookmarkTagFilter}
            onAttachBookmarkTag={onAttachBookmarkTag}
            onDetachBookmarkTag={onDetachBookmarkTag}
```

- [ ] **Step 6: Extend `NavigationShortcuts` signature** (~1751). Add the destructured params and their types. After `bookmarks,` add `tags,`, `bookmarkTags,`, `bookmarkTagFilter,`, `onSetBookmarkTagFilter,`, `onAttachBookmarkTag,`, `onDetachBookmarkTag,`; and in the type block add:

```tsx
  tags: Tag[];
  bookmarkTags: ItemTag[];
  bookmarkTagFilter: number | null;
  onSetBookmarkTagFilter: (id: number | null) => void;
  onAttachBookmarkTag: (bookmarkId: number, name: string) => void;
  onDetachBookmarkTag: (bookmarkId: number, tagId: number) => void;
```

- [ ] **Step 7: Render** in the Bookmarks `<section>` (~1800). Replace:

```tsx
      {bookmarks.length > 0 && (
        <section>
          <h3 className="text-xs tracking-wider text-neutral-500 mb-2">Bookmarks</h3>
          <ul className="space-y-1">
            {bookmarks.slice(0, 8).map((b) => (
              <li key={b.id}>
                <button
                  type="button"
                  onClick={() => onJumpToVerse(b.verse_id, "KJV")}
                  className="w-full text-left text-xs text-neutral-300 hover:text-amber-200 truncate"
                >
                  {b.label ?? formatVerseId(b.verse_id, books)}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
```

with:

```tsx
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
                  <BookmarkTagRow
                    bookmarkId={b.id}
                    tags={bookmarkTags.filter((it) => it.item_id === b.id)}
                    allTags={tags}
                    onAttach={onAttachBookmarkTag}
                    onDetach={onDetachBookmarkTag}
                  />
                </li>
              ))}
          </ul>
        </section>
      )}
```

- [ ] **Step 8:** `npm run build` → tsc clean + vite build. Fix any type/prop mismatches. Commit:

```bash
git add app/src/App.tsx
git commit -m "feat(tags): bookmark tag chips, add control, and tag filter in sidebar"
```

---

## Task 6: E2E — tag a bookmark and filter by tag

**Files:** add a new `it` to `app/tests/e2e/reader-interactions.spec.ts` (after the existing `"bookmarks a verse and shows it in shortcuts"` test). It creates its own bookmark, then tags + filters it.

- [ ] **Step 1: Add the test** (reuses the bookmark-creation steps; re-queries elements after the tag-add triggers a nav refresh):

```ts
  it("tags a bookmark and filters the sidebar by the tag", async () => {
    const reader = await $("button=Reader");
    await reader.waitForClickable({ timeout: 10_000 });
    await reader.click();

    const jumpInput = await $('input[aria-label="Jump to reference"]');
    await jumpInput.waitForDisplayed({ timeout: 5_000 });
    await jumpInput.setValue("Genesis 1:1");
    await $("button=Go").click();

    await clickVerseAction('button[aria-label="Verse 1 actions"]');

    const label = `Tagged bookmark ${Date.now()}`;
    const bookmarkLabel = await $('input[aria-label="Bookmark label"]');
    await bookmarkLabel.waitForDisplayed({ timeout: 5_000 });
    await bookmarkLabel.setValue(label);
    const bookmark = await $("button=Bookmark");
    await bookmark.waitForClickable({ timeout: 5_000 });
    await bookmark.click();

    const shortcut = await $(`button=${label}`);
    await shortcut.waitForDisplayed({ timeout: 10_000 });

    // Close the verse panel so the sidebar shortcut is the clear target.
    await $('button[aria-label="Close verse panel"]').click();

    // Open the bookmark's tag input, add a tag.
    const tagName = `topic${Date.now()}`;
    const li = await (await $(`button=${label}`)).parentElement();
    await li.$('[data-testid="bookmark-add-tag"]').click();
    const tagInput = await li.$('[data-testid="bookmark-tag-input"]');
    await tagInput.waitForDisplayed({ timeout: 5_000 });
    await tagInput.setValue(tagName);
    await browser.keys("Enter");

    // The chip renders on the bookmark (re-query: the list re-rendered after refresh).
    const chip = await $(`[data-testid="bookmark-tag-chip"]*=${tagName}`);
    await chip.waitForDisplayed({ timeout: 10_000 });

    // Filtering by the tag keeps this bookmark visible.
    const filterChip = await $(`[data-testid="bookmark-tag-filter"]`).then((bar) =>
      bar.$(`button=${tagName}`),
    );
    await filterChip.click();
    await expect(await $(`button=${label}`)).toBeDisplayed();

    // Clear the filter to leave clean state for later tests.
    await (await $('[data-testid="bookmark-tag-filter"]')).$("button=Clear").click();
  });
```

If `parentElement()`/scoped lookups prove brittle (e.g. multiple bookmarks present from earlier tests), scope by the `<li>` containing the label button via `browser.execute`, or assert the chip globally (`$(\`[data-testid="bookmark-tag-chip"]*=${tagName}\`)`) which is already unique by the timestamped name. Keep the assertions (chip renders; filtered list still shows the bookmark); report any selector adaptation.

- [ ] **Step 2:** Run (from `app/`, ~10 min, 600000 ms timeout): `npm run test:e2e:build`. Expect the new test + all pre-existing pass. INFRA failure → BLOCKED.

- [ ] **Step 3: Commit**

```bash
git add app/tests/e2e/reader-interactions.spec.ts
git commit -m "test(tags): e2e for tagging a bookmark and filtering by tag"
```

---

## Task 7: Full gate + finish

- [ ] **Step 1:** `npm run check` (from `app/`) → exit 0 (includes the new cargo tests).
- [ ] **Step 2:** Set the spec `Status:` to `Implemented`; commit `docs(tags): mark study-tags-bookmarks spec implemented`.
- [ ] **Step 3:** Finish the branch (finishing-a-development-branch): verify tests → merge to main.

---

## Self-Review (plan author)

- **Spec coverage:** tags + polymorphic item_tags schema v14 (Task 1 Steps 1–2) ✓; find-or-create + list/delete/tag/untag/list_item_tags fns + delete_bookmark cleanup (Task 1 Steps 3–4) ✓; commands + item_type validation + registration (Task 2) ✓; bible.ts wrappers (Task 3) ✓; chips + add control + filter, extracted to features/tags (Tasks 4–5) ✓; Rust unit tests + e2e (Tasks 1/6) ✓; USER_TABLES NOT touched (Task 1 Step 2 note) ✓.
- **Type/name consistency:** `Tag{id,name,created_at}` and `ItemTag{item_id,tag_id,name}` identical across Rust serialize, `bible.ts`, and component props; commands `list_tags/create_tag/delete_tag/tag_item/untag_item/list_item_tags` match the `bible.ts` invoke strings and the registration list; `item_type="bookmark"` is in the validated set and the DB `CHECK`; filter predicate uses `it.item_id === b.id && it.tag_id === bookmarkTagFilter`.
- **Placeholder scan:** complete code throughout; the two convention notes (blank-name error type; camel→snake arg mapping) point to existing patterns to mirror, not placeholders; the e2e has an explicit selector-fallback note.
