# Bible AI App Deep Review Findings - 2026-06-11 22:43:08 +01:00

Report file timestamp: `2026-06-11-224308`  
Review date/time: `2026-06-11 22:43:08 +01:00`  
Workspace: `C:\JM Programs\BibleApp`  
Scope: additional review passes over package/runtime surfaces, frontend shell and destructive flows, sidecar/provider behavior, release tooling, resource/schema drift, and verification.

## Worktree Note

The review started with this pre-existing tracked change:

- `app/src-tauri/Cargo.toml`

I did not modify or revert it. The only file added by this pass is this timestamped review report under `docs/reviews/`.

## Current State Summary

The app is broadly coherent and testable. The frontend builds, the full Rust library test suite passes, sidecar tests pass, production capability/CSP posture remains narrow, provider secret redaction exists, JSON import/export has transactional validation, and the public release gate correctly blocks without manual release evidence.

The remaining active risk is concentrated in release assurance, import/input budgets, destructive-flow hygiene, sidecar cancellation/concurrency, and schema/tooling drift.

## Fresh Or Updated Findings

### 1. Low/Medium - `ollama_host` accepts HTTPS, but the Rust HTTP client has no TLS feature

Rust `reqwest` is compiled with `default-features = false` and only the `json` feature. The settings validation accepts both `http` and `https` for `ollama_host`, and the Rust Ollama diagnostics/embedding paths use `reqwest::Client` for that URL.

Evidence:

- `app/src-tauri/Cargo.toml:26` declares `reqwest = { version = "0.12", default-features = false, features = ["json"] }`.
- `cargo tree --manifest-path .\app\src-tauri\Cargo.toml -e features -i reqwest@0.12.28` showed the app-owned reqwest only has the `json` feature.
- `app/src-tauri/src/lib.rs:228-236` accepts `http` or `https` for normalized URL settings.
- `app/src-tauri/src/user_db.rs:7942-7948` applies the same `http` or `https` acceptance during imported settings normalization.
- `app/src-tauri/src/lib.rs:1064-1079` uses `reqwest::Client` to call the configured Ollama `/api/tags` endpoint.
- `app/src-tauri/src/ollama.rs:38-50` uses the same client path for embeddings.

Impact:

Default local Ollama over `http://localhost:11434` works. A user who configures an HTTPS Ollama endpoint can pass validation but hit runtime TLS-backend failures in diagnostics or semantic retrieval.

Recommendation:

Either restrict `ollama_host` to `http` in the Rust settings contract, or enable a TLS feature such as `rustls-tls` on the app-owned `reqwest` dependency and add a small test/documentation note for HTTPS Ollama endpoints.

### 2. Low - macOS release manifest has the same directory attestation gap as Windows

The macOS release manifest hashes key files and the DMG, but directory artifacts, including the `.app` bundle, sidecar providers, and `node_modules`, are summarized only by file count and total bytes.

Evidence:

- `app/scripts/create-macos-release-manifest.mjs:25-36` hashes named files.
- `app/scripts/create-macos-release-manifest.mjs:37-41` records `app_bundle`, `sidecar_providers`, and `sidecar_dependencies` as directories.
- `app/scripts/macos-release-utils.mjs:49-57` describes directories with only `files` and `bytes`.
- `app/scripts/macos-release-utils.mjs:59-78` summarizes directories by count and bytes.
- `app/scripts/verify-macos-release-manifest.mjs:129-162` verifies only directory count and byte totals.

Impact:

The DMG itself is hashed, so the packaged artifact is still covered. The manifest cannot precisely attest the full file tree inside the app bundle or sidecar directories.

Recommendation:

Add deterministic tree hashes or per-file hash lists for directory artifacts on both Windows and macOS manifests.

### 3. Low - Sidecar requests are serialized, so long Council calls block diagnostics/explain behind the mutex

This is documented in code as a v0.1 constraint, but it remains important current-state behavior. One long-running Council request occupies the Rust sidecar mutex and the Node sidecar request loop until it completes, errors, or hits the 30-minute Rust deadlock guard.

Evidence:

- `app/src-tauri/src/sidecar.rs:3-6` documents one spawned sidecar and serialized calls behind a mutex.
- `app/src-tauri/src/sidecar.rs:20` sets the sidecar request timeout to 1800 seconds.
- `app/src-tauri/src/sidecar.rs:259-285` locks the sidecar state and awaits the request while holding the mutex.
- `app/sidecar/index.mjs:191-202` awaits `handle(msg)` before sending a reply and continuing the stdin loop.
- `app/src/features/council/CouncilPanel.tsx:161-165` acknowledges a second request would queue behind the sidecar mutex.

