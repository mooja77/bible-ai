# Manual Release QA Report

Date: 2026-05-02

## Current Status

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

Latest automated run on 2026-05-07:

- `npm run check` passed.
- `npm run tauri build -- --debug --no-bundle` passed.
- `npm run qa:real-council:verify -- --fixture tests/fixtures/council-real-results.json` passed.
- `npm run tauri -- build --bundles nsis,msi` passed after stopping a stale process that had locked the previous release executable.
- `npm run release:check` passed after rebuilding the NSIS/MSI artifacts with credential-vault hardening included.
- Release build produced NSIS and MSI installers, release manifest, release summary, release package, and release archive.
- Installed release smoke passed with temporary `APPDATA` and `LOCALAPPDATA`.
- The manual gate collector was tested against a temporary clean profile path; the generated JSON passed `npm run qa:manual-gates:verify` when all manual switches were supplied.
- `npm run qa:manual-gates:package` and `npm run qa:manual-gates:package:verify` passed, producing a portable clean-profile QA package at `app/src-tauri/target/release/manual-qa-package`.

Release-readiness additions since that run:

- WEB is bundled in the corpus.
- Real Council QA fixtures were captured from a 20-question Gemini+OpenAI non-mock run that passed the machine-checkable release gate.
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
  -SqliteBackupRestorePassed
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

## Public Release Gate

Public release remains blocked until the clean-profile installer checklist and credential-vault profile checks are signed off. Multi-provider Council QA is complete.

The final public-release command is:

```bash
cd app
npm run qa:public-release:verify
```

It fails until both evidence files are present and valid:

- `app/tests/fixtures/council-real-results.json`
- `app/release/manual-release-gates.json`
