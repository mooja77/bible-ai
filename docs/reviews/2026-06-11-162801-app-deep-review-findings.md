# Bible AI Deep Review Findings - 2026-06-11 16:28:01 +01:00

Filename timestamp: `2026-06-11-162801`.

This is another deep review pass over `C:\JM Programs\BibleApp`. It carries forward the confirmed findings from the earlier `docs/reviews/2026-06-11-*` reports and adds the results of the extra passes requested here.

No application code was changed in this pass. The working tree already had `app/src-tauri/Cargo.toml` modified before this review; I did not revert or edit it.

## Scope

Passes completed:

- Backup/export privacy and resource-entry export contract.
- Resource import, resource search, FTS rebuild, and duplicate-id remapping.
- Provider credentials, diagnostics redaction, and macOS credential portability.
- Delete/import/reference cleanup and test coverage cross-checks.
- Focused verification runs.

## Current State

Bible AI is a local-first Tauri 2 desktop Bible study app.

- Frontend: React 19, TypeScript, Vite, Tailwind.
- Backend: Rust/Tauri, `rusqlite`, bundled read-only `data/corpus.sqlite`, per-user `user.sqlite`.
- AI orchestration: long-running Node sidecar under `app/sidecar`.
- Main user surfaces: Reader, Council, Theology, Resources, Workspaces, Tags, Settings.
- Runtime user schema is `USER_SCHEMA_VERSION = 14`; export format is `EXPORT_VERSION = 1`: `app/src-tauri/src/user_db.rs:13-15`.
- Export/import table order includes settings, notes, Council, Theology, resources, modules, workspaces, tags, and item tag links: `app/src-tauri/src/user_db.rs:15-46`.

The application is generally in a strong state: the command surface is bounded, most persistence paths validate inputs, sidecar stdout is kept as JSON, provider secrets are moved to the OS credential vault, and many of the newer regression cases are now covered by Rust or sidecar tests.

## Verification

Current pass verification:

- `npm run build` passed. Vite built 97 modules.
- `npm run test:sidecar` passed: 66 tests, 66 passing.
- `cargo test --manifest-path .\app\src-tauri\Cargo.toml` passed: 93 Rust tests, 93 passing.

Known E2E status:

- Full `npm run test:e2e:build` remains locally blocked before useful spec execution by a host dependency mismatch: `msedgedriver.exe` is version 147 while installed Edge/WebView is 149.0.4022.62.
- The E2E config documents that `msedgedriver.exe` must match installed Edge: `app/wdio.conf.mts:11-14`.
- The configured E2E suite is broad and includes smoke, workspace, reader, backup/restore, Council, search, tags, release-readiness, validation, UI scale, empty translation, max scale, and contrast specs: `app/wdio.conf.mts:125-145`.

## Confirmed Positives

### Backup Export Now Protects Imported Resource Bodies

Normal JSON backups intentionally include resource source and collection metadata but exclude imported resource entry bodies.

Evidence:

- Export iterates all user tables but special-cases `resource_entries` to an empty array: `app/src-tauri/src/user_db.rs:7381-7398`.
- App settings export also filters secret and unsupported keys: `app/src-tauri/src/user_db.rs:7400-7428`.
- Settings copy clearly says provider secrets and imported resource entry bodies are excluded: `app/src/features/settings/SettingsPanel.tsx:810-815`.
- Regression test covers this exact contract: `app/src-tauri/src/user_db.rs:4428-4496`.

Assessment: this is good privacy and file-size behavior. It should remain documented as intentional, because it means normal JSON backups are not full resource-library backups.

### Resource FTS Is Much Better Covered Than Earlier Risk Areas

Resource import/search has meaningful guardrails now.

Evidence:

