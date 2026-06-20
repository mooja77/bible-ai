# Bible AI Deep Review Findings - 2026-06-11 16:36:56 +01:00

Filename timestamp: `2026-06-11-163656`.

Scope: another set of read-only review passes over the current app state, focused on IPC/input validation, dependency and packaging posture, frontend resilience, corpus/search consistency, and Council retrieval behavior. No app code was changed in this pass.

Previous baseline report: `docs/reviews/2026-06-11-162801-app-deep-review-findings.md`.

## Current State Summary

- App stack: Tauri 2 desktop app, React 19, Vite 7, Tailwind 4, Rust backend, and a bundled Node sidecar.
- Main package scripts and verification surface are broad: `app/package.json` includes `build`, `check`, `test:sidecar`, E2E, release, macOS release, and QA scripts.
- Tauri bundle resources include `data/corpus.sqlite`, sidecar entrypoints, sidecar provider files, sidecar package metadata, `sidecar/node`, and `sidecar/node_modules`: `app/src-tauri/tauri.conf.json`.
- Current working tree had a pre-existing modified `app/src-tauri/Cargo.toml`; this review did not touch it.

## Positive Confirmations From This Pass

1. IPC registration parity is clean.
   - Static scan found 104 `#[tauri::command]` functions and 104 registered handlers.
   - Handler block: `app/src-tauri/src/lib.rs:3978-4089`.

2. Backend input normalization is stronger than it was earlier in the project.
   - Shared guards cover limits, book/chapter/verse IDs, verse ranges, colors, module keys, Strong's codes, testament filters, app settings, and URL settings: `app/src-tauri/src/lib.rs:52-163`, `app/src-tauri/src/lib.rs:228-240`, `app/src-tauri/src/lib.rs:315-325`.
   - File writes mostly go to app-controlled backup/export directories or validate absolute Markdown output paths with extension and parent checks: `app/src-tauri/src/lib.rs:1853-2043`, `app/src-tauri/src/lib.rs:2204-2227`.
   - JSON import validates top-level version/table shape and normalizes rows inside an immediate transaction: `app/src-tauri/src/user_db.rs:7448-7892`.

3. Dependency audit is clean for npm packages.
   - `npm audit --json` in `app`: 0 vulnerabilities.
   - `npm audit --json` in `app/sidecar`: 0 vulnerabilities.

4. The frontend has real fault-containment primitives.
   - Root and per-view error boundaries are mounted: `app/src/main.tsx`, `app/src/App.tsx:1335-1578`.
   - `GlobalErrorNotice` listens for uncaught errors and unhandled promise rejections, filters benign ResizeObserver noise, and auto-dismisses: `app/src/components/GlobalErrorNotice.tsx`.
   - There is an E2E test for the global error notice: `app/tests/e2e/global-error-notice.spec.ts`.

5. Scripture search has an explicit semantic-degradation path and test coverage.
   - Backend degrades semantic search to keyword for "all translations", missing embeddings, or Ollama failure: `app/src-tauri/src/lib.rs:841-924`.
   - UI displays the degradation notice: `app/src/features/search/SearchResults.tsx:213-218`.
   - E2E forces WEB semantic search and verifies the degraded notice/results: `app/tests/e2e/search-semantic.spec.ts`.

6. Bundled corpus did not contain personal data in the user-style tables I checked.
   - `app_settings`, bookmarks, reading history, saved searches, workspaces, study items, highlights, notes, Council sessions, and Council turns were all empty in `data/corpus.sqlite`.

## Corpus Inventory

Read-only query target: `data/corpus.sqlite`.

- Size: 676,241,408 bytes.
- `PRAGMA user_version`: 0.
- Canonical books: 66.
- Canonical verse rows: 32,194.
- Translation text rows:
  - ASV: 31,086.
  - KJV: 31,100.
  - TR: 7,957.
  - WEB: 31,098.
  - WLC: 23,213.
  - YLT: 31,102.
