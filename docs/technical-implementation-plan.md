# Technical Implementation Plan

This document maps the roadmap into concrete application work for the current Tauri 2, React, TypeScript, Rust, SQLite, and Node sidecar architecture.

## Current Architecture Assumptions

- `data/corpus.sqlite` is read-only and bundled as a Tauri resource.
- `user.sqlite` is created in the OS app data directory and opened through `UserDbState`.
- Rust commands in `app/src-tauri/src/lib.rs` are the IPC boundary.
- Corpus queries live in `app/src-tauri/src/db.rs`.
- User-data queries live in `app/src-tauri/src/user_db.rs`.
- Frontend command wrappers live in `app/src/lib/bible.ts`.
- The Node sidecar in `app/sidecar` handles Council/provider workflows.
- The packaged app bundles `app/sidecar`, including `sidecar/node/node.exe`.
- macOS packaging uses the same sidecar directory, but the bundled runtime must live at `sidecar/node/bin/node`; see [`macos-distribution-plan.md`](macos-distribution-plan.md).

## Learning And Theology Extension

The implementation plan for the next product arc lives in [`learning-technical-implementation.md`](learning-technical-implementation.md).

That plan extends this architecture with:

- Council human judgment commands and UI.
- Research trail and argument map payloads from the sidecar.
- Theology topic/link/conclusion commands.
- Open resource search and source attribution commands.
- Export integration for user-authored conclusions and source attribution.

## Cross-Cutting Rules

- Any new user table must be created by an idempotent migration in `user_db.rs`.
- Increment `USER_SCHEMA_VERSION` whenever persisted schema changes.
- Mirror runtime user schema changes in `data/schema.sql`.
- Keep corpus schema changes separate from user schema changes.
- Prefer typed command wrappers in `src/lib/bible.ts` for every Tauri command.
- Add E2E coverage for user-visible workflows that cross React, Rust, SQLite, or sidecar boundaries.

## Phase 1: Study Workspace Core

### Backend

Add tables:

```sql
CREATE TABLE study_workspaces (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  description TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  archived_at TEXT
);

CREATE TABLE study_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  workspace_id INTEGER NOT NULL REFERENCES study_workspaces(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN (
    'verse',
    'verse_range',
    'note',
    'search_hit',
    'search',
    'council_session',
    'council_result',
    'explanation',
    'module_entry',
    'freeform'
  )),
  title TEXT,
  payload_json TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_study_items_workspace_order
  ON study_items(workspace_id, sort_order, id);
```

Add Rust types:

- `StudyWorkspaceSummary`
- `StudyWorkspace`
- `StudyItem`
- `NewStudyWorkspace`
- `NewStudyItem`
- `UpdateStudyItem`

Add Tauri commands:

- `list_study_workspaces(include_archived?: bool)`
- `create_study_workspace(title, description?)`
- `update_study_workspace(id, title?, description?, archived?)`
- `delete_study_workspace(id)`
- `get_study_workspace(id)`
- `add_study_item(workspace_id, kind, title?, payload_json)`
- `update_study_item(id, title?, payload_json?, sort_order?)`
- `delete_study_item(id)`
- `reorder_study_items(workspace_id, item_ids)` updates `sort_order` atomically for the full workspace item list.

### Frontend

Add feature folder:

```text
app/src/features/workspaces/
  WorkspaceList.tsx
  WorkspaceDetail.tsx
  AddToWorkspaceMenu.tsx
  WorkspaceItemRenderer.tsx
  workspaceMarkdown.ts
```

App integration:

- Add `workspace` mode to `App.tsx`.
- Add sidebar entry for Workspaces.
- Add `AddToWorkspaceMenu` to Reader verse panel, Search results, and Council result view.
- Keep workspace item renderers focused on action controls and inline title editing; deeper payload editors can come later.
- Add a workspace-detail note composer for standalone `note` items, with inline body editing through `update_study_item`.
- Workspace search and search-hit items expose a rerun action that restores the saved query into the main search flow.
- Workspace verse and range items expose copy and Council-prefill actions in addition to Reader navigation.
- Workspace verse and range Explain actions call `explain_passage` and append the result as an `explanation` workspace item.

### Tests

