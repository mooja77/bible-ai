# Bible AI Deep Review Findings

Generated: 2026-06-11 14:56:46 +01:00  
Reviewer: Codex  
Scope: read-only application review plus documentation of all standing findings from the current review passes.

## Current State

Bible AI is a local-first Tauri 2 desktop Bible study app. The frontend is React 19, TypeScript, Vite, and Tailwind. The backend is Rust/Tauri with `rusqlite`, a bundled read-only `data/corpus.sqlite`, and per-user `user.sqlite`. AI Council/provider orchestration runs through a long-lived Node sidecar under `app/sidecar`.

Primary modes present in the app:

- Reader
- Council
- Theology
- Resources
- Workspaces
- Tags
- Settings

The local corpus currently includes ASV, KJV, TR, WEB, WLC, and YLT. WLC is the only translation with word-token/Strong's tagging enabled in the UI, matching `TAGGED_TRANSLATIONS = new Set(["WLC"])` in `app/src/App.tsx`.

## Verification Snapshot

Earlier in this review cycle:

- `npm run build` passed.
- `npm run test:sidecar` passed, 66 tests.
- `cargo test --manifest-path .\src-tauri\Cargo.toml` passed, 93 tests.
- Full `npm run check` passed.
- Full E2E did not reach specs locally because `msedgedriver.exe` was version 147 while installed Edge/WebView was `149.0.4022.62`. `app/wdio.conf.mts:11-13` documents that `msedgedriver.exe` must version-match installed Edge.

This pass was read-only except for creating this report. Before this report, `git status --short` showed only `M app/src-tauri/Cargo.toml`, and `git diff -- app/src-tauri/Cargo.toml` showed no content patch, only a line-ending warning.

## Findings

### Medium: note tags can be created before a note exists

The Note tab always renders `ItemTagRow`, even when the note body is empty and unsaved. Attaching a tag calls `createTag` and then `tagItem(t.id, "note", verseId)` without first ensuring a `user_notes` row exists.

Evidence:

- `app/src/features/reader/VersePanel.tsx:649-652`
- `app/src/features/reader/VersePanel.tsx:688-694`
- `app/src/features/tags/TagControls.tsx:65-70`
- `app/src-tauri/src/user_db.rs:1184-1189`

Impact:

A user can create a tag link to a verse note that does not exist. The tag chip appears in the Note tab, but the Tags browser may not have a browsable item because `list_tagged_items` joins note tags to `user_notes`.

Suggested fix:

Require note existence before tagging. The cleanest behavior is probably to save a non-empty note before allowing note tag creation, or to disable note tags while the note body is empty.

### Medium: deleting a note leaves note tag links behind

`delete_bookmark` explicitly deletes bookmark `item_tags` before deleting the bookmark. `delete_note` only deletes from `user_notes`.

Evidence:

- `app/src-tauri/src/user_db.rs:1103-1108`
- `app/src-tauri/src/user_db.rs:9065-9070`
- `app/src/features/reader/VersePanel.tsx:631-633`
- `app/src/features/reader/VersePanel.tsx:676-680`

Impact:

Deleting a tagged note leaves orphan `item_tags` rows. Those stale rows can still affect tag counts and backup/export state.

Suggested fix:

Make `delete_note` delete `item_tags WHERE item_type = 'note' AND item_id = ?` before deleting the note, matching the bookmark cleanup pattern. Add a Rust regression test mirroring `delete_bookmark_clears_its_item_tags`.

### Medium: tag counts can disagree with tag browser items

`list_tags_with_counts` counts raw `item_tags` rows for bookmarks and notes. `list_tagged_items` only returns rows that successfully join to existing bookmarks or notes.

Evidence:

- `app/src-tauri/src/user_db.rs:1221-1228`
- `app/src-tauri/src/user_db.rs:1239-1248`
- `app/src/features/tags/TagBrowser.tsx:57-73`
- `app/src/features/tags/TagBrowser.tsx:82-85`

Impact:

After a ghost/orphan note tag, the Tags view can display a nonzero count for a tag but show "No items with this tag" when selected.

Suggested fix:

Either prevent orphan links at write time and clean existing rows, or make counts use the same joins as `list_tagged_items`.

### Medium: runtime user schema is v14 but `data/schema.sql` still mirrors v12

Runtime user schema has `USER_SCHEMA_VERSION = 14` and creates `tags` / `item_tags`. `data/schema.sql` still says it mirrors v12 and lacks those two tables.

Evidence:

- `app/src-tauri/src/user_db.rs:13`
- `app/src-tauri/src/user_db.rs:63-65`
- `app/src-tauri/src/user_db.rs:372-386`
- `data/schema.sql:312-314`
- `data/schema.sql:408-430`
- `docs/technical-implementation-plan.md:31-33`

Impact:

The authoritative design schema is stale. This is risky for future migrations, import/export work, contributor onboarding, and any scripts or docs that treat `data/schema.sql` as current.

Suggested fix:

Update `data/schema.sql` to v14 and add `tags`, `item_tags`, and their index. Add a lightweight check that compares runtime user tables with the schema mirror.

### Medium: JSON import and SQLite restore refresh only part of app state

Settings calls `onUserDataChanged` after JSON import and SQLite restore, but the parent refresh only reloads current-chapter user data and navigation lists. It does not reload app settings, mounted Settings module/resource state, or active setting-derived UI state.

Evidence:

- `app/src/features/settings/SettingsPanel.tsx:210-220`
- `app/src/features/settings/SettingsPanel.tsx:240-248`
- `app/src/App.tsx:438-471`
- `app/src/App.tsx:1378-1399`
- `app/src/features/settings/SettingsPanel.tsx:101-132`
- `app/src/features/settings/SettingsPanel.tsx:1049`
- `app/src/features/settings/DataSourcesSection.tsx:18-24`

Impact:

After restoring or importing settings/resources while staying on the same Settings screen, parts of the UI can remain stale until a remount or manual refresh. Existing E2E coverage remounts Settings by switching screens, which hides this same-screen stale state.

Suggested fix:

Introduce a broader `reloadUserStateAfterImport` path that reloads app settings, navigation data, chapter user data, and Settings resource/module summaries. After SQLite restore, consider remounting or keying app state to the active DB generation.

### Medium: Council client timeout does not cancel backend work

The UI races Council requests against a 5-minute timeout. The sidecar helper also explicitly says its timeout does not cancel underlying work. Rust persists a Council session after the sidecar returns.

Evidence:

- `app/src/features/council/CouncilPanel.tsx:39-63`
- `app/src/features/council/CouncilPanel.tsx:177-207`
- `app/sidecar/council.mjs:31-44`
- `app/sidecar/council.mjs:47-60`
- `app/src-tauri/src/sidecar.rs:259-285`
- `app/src-tauri/src/lib.rs:2502-2539`

Impact:

The user can see a "taking longer than expected" failure while the backend continues. If it later completes, the result can be persisted into history even though the active UI discarded it.

Suggested fix:

Add request cancellation or a run token/cancelled flag propagated to persistence. At minimum, record timed-out results with an explicit status so history does not look like a normal completed run.

### Medium: local E2E is currently blocked by driver mismatch

The E2E harness requires `msedgedriver.exe` to match installed Edge/WebView. The local run failed before specs because the driver was version 147 and installed Edge/WebView was `149.0.4022.62`.

Evidence:

- `app/wdio.conf.mts:11-13`
- `app/wdio.conf.mts:125-145`

Impact:

The app has a strong E2E suite, but this workstation cannot currently run it end to end. That means UI regressions and the release gate cannot be locally revalidated until the driver is corrected.

Suggested fix:

Install/update `msedgedriver.exe` to match Edge/WebView 149. Keep the driver version pinned or scripted in developer setup docs if possible.

### Medium: Windows source install guide omits sidecar dependency install

The root README correctly says the sidecar has its own `package.json` and needs `cd sidecar && npm install`. The Windows source install guide only runs `npm install` in `app` and then `npm run dev`.

Evidence:

- `README.md:152-158`
- `docs/install-windows.md:23-29`
- `app/sidecar/package.json:12-14`
- `app/sidecar/providers/claude.mjs:7`

Impact:

A fresh Windows source install can fail to start the sidecar or Claude provider path because `@anthropic-ai/claude-agent-sdk` is not installed under `app/sidecar/node_modules`.

Suggested fix:

Update `docs/install-windows.md` to match the README dependency flow.

### Medium: release builds depend on ignored local artifacts

The Tauri bundle expects `data/corpus.sqlite`, `app/sidecar/node`, and `app/sidecar/node_modules`. Those are ignored by git. The current machine has them, but a clean checkout will not.

Evidence:

- `app/src-tauri/tauri.conf.json:30-39`
- `.gitignore:4-5`
- `.gitignore:18`
- `app/package.json:28`
- `app/scripts/verify-release.mjs:8-22`
- `app/scripts/stage-debug-resources.mjs:16-34`

Impact:

Release builds are not reproducible from a clean checkout unless the developer already knows how to generate or stage those ignored inputs. `verify-release` validates after build but does not prepare the missing resources before build.

Suggested fix:

Add a preflight/prep script for release builds that verifies or creates all ignored bundled resources before `tauri build`, and call it from `release:build`.

### Low/Medium: Council readiness preview is optimistic for Claude Code

The Council preview marks Claude active regardless of actual local Claude Code login. The sidecar provider explicitly documents that `isAvailable` is optimistic and diagnostics are the real check.

Evidence:

- `app/src/features/council/CouncilVoicePanels.tsx:3-16`
- `app/src/features/council/CouncilVoicePanels.tsx:42-64`
- `app/sidecar/providers/claude.mjs:151-188`
- `app/sidecar/index.mjs:94-100`
- `app/src-tauri/src/lib.rs:1031-1061`

Impact:

