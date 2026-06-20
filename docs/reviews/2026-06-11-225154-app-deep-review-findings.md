# Bible AI deep review findings - 2026-06-11 22:51:54 +01:00

Filename timestamp: 2026-06-11-225154

Review window: 2026-06-11 22:51:54 to 2026-06-11 22:59:30 +01:00.

Workspace: `C:\JM Programs\BibleApp`

Worktree note: `app/src-tauri/Cargo.toml` was already modified before this pass and was not touched. `docs/reviews/` is untracked and contains the review reports.

## Scope covered

- App shell, navigation state, shortcuts, destructive controls, accessibility affordances.
- Settings, provider setup state, local Claude Code path, credential/privacy messaging.
- Backend command input validation, backup import/restore, workspace export redaction.
- Release gates, manual QA scripts, release manifests, resource fixtures.
- Test inventory and targeted verification.

## Findings

### 1. Release blocker: public release gate is still blocked by template manual QA evidence

Severity: High

Evidence:

- `app/scripts/verify-public-release-gate.mjs:19` uses `release/manual-release-gates.json` as the default manual evidence path.
- `app/scripts/verify-public-release-gate.mjs:32-33` runs `verify-manual-release-gates.mjs` as the manual clean-profile and credential-vault gate.
- `app/release/manual-release-gates.json:2` has an empty `operator`.
- `app/release/manual-release-gates.json:5` has an empty `installer_artifacts` array.
- `app/release/manual-release-gates.json:6-13` keeps every required manual gate boolean at `false`.
- Verification on this pass: `npm run qa:public-release:verify` passed Real Council QA for 20 results, then failed the manual gate with missing operator/profile, empty installer artifacts, and all required manual booleans false.

Impact:

The app is not currently release-ready through its own public release gate. The real Council evidence fixture is present and passes, but the clean-profile manual evidence has not been collected.

Recommendation:

Run the clean Windows profile or VM manual QA package, replace `app/release/manual-release-gates.json` with real evidence, and rerun `npm run qa:public-release:verify`. Do not treat the current file as anything other than a template.

### 2. Backup import and workspace payload paths do not enforce size budgets

Severity: Medium

Evidence:

- `app/src/features/settings/SettingsPanel.tsx:214-215` parses the entire pasted backup JSON and sends it to `importUserDataJson`.
- `app/src-tauri/src/lib.rs:1841-1849` forwards the parsed `serde_json::Value` to `user_db::import_user_data`.
- `app/src-tauri/src/user_db.rs:7469-7490` validates export version, schema version, and top-level tables shape, but not payload size, table row count, or field length.
- `app/src-tauri/src/user_db.rs:8035` starts `normalize_required_import_text`; the helper trims and requires non-empty text, but does not cap length.
- `app/src-tauri/src/user_db.rs:8128` starts `normalize_json_import_text`; it validates JSON shape, but does not cap serialized JSON size or nesting.
- `app/src-tauri/src/lib.rs:1170-1178` serializes workspace item payloads directly with no payload-size cap.
- `app/src-tauri/src/lib.rs:1106-1118` only requires non-empty workspace titles, with no length cap.
- `app/src-tauri/src/lib.rs:1873-1894` only rejects empty workspace Markdown before writing it, with no output-size budget.

Impact:

A pasted or invoked oversized backup, workspace payload, module/resource body, or export can consume memory, lock the UI/backend during JSON parse or SQLite writes, bloat the local database, and make later search/export flows slow. This is local availability/resilience risk, not a remote exploit in the current desktop model.

Recommendation:

Add explicit limits: maximum pasted backup JSON size in the UI, maximum total import bytes, maximum rows per table, maximum text/json field lengths by table, maximum workspace title/payload/export sizes, and tests that oversized imports fail transactionally.

### 3. Manual QA package can self-assert most gates without per-step artifacts

Severity: Medium

Evidence:

- `app/scripts/package-manual-release-qa.mjs:76` creates `RUN-MANUAL-QA.ps1` with a `-MarkChecklistPassed` switch.
- `app/scripts/package-manual-release-qa.mjs:98-110` then passes all manual checklist switches to `collect-manual-release-gates.ps1` when that switch is present.
- `app/scripts/collect-manual-release-gates.ps1:123-130` writes most gates from boolean switches.
- `app/scripts/collect-manual-release-gates.ps1:126` is the main independently measured gate, derived from credential target count and SQLite sensitive-string scan.
- `app/scripts/verify-manual-release-gates.mjs:6-14` requires booleans to be true, and `app/scripts/verify-manual-release-gates.mjs:21-34` checks operator/date/profile/installers, but it does not require per-step logs, screenshots, export scan artifacts, or installer execution transcripts.