- Unit-level renderer tests if a test runner is added.
- E2E: create workspace, add current verse, open workspace, verify item appears, delete workspace.

## Phase 2: Verse Range Selection

### Backend

Add helper command:

- `get_verse_range(translation_code, start_verse_id, end_verse_id)`

Rules:

- Allow same-book ranges, including ranges that cross chapter boundaries.
- Reject ranges where `start_verse_id > end_verse_id`.
- Reject large ranges above a configurable limit, initially 200 verses.

### Frontend

In `ChapterReader.tsx`:

- Track `selectionStartVerseId` and `selectionEndVerseId`.
- Click selects one verse.
- Shift-click expands range.
- Escape clears selection.
- Render selected verse background consistently with highlights.

Add `VerseRangeActionBar.tsx`:

- Copy
- Highlight
- Note
- Ask Council
- Explain
- Bookmark
- Add to workspace

Reference parsing:

- Extend current parser to accept `John 3:16-18`.
- Return `{ book, chapter, startVerse, endVerse }`.
- Accept `John 3:16-4:2` from the jump box and open a range action bar with copy, bookmark, note, Council, Explain, and workspace actions.

### Tests

- E2E: shift-click range, action bar appears, bookmark/copy/add-to-workspace action works.
- E2E: jump box accepts `John 3:16-18` and opens the range action bar.

## Phase 3: Markdown Export

### Renderer Contract

Add `workspaceMarkdown.ts`:

```ts
export function renderWorkspaceMarkdown(workspace: StudyWorkspace): string
```

Renderer rules:

- Use stable heading order.
- Include creation/export timestamp.
- Include citations as plain Markdown links or plain reference text.
- Preserve Council confidence, positions, dissent, and unresolved tensions.
- Include source metadata for search and module items.
- Include Council cited evidence and retrieved evidence references when a saved Council payload includes the full response.
- Include Council dissent notes and unresolved tensions from the saved synthesis payload.

### Export Commands

Initial:

- Copy rendered Markdown to clipboard in the frontend.
- Save rendered Markdown to a timestamped file under the app-data `exports` directory.

Later:

- Dialog-based "Save as..." support for choosing the `.md` destination is implemented with `tauri-plugin-dialog` and scoped `tauri-plugin-fs` writes.
- HTML export is implemented as a printable document that preserves the Markdown renderer output.
- PDF export is implemented as a simple paginated text PDF generated by the Rust app from the Markdown renderer output.

### Tests

- Snapshot-style tests for Markdown renderer once a TS test runner exists.
- E2E: create workspace, add item, copy/export Markdown, verify visible success state.

## Phase 4: Bookmarks and Reading History

### Backend

Add tables:

```sql
CREATE TABLE bookmarks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  verse_id INTEGER NOT NULL,
  end_verse_id INTEGER,
  label TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(verse_id, end_verse_id)
);

CREATE TABLE reading_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  book_id INTEGER NOT NULL,
  chapter INTEGER NOT NULL,
  translation_codes TEXT NOT NULL,
  visited_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

Commands:

- `list_bookmarks`
- `add_bookmark`
- `delete_bookmark`
- `record_reading_location`
- `list_recent_reading_locations`

### Frontend

- Add sidebar sections under Books or a dedicated "Library" mode.
- Debounce reading history writes on navigation.
- Persist last opened location in `app_settings`.

### Tests

- E2E: bookmark a verse, navigate away, click bookmark, verify navigation.

## Phase 5: Parallel Translation Layout

### Frontend

Add reader settings:

- `reader_layout`: `columns | interleaved`
- `reader_density`: `comfortable | compact`
- `sync_scroll`: `true | false`

Components:

- `ChapterColumnsView`
- `ChapterInterleavedView`
- `ReaderLayoutControls`

Implementation notes:

- Reuse fetched `chapterData`.
- Interleaved view iterates verse numbers and renders translation cells per verse.
- Scroll sync should avoid infinite loops by tracking the source pane during animation/frame.

### Tests

- E2E: toggle interleaved view and verify two translation labels render in one verse block.
- E2E: preference persists after app reload if reload support is stable in WebDriver.

## Phase 6: Original-Language Tools

### Backend

Commands:

- `get_strongs_occurrences(code, translation_code?, limit?)`
- `get_word_context(translation_code, verse_id, position)`

Occurrence query:

```sql
SELECT wt.translation_code, wt.verse_id, wt.surface, wt.lemma, wt.morph,
       b.name, b.osis_code, v.chapter, v.verse, tt.text