- FTS rows: 155,556.
- Embeddings, all `nomic-embed-text`, dimension 768:
  - ASV: 31,086.
  - KJV: 31,100.
  - TR: 7,957.
  - WLC: 23,213.
  - YLT: 31,102.
  - WEB: none.
- Word tokens:
  - WLC only: 306,785 token rows, 300,007 rows with Strong's values.
- Strong's dictionary rows: 14,197.
- Cross references: 344,799.
- Bundled `modules` table: 0 rows.

## New Or Updated Findings

### R05-F01 - Medium - Council semantic-only retrieval does not fall back to FTS

The comments around Council retrieval say semantic retrieval falls back to FTS when unavailable, but the implementation only enables FTS for `keyword` or `hybrid`.

Evidence:

- Contract/comment: `app/src-tauri/src/lib.rs:2402-2405`, `app/src-tauri/src/lib.rs:3236-3241`.
- UI exposes semantic-only Council mode: `app/src/features/council/CouncilPanel.tsx:475-479`.
- Backend sets `use_semantic` for semantic/hybrid but `use_fts` only for keyword/hybrid: `app/src-tauri/src/lib.rs:3250-3252`.
- If embeddings are missing or Ollama fails in semantic-only mode, `semantic_rows` is empty, `fts_rows` is empty, and the command can return `no evidence found: retrieval produced no hits`: `app/src-tauri/src/lib.rs:3274-3310`, `app/src-tauri/src/lib.rs:3345-3346`.
- Existing Council E2E specs force keyword or hybrid and do not cover semantic-only fallback: `app/tests/e2e/council-error.spec.ts`, `app/tests/e2e/council-mock.spec.ts`.

Impact: Users who choose "Search: by meaning" can get a hard Council failure even when keyword evidence exists. This is inconsistent with scripture search, which degrades semantic failures to keyword and shows a notice.

Suggested fix: Decide the desired contract. If semantic-only should still degrade, set `use_fts` when `use_semantic` is unavailable or fails, return a degradation reason, and add a Council E2E/unit regression. If semantic-only should be strict, update comments and UI copy.

### R05-F02 - Low/Medium - Council retrieval mode can overstate "hybrid" for explicit-reference questions

The retrieval mode classification reports `explicit+hybrid` whenever explicit references are present and cross-reference expansion is not present, regardless of whether semantic or FTS rows were actually included.

Evidence:

- Mode match returns `explicit+hybrid` for `(true, _, _, false)`: `app/src-tauri/src/lib.rs:3437-3448`.
- UI maps `explicit+hybrid` to "explicit reference + hybrid": `app/src/features/council/CouncilPanel.tsx:345-355`.
- The mock E2E expects "explicit reference + hybrid" for an explicit passage query: `app/tests/e2e/council-mock.spec.ts:1-35`.

Impact: The Council audit trail can claim hybrid retrieval even when the evidence may have come only from explicit references, or from explicit references plus keyword. That weakens retrieval transparency.

Suggested fix: Classify explicit rows independently, for example `explicit`, `explicit+fts`, `explicit+semantic`, `explicit+hybrid`, and only use "hybrid" when both semantic and keyword paths contributed.

### R05-F03 - Low/Medium - Ollama host accepts HTTPS, but Rust reqwest is built without a TLS backend

The settings UI and backend validators accept `https://` for `ollama_host`, but Rust `reqwest` is configured with `default-features = false` and only `json`; no TLS feature appears in the current feature graph.

Evidence:

- `reqwest = { version = "0.12", default-features = false, features = ["json"] }`: `app/src-tauri/Cargo.toml:26`.
- Frontend URL validation accepts `http:` or `https:`: `app/src/lib/settings.ts:12-20`.
- Ollama host field tells users to enter `http(s)://`: `app/src/features/settings/SettingsPanel.tsx:633-645`.
- Backend URL normalization accepts both HTTP and HTTPS: `app/src-tauri/src/lib.rs:228-240`, `app/src-tauri/src/lib.rs:315-325`.
- Rust Ollama calls use reqwest in `check_ollama` and embeddings: `app/src-tauri/src/lib.rs:1064-1088`, `app/src-tauri/src/ollama.rs:38-69`.