Users can see "ready" / "will try" and start a Council run even when the app already has a diagnostic pathway capable of proving Claude is unavailable.

Suggested fix:

Feed recent diagnostics into Council readiness, or label Claude Code as "login not checked" until the provider test succeeds.

### Low/Medium: Council semantic retrieval can silently degrade to FTS

Reader semantic search reports degraded semantic status with reasons. Council retrieval logs semantic failures and falls back to FTS, but the UI only sees the final retrieval mode label.

Evidence:

- `app/src-tauri/src/lib.rs:3234-3246`
- `app/src-tauri/src/lib.rs:3250-3310`
- `app/src-tauri/src/lib.rs:3345-3358`
- `app/src/features/council/CouncilPanel.tsx:327-355`

Impact:

When WEB has no embeddings or Ollama is down, users may see a normal-looking Council result without a clear explanation that semantic retrieval failed and keyword fallback filled the evidence.

Suggested fix:

Return a retrieval diagnostics object with attempted semantic/FTS states and fallback reason. Show that in the Council retrieval trace.

### Low/Medium: tag command contract is wider than current implementation

The backend accepts `bookmark`, `note`, `range_note`, and `study_item` as taggable item types. Listing/counting/import remap paths currently only handle bookmarks and notes; import explicitly skips range notes and study items.

Evidence:

- `app/src-tauri/src/lib.rs:1268-1274`
- `app/src-tauri/src/user_db.rs:378-384`
- `app/src-tauri/src/user_db.rs:1221-1228`
- `app/src-tauri/src/user_db.rs:1239-1248`
- `app/src-tauri/src/user_db.rs:7591-7598`

Impact:

Future UI or direct command callers can write tags for item types that are not consistently counted, browsed, imported, or remapped.

Suggested fix:

Narrow the accepted item types to implemented surfaces, or finish browse/count/import support for `range_note` and `study_item`.

### Low: clipboard copy handling is inconsistent

Some copy actions catch clipboard failures and show local fallback/status. Others await `navigator.clipboard.writeText` without local error handling, relying on the global error notice.

Evidence:

- Caught example: `app/src/features/resources/ResourcesPanel.tsx:125-131`
- Caught example: `app/src/features/council/CouncilMarkdownExport.tsx:18-23`
- Uncaught range copy: `app/src/features/reader/ChapterReader.tsx:539-545`
- Uncaught workspace copy: `app/src/features/workspaces/WorkspacesPanel.tsx:198-203`
- Uncaught theology copies: `app/src/features/theology/TheologyPanel.tsx:408-429`
- Global error fallback: `app/src/components/GlobalErrorNotice.tsx:26-35`

Impact:

If clipboard access is unavailable in a WebView, users can get an "Unexpected error" toast instead of a contextual "copy failed" message. The action also does not provide a fallback text/path the way some other components do.

Suggested fix:

Wrap all clipboard writes in local try/catch and show contextual status. Consider a shared `copyToClipboard` helper.

## Test Coverage Gaps

- Tag tests cover bookmark tag browsing and note tag creation, but not deleting a tagged note or adding a tag before a note row exists.
  - `app/tests/e2e/notes-search.spec.ts:61-69`
  - `app/tests/e2e/tags-browse.spec.ts:28-47`
- Backup/restore resource tests remount Settings before checking Data Sources, so they do not catch same-screen stale resource state.
  - `app/tests/e2e/backup-restore.spec.ts:145-180`
- Council timeout E2E asserts the UI timeout appears, but not whether a late backend result is later persisted into history.
  - `app/tests/e2e/council-error.spec.ts:66-108`

## Positive Notes

- Tauri capabilities are tight: `core:default` plus `dialog:allow-save`.
  - `app/src-tauri/capabilities/default.json`
- Production CSP avoids `unsafe-eval`; the relaxed script policy is dev-only.
  - `app/src-tauri/tauri.conf.json:20-24`
- Workspace HTML preview/export escapes Markdown rather than injecting rendered HTML.
  - `app/src/features/workspaces/workspaceHtml.ts`
- Provider credentials are stored through OS keyring integration and secret app-settings rows are cleaned from SQLite.
  - `app/src-tauri/src/credentials.rs:26-50`
  - `app/src-tauri/src/user_db.rs:693-704`
- JSON backup export/import has substantial Rust coverage for secret redaction and app-setting normalization.
  - `app/src-tauri/src/user_db.rs:4732-5185`

## Suggested Fix Order

1. Fix note tag integrity: prevent ghost note tags, clean note tags on delete, and align counts with browse joins.
2. Update `data/schema.sql` to mirror runtime v14.
3. Fix local E2E infrastructure by updating `msedgedriver.exe`.
4. Update Windows install docs for sidecar dependencies.
5. Add release preflight/prep for ignored bundled resources.
6. Make import/restore refresh the whole app state.
7. Add Council cancellation/late-result handling.
8. Use diagnostics-driven Council readiness and richer retrieval fallback reporting.
9. Normalize clipboard error handling.
