# Bible AI Deep Review Findings

Generated: 2026-06-11 15:06:03 +01:00

Report file: `docs/reviews/2026-06-11-150603-app-deep-review-findings.md`

Extends: `docs/reviews/2026-06-11-145646-app-deep-review-findings.md`

Scope: additional passes over the current app state, carrying forward all prior findings and adding the new findings from the second review cycle. Paths and line numbers are relative to the repository root unless noted.

## Current App State

Bible AI is a local-first Tauri 2 desktop Bible study app.

- Frontend: React 19, TypeScript, Vite, Tailwind.
- Backend: Rust/Tauri with rusqlite.
- Databases: bundled read-only `data/corpus.sqlite`; per-user writable `user.sqlite`.
- AI orchestration: Node sidecar under `app/sidecar`.
- Main product areas: Reader, Council, Theology, Resources, Workspaces, Tags, Settings.
- Corpus state: ASV, KJV, TR, WLC, and YLT have embeddings; WEB does not. WLC is the only translation with `word_tokens`, and the frontend reflects that with `TAGGED_TRANSLATIONS = new Set(["WLC"])`.

Repository state at the start of this report:

- `app/src-tauri/Cargo.toml` is modified in the worktree, but this appears pre-existing and was not changed by this review.
- `docs/reviews/` is untracked because it contains the timestamped review artifacts.

## Passes Performed

1. Rechecked the high-level product architecture, app modes, docs, and test scripts.
2. Rechecked Tauri command registration against `generate_handler!` and the TypeScript command wrapper surface.
3. Rechecked user database schema, migrations, import/export, backup/restore, and tag contracts.
4. Rechecked frontend async behavior, clipboard handling, restore/import state refresh, and E2E coverage gaps.
5. Rechecked local verification state and the WebDriver/Edge blocker.

## Verification Snapshot

Previously confirmed during this review cycle:

- `npm run build` passed.
- `npm run test:sidecar` passed with 66 tests.
- `cargo test --manifest-path .\src-tauri\Cargo.toml` passed with 93 tests.
- `npm run check` passed.

Still blocked:

- `npm run test:e2e:build` is blocked before specs run because local `msedgedriver.exe` is version 147 while installed Edge/WebView is `149.0.4022.62`.
- `wdio.conf.mts:11-13` documents that `msedgedriver.exe` must match the installed Edge version.
- `wdio.conf.mts:125-145` lists the active 18 E2E spec files.

## Findings

### 1. Medium - Note tags can be created before the note exists

Evidence:

- `app/src/features/reader/VersePanel.tsx:649-652` and `app/src/features/reader/VersePanel.tsx:688-694` render tag controls for note/range-note state before persistence is guaranteed.
- `app/src/features/tags/TagControls.tsx:65-70` calls the tag command directly for the supplied item id.
- `app/src-tauri/src/user_db.rs:1184-1189` inserts into `item_tags` without checking that the referenced note exists.

Impact:

Users can create tag rows for a note id that is not yet backed by an actual note. Those orphan links can later show up as inconsistent counts or inert tag browser entries.

Suggested fix:

Persist the note before enabling note tag editing, or make the backend reject tag creation unless the referenced note/range note/workspace item exists. The backend guard is the stronger fix because it protects every caller.

### 2. Medium - Deleting a note leaves note tag links behind

Evidence:

- `app/src-tauri/src/user_db.rs:1103-1108` explicitly removes bookmark tags before deleting bookmarks.
- `app/src-tauri/src/user_db.rs:9065-9070` deletes notes but does not remove matching `item_tags`.
- `app/src/features/reader/VersePanel.tsx:631-633` and `app/src/features/reader/VersePanel.tsx:676-680` refresh note tag state around note actions, which can leave stale backend rows invisible until another tag view is loaded.

Impact:

Deleted notes can continue to contribute to tag counts and tag browser results. This is a data integrity issue in `user.sqlite`.

Suggested fix:

Delete `item_tags` rows for `item_type = 'note'` in the same transaction as note deletion. Add the equivalent cleanup for range notes and study items if those item types remain supported.

### 3. Medium - Tag counts can disagree with tag browser items

Evidence:

- `app/src-tauri/src/user_db.rs:1221-1228` counts `item_tags` rows directly.
- `app/src-tauri/src/user_db.rs:1239-1248` lists tagged items by joining against the concrete item table.
- `app/src/features/tags/TagBrowser.tsx:57-73` loads tag counts separately from tagged item details.
- `app/src/features/tags/TagBrowser.tsx:82-85` displays the count returned by the count command.

Impact:

If `item_tags` contains orphan rows, the tag browser can show a count that does not match the visible items. This is the user-facing symptom of findings 1 and 2.

Suggested fix:

Clean orphan rows, enforce existence on insert, and consider deriving counts from the same joined query used to display tag browser rows.

### 4. Medium - Runtime user schema is v14 but `data/schema.sql` still mirrors v12

Evidence:

- `app/src-tauri/src/user_db.rs:13` sets the runtime user schema version to 14.
- `app/src-tauri/src/user_db.rs:63-65` executes embedded schema SQL during initialization.
- `app/src-tauri/src/user_db.rs:372-386` creates tag-related schema/migrations at runtime.
- `data/schema.sql:312-314` still documents user schema version 12.
- `data/schema.sql:408-430` lacks the current tag/item-tag schema that runtime code now creates.
- `docs/technical-implementation-plan.md:31-33` still calls `data/schema.sql` the canonical schema dump.

Impact:

The documented canonical schema is stale. New developers or future migration work can make incorrect assumptions if they rely on the SQL dump instead of the runtime migration path.

Suggested fix:

Regenerate or update `data/schema.sql` from the current runtime schema and clarify whether it is canonical, historical, or only a bootstrap aid.

### 5. Medium - JSON import and SQLite restore refresh only part of app state

Evidence:

- `app/src/features/settings/SettingsPanel.tsx:210-220` refreshes only selected local settings after JSON import.
- `app/src/features/settings/SettingsPanel.tsx:240-248` refreshes only selected local settings after SQLite restore.
- `app/src/App.tsx:438-471` owns broader app state for bookmarks, notes, workspaces, settings, and related data.
- `app/src/App.tsx:1378-1399` wires settings import/restore callbacks into the app.
- `app/src/features/settings/SettingsPanel.tsx:101-132` owns data source state shown inside Settings.
- `app/src/features/settings/SettingsPanel.tsx:1049` renders data-source state from local Settings state.
- `app/src/features/settings/DataSourcesSection.tsx:18-24` displays the supplied sources.

Impact:

After import or restore, some screens can show stale data until navigation or a reload causes broader state to refresh. This is most visible for state owned outside Settings, and likely for Settings-owned data sources too.

Suggested fix:

Route import and restore completion through a single app-level refresh path that reloads every user-data domain affected by the operation: settings, notes, bookmarks, workspaces, tags, data sources, council sessions, theology items, and any cached reader state.

### 6. Medium - Council client timeout does not cancel backend work

Evidence:

- `app/src/features/council/CouncilPanel.tsx:39-63` implements the frontend timeout helper.
- `app/src/features/council/CouncilPanel.tsx:177-207` races the Council request against the frontend timeout.
- `app/sidecar/council.mjs:31-44` creates a sidecar timeout controller.
- `app/sidecar/council.mjs:47-60` passes the abort signal into provider execution.
- `app/src-tauri/src/sidecar.rs:259-285` continues the Rust/sidecar invoke path independently of the frontend race.
- `app/src-tauri/src/lib.rs:2502-2539` persists Council session data after the backend operation returns.

Impact:

When the UI times out, the backend operation can still complete and persist a Council session later. The user may believe the run failed or stopped, while data is written after the visible timeout.

Suggested fix:

Add a real cancellation path that propagates from the frontend to Tauri and the sidecar, or mark timed-out requests with an operation id and ignore/purge late completion results.

### 7. Medium - Local E2E is blocked by Edge WebDriver mismatch

Evidence:

- `wdio.conf.mts:11-13` states that local `msedgedriver.exe` must match installed Edge/WebView.
- `wdio.conf.mts:125-145` lists 18 E2E specs, but the suite cannot reach them with the current driver mismatch.

Impact:

The app has meaningful E2E coverage, but it is currently not executable in this local environment. This prevents end-to-end verification of backup/restore, tags, notes, workspaces, reader interactions, and Council UI flows.

Suggested fix:

Update `msedgedriver.exe` to match installed Edge/WebView `149.0.4022.62`, or change the local E2E bootstrap to locate/download the matching driver automatically.

### 8. Medium - Windows source install guide omits sidecar dependency install

Evidence:

- `README.md:152-158` documents Windows source build steps.
- `docs/install-windows.md:23-29` documents Windows install prerequisites/steps.
- `app/sidecar/package.json:12-14` defines sidecar dependencies.
- `app/sidecar/providers/claude.mjs:7` imports `@anthropic-ai/sdk`.

Impact:

A fresh source checkout can build frontend/Rust pieces but fail at runtime or release verification if `app/sidecar/node_modules` has not been installed. This is especially easy to miss because the sidecar has its own package manifest.

