# Bible AI Deep Review Findings - 2026-06-11 19:19:42 +01:00

Scope: another read-only review pass over the current Bible AI app state. This pass focused on app shell shortcuts, onboarding/keyboard behavior, provider settings and credential handling, backup/import/restore refresh paths, and public-release gate scripts.

No app code was changed. The worktree already had `app/src-tauri/Cargo.toml` modified before this pass; I did not change or revert it. This report is the only intentional new artifact from this pass.

## Current State

- Stack remains Tauri 2 + React 19 + Vite 7 + Rust backend + SQLite + bundled Node sidecar.
- `Ctrl/Cmd+K` is implemented globally in `app/src/App.tsx:741` and opens the command palette.
- `/` search focus is implemented in `app/src/features/search/SearchInput.tsx:13` and `app/src/features/search/SearchInput.tsx:16`.
- Provider credentials are now on a much stronger path than earlier reviews: the Rust bridge reads/writes OS credential vault entries, settings save paths strip secret settings from SQLite, legacy secret settings are migrated out, and the sidecar redaction tests cover nested provider secrets.
- Current public-release evidence is still the blank template in `app/release/manual-release-gates.json`; this correctly blocks the public-release gate today.

## New Findings

### 1. Medium - JSON import and SQLite restore leave Settings module/resource state stale until remount

`SettingsPanel` loads installed modules, module topics, and resource sources through `refreshModules()` in `app/src/features/settings/SettingsPanel.tsx:101`, which calls `listModules()`, `listModuleTopics()`, and `listResourceSources()` at `app/src/features/settings/SettingsPanel.tsx:108`.

The JSON import path calls `importUserDataJson()` and then only invokes `onUserDataChanged?.()` at `app/src/features/settings/SettingsPanel.tsx:210` and `app/src/features/settings/SettingsPanel.tsx:219`. The SQLite restore path does the same at `app/src/features/settings/SettingsPanel.tsx:240` and `app/src/features/settings/SettingsPanel.tsx:247`.

The parent callback `refreshUserDataAndNavigation()` only refreshes active chapter data and navigation lists in `app/src/App.tsx:468`. It does not refresh `SettingsPanel`'s own `resourceSources`, `installedModules`, or `moduleTopics` state. Module-specific install/import/uninstall actions do call `refreshModules()` later in `SettingsPanel`, but backup import and SQLite restore do not.

Impact: a user can paste/import resource or module data, see a success status, and still see stale Data Sources, Installed Modules, or Topic Browser content in the same Settings view until the panel remounts or another module action refreshes it. Existing E2E coverage does not catch this because the backup/resource flow navigates away and back before checking resource UI.

Recommendation: after successful JSON import and SQLite restore, call `await refreshModules()` before or alongside `onUserDataChanged?.()`. Add an E2E assertion that imports resource/module data and checks the Settings Data Sources view without leaving Settings first.

### 2. Medium - Public-release manual QA evidence is not bound to the current release artifact hashes

`app/scripts/verify-public-release-gate.mjs:19` selects the real Council fixture and manual evidence file, then runs only `verify-real-council-qa.mjs` and `verify-manual-release-gates.mjs` at `app/scripts/verify-public-release-gate.mjs:26` and `app/scripts/verify-public-release-gate.mjs:33`.

`verify-manual-release-gates.mjs` requires operator, date, profile, required boolean flags, and a non-empty `installer_artifacts` array at `app/scripts/verify-manual-release-gates.mjs:4` and `app/scripts/verify-manual-release-gates.mjs:33`. It does not verify that those installer entries exist, match the expected NSIS/MSI names, or match `release-manifest.json` byte counts and SHA-256 hashes.

There is a stronger manual QA package verifier: `app/scripts/verify-manual-release-qa-package.mjs:42` verifies installer artifacts from the release manifest, and `app/scripts/verify-manual-release-qa-package.mjs:81` compares SHA-256. However, that package verifier is separate from `qa:public-release:verify`, and the final manual evidence file can still be stale, hand-edited, or copied forward from a different release without the public gate detecting artifact identity drift.

Impact: after the current template evidence is filled in, the public release gate can prove that someone checked required boxes, but not that the manually tested installers are the exact current release installers.

Recommendation: extend manual evidence with release manifest hash, installer names, byte counts, and SHA-256 values copied from the manifest. Have `verify-manual-release-gates.mjs` compare them against the current `release-manifest.json`, or make `qa:public-release:verify` require a verified manual QA package plus matching final evidence.

### 3. Low - The `/` shortcut smoke test does not exercise the shortcut

The runtime shortcut exists in `SearchInput`: it ignores existing form controls and focuses the search input on `/`.

