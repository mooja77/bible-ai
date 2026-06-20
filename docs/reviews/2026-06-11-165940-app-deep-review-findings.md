# App Deep Review Findings - 2026-06-11 16:59:40 +01:00

Filename timestamp: `2026-06-11-165940`

Review scope: another set of read-only passes over the current Bible AI app state, focused on rendering/XSS boundaries, backup/export privacy, resource ingestion and attribution gates, and targeted test/performance-sensitive paths. No app code was changed in this pass.

Current worktree note: `app/src-tauri/Cargo.toml` was already modified before this pass. I did not change or revert it. `docs/reviews/` contains the accumulated timestamped review reports.

## Current App State

- The app is a Tauri 2 + React/Vite desktop app with a Rust local SQLite layer, Node sidecar AI/Council workers, local backup/restore, study workspaces, Theology, Resources, and resource-import scripts.
- Provider secrets are intended to live in the OS credential store, not JSON backups.
- Normal JSON backups intentionally include user-authored data plus resource source metadata, but omit imported `resource_entries` bodies.
- Resource library ingestion has two channels:
  - Scripted resource workflow: `assess-source.mjs`, manifest validation, JSONL generation, then Settings backup JSON import.
  - Generic Settings backup JSON import: accepts tables including `resource_sources`, `resource_collections`, and `resource_entries`.

## New Findings

### 1. Medium - Resource backup JSON import bypasses the documented source-assessment gate

The resource ingestion docs require source review before import and explicitly say unclear license terms must be deferred (`docs/open-resource-ingestion-plan.md:7`, `docs/open-resource-ingestion-plan.md:25`, `docs/open-resource-ingestion-plan.md:179`). The source-assessment script enforces those rules for accepted sources: redistribution must be true, license must not be unknown, unclear license terms must be rejected/deferred, and manifest import requires an accepted assessment (`app/scripts/resources/assess-source.mjs:36`, `app/scripts/resources/assess-source.mjs:40`, `app/scripts/resources/assess-source.mjs:47`, `app/scripts/resources/assess-source.mjs:79`).

The app-side generic backup import path does not reuse that gate. For `resource_sources`, it only requires non-empty `slug`, `title`, `license`, and `attribution`, plus valid object JSON for `metadata_json` (`app/src-tauri/src/user_db.rs:7832`). For `resource_entries`, it requires a non-empty body and valid payload JSON (`app/src-tauri/src/user_db.rs:7847`). The e2e suite confirms users can paste resource JSON into the Settings backup textarea and make those entries searchable (`app/tests/e2e/backup-restore.spec.ts:88`, `app/tests/e2e/backup-restore.spec.ts:103`, `app/tests/e2e/backup-restore.spec.ts:131`, `app/tests/e2e/backup-restore.spec.ts:153`).

Impact: a user or distributed fixture can import resources with an `"Unknown"` or otherwise unreviewed license through Settings, bypassing the stricter workflow that the docs and scripts imply. The UI will still show license/attribution text, but that text may not represent a reviewed source.

Recommendation: when `resource_entries` are present in a JSON import, require a source-review marker or accepted assessment metadata, or import them as explicitly "unreviewed/quarantined" until the user confirms source terms. At minimum, reject `"Unknown"` licenses and `redistribution_permission: false` in resource source metadata in the app import path too.

### 2. Medium/Low - Backup JSON import has no size or row-count budget for large resource text

The generic import normalizer trims required text but does not enforce length limits or total payload budgets (`app/src-tauri/src/user_db.rs:8035`). Resource entries can provide arbitrarily large `body` and `search_text`, and if `search_text` is blank the body is copied into it (`app/src-tauri/src/user_db.rs:7847`). After import, the app rebuilds the resource FTS index for all imported resource entries (`app/src-tauri/src/user_db.rs:7705`, `app/src-tauri/src/user_db.rs:7754`).

