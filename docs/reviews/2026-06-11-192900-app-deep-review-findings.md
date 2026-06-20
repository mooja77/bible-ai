# Bible AI Deep Review Findings - 2026-06-11 19:29:00 +01:00

Scope: another read-only review cycle over the current Bible AI app state. This pass focused on the Tauri command boundary, full SQLite backup/restore behavior, provider readiness semantics, sidecar timeout behavior, and the tests/release gates that cover those paths.

No app code was changed. The worktree already had `app/src-tauri/Cargo.toml` modified before this pass; I did not change or revert it. This report is the only intentional new artifact from this pass.

## Current State

- The app is still a Tauri 2 desktop app with a React/Vite frontend, Rust command layer, SQLite user database, bundled corpus, and long-running Node sidecar.
- The default Tauri capability remains narrow: `core:default` plus `dialog:allow-save` in `app/src-tauri/capabilities/default.json`.
- Production CSP is reasonably tight in `app/src-tauri/tauri.conf.json`: no remote script source, no object embedding, no frames, IPC/connect limited to the app/IPC origins.
- JSON backup import/export has good secret handling: selected tests confirm secret app settings are skipped on import/export and broad secret-like keys are redacted from text exports.
- SQLite restore is safer than a raw overwrite: it validates the source opens, passes `PRAGMA quick_check`, has an `app_settings` table, and is not newer than the current user schema before copying.
- The public-release gate is still intentionally blocked by incomplete manual clean-profile evidence. Real Council QA passes; manual release evidence does not.

## Fresh Findings

### 1. Medium - SQLite restore can temporarily reintroduce legacy provider secrets into active `user.sqlite`

The normal settings load path migrates old SQLite provider secrets into the OS credential vault and then deletes secret settings from the DB. That happens in `get_app_settings`: it detects legacy provider key rows at `app/src-tauri/src/lib.rs:1003`, saves them to the vault, and calls `user_db::delete_secret_settings` at `app/src-tauri/src/lib.rs:1010`.

Full SQLite restore follows a different path. `restore_user_sqlite` validates the source, copies it over the active DB at `app/src-tauri/src/lib.rs:2012`, opens the restored file at `app/src-tauri/src/lib.rs:2021`, and installs that connection into process state at `app/src-tauri/src/lib.rs:2039`. It does not run the legacy secret migration/cleanup path before returning success.

Impact: restoring an older or externally-created Bible AI `user.sqlite` can put `google_api_key`, `openai_api_key`, `anthropic_api_key`, `managed_gateway_token`, or broader secret-like app settings back into the active SQLite file. They should be cleaned the next time `get_app_settings` runs, but immediately after restore the Settings panel only calls `onUserDataChanged`, not a settings reload. That leaves a window where secrets can remain at rest in the DB despite the app's current credential-vault posture.

Recommendation: after a successful SQLite restore and before returning success, run a shared helper that performs the same legacy provider-key migration and `delete_secret_settings` cleanup used by `get_app_settings`. Add a restore-specific test that creates a source DB with legacy secret app settings, restores it, and asserts the active DB no longer contains those rows.

### 2. Medium - Provider readiness UI counts configured/optimistic providers as "tested" or "ready"

`SettingsPanel` computes `passingVoiceCount` from `diagnostics.providers.filter((provider) => provider.available)` at `app/src/features/settings/SettingsPanel.tsx:403`. Those provider entries come from the sidecar manifest, where `providerManifest` reports whether a provider is configured or assumed available, not whether the live diagnostic check passed.

The Claude path is especially misleading: `claude.isAvailable` is deliberately optimistic at `app/sidecar/providers/claude.mjs:161`, and the file comments note that availability cannot cheaply prove a Claude Code login at `app/sidecar/providers/claude.mjs:183`. The real diagnostic result lives under `diagnostics.checks.claude.ok`, but the top-level readiness pill and local setup readiness can still use manifest availability.

The Council preview has the same vocabulary problem: it marks Claude `active: true` at `app/src/features/council/CouncilVoicePanels.tsx:15`, while the panel title and counter say "AI helpers ready to run" at `app/src/features/council/CouncilVoicePanels.tsx:61` and count active helpers at `app/src/features/council/CouncilVoicePanels.tsx:64`.

Impact: invalid API keys, an unreachable gateway, or a missing Claude Code login can still make parts of the UI say a voice is available/ready/tested because the code is counting "configured" or "will try" rather than "verified ok." The detailed diagnostic rows show failures correctly, but the summary signal is the one users will scan first.

Recommendation: split the model into explicit states: `configured`, `will_try`, and `verified`. Compute "Tested providers" and guided setup readiness from `diagnostics.checks.*.ok`, not `provider.available`. In the Council preview, label Claude without a verified login as "will try" but do not count it as "ready."

### 3. Medium - Provider test buttons can pass against unsaved keys that Council will not use

`submit()` is the only Settings path that calls `onSave(draft)` at `app/src/features/settings/SettingsPanel.tsx:152`. `saveAndRunChecks()` saves first, then tests, at `app/src/features/settings/SettingsPanel.tsx:177`.

The standalone test buttons call `runChecks(...)` directly, including "Test all providers" at `app/src/features/settings/SettingsPanel.tsx:761`, "Test Google" at `app/src/features/settings/SettingsPanel.tsx:777`, and "Test setup" at `app/src/features/settings/SettingsPanel.tsx:1066`. `runChecks` sends the in-memory `draft` to `checkAppSetup` at `app/src/features/settings/SettingsPanel.tsx:163`, but it does not persist the draft to the credential vault or App-level settings.

Impact: a user can paste a key, click a standalone provider test, see the provider accepted, and then leave Settings or ask the Council without saving. The test used the draft key, but the Council command reloads settings from SQLite/vault, so it can fail or run fewer voices than the test implied.

