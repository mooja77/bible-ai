# Implementation Checklist

Use this checklist to drive the feature roadmap without losing track of backend, frontend, schema, tests, and release work.

## Phase 1: Study Workspaces

- [x] Add user DB migration for `study_workspaces`.
- [x] Add user DB migration for `study_items`.
- [x] Mirror schema in `data/schema.sql`.
- [x] Add Rust structs and user DB functions.
- [x] Add Tauri commands.
- [x] Add TypeScript types and command wrappers.
- [x] Add Workspaces mode to `App.tsx`.
- [x] Add sidebar workspace shortcuts for study resumption.
- [x] Build workspace list.
- [x] Build workspace detail view.
- [x] Add workspace title/description editing.
- [x] Add workspace item title editing.
- [x] Add standalone workspace note creation and editing.
- [x] Add workspace verse/range copy and Council actions.
- [x] Add workspace verse/range Explain action that saves an explanation item.
- [x] Add explanation workspace item rendering.
- [x] Add module-entry workspace item rendering.
- [x] Add Council-result workspace restore and copy actions.
- [x] Add workspace archive action.
- [x] Add workspace item removal.
- [x] Add workspace item reordering.
- [x] Build add-to-workspace menu.
- [x] Add Reader integration.
- [x] Add Search integration.
- [x] Add workspace search-item rerun action.
- [x] Add Council integration.
- [x] Add E2E workspace test.
- [x] Run full verification.

## Phase 2: Verse Range Selection

- [x] Add selection state to `ChapterReader`.
- [x] Implement click and shift-click selection.
- [x] Add range action bar.
- [x] Add range parser support.
- [x] Add jump-box range selection.
- [x] Add jump-box cross-chapter range support.
- [x] Add `get_verse_range` command.
- [x] Add copy range action.
- [x] Add highlight range action or defer with visible disabled state.
- [x] Add note range action or defer with visible disabled state.
- [x] Add range-to-workspace action.
- [x] Add range bookmark action.
- [x] Add E2E range selection test.
- [x] Add E2E range note persistence and workspace verification.
- [x] Run full verification.

## Phase 3: Markdown Export

- [x] Add workspace Markdown renderer.
- [x] Add export preview.
- [x] Add copy Markdown action.
- [x] Add save Markdown file action.
- [x] Add dialog-based Markdown Save As support.
- [x] Add HTML export.
- [x] Add PDF export.
- [x] Include Council result rendering.
- [x] Include Council result source evidence in Markdown.
- [x] Include Council dissent notes and unresolved tensions in Markdown.
- [x] Include notes and search snippets.
- [x] Add E2E export preview test.
- [x] Run full verification.

## Phase 4: Bookmarks and History

- [x] Add `bookmarks` table.
- [x] Add `reading_history` table.
- [x] Add commands and TypeScript wrappers.
- [x] Add bookmark action.
- [x] Add custom bookmark labels.
- [x] Add recent passages sidebar section.
- [x] Persist last opened location.
- [x] Add E2E bookmark test.
- [x] Run full verification.

## Phase 5: Translation Layouts

- [x] Add reader layout settings.
- [x] Add layout controls.
- [x] Extract current column view.
- [x] Add interleaved view.
- [x] Add compact density.
- [x] Add scroll sync.
- [x] Persist preferences.
- [x] Add E2E layout test.
- [x] Run full verification for currently implemented reader settings.

## Phase 6: Original-Language Tools

- [x] Add Strong's occurrence query.
- [x] Add `get_strongs_occurrences` command.
- [x] Add word study panel.
- [x] Add occurrence list.
- [x] Add occurrence navigation.
- [x] Add E2E word study test.
- [x] Run full verification.

## Phase 7: Saved Searches

- [x] Add `saved_searches` table.
- [x] Add commands and TypeScript wrappers.
- [x] Add Save Search action.
- [x] Add saved search list.
- [x] Add rerun action.
- [x] Add rename action.
- [x] Add delete action.
- [x] Add workspace integration.
- [x] Add selected search-result workspace grouping.
- [x] Add individual search-hit rerun action.
- [x] Add E2E saved search test.
- [x] Run full verification.

## Phase 8: Council Retrieval Controls and Audit

- [x] Add retrieval options to `ask_council`.
- [x] Add retrieval strategy handling in Rust.
- [x] Add book/testament/range filters to retrieval.
- [x] Store retrieval options with session.
- [x] Store retrieved evidence with session.
- [x] Add provider evidence classification to Council responses.
- [x] Add Council retrieval controls UI.
- [x] Add Council audit view.
- [x] Render evidence classification badges in the audit view.
- [x] Add Council process view explaining the visible reasoning workflow and leading-argument comparison.
- [x] Add workspace integration.
- [x] Add E2E mock Council audit test.
- [x] Run full verification.

## Phase 9: Explain Passage

- [x] Add sidecar `explain` request.
- [x] Add mock explain mode.
- [x] Add Rust `explain_passage` command.
- [x] Add frontend types and wrapper.
- [x] Add Explain action from verse.
- [x] Add Explain action from range.
- [x] Add result panel.
- [x] Add workspace integration.
- [x] Add E2E explain test.
- [x] Run full verification.

## Phase 10: Modules

