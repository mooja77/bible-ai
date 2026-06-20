# App Deep Review Findings - 2026-06-11 22:15:33 +01:00

Review timestamp: 2026-06-11 22:15:33 +01:00  
Verification timestamp: 2026-06-11 22:21:02 +01:00  
Workspace: `C:\JM Programs\BibleApp`  
Report target: `docs/reviews/2026-06-11-221533-app-deep-review-findings.md`

This was a read-only app review plus this documentation file. No app code was changed. The worktree already had `app/src-tauri/Cargo.toml` modified before this report was written; I did not inspect or alter that change.

## Current State

- The app is a Tauri 2 + React/Vite desktop app with Rust command boundaries, a local SQLite user DB, a read-only corpus DB, a Node sidecar for Council/provider work, study workspaces, Theology, Resources, backup/restore, and release gates.
- Resource search, workspace exports, Theology exports, semantic/keyword search, and sidecar normalization are materially stronger than in the earliest reports. The targeted tests below passed.
- No new Critical or High severity defect was found in this pass.
- The public-release gate is intentionally still blocked by missing/incomplete clean-profile manual QA evidence. The real Council QA fixture portion passes.

## Passes Completed

1. Resource ingestion, search, attribution, source metadata, backup import/export.
2. Theology/workspace persistence, Markdown/HTML/PDF export boundaries, redaction paths.
3. Reader/search/retrieval correctness: FTS query cleanup, semantic fallback, Strong's matching, cross-reference text fallback, UI degradation notices.
4. E2E/release/doc drift around schema versions, manual gates, resource tooling, and previous review findings.

## Active Findings

### 1. Medium - Generic backup JSON resource import still bypasses the source-assessment gate

The curated resource workflow has a source-assessment and manifest-validation path, and the docs say accepted sources must have clear license terms and redistribution permission (`docs/open-resource-ingestion-plan.md:180`). The generic Settings backup import path accepts resource tables directly. For `resource_sources`, it only requires `slug`, `title`, `license`, `attribution`, optional text fields, and object-shaped `metadata_json` (`app/src-tauri/src/user_db.rs:7832`). For `resource_entries`, it requires a non-empty body and valid/default payload JSON (`app/src-tauri/src/user_db.rs:7847`).

E2E coverage proves this path is intentionally usable from Settings backup import and makes entries searchable (`app/tests/e2e/backup-restore.spec.ts:88`, `app/tests/e2e/backup-restore.spec.ts:103`, `app/tests/e2e/backup-restore.spec.ts:131`, `app/tests/e2e/backup-restore.spec.ts:153`).

Impact: a user or distributed JSON backup can import unreviewed resources with weak or misleading license metadata while the broader resource docs imply stricter admission.

Recommendation: require accepted source-review metadata when importing `resource_entries`, or import these rows as explicitly unreviewed/quarantined. At minimum, reject `license: "Unknown"` and `redistribution_permission: false` in app-side import.

### 2. Medium/Low - Resource backup import still has no practical size or row-count budgets

Generic import validation trims required strings but does not bound total JSON size, rows per table, `resource_entries.body`, or `search_text` (`app/src-tauri/src/user_db.rs:8035`). Blank `search_text` is replaced with the full body (`app/src-tauri/src/user_db.rs:7847`), and import rebuilds the resource FTS index when resource entries are present (`app/src-tauri/src/user_db.rs:7705`, `app/src-tauri/src/user_db.rs:7754`).

Impact: an oversized backup can create expensive DB writes, FTS rebuilds, large React state payloads, and large workspace payloads after adding resources.

Recommendation: add pre-transaction import budgets for JSON bytes, table row counts, text field lengths, and resource entry body/search text sizes.

### 3. Medium - JSON import and SQLite restore still leave Settings resource/module state stale until refresh/remount

`SettingsPanel.refreshModules()` reloads modules, module topics, and resource sources (`app/src/features/settings/SettingsPanel.tsx:101`). JSON import only calls `onUserDataChanged?.()` after setting import status (`app/src/features/settings/SettingsPanel.tsx:210`). SQLite restore does the same (`app/src/features/settings/SettingsPanel.tsx:240`). The parent callback refreshes chapter/user/navigation state, not Settings' local module/resource source state (`app/src/App.tsx:468`).

Impact: after importing resource/module data from the Settings screen, the success message can be correct while Data Sources or module lists remain stale until the panel remounts.

Recommendation: after successful JSON import and SQLite restore, call `refreshModules()` before or alongside `onUserDataChanged?.()`. Add an E2E assertion that checks Data Sources immediately without navigating away.

### 4. Medium - SQLite restore can temporarily reintroduce legacy provider secrets into active `user.sqlite`