Suggested fix:

Add `npm --prefix app/sidecar install` or an equivalent workspace script to the Windows source setup docs and release checklist.

### 9. Medium - Release builds depend on ignored local artifacts

Evidence:

- `app/src-tauri/tauri.conf.json:30-39` bundles local sidecar/resources.
- `.gitignore:4-5` and `.gitignore:18` ignore dependency/build artifacts.
- `app/package.json:28` has the release verification script.
- `app/scripts/verify-release.mjs:8-22` checks required release resources.
- `app/scripts/stage-debug-resources.mjs:16-34` stages required resources for development.

Impact:

Release correctness depends on local generated/staged artifacts that are intentionally not committed. This is manageable, but fragile if setup or CI does not create them exactly.

Suggested fix:

Make release staging an explicit prerequisite in CI/release scripts and keep the source install docs aligned with the resource checks.

### 10. Low/Medium - Council readiness preview is optimistic for Claude Code

Evidence:

- `app/src/features/council/CouncilVoicePanels.tsx:3-16` defines voice panel metadata.
- `app/src/features/council/CouncilVoicePanels.tsx:42-64` renders readiness state.
- `app/sidecar/providers/claude.mjs:151-188` performs provider readiness/runtime checks.
- `app/sidecar/index.mjs:94-100` exposes sidecar health behavior.
- `app/src-tauri/src/lib.rs:1031-1061` exposes readiness/health command behavior.

Impact:

The UI can imply that Claude Code is ready when deeper runtime requirements may still fail. This can make the first real Council run feel unexpectedly broken.

Suggested fix:

Align frontend readiness labels with backend/provider readiness checks, and distinguish configured, reachable, authenticated, and fully runnable states.

### 11. Low/Medium - Council semantic retrieval can silently degrade to FTS

Evidence:

- `app/src-tauri/src/lib.rs:3234-3246` handles Council retrieval setup.
- `app/src-tauri/src/lib.rs:3250-3310` attempts semantic/vector retrieval behavior.
- `app/src-tauri/src/lib.rs:3345-3358` falls back to keyword/FTS behavior.
- `app/src/features/council/CouncilPanel.tsx:327-355` displays Council context without making the degradation obvious.

Impact:

If embeddings are missing for the selected corpus/translation or vector search fails, the Council can still answer using weaker retrieval. That resilience is useful, but the user may not know why results are less relevant.

Suggested fix:

Surface retrieval mode in the Council run metadata or context preview, especially when semantic retrieval falls back to FTS.

### 12. Low/Medium - Tag command contract is wider than implementation

Evidence:

- `app/src-tauri/src/lib.rs:1268-1274` accepts `bookmark`, `note`, `range_note`, and `study_item` as taggable item types.
- `app/src-tauri/src/user_db.rs:378-384` creates generic `item_tags`.
- `app/src-tauri/src/user_db.rs:1221-1228` counts tags for arbitrary item type rows.
- `app/src-tauri/src/user_db.rs:1239-1248` lists tagged items through item-type-specific joins.
- `app/src-tauri/src/user_db.rs:7591-7598` imports item tag rows.
- `app/src/lib/bible.ts:518-523` exposes frontend tag wrappers with `itemType: string`.

Impact:

The command surface suggests a broader generic tagging model than the UI and listing/counting code fully support. That increases the chance of orphan or invisible tag rows if future features start tagging range notes or study items without completing the query/display path.

Suggested fix:

Narrow the public TypeScript type to the actually supported item types, or finish support for all accepted backend item types with referential checks, cleanup, counts, and list views.

### 13. Low - Clipboard copy handling is inconsistent

Evidence:

- Caught examples: `app/src/features/resources/ResourcesPanel.tsx:125-131`; `app/src/features/council/CouncilMarkdownExport.tsx:18-23`.
- Uncaught examples: `app/src/features/reader/ChapterReader.tsx:539-545`; `app/src/features/workspaces/WorkspacesPanel.tsx:198-203`; `app/src/features/theology/TheologyPanel.tsx:408-429`.
- Additional uncaught item-level copies: `app/src/features/workspaces/WorkspaceItem.tsx:243`, `app/src/features/workspaces/WorkspaceItem.tsx:297`, `app/src/features/workspaces/WorkspaceItem.tsx:343`, `app/src/features/workspaces/WorkspaceItem.tsx:404`, `app/src/features/workspaces/WorkspaceItem.tsx:454`.
- Global fallback: `app/src/features/common/GlobalErrorNotice.tsx:26-35`.

Impact:

