# Manual Release QA Report

Date: 2026-05-02

## Current Status

Automated release verification is available through:

- `npm run check:full`
- `npm run release:build`
- `npm run release:install-smoke`

Latest automated run on 2026-05-05:

- `npm run check:full` passed with 35 E2E tests.
- `npm run tauri -- build --bundles nsis` passed after the full release build exceeded the command timeout.
- `npm run release:check` passed.
- Release build produced NSIS and MSI installers, release manifest, release summary, release package, and release archive.
- Installed release smoke passed with temporary `APPDATA` and `LOCALAPPDATA`.

Release-readiness additions since that run:

- WEB is bundled in the corpus.
- Real Council QA fixtures were captured from a 20-question Claude-only non-mock run.
- Explicit-reference retrieval was added for questions that name passages directly.
- E2E coverage now checks that Council source JSON does not expose Windows paths or provider key names.
- Settings includes in-app license, attribution, and privacy disclosures.
- Provider keys are now stored in the OS credential vault; the active local `user.sqlite` has no `app_settings` rows matching `api_key` or `token`.

Manual clean-profile Windows testing still requires a separate Windows user profile or clean VM. That cannot be proven by source edits alone.

## Manual Checklist

1. Install the generated NSIS/MSI on a clean Windows profile.
2. Confirm first launch creates local app data without errors.
3. Open Settings and verify provider keys can be entered, saved, and tested.
4. Confirm provider keys are stored by the OS credential vault, not as `app_settings` secret rows in `user.sqlite`.
5. Run a Council question with mock mode disabled and at least two real providers.
6. Save a Council result to a workspace.
7. Export Markdown, HTML, PDF, and backup JSON.
8. Restore backup JSON into a fresh profile.
9. Create and restore a SQLite backup.
10. Open source data drawers and exported files.
11. Confirm no local filesystem paths, provider keys, or raw API credentials appear in exports or source drawers.

## Public Release Gate

Public release remains blocked until the clean-profile installer checklist is signed off and multi-provider Council QA is completed with at least two non-mock providers.
