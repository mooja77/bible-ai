# Manual Release QA Report

Date: 2026-05-02; current status corrected 2026-07-14

## Current Status

The May run below is retained as historical evidence only. It is **not valid for
the current public-release contract**. A new 20-case Granite + Claude fixture
now passes the grounding, scope, cross-family judge, evidence-route diversity,
confidence-adjustment, kill-test, quote-hydration, primary-passage, and
two-provider machine gates. Its named confidence review and the clean-profile,
accessibility, safety, credential-vault, and content-rights attestations remain
pending. See `docs/ship-readiness.md` for the current sequence.

Current automated Windows artifact evidence (2026-07-14):

- Tauri produced fresh unsigned NSIS and MSI bundles.
- Source commit:
  `368af6ea6d4ada4af2ebedb2dfc4298f8078c967`.
- `npm run release:verify`, `npm run release:smoke`, and
  `npm run release:install-smoke` passed; the NSIS installer was installed,
  launched for 8 seconds, and uninstalled.
- NSIS: 493,762,616 bytes, SHA-256
  `38151a3fe9253295a1d6da9ec436a09b27b9bac97672d5915a204f7ace5bb5f8`.
- MSI: 612,086,884 bytes, SHA-256
  `19cae56baa5ca8e4c085a65b4c880807e645d34d81a06acaf9aa7a0f726d58f8`.
- Release archive: 1,103,341,590 bytes, SHA-256
  `71d6676c3c9d9a0e63cb7ae1bfacf52ccd8001a7e1fb96320eb2f6022d500185`.
- A first install-smoke run hit the old 180-second timeout during transient
  Windows load. The smoke runner now uses bounded 10-minute install and
  5-minute uninstall defaults, kills the full process tree on timeout, and the
  current real install/launch/uninstall run passed in 285 seconds.
- The source-bound manifest and portable manual-QA package were regenerated
  and verified against these installers. Regenerate them again after any
  tracked source change; never reuse a stale package.

Current automated macOS candidate evidence (2026-07-15):

- Commit `9adf30beb3c9ddd8304cbf364b4e4fcaf809d487` produced
  `Bible AI_0.1.0_aarch64.dmg` on the `macos-26-arm64` runner.
- The workflow verified the complete corpus checksum, mounted the DMG, copied
  the app, launched the installed copy with an isolated profile, and required
  non-empty `user.sqlite` creation.
- This remains ad-hoc signed, unnotarized, Apple Silicon-only machine evidence.
  Clean-Mac provider, persistent Keychain, accessibility, backup/restore, and
  Gatekeeper review are still required before public distribution.

Automated release verification is available through:

- `npm run check:full`
- `npm run release:build`
- `npm run release:install-smoke`
- `npm run qa:manual-gates:template`
- `npm run qa:manual-gates:collect`
- `npm run qa:manual-gates:package`
- `npm run qa:manual-gates:package:verify`
- `npm run qa:manual-gates:create-user` from an elevated PowerShell prompt
- `npm run qa:manual-gates:verify`
- `npm run qa:public-release:verify`

Historical automated run on 2026-05-07:

- `npm run check` passed.
- `npm run tauri build -- --debug --no-bundle` passed.
- `npm run qa:real-council:verify -- --fixture tests/fixtures/council-real-results.json` passed.
- `npm run tauri -- build --bundles nsis,msi` passed after stopping a stale process that had locked the previous release executable.
- `npm run release:check` passed after rebuilding the NSIS/MSI artifacts with credential-vault hardening included.
- Release build produced NSIS and MSI installers, release manifest, release summary, release package, and release archive.
- Installed release smoke passed with temporary `APPDATA` and `LOCALAPPDATA`.
- The manual gate collector was tested against a temporary clean profile path; the generated JSON passed `npm run qa:manual-gates:verify` when all manual switches were supplied.
- `npm run qa:manual-gates:package` and `npm run qa:manual-gates:package:verify` passed, producing a portable clean-profile QA package at `app/src-tauri/target/release/manual-qa-package`.

