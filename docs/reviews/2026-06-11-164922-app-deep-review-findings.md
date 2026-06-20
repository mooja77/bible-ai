# Bible AI Deep Review Findings - 2026-06-11 16:49:22 +01:00

Filename timestamp: `2026-06-11-164922`.

Scope: another read-only review pass over the current app state. This pass focused on Tauri desktop security boundaries, the Node sidecar/provider path, release packaging scripts, model-default freshness, and user-data integrity around tags/notes/workspace items.

Previous baseline report: `docs/reviews/2026-06-11-163656-app-deep-review-findings.md`.

No app code was changed in this pass.

## Current-State Positives

1. Tauri permissions are narrow.
   - Main capability grants only `core:default` and `dialog:allow-save`: `app/src-tauri/capabilities/default.json:6-9`.
   - No generic shell or filesystem plugin permission is exposed to the frontend.
   - The only Tauri plugin initialized in Rust is dialog: `app/src-tauri/src/lib.rs:3981`.

2. Production CSP is reasonably tight.
   - Production CSP allows self resources, asset images, data images, inline styles, IPC, and blocks object/embed/frame ancestry: `app/src-tauri/tauri.conf.json:23`.
   - `unsafe-eval` is present only in `devCsp`, not production: `app/src-tauri/tauri.conf.json:24`.

3. Sidecar error handling is substantially hardened.
   - Rust spawns the sidecar lazily, serializes requests behind a mutex, drains stderr, and drops the sidecar on protocol/transport failures: `app/src-tauri/src/sidecar.rs`.
   - Provider errors are redacted and classified into auth/quota/network/server/parse buckets: `app/sidecar/providers/_shared.mjs`.
   - Sidecar tests cover JSON extraction, sanitization, redaction, provider error classification, and Council mock behavior.

4. Release scripts now check the most important bundled runtime resources.
   - Windows verifier checks the app executable, corpus DB, sidecar entrypoints, providers, lockfile, Node runtime, `node_modules`, and installer artifacts: `app/scripts/verify-release.mjs`.
   - macOS verifier checks the `.app` bundle, Info.plist, executable bit, corpus, sidecar entrypoints, providers, lockfile, Node runtime, `node_modules`, and DMG: `app/scripts/verify-macos-release.mjs`.

5. User DB opens with foreign keys enabled.
   - `user_db::open` enables `PRAGMA foreign_keys = ON` before applying schema: `app/src-tauri/src/user_db.rs:389-401`.

## New Or Updated Findings

### R06-F01 - Low - Release manifests include absolute local build paths

Both Windows and macOS release manifest scripts write `release_root` as an absolute path. Those manifests are copied into the release package, so public artifacts can expose the build machine path and become less reproducible across builders.

Evidence:

- Windows manifest writes `release_root: releaseRoot`: `app/scripts/create-release-manifest.mjs:55-65`.
- Windows package copies `release-manifest.json`: `app/scripts/package-release-artifacts.mjs`.
- macOS manifest writes `release_root: releaseRoot`: `app/scripts/create-macos-release-manifest.mjs:69-80`.
- macOS package copies `macos-release-manifest.json`: `app/scripts/package-macos-release-artifacts.mjs`.

Suggested fix: Remove `release_root` from public manifests or replace it with a relative artifact root plus a non-sensitive build ID.

### R06-F02 - Medium - macOS signing/notarization is optional in automated release checks

The macOS release verifier only runs `codesign --verify` when `BIBLE_AI_REQUIRE_MACOS_CODESIGN=true`. The build environment verifier warns when signing identity variables are missing, but warning-only status still lets `macos:release:check` pass. The package README says public distribution builds must be signed and notarized, but that is manual rather than enforced.

Evidence:

- Optional codesign gate: `app/scripts/verify-macos-release.mjs:47-54`.
- Missing signing identity is a warning, not a failure: `app/scripts/verify-macos-build-env.mjs:38-62`.
- Package README generator states public macOS distribution must be signed and notarized: `app/scripts/package-macos-release-artifacts.mjs:55-62`.

