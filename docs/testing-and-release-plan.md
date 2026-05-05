# Testing and Release Plan

This plan defines verification expectations for the feature roadmap.

## Baseline Commands

Run before completing any feature phase:

```powershell
cd app
npm run check:full
```

Run for release-impacting changes:

```powershell
cd app
npm run release:build
```

## Existing E2E Coverage

Current coverage includes:

- App shell loads.
- Reader mode and Council mode buttons render.
- Translation picker renders.
- Genesis 1 renders by default.
- Search returns FTS results and click navigates.
- Verse panel opens.
- Council mock workflow submits, renders, persists, restores, and deletes.

## Required E2E Tests by Feature

### Study Workspaces

Test:

1. Create workspace.
2. Navigate away and reopen the workspace from the sidebar shortcut.
3. Edit workspace title/description and verify the detail view updates.
4. Archive a workspace and verify it leaves the active list.
5. Add current verse.
6. Open workspace.
7. Verify verse item.
8. Edit an item title and verify the item refreshes in place.
9. Create and edit a standalone workspace note.
10. Add a second item.
11. Move an item up or down and verify order changes.
12. Explain a saved verse/range item and verify an explanation item is added.
13. Ask Council from a saved verse/range item and verify the Council question is prefilled.
14. Rerun a saved workspace search item and verify Search opens with the saved query.
15. Save Markdown and verify a saved-file status is shown.
16. Delete workspace.

Also test adding a Council mock result to a workspace, then reopening a saved Council result from the workspace detail view.

### Verse Range Selection

Test:

1. Shift-click a verse range.
2. Verify range action bar.
3. Add range to workspace.
4. Bookmark range and verify the sidebar shortcut appears.
5. Save a range note, reselect the same range, and verify the note reloads.
6. Open workspace and verify citation.

### Markdown Export

Test:

1. Create workspace with one verse and one note.
2. Open export preview.
3. Verify Markdown contains title, citation, and note text.
4. Verify saved Council results include cited evidence, dissent notes, and unresolved tensions when present.
5. Save Markdown, HTML, and PDF exports and verify visible saved-file status for each extension.
6. Manual QA: use Save As to write a `.md` file through the OS dialog and confirm the saved file matches the preview.

Clipboard and OS file-dialog behavior may be flaky in WebView automation. Prefer testing preview text first.

### Bookmarks and Reading History

Test:

1. Bookmark a verse with a custom label.
2. Navigate away.
3. Verify the custom label appears in sidebar shortcuts.
4. Click bookmark.
5. Verify reader returns to verse.

History:

1. Navigate to another chapter.
2. Verify recent location appears.

### Parallel Translation Layout

Test:

1. Enable two translations.
2. Switch to interleaved view.
3. Verify both translations render in one verse block.
4. Switch back to columns.

### Original-Language Tools

Test:

1. Enable a tagged translation.
2. Click a tagged word.
3. Verify word study panel opens.
4. Click an occurrence.
5. Verify reader navigates.

### Saved Searches

Test:

1. Search with filters.
2. Save search.
3. Rename saved search.
4. Clear search.
5. Rerun saved search.
6. Select multiple search results and add them to a workspace as a grouped item.
7. Add one search hit to a workspace and rerun the saved hit query.
8. Delete saved search.

### Council Retrieval Controls and Audit

Test with mock Council:

1. Set retrieval strategy and filter.
2. Submit question.
3. Verify answer renders.
4. Open audit panel.
5. Verify retrieved evidence is listed.
6. Verify evidence classification badges render.
7. Verify the Council process view explains evidence retrieval, independent voices, synthesis clustering, and why the leading argument ranked above the nearest alternative.
8. Restore session and verify retrieval settings persist.

### Explain Passage

Council transparency visualization test coverage is planned in [`council-transparency-visualization-plan.md`](council-transparency-visualization-plan.md). Add those E2E cases before marking Phase 12 complete.

Test with mock sidecar:

1. Select verse/range.
2. Click Explain.
3. Verify explanation renders.
4. Add explanation to workspace.
5. Open the workspace and verify the explanation item renders with source navigation.

### Modules

Test with fixture module:

1. Import module.
2. Navigate to known verse.
3. Verify module entry appears.
4. Import Strong's JSONL fixture and verify entry appears in word study.
5. Verify topic-keyed JSONL entries appear in the Settings topic browser.
6. Verify verse-linked topic entries can open their source passage in the reader.
7. Verify verse-range JSONL entries appear when the matching range is selected.
8. Delete/uninstall module and verify the installed module list updates.
9. Verify module-entry workspace items render and export to Markdown.

### Backup and Restore

