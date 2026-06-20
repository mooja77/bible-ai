# Bible AI Deep Review Findings - Third Pass

Generated: 2026-06-11 16:11:33 +01:00

Report file: `docs/reviews/2026-06-11-161133-app-deep-review-findings.md`

Extends:

- `docs/reviews/2026-06-11-145646-app-deep-review-findings.md`
- `docs/reviews/2026-06-11-150603-app-deep-review-findings.md`

Scope: another set of review passes over the current application state. This report carries forward all prior findings and adds the new findings from this pass. Paths and line numbers are relative to the repository root.

## Current State

Bible AI is a local-first Tauri 2 desktop Bible study app.

- Frontend: React 19, TypeScript, Vite, Tailwind.
- Backend: Rust/Tauri with rusqlite.
- Data: bundled read-only `data/corpus.sqlite`; per-user writable `user.sqlite`.
- AI orchestration: long-running Node sidecar under `app/sidecar`.
- Main modes: Reader, Council, Theology, Resources, Workspaces, Tags, Settings.
- Corpus state: ASV, KJV, TR, WLC, and YLT have embeddings; WEB does not. WLC is the only translation with `word_tokens`.

Repository state observed during this pass:

- `app/src-tauri/Cargo.toml` was already modified in the worktree before this pass and was not touched.
- `docs/reviews/` contains the timestamped review artifacts and remains untracked.
- Windows-side runtime artifacts exist locally: `data/corpus.sqlite`, `app/sidecar/node/node.exe`, and `app/sidecar/node_modules`.

## Extra Passes Performed

1. Security and Tauri capability review.
2. Filesystem command review for export, backup, restore, and Save As paths.
3. Packaging and sidecar resource review.
4. User schema, migration, import/export, and polymorphic relationship review.
5. Frontend state refresh, destructive action, and E2E coverage review.

## Verification Snapshot

Previously confirmed in this review cycle:

- `npm run build` passed.
- `npm run test:sidecar` passed with 66 tests.
- `cargo test --manifest-path .\src-tauri\Cargo.toml` passed with 93 tests.
- `npm run check` passed.

Still blocked:

- `npm run test:e2e:build` is blocked before specs run because local `msedgedriver.exe` is version 147 while installed Edge/WebView is `149.0.4022.62`.
- `app/wdio.conf.mts:11-13` documents that `msedgedriver.exe` must match installed Edge.
- `app/wdio.conf.mts:125-145` lists the active E2E specs.

No new test run was needed for this documentation-only pass.

## Positive Findings

- Tauri capabilities are narrow: `app/src-tauri/capabilities/default.json:6-9` grants `core:default` and `dialog:allow-save` only.
- Production CSP is restrictive: `app/src-tauri/tauri.conf.json:22-24` limits default/script behavior and blocks object embedding.
- Command registration matched command definitions in the earlier command-surface pass: 104 `#[tauri::command]` functions and 104 registered handlers.
- Sidecar stdout is reserved for JSON RPC and logs go to stderr: `app/sidecar/index.mjs:24-29`.
- Sidecar diagnostic/error paths redact configured secrets: `app/sidecar/index.mjs:22`, `app/sidecar/index.mjs:180-184`, and `app/sidecar/providers/_shared.mjs:143-149`.
- User JSON import is transactional: `app/src-tauri/src/user_db.rs:7454-7465` wraps import in `BEGIN IMMEDIATE`, commits on success, and rolls back on error.

## Findings

### 1. Medium - Note tags can be created before the note exists

Evidence:

- `app/src/features/reader/VersePanel.tsx:649-652` and `app/src/features/reader/VersePanel.tsx:688-694` render note tag controls around note state before persistence is guaranteed.
- `app/src/features/tags/TagControls.tsx:65-70` calls the attach callback directly for the supplied item id.
- `app/src-tauri/src/user_db.rs:1184-1189` inserts into `item_tags` without checking that the referenced note exists.

Impact:

Users can create `item_tags` rows for a note id that is not backed by a row in `user_notes`.

Suggested fix:

Persist the note before enabling tag editing, and add a backend existence check before inserting an item tag.

### 2. Medium - Deleting a note leaves note tag links behind

Evidence:

- `app/src-tauri/src/user_db.rs:1103-1108` explicitly deletes bookmark tags before deleting a bookmark.
- `app/src-tauri/src/user_db.rs:9065-9070` deletes `user_notes` but does not delete matching `item_tags`.
- `app/src/features/reader/VersePanel.tsx:631-633` and `app/src/features/reader/VersePanel.tsx:676-680` refresh note tag state around note actions, but stale rows remain in the database.