Impact: An unsigned or unnotarized DMG can pass the standard automated macOS release checks unless the environment explicitly opts into stricter verification.

Suggested fix: Split local QA and public release commands. Keep unsigned local checks available, but make the public release path fail unless signing and notarization verification are explicitly satisfied.

### R06-F03 - Low/Medium - Note deletion leaves note tag links behind

The current UI can attach tags to verse notes. If a user clears the note body, `delete_note` deletes the note row but does not delete `item_tags` rows for `item_type = 'note'`. `list_tags_with_counts` counts raw note tag links, while `list_tagged_items` joins to `user_notes`, so the Tags view can show a count but no corresponding item.

Evidence:

- UI attaches note tags using `tagItem(t.id, "note", verseId)`: `app/src/features/reader/VersePanel.tsx:642-651`.
- Clearing a note calls `deleteNote(verseId)`: `app/src/features/reader/VersePanel.tsx:626-633`.
- Backend `delete_note` deletes only from `user_notes`: `app/src-tauri/src/user_db.rs:9065-9070`.
- Bookmark deletion has the manual cleanup that notes lack: `app/src-tauri/src/user_db.rs:1103-1108`.
- Tag counts count raw `item_tags` rows for bookmark/note: `app/src-tauri/src/user_db.rs:1221-1239`.
- Tagged item listing joins to actual `user_notes`, so orphan note tags disappear from item results: `app/src-tauri/src/user_db.rs:1241-1248`.

Suggested fix: In `delete_note`, delete `item_tags` where `item_type = 'note' AND item_id = verse_id` inside the same logical operation. Add a regression test similar to `delete_bookmark_clears_its_item_tags`.

### R06-F04 - Low/Medium - Taggable item contract is wider than implemented cleanup/import behavior

The backend command contract and schema advertise four item types: `bookmark`, `note`, `range_note`, and `study_item`. Import logic explicitly says `range_note` and `study_item` are not yet taggable and skips them. Delete paths for `study_item`, `study_workspace`, and `range_note` do not clear corresponding `item_tags`.

Evidence:

- Command validation accepts four types: `app/src-tauri/src/lib.rs:1268-1275`.
- Schema check accepts the same four types: `app/src-tauri/src/user_db.rs:378-386`.
- Import skips `range_note` and `study_item`, with a comment saying they are not yet taggable: `app/src-tauri/src/user_db.rs:7574-7605`.
- `delete_study_item` deletes from `study_items` but not `item_tags`: `app/src-tauri/src/user_db.rs:963-982`.
- `delete_study_workspace` deletes child `study_items` but not their `item_tags`: `app/src-tauri/src/user_db.rs:817-822`.
- `delete_range_note` deletes from `user_range_notes` but not `item_tags`: `app/src-tauri/src/user_db.rs:9145-9155`.

Impact: A caller using the exposed IPC command, or a future UI that enables those item types, can create tag links that will not survive import/export consistently and will orphan on delete.

Suggested fix: Either narrow `TAGGABLE_ITEM_TYPES` and schema to `bookmark`/`note` until broader support is implemented, or implement full create/import/list/delete semantics for `range_note` and `study_item`.

### R06-F05 - Low - Provider voice timeouts do not cancel underlying work

The sidecar-level `withTimeout` helper explicitly does not cancel the underlying provider promise. Its default voice timeout is 300 seconds, while direct provider HTTP calls generally default to 600 seconds. That means the Council can mark a voice as timed out while the underlying fetch/SDK work continues in the background until its own timeout settles.

Evidence:

- `withTimeout` comment states the loser keeps running: `app/sidecar/council.mjs:31-44`.
- Default voice timeout is 300 seconds: `app/sidecar/council.mjs:47-50`.
- OpenAI/Gemini/Gateway provider timeouts default to 600 seconds: `app/sidecar/providers/openai.mjs`, `app/sidecar/providers/gemini.mjs`, `app/sidecar/providers/gateway.mjs`.
- Rust sidecar request timeout is 1800 seconds: `app/src-tauri/src/sidecar.rs:16-18`.