Clipboard failures can surface as global unhandled promise errors in some flows, while other flows show targeted local feedback. The global handler prevents total silence, but the user experience is inconsistent.

Suggested fix:

Centralize clipboard copy into a shared helper that returns success/failure and gives the caller a consistent message path.

### 14. Low/Medium - SQLite restore validation is permissive

Evidence:

- `app/src-tauri/src/lib.rs:2045-2090` opens the restore source read-only, runs `PRAGMA quick_check`, checks for an `app_settings` table, reads `PRAGMA user_version`, and rejects only if the source schema version is newer than the app supports.
- `app/src-tauri/src/lib.rs:2154-2172` has a test named `validate_user_sqlite_source_accepts_bible_ai_backup` that creates a minimal database containing only `app_settings` plus the current `user_version`, then asserts that validation succeeds.
- `app/src-tauri/src/user_db.rs:389-402` then opens the selected database, enables `foreign_keys`, executes schema creation/migration SQL, seeds defaults, and bumps schema version.

Impact:

A wrong SQLite database that happens to contain `app_settings` can pass restore validation. The app will then replace `user.sqlite`, create any missing tables, and appear to have wiped user data. The pre-restore backup/confirmation flow reduces risk, but the validation is weaker than the user-facing "Bible AI backup" expectation.

Suggested fix:

Require a stronger app identity marker before restore. Options include a metadata row with app id/version, or validation for a set of expected tables such as `app_settings`, `user_notes`, `study_workspaces`, `council_sessions`, and `data_sources`. Keep a legacy path only for known older backups.

## Additional Review Notes

### Command registration currently matches

A command surface pass found 104 `#[tauri::command]` functions and 104 handlers registered in the Tauri `generate_handler!` block. No unregistered command functions or stale registered handler names were found in that pass.

Manual follow-up confirmed the frontend wrapper for `export_user_data_json` exists at `app/src/lib/bible.ts:1137-1138`; a simple regex initially missed it because the generic type contains a nested comma.

This is a positive state, but it would be worth adding a small automated guard because command drift is easy to introduce in Tauri apps.

### Study item and range note tag cleanup is a future-risk path

Evidence:

- `app/src-tauri/src/lib.rs:1268-1274` includes `range_note` and `study_item` in the accepted taggable item types.
- `app/src-tauri/src/user_db.rs:817-822` deletes study workspace items without item tag cleanup.
- `app/src-tauri/src/user_db.rs:963-981` deletes individual study items without item tag cleanup.
- `app/src-tauri/src/user_db.rs:9145-9155` deletes range notes without item tag cleanup.

Current impact depends on whether the UI actively tags these item types. The safer path is to either remove those types from the accepted command contract or fully implement cleanup/listing/counting for them.

### Existing coverage is meaningful but misses failure-path contracts

Relevant tests:

- `app/tests/e2e/backup-restore.spec.ts:45-84` covers SQLite backup/restore using an app-generated backup.
- `app/tests/e2e/backup-restore.spec.ts:145-180` covers resource import and navigates away/back before checking data sources.
- `app/tests/e2e/notes-search.spec.ts:61-69` covers note tag creation happy path.
- `app/tests/e2e/tags-browse.spec.ts:28-47` covers bookmark tag browser happy path.
- `app/tests/e2e/council-error.spec.ts:66-108` covers Council client timeout UI behavior.

Coverage gaps:

- No E2E or integration test for rejecting wrong/minimal SQLite restore sources.
- No E2E test for stale state immediately after import/restore without navigation.
- No test for orphan tag prevention after creating/deleting notes.
- No test for late Council backend completion after a frontend timeout.

## Suggested Fix Order

1. Fix tag integrity first: enforce item existence on tag insert, clean `item_tags` during note/range-note/study-item delete, and reconcile tag counts/listing.
2. Strengthen SQLite restore validation before users rely on arbitrary backup imports.
3. Add one app-level refresh path after JSON import and SQLite restore.
4. Update `data/schema.sql` and docs to reflect runtime schema v14.
5. Unblock local E2E by updating `msedgedriver.exe` or automating driver matching.
6. Add targeted tests for restore validation, tag orphan prevention, and import/restore refresh.
7. Clean up Council timeout semantics and retrieval-mode visibility.
8. Normalize clipboard copy handling behind one shared helper.

## Bottom Line

The app is in a generally solid state: build, unit/integration tests, sidecar tests, and Rust tests were passing in the latest verification cycle, and the Tauri command registration surface matched the command definitions. The main risks are not broad architectural problems; they are state-integrity and lifecycle edge cases around tags, restore/import refresh, SQLite restore validation, and Council timeout semantics.