- `resource_entries_fts` is an external-content FTS5 index on `resource_entries`: `app/src-tauri/src/user_db.rs:190-202`.
- `create_resource_entry` validates body/search text, upserts the entry, then upserts the matching FTS row by resolved id: `app/src-tauri/src/user_db.rs:7037-7084`.
- Search normalizes punctuation-heavy queries into quoted prefix terms and falls back to recent entries for empty FTS queries: `app/src-tauri/src/user_db.rs:7086-7169`.
- Import rebuilds the resource FTS table after resource entry imports: `app/src-tauri/src/user_db.rs:7705-7707` and `app/src-tauri/src/user_db.rs:7754-7759`.
- Tests cover untitled entries, punctuation query splitting, search results, and FTS rebuild after import: `app/src-tauri/src/user_db.rs:4514-4655`.

Assessment: I did not find a current resource FTS correctness defect in this pass.

### Credential Storage On Windows Is Well Hardened

Windows credential behavior is solid at the code level.

Evidence:

- Provider and gateway secrets are read/written through `keyring`: `app/src-tauri/src/credentials.rs:1-50`.
- Blank secret fields delete credentials, missing secret fields keep existing credentials, and this is tested: `app/src-tauri/src/credentials.rs:66-106`.
- Legacy SQLite secret rows are migrated into the vault before the vault is read, then removed from SQLite: `app/src-tauri/src/lib.rs:996-1015`.
- SQLite secret cleanup enables `secure_delete` and runs `VACUUM` after deletion: `app/src-tauri/src/user_db.rs:693-707`.
- Regression tests verify secret cleanup from the database file and broad secret-name detection: `app/src-tauri/src/user_db.rs:3769-3867`.
- Sidecar diagnostic results are redacted before returning to Rust/UI: `app/sidecar/index.mjs:150-160`.
- Redaction strips configured provider secrets and managed gateway tokens from nested values: `app/sidecar/providers/_shared.mjs:143-162` and `app/sidecar/tests/shared.test.mjs:169-183`.
- E2E release-readiness checks backup JSON does not contain provider key values or key names: `app/tests/e2e/release-readiness.spec.ts:50-92`.

Assessment: the Windows path is in good shape. The portability issue below is separate.

### Tauri Surface Is Relatively Narrow

Evidence:

- Default capability allows core defaults and save dialog only: `app/src-tauri/capabilities/default.json:6-9`.
- Production CSP is restrictive: `app/src-tauri/tauri.conf.json:22-24`.
- Bundle resources are explicit: `app/src-tauri/tauri.conf.json:27-39`.

Assessment: good baseline for a local desktop app.

## New Findings From This Pass

### F01 - Medium - macOS Credential Storage Is Planned, But The Rust Keyring Backend Is Windows-Only

The app has macOS release scripts and docs requiring Keychain verification, but `keyring` is currently enabled with `windows-native` only.

Evidence:

- Cargo dependency: `keyring = { version = "3", features = ["windows-native"] }`: `app/src-tauri/Cargo.toml:28`.
- macOS release build script runs a real Tauri build on macOS: `app/package.json:39`.
- macOS plan explicitly requires Keychain credential storage verification: `docs/macos-distribution-plan.md:3-11`.
- macOS install guide says the final `.app`/`.dmg` needs macOS-native dependencies and Keychain checks: `docs/install-macos.md:5-9`.
- Local `cargo metadata` for `keyring v3.6.3` shows platform backend features are explicit (`apple-native`, `windows-native`, `linux-native`, etc.). The current package enables only `windows-native`.

Impact:

- A macOS build may compile with no native keyring backend or fall back to a non-Keychain behavior depending on crate defaults and target behavior.
- Even if it compiles, Settings credential save/read is likely to fail the documented Keychain QA gate until the `apple-native` feature is enabled and tested on macOS.

Recommendation:

- Add the appropriate `keyring` feature for every supported desktop release lane, starting with `apple-native` for macOS.
- Add a macOS build-env check that fails if the keyring backend features do not cover the target release lane.
- Verify on a clean macOS user profile before treating macOS distribution as release-ready.

### F02 - Low/Medium - Resource Source Metadata Can Leak Local Paths In Data Sources And JSON Backups

Resource entry bodies are excluded from normal backups, but `resource_sources` rows are exported normally and their `source_url`/`metadata_json` fields are rendered in Settings without path redaction.