The normal settings load path migrates legacy provider keys out of SQLite and deletes secret settings (`app/src-tauri/src/lib.rs:1003`, `app/src-tauri/src/lib.rs:1008`, `app/src-tauri/src/lib.rs:1010`). SQLite restore validates and copies the selected DB, opens it, and installs the connection (`app/src-tauri/src/lib.rs:1985`, `app/src-tauri/src/lib.rs:2012`, `app/src-tauri/src/lib.rs:2021`, `app/src-tauri/src/lib.rs:2039`). It does not run the legacy secret migration/cleanup before returning.

Impact: restoring an older `user.sqlite` can put legacy provider keys back into the active DB until a later settings load performs cleanup.

Recommendation: run the shared credential migration and `delete_secret_settings` cleanup immediately after restore opens the restored DB and before returning success. Add a restore-specific regression test.

### 5. Medium - Provider readiness still conflates configured/optimistic providers with verified providers

Settings counts `diagnostics.providers.filter((provider) => provider.available)` as passing voices (`app/src/features/settings/SettingsPanel.tsx:403`). Claude is optimistic by design: `isAvailable` returns true unless disabled or an API key path exists (`app/sidecar/providers/claude.mjs:161`). The Council preview marks Claude as active even when it is only "will try" through a local login (`app/src/features/council/CouncilVoicePanels.tsx:11`, `app/src/features/council/CouncilVoicePanels.tsx:15`) and labels the summary "AI helpers ready to run" (`app/src/features/council/CouncilVoicePanels.tsx:61`).

Impact: users can see "ready" counts based on configured/optimistic availability rather than a completed live diagnostic.

Recommendation: split readiness into `configured`, `will_try`, and `verified`. Count "tested" or "ready" only from `diagnostics.checks.*.ok`.

### 6. Medium - Standalone provider test buttons can pass against unsaved draft settings

`submit()` is the save path (`app/src/features/settings/SettingsPanel.tsx:150`). `saveAndRunChecks()` saves and then tests (`app/src/features/settings/SettingsPanel.tsx:177`). Standalone buttons call `runChecks(...)` directly (`app/src/features/settings/SettingsPanel.tsx:761`, `app/src/features/settings/SettingsPanel.tsx:777`, `app/src/features/settings/SettingsPanel.tsx:785`, `app/src/features/settings/SettingsPanel.tsx:793`, `app/src/features/settings/SettingsPanel.tsx:801`, `app/src/features/settings/SettingsPanel.tsx:1066`), and `runChecks` sends the in-memory `draft` to `checkAppSetup` (`app/src/features/settings/SettingsPanel.tsx:163`).

Impact: a provider test can succeed with a pasted key that is not saved to the credential vault or persisted settings, so the Council can still fail later.

Recommendation: save before standalone provider tests, or label those tests as "unsaved draft" and block "ready for Council" wording until saved.

### 7. Medium - Council and provider timeouts still do not cancel losing work

The sidecar `withTimeout` explicitly documents that it does not cancel the underlying promise (`app/sidecar/council.mjs:31`) and wraps each provider voice (`app/sidecar/council.mjs:57`). The frontend Council timeout also uses `Promise.race` without a backend cancel channel (`app/src/features/council/CouncilPanel.tsx:55`). Claude diagnostics use `Promise.race` around the probe (`app/sidecar/providers/claude.mjs:199`).

Impact: the UI can report a timeout while provider/SDK work continues in the sidecar process, consuming time and possibly overlapping with the next action.

Recommendation: pass abort signals where APIs support them. For Claude Code SDK calls that cannot be aborted cleanly, isolate them in a killable child process or add request cancellation to the sidecar protocol.

### 8. Low - Runtime schema metadata is still drifted in docs/tooling

Runtime `USER_SCHEMA_VERSION` is 14 (`app/src-tauri/src/user_db.rs:13`). The JSONL resource importer still emits `user_schema_version: 13` while a comment says to keep it in sync (`app/scripts/resources/import-resource-jsonl.mjs:74`, `app/scripts/resources/import-resource-jsonl.mjs:76`). `data/schema.sql` still says the user section mirrors current v12 shape (`data/schema.sql:313`).

Impact: current imports accept older schema numbers, so this is not a hard runtime failure. It still weakens generated fixture metadata and makes schema review harder.

Recommendation: source the schema version from one place, or add a small check that fails when runtime schema, schema mirror comments, and import-generator stamps diverge.

### 9. Low - Clipboard failure handling remains inconsistent

Some copy paths catch Clipboard API failure, such as Settings backup copy (`app/src/features/settings/SettingsPanel.tsx:184`) and Council Markdown export. Workspace and Theology copy paths still await clipboard writes without local error handling (`app/src/features/workspaces/WorkspacesPanel.tsx:198`, `app/src/features/theology/TheologyPanel.tsx:408`, `app/src/features/theology/TheologyPanel.tsx:416`, `app/src/features/theology/TheologyPanel.tsx:423`). Workspace item copy buttons follow the same pattern (`app/src/features/workspaces/WorkspaceItem.tsx:240`, `app/src/features/workspaces/WorkspaceItem.tsx:294`, `app/src/features/workspaces/WorkspaceItem.tsx:340`, `app/src/features/workspaces/WorkspaceItem.tsx:401`, `app/src/features/workspaces/WorkspaceItem.tsx:451`).