Impact: HTTPS Ollama endpoints can pass validation and then fail at runtime. Most local Ollama installs use HTTP, so this is not a default-path blocker.

Suggested fix: Either enable a TLS feature such as `rustls-tls` for reqwest, or narrow validation/UI copy for `ollama_host` to HTTP only.

### R05-F04 - Low - Clipboard error handling is inconsistent

Some copy flows catch Clipboard API failures and show local status, while others await or call `navigator.clipboard.writeText` without `try/catch`.

Handled examples:

- Resource import docs path handles failure: `app/src/features/resources/ResourcesPanel.tsx:122-130`.
- Settings backup copy handles failure: `app/src/features/settings/SettingsPanel.tsx:182-193`.
- Council markdown/source copy handles failure: `app/src/features/council/CouncilMarkdownExport.tsx`, `app/src/features/council/CouncilSourceDrawer.tsx`.

Unhandled examples:

- Reader range copy: `app/src/features/reader/ChapterReader.tsx:541`.
- Workspace item copy handlers: `app/src/features/workspaces/WorkspaceItem.tsx:243`, `app/src/features/workspaces/WorkspaceItem.tsx:297`, `app/src/features/workspaces/WorkspaceItem.tsx:343`, `app/src/features/workspaces/WorkspaceItem.tsx:404`, `app/src/features/workspaces/WorkspaceItem.tsx:454`.
- Workspace Markdown copy: `app/src/features/workspaces/WorkspacesPanel.tsx:198-203`.
- Theology Markdown copy: `app/src/features/theology/TheologyPanel.tsx:408-428`.

Impact: Clipboard-denied WebView/browser contexts can produce unhandled rejections or a global "Unexpected error" toast for normal user actions.

Suggested fix: Centralize a `copyToClipboard` helper that returns `{ ok, error }` and update all copy buttons to show local copy failed status.

### R05-F05 - Low - Guided tour modal lacks visible focus management

The command palette focuses its input on mount, but the guided tour modal is declared as `aria-modal="true"` without an obvious initial-focus move, focus trap, or focus restoration.

Evidence:

- Command palette focuses input: `app/src/features/app-shell/CommandPalette.tsx`.
- Guided tour modal has `role="dialog"` and `aria-modal="true"` but keyboard handling is global and the rendered dialog does not visibly receive focus on open: `app/src/features/onboarding/GuidedTour.tsx:141-183`.

Impact: Keyboard and screen-reader users can lose context or tab into background UI while the modal is open.

Suggested fix: Move focus to the modal or first useful control on open, trap Tab while open, and restore focus to the launcher on close.

### R05-F06 - Low - Corpus/schema versioning remains confusing

The shipped corpus has `PRAGMA user_version = 0`, contains empty user-style tables, and `data/schema.sql` says its user schema mirrors v12, while runtime user schema is v14.

Evidence:

- Corpus query showed `user_version = 0` and empty user-style tables.
- `data/schema.sql` says it mirrors current v12 shape: `data/schema.sql:313`.
- Runtime `USER_SCHEMA_VERSION` is 14: `app/src-tauri/src/user_db.rs:13`.
- Resource import generator still stamps `user_schema_version: 13`: `app/scripts/resources/import-resource-jsonl.mjs:74-76`.

Impact: This increases the chance that ingestion tools, fixture generation, and developer docs drift away from the actual runtime backup/import schema.

Suggested fix: Split corpus-only schema documentation from runtime user schema, or generate schema docs from `user_db.rs`/migrations. Update resource import output to schema 14.

## Carried-Forward Active Findings

These remain active from the prior report unless noted above.