Evidence:

- Export only special-cases `resource_entries`; non-settings tables, including `resource_sources`, are returned as-is: `app/src-tauri/src/user_db.rs:7395-7402`.
- Source creation stores `source_url` and `metadata_json` after basic trimming/JSON validation, not privacy sanitization: `app/src-tauri/src/user_db.rs:6973-7000`.
- Import normalization also trims `source_url`/`metadata_json` but does not redact local paths: `app/src-tauri/src/user_db.rs:7832-7839`.
- Data Sources displays `source.source_url` directly: `app/src/features/settings/DataSourcesSection.tsx:75-79`.
- Resource JSONL import writes `manifest.source_url` and nested manifest metadata directly into the import payload: `app/scripts/resources/import-resource-jsonl.mjs:79-99`.
- Privacy docs say exports and source drawers must not include local app data paths: `docs/privacy-and-distribution.md:19-24`.

Impact:

- If a resource manifest uses a local filesystem path as `source_url` or in metadata, Settings Data Sources and JSON backups can expose that path.
- Current workspace/theology export redaction does not cover this source metadata path.

Recommendation:

- Define a policy for resource source metadata: public source URL only, or sanitize local paths on import/export/display.
- Add a regression test that imports a resource source with a Windows path and a Unix path in `source_url`/metadata, then verifies JSON backup and Settings-safe display behavior.

### F03 - Low - Resource Import Generator Is One Schema Behind Runtime

The resource import generator still hard-codes `user_schema_version: 13`, while runtime user schema is 14 and the script comment says to keep it in sync.

Evidence:

- Runtime user schema: `app/src-tauri/src/user_db.rs:13`.
- Import script comment and hard-coded value: `app/scripts/resources/import-resource-jsonl.mjs:74-76`.
- Import accepts older schemas and only rejects newer schemas: `app/src-tauri/src/user_db.rs:7477-7483`.

Impact:

- This is probably harmless today because schema 13 payloads are older, not newer.
- It is still maintenance drift, and the comment creates false confidence that the resource package generator is synced with the app schema.

Recommendation:

- Update the generator to schema 14, or remove the "keep in sync" claim and explicitly document that resource-only packages intentionally target the minimum compatible schema.

## Carried-Forward Confirmed Findings

### F04 - Medium - Note Tags Can Be Created Before The Note Exists

The Note tab always renders tag controls and allows tagging a verse as a note even if no note row exists.

Evidence:

- Note tag attach creates/fetches a tag and writes an `item_tags` row for `("note", verseId)` without checking note existence: `app/src/features/reader/VersePanel.tsx:643-652`.
- Tag UI calls `onAttach` whenever the trimmed name is non-empty: `app/src/features/tags/TagControls.tsx:65-70`.
- Backend `tag_item` inserts `(tag_id, item_type, item_id)` without verifying that the item exists: `app/src-tauri/src/user_db.rs:1184-1189`.

Impact:

- A user can create tag links for a non-existent note.
- Those links are counted but cannot appear in the tag browser item list because the list joins to `user_notes`.

Recommendation:

- Hide or disable note tag controls until a note exists, or auto-create the note before allowing tags.
- Add backend validation or cleanup so `item_tags` cannot point to missing notes.

### F05 - Medium - Deleting A Note Leaves Its Note Tag Links Behind

Bookmark deletion explicitly clears tag links; note deletion does not.

Evidence:

- Bookmark deletion removes `item_tags` first: `app/src-tauri/src/user_db.rs:1103-1108`.
- Note deletion only deletes from `user_notes`: `app/src-tauri/src/user_db.rs:9065-9070`.
- Note deletion is triggered from the Note tab when body is blank or Delete note is clicked: `app/src/features/reader/VersePanel.tsx:626-635` and `app/src/features/reader/VersePanel.tsx:673-680`.

Impact:

- Tag counts can stay inflated after notes are deleted.
- Recreating a note on the same verse can silently inherit old tags.

Recommendation:

