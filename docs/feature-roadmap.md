# Bible AI Feature Roadmap

This roadmap extends the current reader, search, notes/highlights, Strong's popup, and Council workflow into a fuller study environment.

The next arc is Study Packet v1, the portable auditable study artifact. Its canonical contract is [`study-packet-v1-contract.md`](study-packet-v1-contract.md).

## Goals

- Make Bible AI useful as a persistent study workspace, not only a chapter reader.
- Keep the corpus offline-first and user data local-first.
- Make AI output auditable by linking claims, retrieved evidence, and saved study artifacts.
- Preserve simple workflows for reading, searching, note taking, and export.

## Priority Order

1. Study workspace core
2. Verse range selection
3. Markdown export
4. Bookmarks and reading history
5. Better parallel translation layout
6. Original-language tools
7. Saved searches
8. AI retrieval controls and citation audit
9. Lightweight passage explanation mode
10. Commentary and module system
11. Backup and restore
12. Council transparency visualizations

## Phase 1: Study Workspace Core

Purpose: create a durable container for verses, notes, searches, and Council answers.

User outcomes:
- Create a named workspace such as "Romans 9", "Genesis creation", or "Women in ministry".
- Add verses, verse ranges, notes, search hits, and Council responses to a workspace.
- Reorder and remove workspace items.
- Resume a study later from the sidebar or a workspace view.

Initial scope:
- Workspace list and detail view.
- Add-to-workspace actions from Reader, Search, and Council.
- Store item payloads as JSON where the shape can evolve.
- No collaboration or cloud sync.

## Phase 2: Verse Range Selection

Purpose: support actions on passages, not only individual verses.

User outcomes:
- Select `John 3:16-18` with click and shift-click.
- Copy a selected range.
- Highlight or note a selected range.
- Ask Council or explain a selected range.
- Add a selected range to a workspace.

Initial scope:
- Range selection inside one chapter.
- Reference parser support for `Book Chapter:Verse-Verse`.
- Workspace items store `start_verse_id` and `end_verse_id`.
- Jump box supports cross-chapter ranges such as `John 3:16-4:2`.

## Phase 3: Markdown Export

Purpose: make study work portable.

User outcomes:
- Export a workspace to Markdown.
- Include passage text, notes, search snippets, and Council synthesis.
- Copy Markdown to clipboard.
- Save Markdown to a local file.
- Save portable HTML and PDF exports.

Initial scope:
- Deterministic Markdown renderer in TypeScript.
- Copy-to-clipboard action.
- Timestamped file save under the app-data exports directory.
- Dialog-based "Save as..." for custom Markdown destinations.
- HTML export and simple paginated PDF export generated from the Markdown renderer.

## Phase 4: Reader Navigation

Purpose: help users continue and revisit study.

User outcomes:
- Bookmark passages.
- See recent passages.
- Resume the last opened location on startup.
- Persist layout preferences.

Initial scope:
- Bookmarks and reading history tables.
- Sidebar sections for bookmarks and recent passages.
- Navigation events recorded when book/chapter changes.

## Phase 5: Parallel Translation Layout

Purpose: make comparison reading more useful.

User outcomes:
- Switch between column view and interleaved verse-by-verse view.
- Keep translation columns synced while scrolling.
- Use compact/dense display mode.

Initial scope:
- Layout preference in `app_settings`.
- Interleaved renderer using existing chapter data.
- Basic scroll sync for column mode.

## Phase 6: Original-Language Tools

Purpose: turn Strong's data into practical word study.

User outcomes:
- Open a full word study side panel from a tagged word.
- See lemma, transliteration, morphology, gloss, and definition.
- See occurrences across Scripture grouped by book.
- Navigate to an occurrence.

Initial scope:
- Commands for Strong's occurrence lookup.
- Side panel replacing or extending the popup.
- Occurrence list from `word_tokens` joined to translation text.

## Phase 7: Saved Searches

Purpose: make repeated topical and lexical searches durable.

User outcomes:
- Save a query and its filters.
- Rerun, rename, or delete saved searches.
- Add selected results to a workspace.

Initial scope:
- `saved_searches` table.
- Save current search filters.
- Sidebar list and rerun action.

## Phase 8: AI Retrieval Controls and Citation Audit

Purpose: make Council answers more transparent and controllable.

User outcomes:
- Choose keyword, semantic, hybrid, and cross-reference retrieval.
- Restrict Council retrieval by translation, book, testament, or range.
- Inspect retrieved verses, used verses, and ignored verses.
- Add a Council result to a workspace.

Initial scope:
- Add retrieval controls to Council UI.
- Persist retrieval options with each session.
- Store retrieved evidence and used evidence in session JSON.
- Build an audit view from existing Council response and retrieval evidence.

## Phase 9: Explain Passage Mode

Purpose: provide a faster non-disputed explanation workflow separate from Council.

User outcomes:
- Ask for a concise explanation of a passage.
- Use local or configured provider model without running multi-voice Council.
- Save explanation to a workspace.

Initial scope:
- Sidecar request type `explain`.
- UI action from selected verse/range.
- Store result as a workspace item or standalone history row.

## Phase 10: Commentary and Module System

Purpose: support public-domain commentaries, lexicons, and other study modules.

User outcomes:
- Install or ingest a module.
- View module entries for the current verse or Strong's code.
- Browse topic-keyed module entries.
- Navigate from module references back to the reader.
- Open verse-linked topic entries directly in the reader.