Historical release-readiness additions recorded after that run:

- WEB is bundled in the corpus.
- Real Council QA fixtures were captured from a 20-question Gemini+OpenAI
  non-mock run that passed the **then-current** machine-checkable release gate;
  they do not pass the 2026-07-13 contract.
- Explicit-reference retrieval was added for questions that name passages directly.
- E2E coverage now checks that Council source JSON does not expose Windows paths or provider key names.
- Settings includes in-app license, attribution, and privacy disclosures.
- Provider keys are now stored in the OS credential vault; legacy SQLite secret rows are removed with SQLite secure delete and vacuum cleanup.
- The 2026-05-07 multi-provider QA run passed with Gemini and OpenAI contributing successful answers for all 20 questions.

Manual clean-profile Windows testing still requires a separate Windows user profile or clean VM. That cannot be proven by source edits alone. If this gate cannot be completed, generated Windows installers should be treated as private/test builds and should not be described as verified public installers.

The manual release gate now has machine-readable evidence and a sanitized collector:

1. From `app/`, run `npm run qa:manual-gates:package`.
2. Copy `app/src-tauri/target/release/manual-qa-package` to the separate clean Windows profile or VM.
3. Complete the manual checklist below from that package.
4. After the checks pass, run this from inside the copied package:

```powershell
powershell -ExecutionPolicy Bypass -File .\RUN-MANUAL-QA.ps1 -Operator "Release QA" -MarkChecklistPassed
```

5. Copy the generated `manual-release-gates.json` back to `app/release/manual-release-gates.json`.
6. If running directly from the repo instead of the packaged folder, this equivalent command is available:

```powershell
npm run qa:manual-gates:collect -- `
  -Operator "Release QA" `
  -WindowsProfile "$env:USERPROFILE" `
  -CleanProfileInstallPassed `
  -FirstLaunchPassed `
  -SettingsProviderKeysPassed `
  -CredentialVaultUpgradeProfilePassed `
  -ExportsSecretLeakCheckPassed `
  -BackupRestorePassed `
  -SqliteBackupRestorePassed `
  -KeyboardOnlyWorkflowPassed `
  -ScreenReaderSmokePassed `
  -Zoom200PercentPassed `
  -SensitiveTopicWordingReviewPassed `
  -LocalizedCrisisResourcesReviewPassed
```

7. The collector detects provider credential targets by name only and scans the profile SQLite file for sensitive-string signals.
8. Do not paste provider keys or credential values into the evidence file.
9. Run `npm run qa:manual-gates:verify`.
10. After the real Council QA fixture also passes, run `npm run qa:public-release:verify`.

If a clean local Windows account is needed, run this from an elevated PowerShell prompt:

```powershell
cd "<repo>\\app"
npm run qa:manual-gates:create-user
```

The helper creates or resets a temporary `.\\BibleAIQA` local user and writes sign-in instructions to the configured public output path, by default `C:\Users\Public\BibleAI-QA-USER.txt`.

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
12. Complete the core flow by keyboard only and with a screen reader.
13. Verify Reader, Council, Settings, and exported content at 200% zoom/text scale.
14. Review the localized sensitive-topic wording and candidate resources for the
    target territory with the named safety reviewer.
15. Verify the named content-rights decision and attribution for every bundled
    source against the exact release artifact.

## Public Release Gate

Public release remains blocked until the clean-profile, accessibility,
credential-vault, safety, content-rights, and human Council confidence checks
are signed off. The current real-provider machine fixture already passes the
grounded-pipeline contract.

The final public-release command is:

```bash
cd app
npm run qa:public-release:verify
```

It fails until all four evidence files are present and valid:

- `app/tests/fixtures/council-real-results.json`
- `app/release/manual-release-gates.json`
- `app/release/content-review.json`
- `app/release/council-confidence-review.json`