Impact:

Deleted notes can still contribute to tag counts or later browser inconsistencies.

Suggested fix:

Delete `item_tags WHERE item_type = 'note' AND item_id = verse_id` in the same operation as note deletion.

### 3. Medium - Tag counts can disagree with tag browser items

Evidence:

- `app/src-tauri/src/user_db.rs:1221-1228` counts raw `item_tags` rows for bookmark and note item types.
- `app/src-tauri/src/user_db.rs:1239-1248` lists tagged items by joining to `bookmarks` and `user_notes`.
- `app/src/features/tags/TagBrowser.tsx:57-73` displays the count from `listTagsWithCounts`.
- `app/src/features/tags/TagBrowser.tsx:82-85` can show no items after a nonzero count.

Impact:

Orphan rows make tag counts larger than the visible tagged item list.

Suggested fix:

After enforcing item existence and delete cleanup, derive counts from joined browsable rows.

### 4. Medium - Runtime user schema is v14 but `data/schema.sql` still mirrors v12

Evidence:

- `app/src-tauri/src/user_db.rs:13` sets `USER_SCHEMA_VERSION` to 14.
- `app/src-tauri/src/user_db.rs:63-65` says the embedded schema is kept in sync with `data/schema.sql`.
- `app/src-tauri/src/user_db.rs:372-386` defines `tags` and `item_tags`.
- `data/schema.sql:312-314` still says the schema mirrors v12.
- `data/schema.sql:408-430` stops after modules/module entries and does not include tags.

Impact:

The documented canonical schema is stale, which can mislead future migration or ingestion work.

Suggested fix:

Regenerate or update `data/schema.sql` from the current runtime schema and clarify whether it is canonical or historical.

### 5. Medium - JSON import and SQLite restore refresh only part of app state

Evidence:

- `app/src/features/settings/SettingsPanel.tsx:210-220` calls `onUserDataChanged` after JSON import.
- `app/src/features/settings/SettingsPanel.tsx:240-248` calls it after SQLite restore.
- `app/src/App.tsx:468-471` refreshes only current chapter user data and navigation lists.
- `app/src/App.tsx:1378-1382` wires Settings to that limited refresh.
- Settings-owned `resourceSources`, modules, and topic browser state are separate local state in `app/src/features/settings/SettingsPanel.tsx:86-90`.

Impact:

After import/restore, some screens can show stale settings, resources, modules, theology, or Council data until the user navigates or reloads.

Suggested fix:

Add one app-level post-import/restore refresh path that reloads every user-data domain affected by backup operations.

### 6. Medium - Council client timeout does not cancel backend work

Evidence:

- `app/src/features/council/CouncilPanel.tsx:39-63` implements frontend timeout behavior.
- `app/src/features/council/CouncilPanel.tsx:177-207` races the Council request against that timeout.
- `app/sidecar/council.mjs:31-44` documents that `withTimeout` does not cancel the underlying work.
- `app/src-tauri/src/sidecar.rs:259-285` keeps the sidecar request path alive behind the Rust mutex.
- `app/src-tauri/src/lib.rs:2502-2539` persists the Council session after backend completion.

Impact:

The UI can time out while backend work continues and later persists a result that the user believes failed.

Suggested fix:

Introduce operation ids plus cancellation/late-result handling, or propagate abort semantics from UI through Tauri to provider calls.

### 7. Medium - Local E2E is blocked by Edge WebDriver mismatch

Evidence:

- `app/wdio.conf.mts:11-13` documents the driver version requirement.
- The local driver is version 147 while Edge/WebView is `149.0.4022.62`.

Impact:

The E2E suite cannot currently verify the app locally even though coverage exists.

Suggested fix:

Update `msedgedriver.exe` to match Edge/WebView 149 or automate driver resolution in the E2E bootstrap.

### 8. Medium - Windows source install guide omits sidecar dependency install

Evidence:

- `README.md:152-158` documents Windows source build steps.
- `docs/install-windows.md:23-29` documents Windows install prerequisites.
- `app/sidecar/package.json:12-14` declares the sidecar dependency.
- `app/sidecar/providers/claude.mjs:7` imports sidecar package code.

Impact:

A fresh checkout can pass some setup steps while missing sidecar runtime dependencies needed for Council/provider behavior.