- Delete `item_tags` where `item_type = 'note' AND item_id = verse_id` inside `delete_note`.
- Add a Rust regression test mirroring `delete_bookmark_clears_its_item_tags`.

### F06 - Medium - Tag Counts Can Disagree With Tag Browser Items

Counts include all bookmark/note tag rows, but item listing only returns rows that still join to live bookmarks or notes.

Evidence:

- Count query counts `item_tags` directly for bookmarks and notes: `app/src-tauri/src/user_db.rs:1221-1228`.
- Item query inner-joins to `bookmarks` and `user_notes`: `app/src-tauri/src/user_db.rs:1239-1248`.
- Tag browser displays the count next to the tag and separately shows "No items with this tag" when the joined item list is empty: `app/src/features/tags/TagBrowser.tsx:57-85`.

Impact:

- After orphaned links, the browser can show a non-zero count and no items.

Recommendation:

- Fix the orphan sources above.
- Optionally count via the same live joins used by `list_tagged_items`.

### F07 - Medium - User Schema Mirrors Are Drifting

Runtime schema is v14, but the standalone schema mirror still states v12 and does not include newer tag tables.

Evidence:

- Runtime `USER_SCHEMA_VERSION` is 14: `app/src-tauri/src/user_db.rs:13`.
- Runtime schema includes `tags` and `item_tags`: `app/src-tauri/src/user_db.rs:372-386`.
- `data/schema.sql` says it mirrors the current v12 shape: `data/schema.sql:313`.
- `rg` found no `CREATE TABLE tags` or `CREATE TABLE item_tags` definitions in `data/schema.sql`.
- Resource import generator schema drift is also present: `app/scripts/resources/import-resource-jsonl.mjs:74-76`.

Impact:

- Developers using `data/schema.sql` as a reference will miss current runtime tables and migration behavior.
- Source-review and import scripts can fall behind runtime expectations.

Recommendation:

- Either regenerate `data/schema.sql` from runtime schema or mark it as historical/non-authoritative.
- Add a lightweight check that fails when `USER_SCHEMA_VERSION` changes but schema mirrors/generators are not updated.

### F08 - Medium - JSON Import And SQLite Restore Refresh Only Part Of The App State

After import/restore, Settings calls the parent callback, but the parent refresh only reloads reader/user navigation state, not the Settings-owned resource/module lists.

Evidence:

- JSON import and SQLite restore call `onUserDataChanged?.()`: `app/src/features/settings/SettingsPanel.tsx:210-220` and `app/src/features/settings/SettingsPanel.tsx:240-248`.
- Parent callback only calls `refetchUserData()` and `refreshNavigationLists()`: `app/src/App.tsx:468-471`.
- Settings owns `resourceSources`, `installedModules`, `moduleTopics`, and `topicEntries` locally: `app/src/features/settings/SettingsPanel.tsx:82-90`.
- Settings refreshes modules/resources on mount through `refreshModules`, not in response to the import callback: `app/src/features/settings/SettingsPanel.tsx:101-132`.
- SettingsPanel is wired with `onUserDataChanged={refreshUserDataAndNavigation}`: `app/src/App.tsx:1378-1382`.

Impact:

- Imported resources/modules/tags can be stale in Settings until the panel remounts or a manual refresh path runs.
- Existing tests that remount Settings can miss this same-screen stale state.

Recommendation:

- After successful import/restore, call `refreshModules()` or broader Settings-local refresh logic before/after `onUserDataChanged`.
- Add a same-screen backup/restore regression test that verifies Data Sources updates without leaving Settings.

### F09 - Medium - Council Client Timeout Does Not Cancel Backend Or Provider Work

The UI has a client timeout and the sidecar has promise timeouts, but timed-out work continues in the background.

Evidence:

- UI races `askCouncil` against a timer: `app/src/features/council/CouncilPanel.tsx:39-63`.
- Council submit awaits `withCouncilTimeout(askCouncil(...))`: `app/src/features/council/CouncilPanel.tsx:177-189`.
- Sidecar timeout helper explicitly says it does not cancel the underlying work: `app/sidecar/council.mjs:31-44`.
- Rust persists the result after `state.request(...).await?` returns: `app/src-tauri/src/lib.rs:2500-2540`.

