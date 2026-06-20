# Bible AI App Deep Review Findings - 2026-06-11 22:25:04 +01:00

Report file timestamp: `2026-06-11-222504`  
Review date/time: `2026-06-11 22:25:04 +01:00`  
Workspace: `C:\JM Programs\BibleApp`  
Scope: additional deep-review passes over the current app state, with emphasis on Tauri command boundaries, release/package gates, frontend shell behavior, persistence/import/export paths, and previously active backlog items.

## Worktree Note

The review started with an existing modified file:

- `app/src-tauri/Cargo.toml`

I did not modify or revert it. Review docs under `docs/reviews/` are untracked in this worktree.

## Current State Summary

The app is in a stronger state than the earliest review passes: production CSP is restrictive, the Tauri capability surface is narrow, SQLite restore validation exists, provider secrets are migrated into the OS credential vault on normal settings load, user-data import/export has meaningful shape validation and transactional rollback, resource entry bodies are intentionally excluded from JSON backup export, release metadata is centralized, and the public release gate correctly blocks without manual QA evidence.

The active issues are now mostly hardening, release assurance, state-refresh polish, and data-integrity cleanup. The highest practical release blocker remains manual clean-profile and credential-vault QA evidence.

## Passes Completed

1. Tauri command and filesystem/security boundary pass.
2. Release, packaging, manifest, and public-release gate pass.
3. Frontend shell, error handling, keyboard shortcuts, and E2E coverage pass.
4. Persistence/import/export, module JSONL, notes/tags, restore, and schema drift pass.
5. Focused verification run across build, sidecar, Rust import/tag/note/module/restore tests, release script syntax, and public-release gate.

## Active Findings

### 1. Low - Release manifest summarizes sidecar directories without per-file hashes

The Windows release manifest hashes individual top-level release files, installers, sidecar entry files, lockfile, and bundled Node runtime, but directory artifacts are summarized only by file count and total bytes.

Evidence:

- `app/scripts/create-release-manifest.mjs:8-19` hashes named file artifacts.
- `app/scripts/create-release-manifest.mjs:21-24` treats `sidecar/providers` and `sidecar/node_modules` as directory artifacts.
- `app/scripts/create-release-manifest.mjs:79-87` records only directory `files` and `bytes`.
- `app/scripts/create-release-manifest.mjs:89-108` summarizes directories by count/bytes only.
- `app/scripts/verify-release-manifest.mjs:140-174` verifies directory count/bytes only.

Impact:

Installer files are hashed, so this is not the main installer integrity control. The gap is that the release-root manifest cannot precisely attest every sidecar provider/dependency file. A file swap that preserves total count and byte total would not be caught by the directory check itself.

Recommendation:

Add deterministic per-file SHA-256 entries for directory artifacts, or a stable Merkle/tree hash over relative paths, sizes, and content hashes. Keep the current aggregate count/byte check as a quick summary.

### 2. Low - Module JSONL import has no payload, row-count, or body-size budgets

The module JSONL import command takes the whole JSONL payload as a `String`, parses every non-empty line into memory, and inserts all entries in one transaction. The Settings UI currently feeds it a small built-in sample, but the Tauri command itself has no explicit resource budget.

Evidence:

- `app/src-tauri/src/lib.rs:1651-1655` exposes `import_module_jsonl` with `entries_jsonl: String`.
- `app/src-tauri/src/lib.rs:1668-1706` iterates all lines and builds a `Vec` before inserting.
- `app/src-tauri/src/lib.rs:1709-1761` inserts all entries in one transaction.
- `app/src/features/settings/SettingsPanel.tsx:306-344` currently invokes it only with a three-entry sample.
- `app/src/lib/bible.ts:1117` exposes the invoke wrapper to the renderer.

Impact:

The present user-facing UI is low risk because it only imports a hard-coded sample. The command contract is still unbounded, so a future file-import UI or a compromised renderer path could allocate and write far more data than intended.

Recommendation:

Apply explicit budgets before parsing/inserting: maximum payload bytes, maximum lines, maximum body/search text length, maximum metadata bytes, and a clear import report when rows are rejected. Add Rust tests for over-budget payloads.

### 3. Medium - Generic JSON user-data import still has no overall size or row budgets

The JSON backup importer validates versions, known tables, row shapes, supported app settings, secret app settings, and transactional rollback. It does not cap total payload size, per-table row counts, or large text fields before inserting resource/module rows and rebuilding FTS.

Evidence:

- `app/src/features/settings/SettingsPanel.tsx:210-219` parses pasted backup JSON with `JSON.parse(importText)` and submits the whole payload.
- `app/src-tauri/src/lib.rs:1841-1850` accepts the full `serde_json::Value` and forwards it to `user_db::import_user_data`.
- `app/src-tauri/src/user_db.rs:7434-7492` validates export and schema versions plus the `tables` object.
- `app/src-tauri/src/user_db.rs:7518-7533` iterates every supplied table array and row.
- `app/src-tauri/src/user_db.rs:7705-7707` rebuilds resource FTS whenever `resource_entries` are present.
- `app/src-tauri/src/user_db.rs:7832-7889` normalizes resource and module rows but does not impose size budgets on resource/module body fields.

Positive context:

- `app/src-tauri/src/user_db.rs:7395-7398` excludes `resource_entries` from normal JSON export.
- `cargo test --manifest-path .\app\src-tauri\Cargo.toml import --lib` passed 23 import/export tests, including transactional rejection and secret app-setting skipping.

Impact:

This is mostly an abuse/robustness issue for pasted/imported backups. A very large payload can consume memory and DB time and can trigger expensive FTS rebuilds.

Recommendation:

Budget the import before transaction start: total serialized size, table allowlist, maximum rows per table, maximum string length per row/field, and explicit maximum resource/module body lengths. Return a structured rejection before DB writes.

### 4. Medium - SQLite restore validation is solid, but legacy secret cleanup is delayed until settings load

SQLite restore now validates the source file before replacing the active DB, creates a safety backup, and reopens the restored DB. Normal settings load migrates legacy provider secrets to the credential vault and deletes/vacuums broad secret-like settings. Restore itself does not invoke that cleanup before returning.

Evidence:

- `app/src-tauri/src/lib.rs:1972-2042` restores the selected SQLite file, opens it, stores the connection, and returns.
- `app/src-tauri/src/lib.rs:2045-2090` validates the restore source with read-only open, `PRAGMA quick_check`, `app_settings`, and schema version.
- `app/src-tauri/src/lib.rs:995-1015` normal settings load migrates legacy provider keys and then calls `delete_secret_settings`.
- `app/src-tauri/src/user_db.rs:693-708` deletes secret-like `app_settings` rows with `secure_delete` and `VACUUM`.
- `app/src-tauri/src/user_db.rs:3769-3840` has a regression test proving secret cleanup removes legacy values from a file-backed DB.

Impact:

After restoring an older backup that still has provider secrets in SQLite, those secrets can remain in the restored file until the app performs the settings-load path. That window is narrower than before, but still worth closing because the cleanup primitive already exists.

Recommendation:

After restore opens the new DB and before returning, run the same legacy secret migration/cleanup path, or call a helper shared with `get_app_settings`. Add a restore regression test with a legacy secret row in the backup file.

### 5. Medium - Settings view can keep stale module/resource state after some data changes

Settings correctly calls `onUserDataChanged` for JSON import, SQLite restore, and module uninstall. Some module install/import paths only refresh Settings-local module state, and the resources/source list is loaded once for Settings rather than consistently refreshed after imports/restores.

Evidence:

- `app/src/features/settings/SettingsPanel.tsx:101-117` owns local `installedModules` refresh state.
- `app/src/features/settings/SettingsPanel.tsx:210-219` calls `onUserDataChanged` after JSON backup import.
- `app/src/features/settings/SettingsPanel.tsx:240-248` calls `onUserDataChanged` after SQLite restore.
- `app/src/features/settings/SettingsPanel.tsx:255-303` installs the sample module and refreshes local modules only.
- `app/src/features/settings/SettingsPanel.tsx:306-344` imports JSONL sample and refreshes local modules only.
- `app/src/features/settings/SettingsPanel.tsx:352-360` uninstalls a module, refreshes local modules, and calls `onUserDataChanged`.

Impact:

The user can complete an import/install and see one panel updated while other navigation/search/data-source state stays stale until another refresh path runs.

Recommendation:

Call the same app-level refresh hook after module install/import as after uninstall. Refresh resource sources after JSON/SQLite import/restore. Consider making Settings data refresh derive from one `userDataVersion` prop.

### 6. Low - Restore requires typing a path because the capability set grants save dialogs only

The capability set grants `dialog:allow-save` but not open-file dialog permission. SQLite restore therefore relies on a typed path instead of a file picker.

Evidence:

- `app/src-tauri/capabilities/default.json:6-9` grants only `core:default` and `dialog:allow-save`.
- `app/src/features/settings/SettingsPanel.tsx:240-246` restores from `sqliteRestorePath`.
- `app/src/lib/bible.ts:1155` invokes `restore_user_sqlite` with a source path string.

Impact:

This is a UX and supportability issue more than a security defect. Typed paths are error-prone, especially for non-technical users restoring backups.

Recommendation:

If the product wants a picker, add only the narrow open-dialog permission required for SQLite backup selection and constrain accepted extensions/path validation in the existing restore command.

### 7. Low - Explicit markdown save-to-path can overwrite arbitrary markdown files selected by the user

The normal workspace export paths write under the app export directory, but `write_workspace_markdown_to_path` accepts an absolute markdown path and writes there.

Evidence:

- `app/src-tauri/src/lib.rs:1887-1896` writes markdown to an explicit path.
- `app/src-tauri/src/lib.rs:2204-2227` validates absolute path, filename, existing parent, and `.md`/`.markdown`.
- `app/src-tauri/capabilities/default.json:8` allows save dialogs.

Impact:

This is aligned with a user-initiated save-as workflow, but there is no backend no-overwrite or confirm-existing guard. The OS dialog may handle confirmation depending on platform, but the command itself does not.

Recommendation:

Keep the command, but either require the frontend save dialog to confirm overwrites or have the backend reject existing paths unless an explicit overwrite flag is provided.

### 8. Low - Note/range-note/study-item tag cleanup remains incomplete

Bookmark deletion clears associated `item_tags`; note, range-note, and study-item destructive flows do not. Because `item_tags` is polymorphic and has no FK to the target item tables, SQLite cannot cascade these rows automatically.

Evidence:

- `app/src-tauri/src/user_db.rs:378-386` defines polymorphic `item_tags` with no item FK.
- `app/src-tauri/src/user_db.rs:1103-1108` deletes bookmark `item_tags` before deleting the bookmark.
- `app/src-tauri/src/user_db.rs:9065-9070` deletes only from `user_notes`.
- `app/src-tauri/src/user_db.rs:9145-9155` deletes only from `user_range_notes`.
- `app/src-tauri/src/user_db.rs:963-982` deletes only from `study_items`.
- `app/src-tauri/src/user_db.rs:817-822` deletes workspace child `study_items` without clearing any study-item tags.
- `app/src-tauri/src/lib.rs:1268` still advertises `bookmark`, `note`, `range_note`, and `study_item` as taggable item types.
- `app/src-tauri/src/user_db.rs:7591-7598` says range-note/study-item import remapping is not implemented yet and skips those links.

Impact:

Deleting a tagged note or future tagged range/study item can leave stale `item_tags` rows. Counts and exports can diverge from visible items.

Recommendation:

Mirror bookmark cleanup in `delete_note`, `delete_range_note`, `delete_study_item`, and workspace deletion. Either fully implement range-note/study-item tags or remove them from the public command contract until supported. Add regression tests for each destructive flow.

### 9. Low - Tagging can create note links before a note exists

The note UI allows tag attachment independently of note persistence, and the backend accepts tag links without verifying that the target note row exists.

Evidence:

- `app/src/features/reader/VersePanel.tsx:612-618` loads all note tags for the verse.
- `app/src/features/reader/VersePanel.tsx:649-652` creates a tag and calls `tagItem(t.id, "note", verseId)`.
- `app/src-tauri/src/user_db.rs:1184-1189` inserts into `item_tags` without target existence validation.
- `app/src-tauri/src/user_db.rs:1239-1248` visible tagged note items require a successful join to `user_notes`.

Impact:

A user can create a tag link that will not appear in tagged item lists until a note row exists. If the note is never saved, the tag link is stale from creation.

Recommendation:

Require the note body to be persisted before allowing tag attach, or have `tag_item` validate target existence for `note` and other item types.

### 10. Low - Schema/version mirrors are still drifting

Runtime user schema is v14 and includes tags/item_tags. The checked-in SQL mirror still describes v12, lacks tag tables, and the resource JSONL script still emits schema version 13.

Evidence:

- `app/src-tauri/src/user_db.rs:13` sets `USER_SCHEMA_VERSION: i64 = 14`.
- `data/schema.sql:312-313` says the SQL mirror is the current v12 shape.
- `app/src-tauri/src/user_db.rs:372-386` creates `tags` and `item_tags`.
- `rg` found no `CREATE TABLE tags` or `CREATE TABLE item_tags` definitions in `data/schema.sql`.
- `app/scripts/resources/import-resource-jsonl.mjs:71-76` emits `user_schema_version: 13` with a comment saying it must stay in sync.