Test:

1. Create user data.
2. Export JSON.
3. Import into a fresh test user DB.
4. Verify records restore.
5. Test duplicate conflict strategies.
6. Create a SQLite backup.
7. Restore from that backup path and confirm the command creates a safety backup.

## Test Data Strategy

- Keep tests deterministic.
- Prefer public corpus verses that are already present in `corpus.sqlite`.
- Use unique test titles with timestamps for workspaces/saved searches.
- Clean up test-created rows when possible.
- Keep mock sidecar mode for all AI E2E tests.

## Manual QA Checklist

Before a release:

- Install MSI on a clean Windows profile.
- Launch app without system Node in PATH if possible.
- Open Settings and run Test setup.
- Confirm corpus loads.
- Confirm Reader can navigate and search.
- Confirm Council mock path is not enabled in production by default.
- Confirm real Council path fails gracefully when no keys/auth are available.
- Confirm user settings persist after app restart.
- Confirm uninstall/reinstall does not unexpectedly delete user data unless requested.

## Installer Resource Checks

After `npm run release:build`, confirm release output contains:

- `target/release/bundle/msi/Bible AI_0.1.0_x64_en-US.msi`
- `target/release/bundle/nsis/Bible AI_0.1.0_x64-setup.exe`
- `target/release/sidecar/index.mjs`
- `target/release/sidecar/node/node.exe`
- `target/release/sidecar/node_modules`
- bundled `corpus.sqlite`
- `target/release/release-manifest.json` with sizes and SHA-256 hashes for release artifacts
- `npm run release:manifest:verify` confirms the manifest app name/version/package/root still match Tauri metadata, required artifacts are listed once, timestamps and SHA-256 values are well-formed, and file hashes still match the artifacts
- `target/release/release-summary.md` with human-readable artifact sizes and hashes
- `npm run release:summary:verify` confirms the summary title, generated timestamp, artifact rows, hashes, and directory rows match the manifest
- `target/release/release-package/` containing the upload-ready installers, manifest, and summary
- `npm run release:package:verify` confirms staged package files match the manifest and root copies
- `target/release/Bible AI_0.1.0_release-package.zip` containing the upload-ready release package; the archive filename is generated from Tauri `productName` and `version`
- `npm run release:archive:verify` confirms the zip contains the staged package files

PowerShell helpers:

```powershell
npm run release:check
npm run release:manifest:verify
npm run release:summary:verify
npm run release:package:verify
npm run release:archive:verify
Get-Content app\src-tauri\target\release\release-manifest.json
Get-Content app\src-tauri\target\release\release-summary.md
Get-ChildItem app\src-tauri\target\release\release-package
Get-ChildItem app\src-tauri\target\release -Filter "*release-package.zip"
Get-ChildItem app\src-tauri\target\release -Recurse -Filter node.exe
Get-ChildItem app\src-tauri\target\release -Recurse -Filter index.mjs
Get-ChildItem app\src-tauri\target\release\bundle -Recurse -File
```

Clean-profile install smoke:

1. Run `npm run release:build`.
2. If artifacts are already built, run `npm run release:install-smoke`.
3. Confirm the script installs `target/release/bundle/nsis/Bible AI_0.1.0_x64-setup.exe` into a temporary directory, launches the installed app with temporary `APPDATA` and `LOCALAPPDATA`, keeps it running for at least 8 seconds, runs the generated uninstaller with `/S`, and removes the temp directory.

For a faster pre-install startup check, run `npm run release:smoke`. It launches the release `app.exe` from `target/release` with temporary `APPDATA` and `LOCALAPPDATA`, waits 8 seconds, then terminates it.

## Risks to Watch

- WebDriver stale element warnings after navigation. Prefer robust wait conditions.
- Tauri driver port collisions. Keep E2E single-worker unless the harness is changed.
- Sidecar resource size after bundling Node and `node_modules`.
- SQLite migration mistakes in existing user profiles.
- Clipboard and file-dialog automation can be flaky.
- API diagnostics should not leak provider keys in errors or logs.

## Council Quality Fixtures

Fixture file: `app/tests/fixtures/council-quality.json`.

The fixture set covers:

- heavy provider disagreement
- provider failure
- sparse evidence

The release-readiness E2E spec restores the fixture workspace and opens the provider-failure result in the Council panel. This guards the transparency UI against crashes when voices disagree, fail, or provide sparse evidence.

## Real-Provider QA Gate

Before public release, run the question bank in `docs/council-real-world-qa.md` with mock mode disabled and non-mock providers configured. Save weak outputs as additional fixtures before prompt tuning so regressions remain reproducible.