Impact: blocked clipboard permissions or WebView limitations can surface as a generic/global error instead of a contextual copy failure message.

Recommendation: centralize clipboard writes in a small helper that returns consistent success/failure state.

### 10. Low - Workspace deletion remains an immediate destructive action

The workspace header has a direct Delete button that calls `deleteStudyWorkspace(workspace.id)` and clears the selection/list immediately (`app/src/features/workspaces/WorkspacesPanel.tsx:477`). Archive is nearby and safer, but Delete has no confirm step.

Impact: accidental workspace deletion is easy relative to the amount of user-authored data a workspace can contain.

Recommendation: add a confirmation step, or route primary removal through archive and keep permanent delete in an archive/trash management view.

### 11. Low - Stale link/tag hygiene still deserves cleanup after destructive flows

Earlier passes found stale Theology links and tag links around some delete/import paths. This remains worth tracking because `theology_links` stores cached payload text, so stale links can still look valid after their source object is deleted.

Recommendation: add cleanup or "source missing" rendering for polymorphic Theology links and item tag references. Cover workspace item, Council session, bookmark/note, module/resource, and future linked object deletion paths.

### 12. Release blocker - Public release gate still lacks clean-profile manual evidence

`npm run qa:public-release:verify` ran in this pass. Real Council QA passed with 20 results and providers `gemini=20`, `openai=20`. The public gate failed on manual clean-profile and credential-vault evidence: operator, Windows profile, manual pass booleans, and installer artifact list are missing/incomplete.

This matches the docs: `docs/manual-release-qa-report.md:99` says public release remains blocked until clean-profile installer and credential-vault profile checks are signed off.

## Positive Confirmations

- Normal JSON backup export omits imported resource entry bodies (`app/src-tauri/src/user_db.rs:7395`), while resource source metadata remains exportable.
- Resource FTS handling is covered by Rust tests for punctuation/hyphen/apostrophe queries, newly inserted untitled entries, export omission, duplicate import remapping, and FTS rebuild.
- Workspace Markdown export performs final text sanitization (`app/src/features/workspaces/workspaceMarkdown.ts:114`), and HTML export escapes rendered Markdown inside a `<pre>` container (`app/src/features/workspaces/workspaceHtml.ts:1`).
- Theology export redacts quoted provider-key assignments and local paths; selected Rust tests passed in this run.
- Search FTS query normalization quotes tokens and preserves `OR` where intended (`app/src-tauri/src/db.rs:224`). Search and semantic retrieval apply verse-window filters before limiting, with tests.
- Strong's occurrence lookup uses exact matching instead of substring `LIKE` matching (`app/src-tauri/src/db.rs:507`).
- Cross-reference text has a fallback translation path to avoid empty NT/OT text when the active translation lacks that canon (`app/src-tauri/src/db.rs:548`).
- E2E coverage exists for resource search/link/workspace flows, resource JSON import/search, semantic degraded fallback notice, cross-reference strength, empty translation columns, Strong's lookup, and workspace export redaction.

## Verification

Passed:

- `npm run build`
- `npm run test:sidecar` - 66/66 tests
- `cargo test --manifest-path .\app\src-tauri\Cargo.toml resource --lib` - 6/6 selected tests
- `cargo test --manifest-path .\app\src-tauri\Cargo.toml theology --lib` - 9/9 selected tests
- `cargo test --manifest-path .\app\src-tauri\Cargo.toml secret --lib` - 7/7 selected tests
- `cargo test --manifest-path .\app\src-tauri\Cargo.toml app_settings --lib` - 8/8 selected tests
- `cargo test --manifest-path .\app\src-tauri\Cargo.toml search --lib` - 11/11 selected tests
- `npm run resources:fixture:test`
- `npm run resources:assess:test`

Expected blocked:

- `npm run qa:public-release:verify` - failed because manual clean-profile/credential-vault evidence is missing or incomplete. Real Council QA passed inside that command.

Not run in this pass:

- Full WDIO E2E suite.
- Full `npm run check`.
- Tauri release build or installer smoke tests.

## Priority Order

1. Fix SQLite restore legacy secret cleanup before returning success.
2. Split provider readiness into configured/will-try/verified and prevent unsaved draft tests from implying Council readiness.
3. Add resource import source-review enforcement and import-size budgets.
4. Refresh Settings resource/module state immediately after JSON import and SQLite restore.
5. Add true cancellation or killable isolation for provider timeouts.
6. Bring schema mirrors/import generator stamps back in sync with runtime schema v14.
7. Normalize clipboard error handling and add workspace-delete confirmation.
8. Complete clean-profile manual release evidence before any public installer claim.