Impact:

Humans and import scripts can make decisions from stale schema metadata. The current runtime accepts older schema payloads, so this is not an immediate import failure, but it weakens maintainer confidence and release reproducibility.

Recommendation:

Update `data/schema.sql` to v14, add tags/item_tags, update resource fixtures/scripts to schema 14 where appropriate, and add a small CI check comparing runtime `USER_TABLES`/schema version against the SQL mirror and resource script.

### 11. Low - Keyboard shortcut E2E coverage is thinner than the app behavior

The app has a command palette and shortcut handling, but E2E coverage does not prove the `/` search shortcut or Ctrl/Cmd+K command palette workflow.

Evidence:

- `app/src/App.tsx:739-749` handles Ctrl/Cmd+K.
- `app/src/features/app-shell/CommandPalette.tsx:24-26` focuses the palette input on open.
- `app/src/features/app-shell/CommandPalette.tsx:54-68` handles Escape, Enter, and arrow navigation.
- `app/tests/e2e/smoke.spec.ts:144-147` labels a `/` shortcut test but only asserts the search input is displayed.
- Search found no E2E test that presses Ctrl/Cmd+K and executes a command.

Impact:

Keyboard regressions could pass E2E. This is coverage debt, not a confirmed runtime defect.

Recommendation:

Add E2E tests that press `/`, assert search focus, press Ctrl/Cmd+K, assert command-palette focus, navigate with arrows, execute a command, and verify close/focus behavior.

### 12. Low - Some timeout wrappers race promises without canceling underlying work

Several provider calls now use `AbortController`, but the shared Council `withTimeout` helper is still a pure `Promise.race`. The frontend Council panel has a similar race wrapper.

Evidence:

- `app/sidecar/council.mjs:36-44` implements `withTimeout` as `Promise.race` with no abort signal.
- `app/sidecar/council.mjs:57` uses that timeout helper.
- `app/src/features/council/CouncilPanel.tsx:55-59` races a timeout promise on the frontend.
- Positive contrast: `app/sidecar/providers/openai.mjs:23-31`, `app/sidecar/providers/gemini.mjs:38-45`, `app/sidecar/providers/claude.mjs:101-108`, and `app/sidecar/providers/gateway.mjs:64-71` use `AbortController` for provider fetches.

Impact:

For provider fetch paths that already abort, impact is reduced. Any future or non-abortable sidecar work wrapped by `withTimeout` can continue in the background after the user sees a timeout.

Recommendation:

Prefer abort-aware timeout helpers where possible and thread `AbortSignal` through long-running provider/synthesis operations. Keep the existing tests but add one that proves abort is invoked for abortable work.

### 13. Low - Clipboard behavior is inconsistent across export/copy actions

Some clipboard paths show errors and status, while others directly call `navigator.clipboard.writeText` inside UI handlers without a shared fallback/error pattern.

Evidence:

- `app/src/features/settings/SettingsPanel.tsx:182-190` catches backup clipboard errors and reports status.
- `app/src/features/workspaces/WorkspaceItem.tsx:343` writes note text to clipboard directly in a button handler.

Impact:

Clipboard permission failures can be inconsistently surfaced to users.

Recommendation:

Centralize clipboard writes behind a helper that returns success/failure text and optionally supports the Tauri clipboard plugin later.

### 14. Low - Workspace delete confirmation deserves a stricter UX gate

Prior passes found the workspace delete flow functional but easy to trigger. This remains a product-safety polish issue for destructive user-authored study data.

Evidence to retain from prior review:

- Workspace delete calls reach `delete_study_workspace`, which deletes child `study_items` and then the workspace (`app/src-tauri/src/user_db.rs:817-822`).

Impact:

Accidental deletion can remove a full workspace and its study items. The DB operation is straightforward, but the product should make this harder to do accidentally.

Recommendation:

Use a confirmation modal naming the workspace, or require typing the workspace title for non-empty workspaces. Consider soft-delete/archive-first if the current archive behavior is not prominent enough.

### 15. Medium - Public release gate remains blocked on manual clean-profile/credential-vault evidence

The public release gate correctly runs both Real Council QA and manual QA evidence checks. Real Council QA passes against the fixture, but manual evidence is incomplete.