The E2E test named `has a search input focusable via the \`/\` shortcut` in `app/tests/e2e/smoke.spec.ts:144` only asserts that the search input is displayed. It never presses `/` and never asserts that focus moved to the input. A repository-wide E2E search found keyboard tests in other specs, but no command-palette-specific E2E coverage and no actual `/` keypress for this smoke case.

Impact: this is a coverage gap, not an observed runtime bug. The app could regress the search shortcut while the named smoke test still passes.

Recommendation: update the smoke test to focus a neutral element or blur active focus, send `browser.keys("/")`, then assert `document.activeElement` is the search input. Add a small command palette E2E check for `Ctrl+K`/`Meta+K`, input filtering, Enter selection, and Escape close.

## Reconfirmed Open Findings

- Medium - Public release artifacts still lack a complete third-party runtime/dependency notice or SBOM gate for bundled Node, sidecar npm packages, native modules, and upstream license texts.
- Low - Production build still references the Vite favicon in `app/index.html:5`; previous build inspection also found starter `vite.svg`/`tauri.svg` artifacts in `dist`.
- Low - Cargo metadata still contains starter placeholders in `app/src-tauri/Cargo.toml:4` and `app/src-tauri/Cargo.toml:5`.
- Low - Settings version display remains separately hard-coded from release/package metadata.
- Medium - Resource import still bypasses the source-assessment/attribution gate used by the curated resource pipeline.
- Medium - User import/restore still lacks clear size and row-count budgets before parsing/writing large JSON payloads.
- Medium - Council frontend timeout does not cancel backend sidecar/provider work.
- Medium - Sidecar provider voice timeouts do not cancel losing provider calls.
- Medium - Council "complete" session semantics and fallback/mode reporting still need tightening around partial provider failures.
- Medium - Per-provider buttons in Settings still run the full setup diagnostics path. `runChecks(scope)` always calls `checkAppSetup(draft)` at `app/src/features/settings/SettingsPanel.tsx:163`, while buttons such as Test Anthropic/Google/OpenAI/Gateway/Ollama only change the scope label at `app/src/features/settings/SettingsPanel.tsx:769`.
- Medium - Release packaging still depends on ignored/local sidecar runtime and dependency artifacts being present and current.
- Medium - macOS release remains a separate, platform-dependent release path; signing/notarization and keychain behavior still need macOS-hosted verification before public distribution.
- Low - Bookmark tag cleanup and stale tag-link hygiene remain worth tightening after destructive bookmark/import flows.
- Low - Save/export flows still need overwrite/extension/cancel-path polish.
- Low - Clipboard export remains a convenience path without the same durability as file export.
- Low - Guided tour dialog still needs stronger focus placement/trapping/restoration coverage.
- Low - `reqwest` is still configured without default TLS features in `app/src-tauri/Cargo.toml:26`; acceptable for current localhost/Ollama-only Rust HTTP usage, but risky if Rust code later calls HTTPS.
- Low - Default AI model IDs should be reconfirmed against current provider docs before public release.

## Positive Confirmations From This Pass

- `npm run qa:public-release:verify` currently fails for the right reason: real Council QA passes, but the manual clean-profile/credential-vault evidence file is still incomplete.
- Real Council QA fixture gate passed with 20 results and two non-mock providers reported in the command output: `gemini=20`, `openai=20`.
- Credential persistence has good defensive behavior: missing secret fields do not delete existing vault entries, imported app settings skip secrets, and secret settings are removed from SQLite after migration/save paths.
- Sidecar diagnostics redaction is tested for nested configured provider secrets.
- Manual QA package verification already has byte and SHA-256 checks for packaged installers; the remaining gap is tying that integrity proof into the final public-release evidence gate.

## Verification Run

- `npm run build` from `app/` - passed. Vite built 97 modules.
- `npm run test:sidecar` from `app/` - passed, 66/66 tests.
- `cargo test --manifest-path .\app\src-tauri\Cargo.toml credential --lib` - passed, 1/1 selected test.
- `cargo test --manifest-path .\app\src-tauri\Cargo.toml user_data_import --lib` - passed, 10/10 selected tests.
- `npm run qa:public-release:verify` from `app/` - failed as expected because `app/release/manual-release-gates.json` is still the incomplete template. The Real Council QA subcheck passed first.

Not run in this pass: full `npm run check`, full Tauri build, full E2E suite, installer smoke tests, or macOS release checks.

## Suggested Next Order

1. Fix the Settings import/restore stale refresh path and add the immediate in-panel E2E assertion.
2. Bind manual public-release evidence to current installer hashes and release manifest identity.
3. Add real keyboard shortcut assertions for `/` and command palette behavior.
4. Continue the public-release hardening backlog: third-party notices/SBOM, starter asset cleanup, Cargo metadata, and release version single-sourcing.