- [x] Add `modules` table.
- [x] Add `module_entries` table.
- [x] Define JSONL import manifest.
- [x] Add import command.
- [x] Add module lookup commands.
- [x] Add Reader module panel.
- [x] Add selected-range module lookup and Reader rendering.
- [x] Add word-study module integration.
- [x] Add topic module browser.
- [x] Add reader navigation from verse-linked topic entries.
- [x] Add module uninstall command and Settings UI.
- [x] Add fixture module.
- [x] Add E2E module test.
- [x] Run full verification.

## Phase 11: Backup and Restore

- [x] Add JSON export command.
- [x] Add JSON import command.
- [x] Add conflict strategies.
- [x] Add JSON backup file command.
- [x] Add SQLite backup command.
- [x] Add restore command with safety backup.
- [x] Add Settings backup/export UI.
- [x] Add import/export tests.
- [x] Run full verification.

## Phase 12: Council Transparency Visualizations

- [x] Create Council transparency implementation plan.
- [x] Create Council transparency UI and visualization spec.
- [x] Create Council transparency file-level execution plan.
- [x] Extend Council response types with optional per-position supporting/challenging evidence IDs.
- [x] Add `why_not_higher` and confidence rationale fields to provider and synthesis prompts.
- [x] Normalize new sidecar fields while preserving compatibility with old sessions.
- [x] Add richer mock Council data for matrix, evidence tabs, retrieval trace, and confidence rationale.
- [x] Build per-position evidence tabs.
- [x] Build voice agreement matrix visualization.
- [x] Add retrieval trace source chips and score display.
- [x] Add confidence rationale panel.
- [x] Add raw source data drawer with copy actions.
- [x] Add top-level winner summary for the leading argument.
- [x] Add side-by-side position comparison.
- [x] Add matched-term highlighting inside evidence text.
- [x] Add matrix-to-position focus highlighting.
- [x] Add source and evidence status tooltips.
- [x] Add source drawer full-response copy action.
- [x] Show cross-reference source citations when available.
- [x] Add Council transparency details to workspace Markdown export.
- [x] Carry transparency export content through HTML and PDF exports.
- [x] Add E2E coverage for matrix, evidence tabs, rationale, source drawer, comparison, highlighting, and export.
- [x] Run full verification.
- [x] Run release verification.

## Full Verification

- [x] `npm run check`
- [x] `npm run check:full`
- [x] `npm run build`
- [x] `cargo fmt --check`
- [x] `cargo check`
- [x] `node --check sidecar/index.mjs`
- [x] `node --check sidecar/council.mjs`
- [x] `npm run test:e2e:build`
- [x] `npm run tauri build`
- [x] `npm run release:verify`
- [x] `npm run release:manifest`
- [x] `npm run release:manifest:verify`
- [x] Release manifest verification enforces required artifact names, unique paths, metadata, timestamps, and SHA-256 shape.
- [x] `npm run release:summary`
- [x] `npm run release:summary:verify`
- [x] `npm run release:package`
- [x] `npm run release:package:verify`
- [x] `npm run release:archive`
- [x] `npm run release:archive:verify`
- [x] Release manifest and archive naming use Tauri `productName` and `version`.
- [x] `npm run release:smoke`
- [x] `npm run release:install-smoke`
- [x] `npm run release:check`
- [x] `npm run release:build`
- [x] `npm run tauri -- build --bundles msi`
- [x] Clean-profile install smoke test

## Phase 13: Release Readiness and Corpus Expansion

- [x] Add visible provider status cards in Settings.
- [x] Add provider test actions in Settings.
- [x] Show Council voices before submit.
- [x] Support user-owned Anthropic, OpenAI, and Gemini provider credentials.
- [x] Store user-owned provider credentials in the OS credential vault instead of local SQLite settings.
- [x] Migrate legacy SQLite provider key rows into the OS credential vault on settings load.
- [x] Redact provider API keys from JSON backup exports.
- [x] Add Data Sources screen in Settings.
- [x] Add WEB corpus source and ingestion script.
- [x] Defer Douay-Rheims after source assessment found Vulgate/deuterocanonical versification mismatch.
- [x] Add About & Distribution screen in Settings.
- [x] Add in-app license, attribution, and privacy disclosures for public-release review.
- [x] Add command palette for faster navigation.
- [x] Add workspace and workspace-item filtering.
- [x] Add Council quality fixtures for heavy disagreement, provider failure, and sparse evidence.
- [x] Add E2E coverage for release-readiness Settings surfaces and provider-failure fixture rendering.
- [x] Document real-provider Council QA runbook and 30-question bank.
- [x] Run 20-question non-mock Council QA with Claude available.
- [x] Save real Council QA result fixtures and output-level weak fixtures.
- [x] Tune Council prompts for confidence, evidence rationale, and leading-argument explanation.
- [x] Add explicit-reference retrieval for Council questions that name passages directly.
- [x] Document manual release QA checklist and public release gate.
- [x] Document Phase 13 corpus decisions for WEB, Douay-Rheims, LXX, and apocrypha.
- [x] Run full verification after Phase 13 implementation.
- [x] Attempt multi-provider Council QA with Claude Code and Gemini detected.
- [x] Add Gemini retry handling for quota/rate/temporary provider failures.
- [x] Preserve partial real-QA output after each question.
- [ ] Run multi-provider Council QA with at least two non-mock providers.
- [ ] Run manual clean-profile installer QA on a separate Windows profile or VM.
- [ ] Manually verify OS credential vault storage on clean and upgraded Windows profiles.