Search queries then return full entry bodies from SQLite (`app/src-tauri/src/user_db.rs:7124`, `app/src-tauri/src/user_db.rs:7196`), and the Resources UI keeps those rows in React state and renders the selected full body (`app/src/features/resources/ResourcesPanel.tsx:83`, `app/src/features/resources/ResourcesPanel.tsx:86`, `app/src/features/resources/ResourcesPanel.tsx:358`). Adding a resource to a workspace also carries the full body into the workspace payload (`app/src/features/resources/ResourcesPanel.tsx:402`).

Impact: this is local/user-triggered, not remote code execution, but a pasted backup can bloat `user.sqlite`, spend a long time rebuilding FTS, and make the Resources screen or workspace payloads heavy enough to freeze the app.

Recommendation: add import-level budgets before `BEGIN IMMEDIATE`: maximum JSON bytes, maximum rows per table, maximum `resource_entries.body` and `search_text` chars, and maximum JSON field size. Consider returning resource search summaries and loading full bodies only on detail selection.

## Reconfirmed Active Finding

### 3. Low - Resource JSONL importer schema version still lags runtime schema

`app/scripts/resources/import-resource-jsonl.mjs` says to keep its emitted `user_schema_version` in sync, but still emits `13` (`app/scripts/resources/import-resource-jsonl.mjs:74`, `app/scripts/resources/import-resource-jsonl.mjs:76`). Runtime `USER_SCHEMA_VERSION` is `14` (`app/src-tauri/src/user_db.rs:13`). This is accepted today because imports only reject newer schemas, but it keeps schema drift alive and weakens generated fixture metadata.

Recommendation: update the script to `14` or read the value from a single generated source, and add a small script test that fails when the emitted version diverges from `USER_SCHEMA_VERSION`.

## Positive Checks From This Pass

- No raw HTML injection path found in searched frontend surfaces. FTS snippets use `<mark>` marker strings from SQLite, but React renders split text nodes, not raw HTML. Workspace HTML export escapes Markdown into a `<pre>`.
- Settings backup copy now clearly says JSON backups include user-authored data and resource source metadata, while provider secrets and imported resource entry bodies are excluded (`app/src/features/settings/SettingsPanel.tsx:813`).
- Normal JSON export intentionally omits `resource_entries` bodies (`app/src-tauri/src/user_db.rs:7395`), and Rust tests cover that behavior.
- Provider secret export/import redaction is covered in Rust and e2e tests.
- Resource search command clamps limits through `bounded_limit(limit, 30, 100)` before SQLite (`app/src-tauri/src/lib.rs:2820`, `app/src-tauri/src/lib.rs:2842`).
- The Resources import-docs UI path points to an existing repo doc: `docs/open-resource-ingestion-plan.md`.
- Resource detail, Theology link payloads, and workspace payloads preserve visible attribution and share-alike terms (`app/src/features/resources/ResourcesPanel.tsx:161`, `app/src/features/resources/ResourcesPanel.tsx:407`).

## Carried-Forward Backlog Snapshot

These are still part of the current-state risk picture from the prior timestamped reports. I did not re-prove every item in this pass unless noted above.

- Release manifests can include absolute local build paths.
- macOS release checks still treat signing/notarization as optional, and the current visible Cargo manifest only enables the Windows keyring feature.
- Note deletion leaves tag links behind; taggable item contract remains wider than cleanup/import support.
- Theology links can go stale after linked object deletion.
- Provider voice timeouts do not cancel underlying work.
- AI model defaults should be reviewed against current provider docs before release.
- Council retrieval/hybrid labeling and semantic fallback behavior need tightening.
- SQLite restore and JSON import paths are improved, but still deserve destructive-restore UX and state-refresh hardening.

## Verification Run

- `npm run resources:assess:test` - passed.
- `npm run resources:fixture:test` - passed.
- `cargo test --manifest-path .\app\src-tauri\Cargo.toml resource --lib` - passed, 6 tests.
- `cargo test --manifest-path .\app\src-tauri\Cargo.toml user_data_import --lib` - passed, 10 tests.

