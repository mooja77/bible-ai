# Release Notes

## 0.1.0 Release Candidate

- Council transparency explains process, ranking, position comparison, evidence use, confidence, retrieval trace, source data, and provider failures.
- Settings includes provider setup status, provider test actions, data sources, backup/restore, and release/distribution status.
- Settings now starts provider configuration with a guided setup path for personal API keys, local/no-hosted-key use, or a managed gateway, plus a one-click save-and-test action.
- Settings includes in-app license, attribution, and privacy disclosures for bundled sources and provider calls.
- Users can connect their own Anthropic, OpenAI, and Gemini API subscriptions; provider keys are stored in the OS credential vault and JSON backups redact provider keys.
- Release packages do not include shared provider keys; each user configures their own local provider access in Settings.
- Managed Gateway setup lets team/public deployments route Council calls through an app-specific backend without exposing direct provider keys to end users.
- Workspaces support notes, saved Council results, Markdown/HTML/PDF export, backup/restore, and item filtering.
- A command palette provides faster navigation to modes, books, bookmarks, searches, and workspaces.
- The World English Bible is bundled as an additional public-domain English translation.
- Non-mock Council QA fixtures capture a 20-question Gemini+OpenAI run that passes the multi-provider release gate.
- Explicit-reference retrieval gives priority to Bible passages named directly in Council questions.
- Release packaging includes verification, manifest, summary, package, archive, and installed-app smoke checks.

## Known Release Blocks

- Clean Windows profile installer QA needs a separate profile or VM. If that gate cannot be completed, Windows installers must be labeled private/test builds rather than public-release-ready installers.
- macOS has release scripts and a distribution plan, but a public `.dmg` must be built and verified on an Apple computer or macOS CI runner before publication.
- OS credential vault migration should be manually verified on an upgraded profile that previously had SQLite-stored provider keys.
- Douay-Rheims, LXX, and apocrypha remain Phase 13 candidates because alternate versification and deuterocanonical UX are not complete.