Suggested fix:

Document `npm --prefix app/sidecar install` or provide a root script that prepares both frontend and sidecar dependencies.

### 9. Medium - Release builds depend on ignored local artifacts

Evidence:

- `app/src-tauri/tauri.conf.json:30-39` bundles `corpus.sqlite`, sidecar source, `sidecar/node`, and `sidecar/node_modules`.
- `app/scripts/verify-release.mjs:8-22` checks release output for those resources.
- `app/scripts/stage-debug-resources.mjs:16-34` copies the same runtime resources for debug builds.
- `.gitignore` ignores dependency/build artifacts, so these are local generated/staged resources.

Impact:

Release correctness depends on local preparation being done exactly right before build.

Suggested fix:

Make sidecar/resource staging explicit in CI and release scripts, and keep setup docs aligned with the verifier.

### 10. Low/Medium - Council readiness preview is optimistic for Claude Code

Evidence:

- `app/src/features/council/CouncilVoicePanels.tsx:3-16` defines voice readiness metadata.
- `app/src/features/council/CouncilVoicePanels.tsx:42-64` renders readiness state.
- `app/sidecar/providers/claude.mjs:151-188` performs deeper provider checks.
- `app/sidecar/index.mjs:94-100` probes Claude readiness through the sidecar.
- `app/src-tauri/src/lib.rs:1031-1061` exposes diagnostics to the app.

Impact:

The UI can imply readiness before the real Claude runtime/auth path is proven.

Suggested fix:

Separate configured, detected, authenticated, and runnable states in the UI.

### 11. Low/Medium - Council semantic retrieval can silently degrade to FTS

Evidence:

- `app/src-tauri/src/lib.rs:3234-3246`, `app/src-tauri/src/lib.rs:3250-3310`, and `app/src-tauri/src/lib.rs:3345-3358` implement semantic retrieval and fallback behavior.
- `app/src/features/council/CouncilPanel.tsx:327-355` displays context without making retrieval downgrade obvious.

Impact:

Users may not know when a Council answer used keyword retrieval instead of semantic retrieval.

Suggested fix:

Expose retrieval mode and fallback reason in Council run metadata and context preview.

### 12. Low/Medium - Tag command contract is wider than implementation

Evidence:

- `app/src-tauri/src/lib.rs:1268-1274` accepts `bookmark`, `note`, `range_note`, and `study_item`.
- `app/src-tauri/src/user_db.rs:378-384` allows the same item types in `item_tags`.
- `app/src-tauri/src/user_db.rs:1221-1228` counts only bookmark/note types.
- `app/src-tauri/src/user_db.rs:1239-1248` lists only bookmark/note rows.
- `app/src-tauri/src/user_db.rs:7591-7598` skips imported range-note and study-item tags with a comment saying they are not yet taggable.
- `app/src/lib/bible.ts:518-523` exposes `itemType: string`.

Impact:

The public command/types suggest generic tagging, but only bookmark and note tagging are fully queryable.

Suggested fix:

Narrow the accepted item types to currently supported values, or complete range-note/study-item tagging across insert, delete cleanup, import, counts, and browsing.

### 13. Low - Clipboard copy handling is inconsistent

Evidence:

- Caught examples: `app/src/features/resources/ResourcesPanel.tsx:125-131`; `app/src/features/council/CouncilMarkdownExport.tsx:18-23`.
- Uncaught examples: `app/src/features/reader/ChapterReader.tsx:539-545`; `app/src/features/workspaces/WorkspacesPanel.tsx:198-203`; `app/src/features/theology/TheologyPanel.tsx:408-429`.
- Additional uncaught item-level copies are in `app/src/features/workspaces/WorkspaceItem.tsx:243`, `:297`, `:343`, `:404`, and `:454`.
- Global fallback exists in `app/src/features/common/GlobalErrorNotice.tsx:26-35`.

Impact:

Clipboard failures sometimes show targeted local feedback and sometimes surface as global async errors.

Suggested fix:

Centralize clipboard writes in a shared helper that returns consistent success/failure state to callers.

### 14. Low/Medium - SQLite restore validation is permissive

Evidence:

- `app/src-tauri/src/lib.rs:2045-2090` validates restore source by opening read-only, running `PRAGMA quick_check`, checking only for `app_settings`, and rejecting only newer schema versions.
- `app/src-tauri/src/lib.rs:2154-2172` tests a minimal database with only `app_settings` and current `user_version` as valid.
- `app/src-tauri/src/user_db.rs:389-402` then opens the restored database, creates any missing schema, seeds defaults, and bumps version.

