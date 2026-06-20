# App Deep Review Findings - 2026-06-11 17:06:56 +01:00

Filename timestamp: `2026-06-11-170656`

Review scope: another read-only review cycle over the current Bible AI app state, focused on Tauri command/path boundaries, workspace/export stale-reference behavior, sidecar/provider request handling, and test coverage around those areas. No app code was changed in this pass.

Current worktree note: `app/src-tauri/Cargo.toml` was already modified before this pass. I did not change or revert it. `docs/reviews/` remains untracked with the accumulated timestamped reports.

## Current State Snapshot

- Command input validation is substantially better than the earliest reports: verse/book bounds, limits, colors, settings, Markdown export paths, SQLite restore sources, resource search limits, and Council evidence limits all have explicit checks.
- Workspace export is still snapshot-based. That is good for reproducible Markdown/HTML/PDF exports, but it means source object deletion can leave old payloads and Theology links behind until cleanup rules are added.
- Sidecar execution is deliberately serialized: one long request blocks the sidecar mutex and the Node request loop until it completes or the Rust 30-minute deadlock guard fires.
- Settings exposes individual provider-test buttons, but the implementation currently runs the full setup diagnostics for every button.

## New Findings

### 1. Medium - Council client timeout does not cancel the backend sidecar request

The Council UI has a five-minute client-side backstop implemented with `Promise.race` (`app/src/features/council/CouncilPanel.tsx:39`, `app/src/features/council/CouncilPanel.tsx:48`, `app/src/features/council/CouncilPanel.tsx:59`). On timeout, it clears `loading` and shows a retry affordance (`app/src/features/council/CouncilPanel.tsx:206`, `app/src/features/council/CouncilPanel.tsx:322`), and the e2e suite verifies that user-facing timeout state (`app/tests/e2e/council-error.spec.ts:98`, `app/tests/e2e/council-error.spec.ts:103`).

That timeout only affects the React promise race. The underlying Tauri invoke continues. On the Rust side, sidecar calls are serialized behind a `tokio::sync::Mutex` (`app/src-tauri/src/sidecar.rs:249`, `app/src-tauri/src/sidecar.rs:260`) and held until `sidecar.request` returns or the 30-minute `SIDECAR_REQUEST_TIMEOUT` fires (`app/src-tauri/src/sidecar.rs:20`, `app/src-tauri/src/sidecar.rs:267`). The Node sidecar also processes stdin sequentially by awaiting each `handle(msg)` before reading the next message (`app/sidecar/index.mjs:188`, `app/sidecar/index.mjs:191`, `app/sidecar/index.mjs:201`).

Impact: after the UI says the Council is no longer running, the backend can still be running the original request. A retry or diagnostics request can queue behind that work, making the app appear stuck even though the visible spinner ended. This is worse when provider calls keep running after local timeouts; the sidecar code already documents that provider-level `withTimeout` does not cancel the losing work (`app/sidecar/council.mjs:32`).

Recommendation: add a cancellable request path. At minimum, when the frontend timeout fires, send a cancel/kill request or drop/restart the sidecar process before allowing retry. Better: use abort signals through the Rust sidecar request, Node handler, and provider fetch calls so one logical Council run can be cancelled end to end.

### 2. Medium/Low - Per-provider test buttons run full diagnostics, not scoped checks

Settings has separate buttons for `Test Anthropic`, `Test Google`, `Test OpenAI`, `Test Gateway`, and `Test Ollama` (`app/src/features/settings/SettingsPanel.tsx:773`, `app/src/features/settings/SettingsPanel.tsx:781`, `app/src/features/settings/SettingsPanel.tsx:789`, `app/src/features/settings/SettingsPanel.tsx:797`, `app/src/features/settings/SettingsPanel.tsx:805`). Each button only changes the display scope string; the implementation still calls the same full `checkAppSetup(draft)` routine (`app/src/features/settings/SettingsPanel.tsx:163`, `app/src/features/settings/SettingsPanel.tsx:166`, `app/src/features/settings/SettingsPanel.tsx:168`).