Impact:

- User can see a timeout, retry, and still have older provider calls running.
- Old work can consume provider quota or later persist a session the user thinks failed.

Recommendation:

- Thread cancellation through UI -> Tauri -> sidecar -> provider calls where possible, or mark timed-out request ids stale server-side before persistence.
- Add a test or simulation that proves timed-out Council calls cannot persist after a newer retry supersedes them.

### F10 - Medium - Theology Links Can Become Stale After Linked Objects Are Deleted

`theology_links` is polymorphic and stores `target_id`, but delete paths for target objects do not prune matching links.

Evidence:

- Theology links can target `workspace_item`, `council_session`, `resource_entry`, `note`, etc.: `app/src-tauri/src/user_db.rs:204-220`.
- Link creation validates kind and positive target id but does not establish real foreign keys: `app/src-tauri/src/user_db.rs:2353-2374`.
- Council session deletion removes argument annotations/judgments/session but not Theology links: `app/src-tauri/src/user_db.rs:1745-1755`.
- Workspace deletion removes study items and workspace but not Theology links to `workspace_item`: `app/src-tauri/src/user_db.rs:817-822`.
- Study item deletion removes the item and updates workspace timestamp but not Theology links: `app/src-tauri/src/user_db.rs:963-982`.

Impact:

- Theology maps can show links to deleted Council sessions, workspace items, or notes/resources when delete support exists.

Recommendation:

- Add explicit cleanup for each supported linked object delete path.
- Add tests that create a Theology link, delete the linked object, and verify the link is removed or rendered as an intentional stale snapshot.

### F11 - Medium - SQLite Restore Validation Is Permissive

Restore source validation checks quick_check, the existence of `app_settings`, and non-newer `user_version`, but accepts a minimal DB with only `app_settings`.

Evidence:

- Validation checks integrity, `app_settings`, and schema version: `app/src-tauri/src/lib.rs:2045-2090`.
- Test proves a minimal DB with only `app_settings` and `PRAGMA user_version` is accepted: `app/src-tauri/src/lib.rs:2154-2172`.
- Runtime open will create missing tables afterward: `app/src-tauri/src/user_db.rs:389-402`.

Impact:

- Restore is safer than before, but it can still accept incomplete or unrelated SQLite files that happen to contain `app_settings`.

Recommendation:

- Require a small set of core Bible AI user tables, or add an app identity marker table/value.

### F12 - Low/Medium - SQLite Restore Still Uses A Raw Path Input

Restore UX still asks the user to type/paste a path rather than using an open-file dialog.

Evidence:

- Capability allows save dialog only, not open dialog: `app/src-tauri/capabilities/default.json:6-9`.
- Settings renders a raw `SQLite restore path` input: `app/src/features/settings/SettingsPanel.tsx:912-921`.

Impact:

- The confirm guard helps, but path typos and wrong-file selection remain easy.

Recommendation:

- Add `dialog:allow-open` and use an open-file picker filtered to `.sqlite`/`.db` where practical.

### F13 - Medium - Windows Install Guide Omits Sidecar Dependency Install

README source install includes `cd sidecar && npm install`, but the Windows install guide only installs app dependencies before `npm run dev`.

Evidence:

- README dependency instructions include the sidecar package install: `README.md:152-158`.
- Windows install guide only runs `npm install` in `app` then `npm run dev`: `docs/install-windows.md:23-29`.
- Sidecar has its own dependency on `@anthropic-ai/claude-agent-sdk`: `app/sidecar/package.json:12-14`.

Impact:

- A clean Windows source checkout can start the frontend but fail when sidecar functionality needs its dependency tree.

Recommendation:

- Update `docs/install-windows.md` to include `cd sidecar; npm install; cd ..`, or add an app-level install/preflight script that installs both.

### F14 - Medium - Release Builds Depend On Ignored Local Artifacts

The bundle requires corpus, bundled Node, and sidecar node_modules, but those inputs are gitignored and must exist locally before release/staged builds.