Impact:

A wrong SQLite database with an `app_settings` table can pass validation, replace `user.sqlite`, and then be migrated into an apparently empty Bible AI database.

Suggested fix:

Require a stronger app identity marker or validate a meaningful set of expected tables before restore. Keep legacy backup handling explicit.

### 15. Medium - Theology links can become stale after linked objects are deleted

Evidence:

- `app/src-tauri/src/user_db.rs:204-220` defines `theology_links` with polymorphic `link_kind` and `target_id`, so SQLite cannot enforce target existence.
- `app/src-tauri/src/user_db.rs:2353-2374` validates the link kind and positive target id only, not the existence of the target row.
- `app/src-tauri/src/user_db.rs:1745-1755` deletes Council sessions, judgments, and annotations but not `theology_links` with `link_kind = 'council_session'`.
- `app/src-tauri/src/user_db.rs:817-822` deletes a workspace and its study items but not `theology_links` with `link_kind = 'workspace_item'`.
- `app/src-tauri/src/user_db.rs:963-981` deletes an individual study item but not matching Theology links.
- `app/src/features/council/AddToTheologyMenu.tsx:31-38` creates `council_session` Theology links.
- `app/src/features/workspaces/WorkspaceItem.tsx:106-115` creates `workspace_item` Theology links.
- `app/src/features/theology/TheologySections.tsx:112-127` displays the stored link and cached payload preview.

Impact:

Theology can keep evidence links to deleted Council sessions or workspace items. Because the link payload stores cached text, the stale link may still look valid even though the source object is gone.

Suggested fix:

Add cleanup for polymorphic Theology links in delete paths for Council sessions, study items, workspaces, modules/resources if delete support exists, and any future linked object type. Add tests that link an object to Theology, delete the object, and verify the Theology link is removed or visibly marked stale.

### 16. Low - SQLite restore still uses a raw path input instead of an open dialog

Evidence:

- `app/src-tauri/capabilities/default.json:6-9` grants `dialog:allow-save` but not `dialog:allow-open`.
- `app/src/features/settings/SettingsPanel.tsx:912-921` renders a raw `SQLite restore path` text input.
- `app/tests/e2e/backup-restore.spec.ts:66-68` enters the backup path by setting that input directly.
- `docs/superpowers/specs/2026-05-29-safe-sqlite-restore-design.md:22-24` explicitly lists replacing the raw path input with a Tauri file picker as out of scope.

Impact:

Non-technical users must paste a filesystem path for one of the riskiest operations in the app. The confirmation guard reduces destructive mis-click risk, but the file-selection UX is still brittle.

Suggested fix:

Add `dialog:allow-open` with a narrow file picker for `.sqlite` restore sources, keep the typed path as an advanced fallback if useful, and retain the existing confirmation step.

## Coverage Gaps To Add

- Reject wrong/minimal SQLite restore sources.
- Create a note tag before a note exists and verify the backend rejects it.
- Delete a tagged note and verify `item_tags` cleanup.
- Link a Council session to Theology, delete the Council session, and verify the Theology link is cleaned or marked stale.
- Link a workspace item to Theology, delete the item/workspace, and verify cleanup.
- Import/restore while Settings is open and verify Settings-owned data sources/modules refresh without navigation.
- Trigger frontend Council timeout and assert no late backend persistence, or assert the late persistence is explicitly surfaced.
- Exercise clipboard failure paths through one shared helper.

## Suggested Fix Order

1. Fix tag integrity: existence checks, delete cleanup, import/list/count contract alignment.
2. Fix stale Theology links for deleted linked objects.
3. Strengthen SQLite restore identity validation.
4. Add a complete app-level post-import/restore refresh.
5. Update `data/schema.sql` to match runtime schema v14.
6. Update Windows setup docs and release prep scripts for sidecar dependencies/runtime artifacts.
7. Unblock E2E locally by updating or auto-resolving Edge WebDriver.
8. Clarify Council timeout cancellation and retrieval fallback visibility.
9. Replace raw SQLite restore path entry with an open-file dialog.
10. Normalize clipboard handling.

## Bottom Line

The app is structurally coherent and has substantial coverage. The most important remaining risks are not broad architecture problems; they are polymorphic data integrity gaps and lifecycle edges: tags, Theology links, restore validation, import/restore refresh, and Council timeout semantics.