1. macOS keyring backend is not enabled in Cargo features.
   - `keyring` is configured with `windows-native` only, so macOS credential storage is likely broken until `apple-native` is enabled for macOS builds.

2. Resource source metadata and JSON backups can expose local source paths or source metadata.
   - Settings Data Sources and exported user data can preserve source/path details that may be sensitive.

3. Resource import generator schema version is stale.
   - Runtime schema is 14, but `app/scripts/resources/import-resource-jsonl.mjs` emits 13.

4. Note tags can be attached before the note exists.
   - The note tab can render tag controls against a verse even before a note row has been saved.

5. Deleting a verse note can leave note tag links behind.
   - Bookmark deletion clears its item tags, but note deletion did not have the same confirmed cleanup path in the previous pass.

6. Tag counts and tag browser items can disagree.
   - `list_tags_with_counts` counts only browsable bookmark/note joins, while raw item tag listing can still expose orphaned links.

7. `data/schema.sql` is stale relative to runtime schema.
   - It still declares v12-era user schema and does not include the current tags/item_tags shape.

8. JSON import and SQLite restore refresh only part of the frontend state.
   - Settings calls `onUserDataChanged`, but several in-memory feature states can remain stale until navigation/reload.

9. Council client timeout does not cancel backend/provider work.
   - The UI timeout resolves the user-facing state but does not propagate cancellation to the backend sidecar/provider operation.

10. Theology links can become stale after linked objects are deleted.
    - Linked verses/resources/workspace items can be removed without a confirmed cascade or cleanup of theology links.

11. SQLite restore accepts a very small Bible AI-shaped database.
    - Validation checks `quick_check`, `app_settings`, and non-newer `user_version`, but not the full expected schema.

12. SQLite restore accepts raw path text.
    - The backend validates the path, but the UI path-entry workflow remains easier to misuse than a native file picker.

13. Windows install/release guidance still has sidecar dependency gaps.
    - The release bundle depends on sidecar runtime artifacts that are easy to miss when preparing a clean package.

14. Release builds depend on ignored local artifacts.
    - `tauri.conf.json` bundles `sidecar/node` and `sidecar/node_modules`; those must exist locally but are not normal source files.

15. Tag command contract is wider than implemented behavior.
    - Backend command accepts item types beyond the UI's effective bookmark/note browsing model.

16. Council readiness can be optimistic.
    - Provider setup/readiness can look acceptable before all selected routes are actually usable.

17. Clipboard handling remains inconsistent.
    - Updated in this pass as R05-F04 with exact current references.

## Verification Performed In This Pass

- `npm audit --json` in `app`: passed, 0 vulnerabilities.
- `npm audit --json` in `app/sidecar`: passed, 0 vulnerabilities.
- `cargo tree --manifest-path app/src-tauri/Cargo.toml -d`: completed; duplicate transitive deps are mostly expected through Tauri/windows stacks.
- `cargo tree --manifest-path app/src-tauri/Cargo.toml -e features`: inspected reqwest/keyring-related features.
- Read-only SQLite corpus inventory via Python `sqlite3` because the `sqlite3` CLI is not installed.
- Static frontend/backend passes with `rg` and targeted file reads.

Not rerun in this pass:

- Full `npm run build`, `npm run test:sidecar`, and Rust tests were already green in the immediately previous report.
- E2E remains blocked in this environment by the local Edge/msedgedriver mismatch documented previously, not by a newly observed app failure.

## Recommended Next Fix Order

1. Fix Council semantic-only fallback and retrieval-mode classification, then add regression coverage.
2. Decide whether Ollama HTTPS should work; either enable reqwest TLS or restrict validation/copy to HTTP.
3. Centralize clipboard handling and update Reader/Workspace/Theology copy buttons.
4. Bring schema docs, resource import generator version, and runtime `USER_SCHEMA_VERSION` back into sync.
5. Add note-tag cleanup/existence guard tests and align tag counts with displayed tag browser items.
6. Add guided-tour focus management if accessibility polish is in scope for the next UI pass.