FROM word_tokens wt
JOIN verses v ON v.id = wt.verse_id
JOIN books b ON b.id = v.book_id
JOIN translation_text tt
  ON tt.verse_id = wt.verse_id
 AND tt.translation_code = wt.translation_code
WHERE wt.strongs LIKE '%' || ? || '%'
ORDER BY v.id, wt.position
LIMIT ?;
```

### Frontend

Components:

- `WordStudyPanel`
- `OccurrencesList`
- `MorphologyBadge`

Behavior:

- Click tagged word opens side panel.
- Occurrence click navigates reader.
- Panel supports copy citation.

### Tests

- E2E: enable WLC or TR, click tagged word, occurrence panel opens.

## Phase 7: Saved Searches

### Backend

Table:

```sql
CREATE TABLE saved_searches (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  query TEXT NOT NULL,
  translation_code TEXT,
  testament TEXT,
  book_id INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

Commands:

- `list_saved_searches`
- `create_saved_search`
- `update_saved_search`
- `delete_saved_search`

### Frontend

- Add Save Search action near search filters.
- Add saved search list in sidebar or Search mode.
- Rerun saved search by restoring query and filters.
- Rename and delete saved searches from the sidebar list.
- Add selected results to workspace.
- Allow multi-select search results to be stored as one grouped workspace item.

### Tests

- E2E: save search, rename saved search, rerun saved search, delete saved search.

## Phase 8: AI Retrieval Controls and Citation Audit

### Backend

Extend `ask_council` parameters:

- `retrieval_strategy`: `keyword | semantic | hybrid`
- `include_cross_refs`: boolean
- `book_id`: optional
- `testament`: optional
- `start_verse_id`: optional
- `end_verse_id`: optional
- `evidence_limit`: existing
- `retrieval_translation`: existing

Persist with session:

- Add `retrieval_options_json` to `council_sessions`.
- Keep full `response_json`.
- Include `retrieved_evidence` in response JSON.

### Sidecar

The Rust host passes the same evidence to the sidecar and preserves it before provider analysis.

Provider enhancement:

- Ask providers to mark evidence as `used`, `supporting`, `conflicting`, or `ignored`.
- Store those classifications inside the Council response JSON so existing session persistence captures them without a separate schema migration.

### Frontend

Add:

- `CouncilRetrievalControls`
- `CouncilAuditView`

Audit view sections:

- Retrieved evidence
- Evidence cited by synthesis
- Evidence cited by individual voices
- Retrieved but unused
- Provider classification badges: used, supporting, conflicting, ignored
- Council process view: show evidence count, voices run, preserved positions, process steps, and a comparison between the top weighted position and the nearest alternative.
- The comparison must derive claims only from visible response data: synthesis weights, cited evidence counts, provider voice position labels, and evidence classifications. Do not imply hidden chain-of-thought access.

### Tests

- E2E mock Council: set retrieval filter, submit, verify retrieval settings, process explanation, evidence classification, and audit panel render.

## Phase 9: Explain Passage Mode

For the next Council transparency expansion, use [`council-transparency-visualization-plan.md`](council-transparency-visualization-plan.md). It covers the data contract, per-position evidence tabs, voice agreement matrix, retrieval trace, confidence rationale, raw source drawer, and export updates.

### Backend and Sidecar

Add sidecar request type:

- `explain`

Request:

```json
{
  "question": "Explain this passage",
  "passage": [...],
  "settings": {...},
  "model": "sonnet"
}
```

Response:

```json
{
  "summary": "...",
  "context": "...",
  "key_terms": [],
  "cross_references": [],
  "cautions": []
}
```

Rust commands:

- `explain_passage(translation_code, start_verse_id, end_verse_id, model?)`

### Frontend

- Add Explain action to verse panel and range action bar.
- Render explanation in a panel.
- Add to workspace.

### Tests

- Mock sidecar explanation E2E.

## Phase 10: Commentary and Module System

### Corpus or User DB

Use user DB for installable modules. A future bundled module corpus can be separate.

Tables:

```sql
CREATE TABLE modules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('commentary', 'lexicon', 'dictionary', 'map', 'timeline')),
  source TEXT,
  license TEXT,
  version TEXT,
  installed_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE module_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  module_id INTEGER NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
  key_type TEXT NOT NULL CHECK (key_type IN ('verse', 'verse_range', 'strongs', 'topic')),
  key_value TEXT NOT NULL,
  title TEXT,
  body TEXT NOT NULL,
  metadata_json TEXT
);

CREATE INDEX idx_module_entries_key
  ON module_entries(key_type, key_value);
```

Import format:

- Prefer JSONL for simple import/export.
- Import accepts one manifest object plus newline-delimited JSON entries.
- Manifest shape:

```json
{
  "slug": "sample-strongs-notes",
  "title": "Sample Strong's Notes",
  "kind": "lexicon",
  "source": "Local JSONL sample",
  "license": "Internal",
  "version": "1"
}
```

- Each JSONL line is one module entry:

```json
{"key_type":"strongs","key_value":"H7225","title":"Beginning","body":"...","metadata":{"strongs":"H7225"}}
```

- `key_type` must be one of `verse`, `verse_range`, `strongs`, or `topic`.
- Re-importing a module slug replaces that module's entries after updating its metadata.

### Frontend

- Module panel in Reader.
- Entries for current verse/range.
- Entries for current Strong's code in word study panel.
- Entries for topic keys in the Settings module topic browser.
- Installed module list in Settings with uninstall action.

Range lookup:

- `list_module_entries_for_range(start_verse_id, end_verse_id)` uses the documented `start-end` `verse_range` key.
- The selected range action bar renders matching module entries and can save them to a workspace as `module_entry` items.

### Tests

- Import fixture module.
- Verify entry appears for Genesis 1:1 or a known Strong's code.
- Uninstall fixture module and verify the module list updates.

## Phase 11: Backup and Restore

### Export

Create a JSON export shape:

```json
{
  "app": "Bible AI",
  "export_version": 1,
  "user_schema_version": 7,
  "exported_at": "2026-04-30T00:00:00Z",
  "tables": {
    "app_settings": [],
    "user_notes": [],
    "user_highlights": [],
    "user_range_notes": [],
    "user_range_highlights": [],
    "council_sessions": [],
    "study_workspaces": [],
    "study_items": [],
    "bookmarks": [],
    "reading_history": [],
    "saved_searches": [],
    "modules": [],
    "module_entries": []
  }
}
```

Commands:

- `export_user_data_json`
- `write_user_data_backup`
- `import_user_data_json(payload, conflict_strategy)`
- `backup_user_sqlite`
- `restore_user_sqlite`

Conflict strategies:

- `skip_existing`: preserves imported primary keys where possible and ignores rows that conflict.
- `replace_existing`: preserves imported primary keys and replaces rows with matching primary keys.
- `duplicate`: omits autoincrement IDs and remaps imported workspace/module child rows to the new parent IDs.

The Settings screen exposes JSON import as pasted backup text with a conflict strategy selector. SQLite backup writes a timestamped copy of `user.sqlite`; SQLite restore accepts a backup path, closes the active user DB connection, creates a timestamped safety copy of the current DB, restores the selected file, and reopens it.

### Safety

- Validate export version and schema version before import.
- Run import in a transaction.
- Back up current `user.sqlite` before destructive restore.
- Never import into `corpus.sqlite`.

### Tests

- Export non-empty user data.
- Import into empty DB.
- Import duplicate data with each conflict strategy.

## Release and Verification Gates

Every phase should pass:

- `npm run build`
- `cargo fmt --check`
- `cargo check`
- `node --check index.mjs; node --check council.mjs`
- `npm run test:e2e:build`

Installer-impacting phases should also pass:

- `npm run release:build`
- Confirm bundled resources contain `corpus.sqlite`, `sidecar/index.mjs`, `sidecar/node/node.exe`, and sidecar `node_modules`.
- Install on a clean Windows profile before tagging a release.