Recommendation: either make all provider-test buttons save first, or label them clearly as "Test unsaved draft" and show a blocking "Save settings to use this in Council" state after a passing unsaved test. Add an E2E test that edits a key, runs a standalone test without saving, and asserts the UI does not present the provider as ready for Council use until saved.

### 4. Low/Medium - Claude diagnostics and Council-level voice timeouts remain non-canceling

The Council helper `withTimeout` explicitly documents that it does not cancel the underlying work at `app/sidecar/council.mjs:32`, and `runOneVoice` uses it around every provider at `app/sidecar/council.mjs:57`. The direct HTTP providers use their own `AbortController`s, but the outer timeout is still not wired to those controllers.

The Settings diagnostic probe has a similar issue for Claude Code subscription mode: `probeClaudeVoice` uses `Promise.race` at `app/sidecar/providers/claude.mjs:199` around `callClaudeVoice`, with no abort channel for the underlying Claude SDK call. `runDiagnostics` awaits that probe at `app/sidecar/index.mjs:99`.

Impact: after a timeout, the UI can report failure while Claude SDK or provider work continues in the sidecar process. The Rust wrapper kills and respawns the Node process on a whole-sidecar transport timeout, but these JavaScript-level timeouts happen inside an otherwise healthy sidecar and can leave expensive work running behind the user's next action.

Recommendation: where APIs support it, pass an abort signal into the provider call rather than only racing promises. For Claude Code SDK work that cannot be aborted cleanly, isolate that call in a killable child process or add a sidecar-level request cancellation mechanism.

## Reconfirmed Open Findings

- Medium - Settings import/restore refresh is still partial: JSON import and SQLite restore refresh parent user/navigation state, but not `SettingsPanel`'s own modules, module topics, and resource source state until remount.
- Medium - Public-release manual QA evidence is still not bound to current installer names, byte counts, and SHA-256 hashes.
- Medium - Public release artifacts still lack a complete third-party runtime/dependency notice or SBOM gate for bundled Node, npm packages, native modules, and upstream license texts.
- Medium - Resource import via backup JSON still bypasses the curated source-assessment/attribution gate.
- Medium - User import/restore still lacks clear size and row-count budgets before parsing/writing large JSON payloads.
- Medium - Frontend Council timeout does not cancel backend sidecar/provider work.
- Medium - Sidecar provider voice timeouts do not cancel losing provider calls.
- Medium - Council completion/fallback semantics still need tighter user-facing distinction between consensus, single-voice fallback, synthesis failure, and partial provider failure.
- Medium - Per-provider buttons in Settings still run the full setup diagnostics path; they change only the scope label.
- Medium - Release packaging still depends on ignored/local sidecar runtime and dependency artifacts being present and current.
- Medium - macOS release remains a separate platform-dependent path; signing/notarization and macOS keychain behavior still need macOS-hosted verification.
- Low - Production build still carries starter Vite/Tauri branding assets.
- Low - Cargo metadata still contains starter placeholders.
- Low - Settings version display is still separately hard-coded from package/release metadata.
- Low - The `/` shortcut smoke test still does not actually press `/` or assert focus movement.
- Low - Command palette still lacks dedicated E2E coverage for open/filter/select/close behavior.
- Low - Bookmark/tag cleanup and stale link hygiene remain worth tightening around destructive/import flows.
- Low - Save/export flows still need overwrite/extension/cancel-path polish.
- Low - Clipboard exports remain convenience paths with less durability than file exports.
- Low - Guided tour dialog still needs stronger focus placement/trapping/restoration coverage.
- Low - Rust `reqwest` is still configured without default TLS features; acceptable for current localhost/Ollama Rust HTTP use, but risky if Rust later calls HTTPS.
- Low - Default AI model IDs should be reconfirmed against provider documentation before a public release.

## Positive Confirmations From This Pass

- Tauri permissions and CSP are generally conservative for a local desktop app.
- SQLite restore validates source DB integrity and schema version before copying.
- JSON backup import/export secret handling is covered by selected Rust tests.
- Workspace/theology text export redaction has tests for provider-key assignments and local paths.
- The Rust sidecar transport wrapper uses `kill_on_drop(true)` and discards the sidecar on transport/protocol timeout.
- Current public release gate fails for the right reason: real Council QA passes, but manual clean-profile/credential-vault evidence is still the incomplete template.

## Verification Run

- `npm run build` from `app/` - passed. Vite built 97 modules.
- `npm run test:sidecar` from `app/` - passed, 66/66 tests.
- `cargo test --manifest-path .\app\src-tauri\Cargo.toml sqlite_restore_tests --lib` - passed, 2/2 selected tests.
- `cargo test --manifest-path .\app\src-tauri\Cargo.toml secret --lib` - passed, 7/7 selected tests.
- `cargo test --manifest-path .\app\src-tauri\Cargo.toml app_settings --lib` - passed, 8/8 selected tests.
- `npm run qa:public-release:verify` from `app/` - failed as expected because `app/release/manual-release-gates.json` is still the incomplete template. The Real Council QA subcheck passed first with 20 results and `gemini=20`, `openai=20`.

Not run in this pass: full `npm run check`, full Tauri build, full E2E suite, installer smoke tests, or macOS release checks.

## Suggested Next Order

1. Add post-SQLite-restore legacy secret migration/cleanup and a restore-specific regression test.
2. Fix provider readiness semantics so summaries count verified checks, not optimistic/configured manifest entries.
3. Decide whether provider test buttons save first or clearly remain draft-only, then cover that behavior in E2E.
4. Continue release hardening: artifact-bound manual evidence, third-party notices/SBOM, starter asset cleanup, Cargo metadata, and version single-sourcing.