Evidence:

- Tauri bundle includes `../../data/corpus.sqlite`, `../sidecar/node`, and `../sidecar/node_modules`: `app/src-tauri/tauri.conf.json:30-39`.
- Release verification requires the corpus, sidecar entry files, bundled Node runtime, providers, and node_modules: `app/scripts/verify-release.mjs:8-22`.
- Debug resource staging copies the same ignored resources: `app/scripts/stage-debug-resources.mjs:16-34`.
- `.gitignore` ignores `app/sidecar/node_modules/`, `app/sidecar/node/`, `app/dist/`, `app/src-tauri/target/`, and `data/corpus.sqlite`: `.gitignore:1-18`.

Impact:

- Release reproducibility depends on local, ignored state unless preflight scripts reliably create or verify all artifacts.

Recommendation:

- Make release/debug prep explicitly generate or fetch all ignored resources.
- Fail early with actionable instructions before `tauri build` when any required artifact is missing.

### F15 - Low/Medium - Tag Command Contract Is Wider Than Current Implementation

The backend accepts broader taggable item types than the listing/counting/import remap paths fully support.

Evidence:

- `tag_item` accepts arbitrary `item_type` values that pass lower-level table constraints; it does not verify existence: `app/src-tauri/src/user_db.rs:1184-1189`.
- Counts and browser lists are limited to `bookmark` and `note`: `app/src-tauri/src/user_db.rs:1221-1248`.
- Existing carried-forward note/tag issues show this mismatch in practice.

Impact:

- Future UI/API callers could create tag links that import/export but are not browsable.

Recommendation:

- Either narrow the backend contract to the item types the app actually renders, or implement full list/count/remap support for every accepted type.

### F16 - Low/Medium - Council Readiness Can Look More Optimistic Than Runtime Reality

Provider readiness mostly checks configuration and simple diagnostics. Claude Code and hosted providers can appear ready while later Council execution still fails due auth, quotas, process availability, or slow calls.

Evidence:

- Settings shows provider status from diagnostics and configured keys: `app/src/features/settings/SettingsPanel.tsx:668-751`.
- Provider errors are classified only after runtime failures: `app/sidecar/providers/_shared.mjs:442-505`.

Impact:

- Users can see a configured/available path and still hit Council failure on first real run.

Recommendation:

- Keep readiness wording explicit: "configured" or "probe passed", not "ready", unless the exact Council provider path was exercised.

### F17 - Low - Clipboard Copy Handling Is Inconsistent

Some copy flows silently swallow clipboard failures while others surface a status.

Evidence:

- Resource import docs path catches copy failure and shows fallback status: `app/src/features/resources/ResourcesPanel.tsx:125-131`.
- Some workspace copy paths set "Copied" only on success but do not surface an error: `app/src/features/workspaces/WorkspaceItem.tsx:415-420`.

Impact:

- Users get inconsistent feedback when clipboard permission or environment blocks copy.

Recommendation:

- Use one shared clipboard helper that returns a visible success/failure state.

## Priority Fix Order

1. Fix the macOS keyring backend before any macOS release build is considered real.
2. Fix note tag orphan creation/deletion, then align tag count/list behavior.
3. Refresh Settings-owned resource/module state after JSON import and SQLite restore.
4. Add Theology link cleanup or explicit stale-snapshot rendering for deleted targets.
5. Decide and enforce resource source metadata privacy rules for local paths.
6. Sync schema mirrors and resource import schema version with runtime v14.
7. Update Windows install docs and release preflight so clean machines can reproduce the app.
8. Resolve local Edge WebDriver version mismatch before claiming the full E2E suite is green.

## Review Artifacts

Prior reports in this folder:

- `docs/reviews/2026-06-11-145646-app-deep-review-findings.md`
- `docs/reviews/2026-06-11-150603-app-deep-review-findings.md`
- `docs/reviews/2026-06-11-161133-app-deep-review-findings.md`

This report:

- `docs/reviews/2026-06-11-162801-app-deep-review-findings.md`