Evidence:

- `app/scripts/verify-public-release-gate.mjs:21-34` runs Real Council QA and Manual clean-profile/credential-vault QA.
- `npm run qa:public-release:verify` on 2026-06-11 failed with missing manual fields: operator, windows profile, clean-profile install, first launch, provider key setup, credential-vault clean/upgrade profile, export secret leak check, backup restore, SQLite restore, and installer artifact list.
- The same command reported Real Council QA passed with 20 results: `gemini=20`, `openai=20`.

Impact:

The app should not be called public-release-ready until the manual clean-profile and credential-vault evidence file is completed against actual installer artifacts.

Recommendation:

Build the NSIS/MSI release artifacts, run the manual QA checklist on a clean Windows profile and an upgrade profile, complete `release/manual-release-gates.json`, and rerun `npm run qa:public-release:verify`.

## Positive Confirmations

- Production CSP is restrictive: `app/src-tauri/tauri.conf.json:22-24`.
- Tauri capability grants are narrow: `app/src-tauri/capabilities/default.json:6-9`.
- Bundled resources are explicit in Tauri config: `app/src-tauri/tauri.conf.json:30-39`.
- SQLite restore now rejects non-user DBs and newer schema versions: `app/src-tauri/src/lib.rs:2045-2090`.
- Restore has safety-backup rollback handling: `app/src-tauri/src/lib.rs:1994-2033` and `app/src-tauri/src/lib.rs:2093-2124`.
- Credential update semantics are sane: missing secret fields keep existing credentials, blanks delete, non-empty values set; tested in `app/src-tauri/src/credentials.rs:84-105`.
- JSON backup export excludes resource entry bodies: `app/src-tauri/src/user_db.rs:7395-7398`.
- JSON import tests cover transactional failures and secret app-setting skips.
- Saved searches validate title/query/book/testament inputs: `app/src-tauri/src/lib.rs:1476-1535`.
- Note search bounds query/limit and escapes LIKE wildcards: `app/src-tauri/src/lib.rs:3044-3063`, `app/src-tauri/src/user_db.rs:8968-8980`.
- Global error notice is mounted at app root and has E2E coverage: `app/src/main.tsx:7-17`, `app/src/components/GlobalErrorNotice.tsx:20-72`, `app/tests/e2e/global-error-notice.spec.ts:22-34`.
- Settings saves are serialized through a promise chain and surface errors: `app/src/App.tsx:277-291`.
- Release metadata is centralized: `app/scripts/release-metadata.mjs:7-12`.
- Release package verification checks installer hashes, and manual release gate script rejects incomplete evidence.

## Verification Run

Commands run from this review pass:

- `npm run build` - passed.
- `npm run test:sidecar` - passed, 66/66 tests.
- `node --check scripts/create-release-manifest.mjs; node --check scripts/verify-release-manifest.mjs; node --check scripts/package-release-artifacts.mjs; node --check scripts/verify-release-package.mjs; node --check scripts/verify-manual-release-gates.mjs` - passed.
- `cargo test --manifest-path .\app\src-tauri\Cargo.toml sqlite_restore --lib` - passed, 2/2 tests.
- `cargo test --manifest-path .\app\src-tauri\Cargo.toml tag --lib` - passed, 10/10 tests.
- `cargo test --manifest-path .\app\src-tauri\Cargo.toml search_notes --lib` - passed, 1/1 test.
- `cargo test --manifest-path .\app\src-tauri\Cargo.toml module --lib` - passed, 2/2 tests.
- `cargo test --manifest-path .\app\src-tauri\Cargo.toml import --lib` - passed, 23/23 tests.
- `npm run qa:public-release:verify` - failed as expected because manual clean-profile/credential-vault QA evidence is incomplete; Real Council QA passed.

## Not Run

- Full `npm run check` was not rerun in this pass because targeted build, Rust, sidecar, and script checks were run instead.
- Full E2E suite was not run. The report calls out shortcut coverage gaps that require new E2E assertions rather than simply rerunning the current suite.

## Suggested Next Order

1. Complete manual release evidence and rerun `npm run qa:public-release:verify`.
2. Fix import budgets for JSON backup and module JSONL import.
3. Run secret cleanup as part of SQLite restore before returning success.
4. Clean up tag integrity for note/range-note/study-item delete paths and target validation.
5. Bring schema mirrors and resource scripts to runtime schema v14.
6. Add shortcut/command-palette E2E coverage.