Initial scope:
- `modules` and `module_entries` tables.
- Import format documented as JSONL or SQLite.
- Start with one public-domain commentary or lexicon.

## Phase 11: Backup and Restore

Purpose: protect user data and support migration.

User outcomes:
- Export user data to JSON.
- Import user data with validation.
- Back up or restore `user.sqlite`.

Initial scope:
- JSON export/import of user tables.
- Schema version recorded in export.
- Conflict strategy: skip, replace, or duplicate with suffix.

## Out of Scope for This Roadmap

- Cloud sync.
- Collaboration.
- Paid account management.
- Modern copyrighted Bible translations.
- Server-hosted API proxy.

## Phase 12: Council Transparency Visualizations

Purpose: help users inspect how the Council reached an answer instead of simply trusting the final synthesis.

User outcomes:

- See why the leading argument ranked above the nearest alternative.
- Compare provider voice agreement across positions.
- Inspect cited, supporting, and challenging evidence per position.
- Trace why each passage was retrieved.
- Read confidence rationale and unresolved weaknesses.
- Open raw source data when advanced audit is needed.
- Export the same transparency details with workspace Council results.

Initial scope:

- Per-position evidence tabs.
- Voice agreement matrix.
- Retrieval trace visualization.
- Confidence rationale panel.
- Raw source drawer.
- Council transparency content in Markdown/HTML/PDF workspace export.

Detailed plan: [`council-transparency-visualization-plan.md`](council-transparency-visualization-plan.md).
UI and visualization spec: [`council-transparency-ui-spec.md`](council-transparency-ui-spec.md).
Execution plan: [`council-transparency-execution-plan.md`](council-transparency-execution-plan.md).

## Phase 13: Release Readiness and Corpus Expansion

Purpose: make the app easier to validate, configure, and use daily before any public release.

User outcomes:

- See provider readiness before running the Council.
- Test provider setup directly in Settings.
- Connect user-owned Anthropic, OpenAI, and Gemini API subscriptions without app-owned keys.
- See current and candidate data sources in Settings.
- Navigate faster with a command palette.
- Filter large workspace libraries and workspace items.
- Review version, release notes, privacy posture, and distribution status.

Initial scope:

- Provider status cards and test buttons.
- Pre-submit Council voice preview.
- Data Sources and About & Distribution Settings sections.
- Council quality fixtures for disagreement, provider failure, and sparse evidence.
- Manual release QA and real-provider Council QA runbooks.
- Phase 13 corpus decision document for WEB, Douay-Rheims, LXX, and apocrypha.

Supporting docs:

- [`council-real-world-qa.md`](council-real-world-qa.md)
- [`manual-release-qa-report.md`](manual-release-qa-report.md)
- [`phase-13-corpus-roadmap.md`](phase-13-corpus-roadmap.md)
- [`release-notes.md`](release-notes.md)
- [`privacy-and-distribution.md`](privacy-and-distribution.md)

## Phase 14: Human Judgment Layer

Purpose: make the user's own judgment first-class beside Council output.

User outcomes:

- Record a starting view before AI analysis.
- Rate each position independently from AI weights.
- Save a personal conclusion, confidence, changed-mind note, and open questions.
- Export user judgment alongside Council evidence and synthesis.

Detailed plan: [`learning-and-systematic-theology-plan.md`](learning-and-systematic-theology-plan.md).

## Phase 15: Research Trail And Reasoning Audit

Purpose: expose how research, retrieval, classification, voice analysis, synthesis, and user judgment connect.

User outcomes:

- See a research timeline for each Council result.
- Inspect used, ignored, conflicting, and missing evidence.
- Identify the weakest link in an argument.
- See what evidence would most change a conclusion.

Technical plan: [`learning-technical-implementation.md`](learning-technical-implementation.md).

## Phase 16: Argument Maps

Purpose: turn positions into inspectable claim/evidence/assumption/weakness maps.

User outcomes:

- Compare interpretive moves across positions.
- Annotate argument-map nodes.
- Save argument maps into workspaces and theology topics.

UI plan: [`learning-ui-workflows.md`](learning-ui-workflows.md).

## Phase 17: Dynamic Systematic Theology

Purpose: create a living systematic theology workspace built from Scripture, resources, Council sessions, user notes, and user conclusions.

User outcomes:

- Browse doctrine topics.
- Link passages, resources, Council sessions, notes, and argument maps.
- Track major positions and unresolved tensions.
- Export topic studies or a full "My Theology" document.

Data model: [`learning-data-model.md`](learning-data-model.md).

## Phase 18: Open Resource Library

Purpose: import more public-domain and open-license resources with visible attribution and license controls.

User outcomes:

- Search open resources beside Scripture.
- Link resource excerpts to workspaces and theology topics.
- Export studies with source attribution.

Resource plan: [`open-resource-ingestion-plan.md`](open-resource-ingestion-plan.md).

## Phase 19: Guided Learning Workflows

Purpose: provide repeatable study paths that ask the user to think before and after AI assistance.

User outcomes:

- Follow guided studies for passages, doctrine topics, and theological comparisons.
- Capture disagreement with AI.
- Review user-authored conclusions and linked passages over time.

Testing plan: [`learning-testing-and-release-plan.md`](learning-testing-and-release-plan.md).