Impact:

If a Council run is slow or the frontend timeout fires while the backend keeps running, retries, diagnostics, and explain requests can appear stuck because they wait behind the original sidecar request.

Recommendation:

Add cancellation or sidecar restart after client timeout, or move to request dispatch that can cancel/abort one logical request without blocking all sidecar operations.

### 4. Low - Guided tour modal still lacks explicit focus capture/restoration

The guided tour declares a modal dialog and has Escape/arrow handling, but unlike the Strong's popup it does not capture the previously focused element, move focus into the dialog, or restore focus on close.

Evidence:

- `app/src/features/onboarding/GuidedTour.tsx:140-153` handles keyboard events globally.
- `app/src/features/onboarding/GuidedTour.tsx:180-188` renders `role="dialog"` and `aria-modal="true"`.
- No `focus()` or previously-focused restoration appears in `GuidedTour.tsx`.
- Positive contrast: `app/src/features/reader/StrongsPopup.tsx:35-37` captures and restores focus, and E2E covers that behavior in `app/tests/e2e/reader-interactions.spec.ts:677-722`.

Impact:

Keyboard and assistive-tech users can open a modal whose active focus remains behind the overlay. Close may not return focus to the launcher.

Recommendation:

Reuse the Strong's popup focus pattern for the guided tour, and add one E2E assertion for initial focus plus Escape-close focus restoration.

### 5. Low - Saved-search and workspace destructive controls are still immediate

Workspace deletion, workspace-item removal, and saved-search deletion execute directly from click handlers. This is testable and fast, but it is easy to trigger accidentally.

Evidence:

- `app/src/features/app-shell/NavigationShortcuts.tsx:191-205` deletes a saved search with no confirmation.
- `app/src/App.tsx:1285-1289` directly calls `deleteSavedSearch` and refreshes navigation state.
- `app/src/features/workspaces/WorkspacesPanel.tsx:477-489` directly deletes a workspace.
- `app/src/features/workspaces/WorkspacesPanel.tsx:585-588` directly deletes workspace items.
- `app/src/features/workspaces/WorkspaceItem.tsx:184-190` exposes an immediate `Remove` button.
- `rg` found no `window.confirm` or equivalent confirmation flow in `app/src`.

Impact:

Accidental clicks can remove user-authored saved searches, workspace items, or entire workspaces without a second step.

Recommendation:

Use confirmation for destructive actions. For workspaces, include the workspace title or require typing it for non-empty workspaces. For saved searches/items, a small confirm popover or undo toast would be enough.

### 6. Low - Shortcut behavior exists, but the E2E test still does not exercise it

The `/` shortcut and Ctrl/Cmd+K command palette behavior exist, but current E2E coverage does not press those keys or assert focus/command execution.

Evidence:

- `app/src/features/search/SearchInput.tsx:11-20` focuses search on `/` unless the active element is an input, textarea, or select.
- `app/src/App.tsx:739-749` opens the command palette on Ctrl/Cmd+K.
- `app/src/features/app-shell/CommandPalette.tsx:24-37` focuses the palette input and runs selected commands.
- `app/tests/e2e/smoke.spec.ts:144-147` labels the `/` shortcut test but only checks that the search input is displayed.
- `rg` found no E2E test that opens or executes the command palette.

Impact:

Shortcut regressions can pass the current E2E suite.

Recommendation:

Add E2E tests that blur/focus a neutral element, press `/`, assert search focus, press Ctrl/Cmd+K, assert palette focus, filter, execute a command, and close with Escape.

### 7. Low - Clipboard error handling is inconsistent

Some clipboard actions catch and surface errors; several copy actions directly call `navigator.clipboard.writeText` and optimistically update copied state.

Evidence:

- `app/src/features/settings/SettingsPanel.tsx:182-190` catches backup clipboard failures and reports status.
- `app/src/features/resources/ResourcesPanel.tsx:127-130` catches resource-doc clipboard failure and falls back to showing the path.
- `app/src/features/workspaces/WorkspacesPanel.tsx:198-203` writes workspace markdown without a catch.
- `app/src/features/workspaces/WorkspaceItem.tsx:243`, `297`, `343`, `404`, and `454` write clipboard text inside handlers without a shared error path.
- `app/src/features/reader/ChapterReader.tsx:541` writes copy text without awaiting or catching.
- `app/src/features/theology/TheologyPanel.tsx:411`, `418`, and `426` write markdown without local catch.

Impact:

Clipboard permission failures can produce inconsistent UX and may surface only as global unhandled rejection notices in some paths.

Recommendation:

Create a small `copyText` helper that returns `{ ok, error }`, use it across copy actions, and preserve the global error notice as a last-resort safety net.

### 8. Low - Sidecar package metadata is stale

The sidecar package description still says it invokes Claude via subscription, but the current sidecar supports Claude, Managed Gateway, Gemini, and OpenAI voices.

Evidence:

- `app/sidecar/package.json` description: "Long-running Node sidecar that invokes Claude (via subscription) for Bible AI council calls."
- `app/sidecar/providers/index.mjs:1-6` registers Claude, gateway, Gemini, and OpenAI providers.

Impact:

This is documentation/package metadata drift, not runtime behavior. It can mislead release reviewers or future maintainers inspecting packaged sidecar metadata.

Recommendation:

Update the sidecar package description to describe the provider orchestrator accurately.

## Reconfirmed Active Findings

### 9. Medium - Generic JSON user-data import still has no global size or row budgets

The importer validates schema/version and many row shapes, and it runs transactionally. It still does not cap total pasted JSON size, per-table rows, or resource/module body sizes before inserting and rebuilding FTS.

Evidence:

- `app/src/features/settings/SettingsPanel.tsx:210-219` parses pasted JSON in memory and imports it.
- `app/src-tauri/src/lib.rs:1841-1850` accepts a full `serde_json::Value`.
- `app/src-tauri/src/user_db.rs:7434-7492` validates version and table object presence.
- `app/src-tauri/src/user_db.rs:7518-7533` iterates all supplied table arrays and rows.
- `app/src-tauri/src/user_db.rs:7705-7707` rebuilds resource FTS when `resource_entries` are present.

Recommendation:

Add total payload, per-table row, per-field string, and resource/module body budgets before beginning the DB transaction.

### 10. Low - Module/resource import tooling still lacks explicit input budgets

The module JSONL command and resource JSONL script load entire files/payloads and build entry arrays in memory with no row/body budget.

Evidence:

- `app/src-tauri/src/lib.rs:1651-1706` takes `entries_jsonl: String`, loops all lines, and accumulates entries.
- `app/scripts/resources/import-resource-jsonl.mjs:44-49` reads the whole JSONL file, splits all lines, and builds an entries array.
- `app/scripts/resources/import-resource-jsonl.mjs:50-68` parses and pushes every entry.

Recommendation:

Add maximum input bytes, line counts, body/search text lengths, and clear over-budget errors.

### 11. Medium - SQLite restore cleanup still waits for the settings path

Restore validates and reopens the SQLite file, while normal settings load migrates/deletes legacy secret settings. Restore itself still returns before invoking that cleanup.

Evidence:

- `app/src-tauri/src/lib.rs:1972-2042` restores the SQLite file and returns.
- `app/src-tauri/src/lib.rs:995-1015` migrates/deletes legacy provider secret rows on normal settings load.
- `app/src-tauri/src/user_db.rs:693-708` performs secure delete and vacuum for secret-like settings.

Recommendation:

Run the legacy secret migration/cleanup path immediately after restore opens the new DB and before returning success.

### 12. Low - Note/range-note/study-item tag cleanup is incomplete

Bookmark deletion clears `item_tags`; note, range-note, study-item, and workspace deletion paths still do not clean polymorphic tag links.

Evidence:

- `app/src-tauri/src/user_db.rs:378-386` defines polymorphic `item_tags`.
- `app/src-tauri/src/user_db.rs:1103-1108` clears bookmark item tags.
- `app/src-tauri/src/user_db.rs:9065-9070` deletes only from `user_notes`.
- `app/src-tauri/src/user_db.rs:9145-9155` deletes only from `user_range_notes`.
- `app/src-tauri/src/user_db.rs:963-982` deletes only from `study_items`.
- `app/src-tauri/src/user_db.rs:817-822` deletes workspace child items without tag cleanup.

Recommendation:

Mirror bookmark cleanup for every destructive flow that can remove a taggable target, or narrow the taggable contract until those item types are fully supported.

### 13. Low - Schema/version mirrors remain stale

Runtime user schema is v14. The SQL mirror still labels itself v12, the resource JSONL generator still emits schema v13, and generated resource fixtures still show v12.

Evidence:

- `app/src-tauri/src/user_db.rs:13` sets `USER_SCHEMA_VERSION` to 14.
- `data/schema.sql:313` says the SQL mirror is v12.
- `app/src-tauri/src/user_db.rs:372-386` creates `tags` and `item_tags`.
- `rg` found no `CREATE TABLE tags` or `CREATE TABLE item_tags` definitions in `data/schema.sql`.
- `app/scripts/resources/import-resource-jsonl.mjs:71-76` emits `user_schema_version: 13`.
- `app/tests/fixtures/resources/public-domain-creeds-import.json:4` and `app/tests/fixtures/resources/sefaria-style-import.json:4` still contain `user_schema_version: 12`.

Recommendation:

Update the SQL mirror and resource-generation scripts to v14. Keep deliberate old-version E2E fixtures if they are testing backward compatibility, but label them as compatibility fixtures.

### 14. Low - Explicit markdown save-to-path can overwrite existing markdown files

The command validates absolute path, parent existence, and markdown extension, but does not enforce no-overwrite semantics.

Evidence:

- `app/src-tauri/src/lib.rs:1887-1896` writes markdown to the explicit path.
- `app/src-tauri/src/lib.rs:2204-2227` validates path shape and extension.
- `app/src-tauri/capabilities/default.json:8` allows save dialogs.

Recommendation:

Either rely on a clearly confirmed OS save dialog overwrite prompt, or add a backend overwrite flag so accidental overwrites are explicitly opted into.

### 15. Medium - Public release gate remains blocked on manual QA evidence

The release gate is working: Real Council QA passes, but manual clean-profile and credential-vault evidence is incomplete.

Evidence:

- `npm run qa:public-release:verify` failed in this pass.
- Real Council QA passed with 20 results, `gemini=20`, `openai=20`.
- Manual gate failed on missing operator, Windows profile, clean-profile install, first launch, provider key setup, credential-vault clean/upgrade profile, export secret leak check, backup restore, SQLite restore, and tested installer artifact list.

Recommendation:

Complete `release/manual-release-gates.json` from a real clean Windows profile and upgrade-profile pass against the NSIS/MSI artifacts, then rerun the public release gate.

## Positive Confirmations

- `npm audit --omit=dev --json` reported zero vulnerabilities for both `app` and `app/sidecar`.
- Production build passed.
- Full Rust library test suite passed, 93/93.
- Sidecar test suite passed, 66/66.
- Sidecar errors and diagnostics are redacted with `redactSecrets`: `app/sidecar/index.mjs:159-184` and `app/sidecar/providers/_shared.mjs:143-160`.
- Provider fetch paths mostly use `AbortController`: OpenAI, Gemini, Claude API, Managed Gateway, and diagnostics endpoint checks.
- The command palette has modal semantics and initial input focus: `app/src/features/app-shell/CommandPalette.tsx:24-45`.
- Strong's popup has focus restoration and E2E coverage.
- Resource fixture search checks passed.
- macOS release package verification hashes the copied DMG and verifies copied manifest/summary file hashes: `app/scripts/verify-macos-release-package.mjs:41-80`.
- The public release gate correctly prevents release when manual evidence is incomplete.

## Verification Run

Commands run in this review pass:

- `npm audit --omit=dev --json` from `app` - passed, zero vulnerabilities.
- `npm audit --omit=dev --json` from `app/sidecar` - passed, zero vulnerabilities.
- `npm run build` - passed.
- `npm run test:sidecar` - passed, 66/66 tests.
- Sidecar/provider `node --check` sweep - passed.
- macOS/resource script `node --check` sweep - passed.
- `npm run resources:fixture:test` - passed.
- `cargo check --manifest-path .\app\src-tauri\Cargo.toml` - passed.
- `cargo test --manifest-path .\app\src-tauri\Cargo.toml --lib` - passed, 93/93 tests.
- `npm run qa:public-release:verify` - failed as expected on incomplete manual QA evidence; Real Council QA passed.

## Not Run

- Full E2E suite was not rerun in this pass.
- Full `npm run check` was not rerun because this pass used targeted build, script, sidecar, resource, audit, cargo check, and full Rust library tests.
- No app code fixes were made in this pass.

## Suggested Next Order

1. Decide whether `ollama_host` should support HTTPS; either add TLS to Rust `reqwest` or restrict the setting to HTTP.
2. Complete manual release QA evidence and rerun the public release gate.
3. Add import budgets for JSON backups, module JSONL, and resource JSONL tooling.
4. Add sidecar cancellation/restart behavior after frontend Council timeout.
5. Clean stale tag links in note/range-note/study-item/workspace deletion paths.
6. Update schema mirrors/resource fixtures to match runtime schema v14.
7. Add E2E coverage for `/`, Ctrl/Cmd+K, guided-tour focus, and destructive confirmation flows.
