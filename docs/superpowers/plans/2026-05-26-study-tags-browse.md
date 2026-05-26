# Study Tags E3 — Browse by Tag Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** A "Tags" view: list tags with counts → pick a tag → see its tagged bookmarks + verse notes (with Scripture citations) → click to jump to the reader.

**Architecture:** Two `user_db` queries (tags-with-counts; items-for-tag as a bookmarks∪notes UNION); `lib.rs` commands stitch citations from the corpus (same pattern as `search_notes`); a new `Mode "tags"` + nav button renders a `TagBrowser` view.

**Tech Stack:** Rust (rusqlite) + Tauri 2, React 19 + TypeScript, WebdriverIO e2e.

**Spec:** `docs/superpowers/specs/2026-05-26-study-tags-browse-design.md`

**Verification:** Rust unit tests + `npm run build` + full `npm run check` + `npm run test:e2e:build`. (Capture the REAL `npm` exit code — not a piped `tail`'s.)

---

## Task 1: `user_db.rs` — structs + queries + tests

- [ ] **Step 1: Structs.** In the Tags section, add:

```rust
#[derive(Serialize, Clone)]
pub struct TagCount {
    pub id: i64,
    pub name: String,
    pub count: i64,
}

#[derive(Serialize, Clone)]
pub struct TaggedItemRaw {
    pub item_type: String,
    pub item_id: i64,
    pub verse_id: i64,
    pub text: Option<String>,
}
```

- [ ] **Step 2: Queries.**

```rust
pub fn list_tags_with_counts(conn: &Connection) -> SqlResult<Vec<TagCount>> {
    let mut stmt = conn.prepare(
        "SELECT t.id, t.name, COUNT(it.tag_id)
         FROM tags t
         LEFT JOIN item_tags it ON it.tag_id = t.id AND it.item_type IN ('bookmark', 'note')
         GROUP BY t.id, t.name
         ORDER BY t.name COLLATE NOCASE",
    )?;
    let rows = stmt.query_map([], |r| {
        Ok(TagCount { id: r.get(0)?, name: r.get(1)?, count: r.get(2)? })
    })?;
    rows.collect()
}

pub fn list_tagged_items(conn: &Connection, tag_id: i64) -> SqlResult<Vec<TaggedItemRaw>> {
    let mut stmt = conn.prepare(
        "SELECT 'bookmark' AS item_type, b.id AS item_id, b.verse_id AS verse_id, b.label AS text
         FROM item_tags it JOIN bookmarks b ON b.id = it.item_id
         WHERE it.tag_id = ?1 AND it.item_type = 'bookmark'
         UNION ALL
         SELECT 'note' AS item_type, n.verse_id AS item_id, n.verse_id AS verse_id, n.body AS text
         FROM item_tags it JOIN user_notes n ON n.verse_id = it.item_id
         WHERE it.tag_id = ?1 AND it.item_type = 'note'
         ORDER BY item_type, verse_id",
    )?;
    let rows = stmt.query_map(params![tag_id], |r| {
        Ok(TaggedItemRaw {
            item_type: r.get(0)?,
            item_id: r.get(1)?,
            verse_id: r.get(2)?,
            text: r.get(3)?,
        })
    })?;
    rows.collect()
}
```

- [ ] **Step 3: Unit tests** (in the existing `#[cfg(test)] mod tests`, using `let conn = test_conn();`). Insert the note row via raw SQL (avoids depending on the note-upsert fn name):

```rust
    #[test]
    fn list_tags_with_counts_counts_browsable_items() {
        let conn = test_conn();
        let bm = add_bookmark(&conn, 1_001_001, None, Some("b")).expect("bm");
        conn.execute(
            "INSERT INTO user_notes (verse_id, body) VALUES (?, ?)",
            params![1_001_002_i64, "note body"],
        )
        .expect("note");
        let shared = create_tag(&conn, "shared").expect("t1");
        create_tag(&conn, "empty").expect("t2");
        tag_item(&conn, shared.id, "bookmark", bm).expect("tag bm");
        tag_item(&conn, shared.id, "note", 1_001_002).expect("tag note");
        let counts = list_tags_with_counts(&conn).expect("counts");
        assert_eq!(counts.iter().find(|c| c.name == "shared").expect("shared").count, 2);
        assert_eq!(counts.iter().find(|c| c.name == "empty").expect("empty").count, 0);
    }

    #[test]
    fn list_tagged_items_unions_bookmarks_and_notes() {
        let conn = test_conn();
        let bm = add_bookmark(&conn, 1_001_001, None, Some("my bm")).expect("bm");
        conn.execute(
            "INSERT INTO user_notes (verse_id, body) VALUES (?, ?)",
            params![1_001_002_i64, "my note"],
        )
        .expect("note");
        let t = create_tag(&conn, "topic").expect("t");
        tag_item(&conn, t.id, "bookmark", bm).expect("tag bm");
        tag_item(&conn, t.id, "note", 1_001_002).expect("tag note");
        let items = list_tagged_items(&conn, t.id).expect("items");
        assert_eq!(items.len(), 2);
        let b = items.iter().find(|i| i.item_type == "bookmark").expect("bm item");
        assert_eq!(b.verse_id, 1_001_001);
        assert_eq!(b.text.as_deref(), Some("my bm"));
        let n = items.iter().find(|i| i.item_type == "note").expect("note item");
        assert_eq!(n.verse_id, 1_001_002);
        assert_eq!(n.text.as_deref(), Some("my note"));
        assert!(list_tagged_items(&conn, 99_999).expect("empty").is_empty());
    }
```

- [ ] **Step 4:** `cargo test --manifest-path ./src-tauri/Cargo.toml` (from `app/`) → all pass.
- [ ] **Step 5: Commit** `app/src-tauri/src/user_db.rs`: `git commit -m "feat(tags): browse queries (tags-with-counts, items-for-tag)"`

---

## Task 2: `lib.rs` — commands + citation stitching

READ `search_notes` (~line 2955) first — Task 2 mirrors its corpus citation-stitching (`open_corpus`, `refs` map, `format_note_citation`).

- [ ] **Step 1: `TaggedItem` struct** (near other serialize structs):

```rust
#[derive(serde::Serialize)]
struct TaggedItem {
    item_type: String,
    verse_id: i64,
    citation: String,
    preview: String,
}
```

- [ ] **Step 2: Commands** (near the other tag commands ~line 1228):

```rust
#[tauri::command]
fn list_tags_with_counts(
    app: AppHandle,
    state: tauri::State<'_, UserDbState>,
) -> Result<Vec<user_db::TagCount>, String> {
    with_user_db(&app, &state, |conn| {
        user_db::list_tags_with_counts(conn).map_err(|e| e.to_string())
    })
}

#[tauri::command]
fn list_tagged_items(
    app: AppHandle,
    state: tauri::State<'_, UserDbState>,
    tag_id: i64,
) -> Result<Vec<TaggedItem>, String> {
    let raw: Vec<user_db::TaggedItemRaw> = with_user_db(&app, &state, |conn| {
        user_db::list_tagged_items(conn, tag_id).map_err(|e| e.to_string())
    })?;
    if raw.is_empty() {
        return Ok(Vec::new());
    }

    let mut ids: Vec<i64> = raw.iter().map(|r| r.verse_id).collect();
    ids.sort_unstable();
    ids.dedup();

    let mut refs: std::collections::HashMap<i64, (String, i64, i64)> =
        std::collections::HashMap::new();
    {
        let conn = open_corpus(&app)?;
        let placeholders = ids.iter().map(|_| "?").collect::<Vec<_>>().join(",");
        let sql = format!(
            "SELECT v.id, b.name, v.chapter, v.verse
             FROM verses v JOIN books b ON b.id = v.book_id
             WHERE v.id IN ({placeholders})"
        );
        let mut stmt = conn.prepare(&sql).map_err(|e| e.to_string())?;
        let rows = stmt
            .query_map(rusqlite::params_from_iter(ids.iter()), |r| {
                Ok((
                    r.get::<_, i64>(0)?,
                    r.get::<_, String>(1)?,
                    r.get::<_, i64>(2)?,
                    r.get::<_, i64>(3)?,
                ))
            })
            .map_err(|e| e.to_string())?;
        for row in rows {
            let (id, name, chapter, verse) = row.map_err(|e| e.to_string())?;
            refs.insert(id, (name, chapter, verse));
        }
    }

    let mut out: Vec<TaggedItem> = Vec::new();
    for r in raw {
        let Some((name, chapter, verse)) = refs.get(&r.verse_id).cloned() else {
            continue;
        };
        let citation = format_note_citation(&name, chapter, verse, None);
        let preview = r
            .text
            .map(|t| {
                let t = t.trim();
                if t.chars().count() > 100 {
                    let head: String = t.chars().take(100).collect();
                    format!("{head}…")
                } else {
                    t.to_string()
                }
            })
            .unwrap_or_default();
        out.push(TaggedItem {
            item_type: r.item_type,
            verse_id: r.verse_id,
            citation,
            preview,
        });
    }
    Ok(out)
}
```

- [ ] **Step 3: Register** `list_tags_with_counts` and `list_tagged_items` in `generate_handler!` (after the other tag commands).

- [ ] **Step 4:** `cargo check --manifest-path ./src-tauri/Cargo.toml` (from `app/`) → clean. Then `cargo fmt --manifest-path ./src-tauri/Cargo.toml` (avoid the `fmt --check` gate failure). 
- [ ] **Step 5: Commit** `app/src-tauri/src/lib.rs`: `git commit -m "feat(tags): commands for tag browse with corpus citations"`

---

## Task 3: `bible.ts` — types + wrappers

- [ ] **Step 1:** Add near the other tag exports:

```ts
export interface TagCount {
  id: number;
  name: string;
  count: number;
}

export interface TaggedItem {
  item_type: string;
  verse_id: number;
  citation: string;
  preview: string;
}

export const listTagsWithCounts = () => invoke<TagCount[]>("list_tags_with_counts");
export const listTaggedItems = (tagId: number) =>
  invoke<TaggedItem[]>("list_tagged_items", { tagId });
```

- [ ] **Step 2:** `npm run build` → tsc clean. Commit `app/src/lib/bible.ts`: `git commit -m "feat(tags): bible.ts browse types + wrappers"`

---

## Task 4: `TagBrowser.tsx` (new view)

- [ ] **Step 1:** Create `app/src/features/tags/TagBrowser.tsx`:

```tsx
import { useEffect, useState } from "react";
import {
  listTagsWithCounts,
  listTaggedItems,
  type TagCount,
  type TaggedItem,
} from "../../lib/bible";

export function TagBrowser({ onJumpToVerse }: { onJumpToVerse: (verseId: number) => void }) {
  const [tagCounts, setTagCounts] = useState<TagCount[]>([]);
  const [selectedTagId, setSelectedTagId] = useState<number | null>(null);
  const [items, setItems] = useState<TaggedItem[]>([]);
  const [loadingItems, setLoadingItems] = useState(false);

  useEffect(() => {
    listTagsWithCounts()
      .then(setTagCounts)
      .catch(() => setTagCounts([]));
  }, []);

  useEffect(() => {
    if (selectedTagId === null) {
      setItems([]);
      return;
    }
    let cancelled = false;
    setLoadingItems(true);
    listTaggedItems(selectedTagId)
      .then((rows) => {
        if (!cancelled) setItems(rows);
      })
      .catch(() => {
        if (!cancelled) setItems([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingItems(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedTagId]);

  return (
    <div className="max-w-4xl mx-auto px-6 py-6" data-testid="tag-browser">
      <header className="surface-panel rounded-lg px-4 py-3 mb-4">
        <p className="text-xs tracking-wider text-neutral-500">Study organization</p>
        <h2 className="text-xl font-semibold text-neutral-100">Tags</h2>
      </header>

      {tagCounts.length === 0 ? (
        <div className="soft-card px-4 py-5 text-sm text-neutral-500">
          No tags yet. Tag bookmarks (sidebar) or verse notes (the Note tab) to organize them here.
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-[14rem_1fr]">
          <nav className="space-y-1" aria-label="Tags">
            {tagCounts.map((t) => (
              <button
                key={t.id}
                type="button"
                data-testid="tag-browser-tag"
                onClick={() => setSelectedTagId(t.id)}
                aria-pressed={selectedTagId === t.id}
                className={
                  "w-full flex items-center justify-between gap-2 px-2 py-1.5 rounded text-sm transition-colors " +
                  (selectedTagId === t.id
                    ? "bg-amber-500/10 text-amber-200"
                    : "text-neutral-300 hover:bg-neutral-900/60")
                }
              >
                <span className="truncate">{t.name}</span>
                <span className="text-xs text-neutral-500">{t.count}</span>
              </button>
            ))}
          </nav>

          <section>
            {selectedTagId === null ? (
              <div className="soft-card px-4 py-5 text-sm text-neutral-500">Select a tag.</div>
            ) : loadingItems ? (
              <p className="text-neutral-500 italic text-sm">Loading…</p>
            ) : items.length === 0 ? (
              <div className="soft-card px-4 py-5 text-sm text-neutral-500">
                No items with this tag.
              </div>
            ) : (
              <ul className="space-y-2">
                {items.map((item, i) => (
                  <li key={`${item.item_type}-${item.verse_id}-${i}`}>
                    <button
                      type="button"
                      data-testid="tag-browser-item"
                      onClick={() => onJumpToVerse(item.verse_id)}
                      className="soft-card soft-card-hover px-3 py-3 w-full text-left"
                    >
                      <div className="flex flex-wrap items-baseline gap-2 text-xs text-neutral-400 mb-1">
                        <span
                          className={
                            "meta-pill " +
                            (item.item_type === "bookmark"
                              ? "text-amber-300 border-amber-500/40"
                              : "text-emerald-300 border-emerald-500/40")
                          }
                        >
                          {item.item_type}
                        </span>
                        <span>{item.citation}</span>
                      </div>
                      {item.preview && (
                        <p className="text-neutral-300 text-sm leading-relaxed truncate">
                          {item.preview}
                        </p>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2:** `npm run build` → tsc clean (unused until App wires it — fine). Commit: `git commit -m "feat(tags): TagBrowser view"`

---

## Task 5: Wire the "Tags" mode in `App.tsx`

- [ ] **Step 1: Import** near the other feature imports: `import { TagBrowser } from "./features/tags/TagBrowser";`
- [ ] **Step 2: Mode union** — change `type Mode = "reader" | "council" | "theology" | "resources" | "workspaces" | "settings";` to add `| "tags"`.
- [ ] **Step 3: Nav button** — in the sidebar `<nav>` (~line 1042), add after the Workspaces `<ModeButton>`:

```tsx
            <ModeButton
              active={mode === "tags"}
              onClick={() => selectMode("tags")}
              label="Tags"
            />
```

- [ ] **Step 4: Render branch** — in the main-content ternary, add before the `mode === "council" ?` branch (~line 1482):

```tsx
        ) : mode === "tags" ? (
          <TagBrowser onJumpToVerse={(verseId) => jumpToVerse(verseId, activeTranslations[0] ?? "KJV")} />
        ) : mode === "council" ? (
```

(`jumpToVerse(verseId, translationCode)` and `activeTranslations` are already in scope — `jumpToVerse` is the same handler passed to `CouncilPanel`'s `onJumpToVerse`.)

- [ ] **Step 5:** `npm run build` → tsc clean + vite build. Commit `app/src/App.tsx`: `git commit -m "feat(tags): Tags mode + nav button rendering TagBrowser"`

---

## Task 6: E2E — browse a tag and jump

**Files:** new `app/tests/e2e/tags-browse.spec.ts`; register in `app/wdio.conf.mts` (add to the `specs` array, before `release-readiness.spec.ts`).

- [ ] **Step 1: Write the spec.** It creates + tags a bookmark, opens Tags, browses, and jumps:

```ts
import { browser, $, expect } from "@wdio/globals";

describe("Browse by tag", () => {
  it("tags a bookmark, finds it in the Tags view, and jumps to it", async () => {
    const reader = await $("button=Reader");
    await reader.waitForClickable({ timeout: 10_000 });
    await reader.click();

    const jumpInput = await $('input[aria-label="Jump to reference"]');
    await jumpInput.waitForDisplayed({ timeout: 5_000 });
    await jumpInput.setValue("Genesis 1:1");
    await $("button=Go").click();

    // Open verse 1 actions and bookmark it.
    const verseOne = await $('button[aria-label="Verse 1 actions"]');
    await verseOne.waitForClickable({ timeout: 10_000 });
    await browser.execute((el: HTMLElement) => el.scrollIntoView({ block: "center" }), verseOne);
    await verseOne.click();
    const label = `Browse bm ${Date.now()}`;
    const bookmarkLabel = await $('input[aria-label="Bookmark label"]');
    await bookmarkLabel.waitForDisplayed({ timeout: 5_000 });
    await bookmarkLabel.setValue(label);
    await (await $("button=Bookmark")).click();
    const shortcut = await $(`button=${label}`);
    await shortcut.waitForDisplayed({ timeout: 10_000 });
    await $('button[aria-label="Close verse panel"]').click();

    // Tag the bookmark in the sidebar.
    const tagName = `browse${Date.now()}`;
    const li = await (await $(`button=${label}`)).parentElement();
    await li.$('[data-testid="bookmark-add-tag"]').click();
    const tagInput = await li.$('[data-testid="bookmark-tag-input"]');
    await tagInput.waitForDisplayed({ timeout: 5_000 });
    await tagInput.setValue(tagName);
    await browser.keys("Enter");
    await $(`[data-testid="bookmark-tag-chip"]*=${tagName}`).waitForDisplayed({ timeout: 10_000 });

    // Open the Tags view, select the tag, see the item.
    await (await $("button=Tags")).click();
    const browserView = await $('[data-testid="tag-browser"]');
    await browserView.waitForDisplayed({ timeout: 10_000 });
    const tagButton = await $(`[data-testid="tag-browser-tag"]*=${tagName}`);
    await tagButton.waitForClickable({ timeout: 10_000 });
    await tagButton.click();
    const item = await $('[data-testid="tag-browser-item"]');
    await item.waitForDisplayed({ timeout: 10_000 });
    await expect(item).toHaveText("Genesis 1:1", { containing: true, ignoreCase: true });

    // Click the item → reader navigates.
    await item.click();
    const heading = await $("h1*=Genesis");
    await heading.waitForDisplayed({ timeout: 10_000 });
    await expect(heading).toBeDisplayed();
  });
});
```

If `button=Tags` is ambiguous (e.g. matches a chip), scope to the sidebar nav (`[aria-label="Main navigation"]`); the `ModeButton` renders a `<button>` with text "Tags". Report any adaptation.

- [ ] **Step 2: Register + run.** Add `"./tests/e2e/tags-browse.spec.ts"` to `specs` in `app/wdio.conf.mts`. Run (from `app/`, ~10 min, 600000 ms): `npm run test:e2e:build`. Expect the new test + all pre-existing pass.
- [ ] **Step 3: Commit** `app/tests/e2e/tags-browse.spec.ts app/wdio.conf.mts`: `git commit -m "test(tags): e2e for browse-by-tag and jump"`

---

## Task 7: Full gate + finish

- [ ] **Step 1:** `npm run check` (from `app/`) → exit 0. Capture the REAL exit code (redirect to a file then check `$?`, or pwsh `$LASTEXITCODE`) — NOT `$?` after a pipe to `tail`.
- [ ] **Step 2:** Set the spec `Status:` to `Implemented`; commit `docs(tags): mark study-tags-browse spec implemented`.
- [ ] **Step 3:** Finish the branch (finishing-a-development-branch): verify tests → merge to main.

---

## Self-Review (plan author)

- **Spec coverage:** tags-with-counts + items-for-tag UNION (Task 1); citation stitching mirroring `search_notes` + preview (Task 2); bible.ts (Task 3); TagBrowser with tag list + items + jump + empty states (Task 4); Tags mode/nav/render (Task 5); Rust tests (Task 1) + browse-and-jump e2e (Task 6) ✓.
- **Type/name consistency:** `TagCount{id,name,count}` and `TaggedItem{item_type,verse_id,citation,preview}` identical across Rust serialize / `bible.ts` / `TagBrowser`; commands `list_tags_with_counts`/`list_tagged_items` match invoke strings + registration; `onJumpToVerse(verseId)` bound to `jumpToVerse(verseId, activeTranslations[0] ?? "KJV")`; `?1` reused for the single `params![tag_id]` bind.
- **Placeholder scan:** full code throughout; the e2e has an explicit `button=Tags` disambiguation note; the cargo `fmt` step is included to pre-empt the gate.