The sidecar diagnostics routine performs every check in the same run, starting with the Claude probe and then hosted/provider health checks (`app/sidecar/index.mjs:94`, `app/sidecar/index.mjs:99`, `app/sidecar/index.mjs:100`, `app/sidecar/index.mjs:107`, `app/sidecar/index.mjs:114`, `app/sidecar/index.mjs:124`, `app/sidecar/index.mjs:125`). The e2e release-readiness test only checks that the buttons are displayed, not that scoped behavior is real (`app/tests/e2e/release-readiness.spec.ts:23`, `app/tests/e2e/release-readiness.spec.ts:27`).

Impact: a user clicking `Test OpenAI` can wait on a Claude subscription probe, Gateway health, Ollama, and other checks. The status text says `Testing OpenAI...`, but the work is broader and can fail or lag because of unrelated providers.

Recommendation: either relabel the buttons as full setup tests or add a `scope` argument to `check_app_setup` / sidecar diagnostics so each provider button only checks the provider it names. Add a unit or e2e test that clicks one scoped button and verifies unrelated provider probes are not called.

## Reconfirmed Active Finding

### 3. Low - Explicit Markdown "Save As" can overwrite any absolute Markdown path

The normal workspace export commands write inside the app export directory. The explicit `write_workspace_markdown_to_path` command accepts any absolute `.md`/`.markdown` path whose parent directory exists (`app/src-tauri/src/lib.rs:1888`, `app/src-tauri/src/lib.rs:1893`, `app/src-tauri/src/lib.rs:2204`). The frontend uses a Tauri save dialog before calling that command (`app/src/features/workspaces/WorkspacesPanel.tsx:208`, `app/src/features/workspaces/WorkspacesPanel.tsx:222`).

This is mostly expected for a "Save As" feature, but there is no backend overwrite policy or confirmation. If a compromised renderer or plugin-level script can invoke the command, it can overwrite arbitrary user-owned Markdown files.

Recommendation: keep the command, but consider enforcing a dialog-issued token or adding an `overwrite` flag derived from a frontend confirmation when the target exists. At minimum, add tests for existing-file behavior and document the expected overwrite semantics.

## Positive Checks From This Pass

- `user_db::open` enables SQLite foreign keys and applies the embedded schema before migrations/seeding (`app/src-tauri/src/user_db.rs:388`).
- SQLite restore validates `quick_check`, requires `app_settings`, rejects newer schemas, creates a safety backup, and rolls back on failed restore (`app/src-tauri/src/lib.rs:1972`, `app/src-tauri/src/lib.rs:2045`, `app/src-tauri/src/lib.rs:2093`).
- Command input tests cover bounds for limits, book/chapter values, verse ranges, colors, settings, module keys, and model/translation overrides.
- Markdown export path tests reject relative paths and non-Markdown extensions.
- Sidecar unit tests cover Council mock behavior, JSON extraction/sanitization, result normalization, redaction, error classification, and timeout classification.
- Provider diagnostics and sidecar error paths redact configured provider secrets before returning errors.

## Carried-Forward Backlog Snapshot

Still relevant from earlier timestamped reports:

- Resource backup JSON import bypasses the stricter source-assessment gate.
- Resource backup JSON import lacks size/row-count budgets for large resource text.
- Resource JSONL importer still emits schema version `13` while runtime schema is `14`.
- Release manifests can include absolute local build paths.
- macOS release checks treat signing/notarization as optional, and the visible Cargo manifest only enables the Windows keyring feature.
- Note deletion leaves tag links behind; taggable item contract remains wider than cleanup/import support.
- Theology links can go stale after linked object deletion.
- AI model defaults should be reviewed against current provider docs before release.
- Council retrieval/hybrid labeling and semantic fallback behavior still need tightening.

## Verification Run

- `npm run test:sidecar` - passed, 66 tests.
- `cargo test --manifest-path .\app\src-tauri\Cargo.toml command_input_tests --lib` - passed, 11 tests.
- `cargo test --manifest-path .\app\src-tauri\Cargo.toml export_path_tests --lib` - passed, 3 tests.
- `cargo test --manifest-path .\app\src-tauri\Cargo.toml sqlite_restore_tests --lib` - passed, 2 tests.

