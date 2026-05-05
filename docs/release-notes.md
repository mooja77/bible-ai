# Release Notes

## 0.1.0 Release Candidate

- Council transparency explains process, ranking, position comparison, evidence use, confidence, retrieval trace, source data, and provider failures.
- Settings includes provider setup status, provider test actions, data sources, backup/restore, and release/distribution status.
- Settings includes in-app license, attribution, and privacy disclosures for bundled sources and provider calls.
- Users can connect their own Anthropic, OpenAI, and Gemini API subscriptions; provider keys are stored in the OS credential vault and JSON backups redact provider keys.
- Workspaces support notes, saved Council results, Markdown/HTML/PDF export, backup/restore, and item filtering.
- A command palette provides faster navigation to modes, books, bookmarks, searches, and workspaces.
- The World English Bible is bundled as an additional public-domain English translation.
- Non-mock Council QA fixtures capture a 20-question Claude-only run; multi-provider QA remains a release gate.
- A 20-question Claude+Gemini QA attempt completed, but Gemini quota failures mean the multi-provider release gate remains open.
- Explicit-reference retrieval gives priority to Bible passages named directly in Council questions.
- Release packaging includes verification, manifest, summary, package, archive, and installed-app smoke checks.

## Known Release Blocks

- Multi-provider non-mock Council QA needs a second provider with enough quota to contribute successful answers.
- Clean Windows profile installer QA needs a separate profile or VM.
- Public release still needs clean-profile installer QA and multi-provider Council QA.
- OS credential vault migration should be manually verified on an upgraded profile that previously had SQLite-stored provider keys.
- Douay-Rheims, LXX, and apocrypha remain Phase 13 candidates because alternate versification and deuterocanonical UX are not complete.