Impact:

Once real evidence is collected, the verifier will prove that the booleans are present and true, but not that every manual checklist step has durable supporting artifacts. That leaves too much release confidence resting on operator declaration.

Recommendation:

Require a small evidence bundle: installer hashes actually tested, command transcript hash, export leak-scan output, backup/restore output, SQLite restore output, provider test output with secrets redacted, and optional screenshot names/hashes. Keep credential values out of evidence.

### 4. Main navigation active state is visual only

Severity: Low

Evidence:

- `app/src/App.tsx:969-1005` renders the main navigation as a `nav` containing `ModeButton` controls.
- `app/src/features/app-shell/ModeButton.tsx:1-22` accepts `active`, but only uses it for CSS classes.
- No `aria-current`, `aria-pressed`, or equivalent semantic active-state attribute is emitted by `ModeButton`.

Impact:

Screen reader users can traverse the main mode buttons but cannot reliably tell which app mode is currently active from semantics alone.

Recommendation:

Add either `aria-current="page"` for the active navigation item or `aria-pressed={active}` if these remain toggle-like buttons. Add a WDIO assertion for the active mode state.

### 5. Provider setup completion ignores a working local Claude Code provider path

Severity: Low

Evidence:

- `app/src/lib/settings.ts:3-9` defines `settingsHasConfiguredAi` as API key or managed gateway URL presence only.
- `app/src/App.tsx:726` uses that helper for `providerSetupComplete`.
- `app/src/App.tsx:1044` shows the "Connect AI when ready" prompt from that app-level completion state.
- `app/sidecar/providers/claude.mjs:154-162` treats Claude Code as available without an API key unless `DISABLE_CLAUDE_VOICE=1`.
- `app/sidecar/providers/index.mjs:24-35` already has a provider manifest that can surface provider availability.
- `app/tests/e2e/release-readiness.spec.ts:20` expects Settings to describe the local/no-hosted-key provider path.

Impact:

A user who can run local Claude Code with no hosted API key may still see setup nudges that imply AI is not connected. The Settings copy and sidecar behavior say local Claude Code is a valid path; the app-level completion heuristic does not.

Recommendation:

Base provider setup completion on diagnostics or the provider manifest, or track "local provider path acknowledged" separately from API-key configuration.

### 6. Shortcut behavior claims are under-tested

Severity: Low

Evidence:

- `app/src/features/search/SearchInput.tsx:14` implements `/` to focus search outside form controls.
- `app/tests/e2e/smoke.spec.ts:144-147` names the test "has a search input focusable via the `/` shortcut", but only asserts that the search input is displayed.
- `app/src/App.tsx:923-925` exposes the command palette button and "Ctrl K" label.
- The current E2E search found no `browser.keys("/")` call and no command-palette keyboard spec.

Impact:

Keyboard regressions in two advertised global shortcuts could slip through despite the test names and UI copy suggesting coverage.

Recommendation:

Add WDIO coverage that focuses a neutral page element, presses `/`, asserts search focus, presses Ctrl/Cmd+K, asserts the command palette dialog opens, uses arrows/Enter, and verifies Escape/focus behavior.

### 7. Release directory manifest entries still lack deterministic content hashes

Severity: Low

Evidence:

- `app/scripts/create-release-manifest.mjs:21-32` records directory artifacts for `sidecar/providers` and `sidecar/node_modules`.
- `app/scripts/create-release-manifest.mjs:84-91` summarizes directories by file count and bytes only.
- `app/scripts/verify-release-manifest.mjs:140-170` verifies directory path, file count, and byte count only.
- Individual file artifacts do get SHA-256 hashes in `app/scripts/create-release-manifest.mjs:72-76` and are rehashed in `app/scripts/verify-release-manifest.mjs:114-134`.

Impact:

Two directory trees can theoretically change content while preserving total file count and byte count. That is unlikely by accident, but it is weaker than the file artifact guarantees and weaker than expected release provenance for bundled provider/dependency trees.

Recommendation:

Add a deterministic tree hash over relative path, byte length, and SHA-256 for every file in each directory artifact, and verify it in both Windows and macOS manifest checks.

### 8. Resource import fixtures advertise an older schema version

Severity: Low

Evidence:

- `app/src-tauri/src/user_db.rs:13` sets `USER_SCHEMA_VERSION` to `14`.
- `app/tests/fixtures/resources/public-domain-creeds-import.json:4` has `user_schema_version: 12`.
- `app/tests/fixtures/resources/sefaria-style-import.json:4` has `user_schema_version: 12`.
- Verification on this pass: `npm run resources:fixture:test` passed, so the fixtures are still usable, but they are not schema-current examples.

Impact:

The importer intentionally accepts older backups, so this is not breaking. It does mean resource fixture coverage is partly exercising backward compatibility rather than current export shape.

Recommendation:

Regenerate the resource import fixtures at schema 14, or add a separate explicit backward-compatibility fixture and keep the main resource workflow fixture current.

### 9. Several destructive user-data controls still execute immediately

Severity: Low

Evidence:

- Saved-search delete is wired directly through `app/src/features/app-shell/NavigationShortcuts.tsx:191-205` and `app/src/App.tsx:1285-1289`.
- Workspace delete is wired through `app/src/features/workspaces/WorkspacesPanel.tsx:477-489`.
- Workspace item delete is wired through `app/src/features/workspaces/WorkspacesPanel.tsx:585-588` and `app/src/features/workspaces/WorkspaceItem.tsx:184-190`.
- A repo search found no `window.confirm` or equivalent app-level confirmation in the app source for these paths. SQLite restore is better: it has a confirm flow and E2E coverage.

Impact:

Accidental clicks can delete saved searches, workspaces, or workspace items with no undo, archive-first, or confirmation step. Workspaces are user-authored study data, so the cost of a misclick is higher than for transient UI state.

Recommendation:

Add an undo toast or a small confirm step for destructive workspace/saved-search actions. Prefer undo for speed, confirm for whole-workspace deletion.

## Positive confirmations

- Build and tests are healthy for the targeted checks run in this pass.
- Rust command input validation is much stronger than earlier states: bounded limits, verse/book/chapter validation, settings normalization, module key normalization, restore-source schema checks, and transactional import rejection tests are all present.
- Workspace Markdown redaction is applied to the final document at `app/src/features/workspaces/workspaceMarkdown.ts:114`, with string/object redaction helpers at `app/src/features/workspaces/workspaceMarkdown.ts:392-416`.
- Workspace redaction has E2E coverage with deliberate fake secrets and a Windows path at `app/tests/e2e/workspace.spec.ts:132-181`.
- JSON backup export redacts provider settings and broad secret-like app settings, covered by `app/tests/e2e/release-readiness.spec.ts:50` and Rust tests such as `app/src-tauri/src/user_db.rs:5099`.
- Theology Markdown export redacts secret assignments and local paths, covered by `app/src-tauri/src/user_db.rs:5168` and related export tests.
- Legacy SQLite provider secrets are vacuumed from the database file by `delete_secret_settings`, covered by `app/src-tauri/src/user_db.rs:3769`.
- Settings module/resource refresh now reloads modules, topics, and resource sources together after module changes.
- SQLite restore validates quick_check, requires an app_settings table, rejects newer schema versions, protects against restoring the active DB over itself, and creates a safety backup before replacement.
- The real Council QA fixture is present and passed the public gate's real-Council verification step with 20 results and both Gemini/OpenAI provider evidence.
- Current visible automated coverage inventory: 67 E2E `it(...)` cases, 66 sidecar Node tests, and 93 Rust unit tests.

## Verification run

Commands run on 2026-06-11:

- `npm run build` in `app`: passed. Vite built 97 modules.
- `cargo test --manifest-path .\src-tauri\Cargo.toml --lib` in `app`: passed, 93 tests.
- `npm run test:sidecar` in `app`: passed, 66 tests.
- `npm run resources:fixture:test` in `app`: passed.
- `npm audit --omit=dev` in `app`: passed, 0 vulnerabilities.
- `npm audit --omit=dev` in `app/sidecar`: passed, 0 vulnerabilities.
- `npm run qa:public-release:verify` in `app`: failed as expected because manual clean-profile evidence is still the blank template. Real Council QA passed first.

## Suggested next work order

1. Replace the manual release gate template with real clean-profile evidence and rerun `npm run qa:public-release:verify`.
2. Add import/payload/export size budgets and transactionally tested oversize rejection.
3. Add semantic active state to `ModeButton` and WDIO coverage for active navigation.
4. Align provider setup completion with the local Claude Code availability path.
5. Strengthen manual QA evidence and release directory tree hashes.
6. Add shortcut E2E tests and destructive-action undo/confirmation.
7. Regenerate schema-current resource import fixtures.