Impact: Timed-out voices can still consume network/provider resources after the UI has moved on. This is most visible during slow provider incidents or repeated retries.

Suggested fix: Pass an `AbortSignal` into provider `analyze` calls and make `withTimeout` abort it. For Claude SDK calls, use any available SDK cancellation primitive or isolate timed-out work in a disposable sidecar process.

### R06-F06 - Low - AI model defaults are configurable, but release defaults are starting to lag current docs

This is not necessarily a runtime failure because users can override model IDs in Settings/environment. It is release hygiene: the baked-in defaults should be reviewed before every public release.

Evidence in code:

- OpenAI default is `gpt-5`: `app/sidecar/providers/openai.mjs:8`.
- Gemini default is `gemini-2.5-flash`: `app/sidecar/providers/gemini.mjs:10-16`.
- Anthropic API default is `claude-sonnet-4-6`, with `opus` alias mapped to `claude-opus-4-7`: `app/sidecar/providers/claude.mjs:15-26`.

External source check on 2026-06-11:

- OpenAI API docs navigation lists "Latest: GPT-5.5": https://platform.openai.com/docs/models
- Anthropic docs describe Claude Opus 4.8 as the current Opus-tier model and deprecation guidance recommends `claude-opus-4-8` over older Opus 4 IDs: https://docs.anthropic.com/en/docs/about-claude/models/overview and https://docs.anthropic.com/en/docs/about-claude/model-deprecations
- Google Gemini docs list newer Gemini model families, including Gemini 3.5 Flash, while this app defaults to Gemini 2.5 Flash: https://ai.google.dev/gemini-api/docs/models

Suggested fix: Keep defaults intentional. Add a release checklist item or automated doc-backed smoke check for default model IDs, and prefer a "known stable" label in UI copy if latest is not the goal.

## Carried-Forward Active Findings

These remain active from earlier reports unless superseded above.

1. Council semantic-only retrieval does not fall back to FTS.
2. Council retrieval mode can overstate "hybrid" for explicit-reference questions.
3. Ollama host accepts HTTPS while Rust reqwest is built without a TLS backend.
4. Clipboard failure handling remains inconsistent across Reader, Workspace, and Theology copy buttons.
5. Guided tour modal still needs focus management.
6. Runtime user schema, data/schema.sql, and resource import schema stamps remain out of sync.
7. macOS keyring backend is still missing from Cargo features unless the pre-existing local Cargo change addresses it.
8. Resource source metadata and JSON backups can expose source/path metadata.
9. JSON import and SQLite restore refresh only part of the frontend state.
10. Theology links can become stale after linked objects are deleted.
11. SQLite restore accepts a very small Bible AI-shaped database.
12. SQLite restore still uses raw path entry rather than a native picker.
13. Release builds depend on local sidecar runtime/dependency artifacts.
14. Council readiness can still be optimistic.

## Verification Performed In This Pass

- `npm run test:sidecar`: passed 66/66.
- `cargo test --manifest-path .\app\src-tauri\Cargo.toml tag --lib`: passed 10/10.
- Static review of Tauri capabilities/CSP, sidecar spawn/provider code, release scripts, model defaults, and tag/note/workspace delete paths.
- Official docs spot-check for current provider model references.

Not rerun in this pass:

- Full `npm run build`.
- Full Rust test suite.
- E2E suite. It remains blocked in this environment by the local Edge/msedgedriver mismatch documented in earlier reports.

## Suggested Next Fix Order

1. Fix note tag cleanup and add the missing regression test.
2. Narrow or fully implement the `range_note`/`study_item` tag contract.
3. Remove absolute paths from release manifests.
4. Make public macOS release checks enforce signing/notarization.
5. Implement abortable provider voice timeouts.
6. Reconfirm provider default models before the next release and update defaults/UI labels as needed.
