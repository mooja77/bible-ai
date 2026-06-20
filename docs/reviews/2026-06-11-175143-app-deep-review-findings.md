# App Deep Review Findings - 2026-06-11 17:51:43 +01:00

Filename timestamp: `2026-06-11-175143`

Verification timestamp: `2026-06-11 17:56:56 +01:00`

Scope: another read-only review cycle over the current Bible AI app state, with fresh passes over Tauri CSP/permissions, release metadata, bundled runtime/dependency artifacts, public build output, local persistence, schema/version boundaries, and accumulated open findings from the prior timestamped reports.

No app code was changed in this pass. `npm run build` regenerated ignored `app/dist` output for inspection. The worktree already had a modified `app/src-tauri/Cargo.toml` before this pass; I did not change or revert it.

## Current State Snapshot

- Stack: Tauri 2 desktop app, React 19, Vite 7, Rust backend, SQLite user/corpus databases, and a bundled Node sidecar for AI/provider orchestration.
- Release posture: version `0.1.0`, Windows-first personal-use release candidate. macOS scripts exist, but public macOS distribution still depends on macOS-hosted signing/notarization work.
- Tauri frontend boundary is narrow: production CSP avoids `unsafe-eval`; `devCsp` carries the Vite-only eval allowance. The default capability grants only `core:default` and `dialog:allow-save`.
- Sidecar packaging is local-artifact based: `tauri.conf.json` bundles `sidecar/node`, `sidecar/node_modules`, provider modules, sidecar entrypoints, sidecar package metadata, and `data/corpus.sqlite`.
- Local UI persistence is limited and guarded: theme, app text scale, guided-tour dismissal, and provider-setup dismissal use wrapped `localStorage` access. Theme and UI scale values are constrained to known values/steps.
- Runtime user schema is `USER_SCHEMA_VERSION = 14`; `data/schema.sql` and the resource JSONL importer are still behind that runtime schema.

## New Findings From This Pass

### 1. Medium - Public release artifacts lack a complete third-party runtime/dependency notice gate

The app ships more than project source and corpus data. Tauri bundle resources include the sidecar Node runtime and sidecar `node_modules` (`app/src-tauri/tauri.conf.json`). The checked-out Windows sidecar runtime directory currently contains only `app/sidecar/node/node.exe`, which reports `v22.20.0`, is `85,588,976` bytes, and has SHA-256 `FDDDBF4581E046B8102815D56208D6A248950BB554570B81519A8A5DACFEE95D`.

The sidecar dependency directory contains 731 files and about `95,781,078` bytes. The installed top-level dependencies include `@anthropic-ai/claude-agent-sdk`, `zod`, and `@img/sharp-win32-x64`. The installed Sharp native package includes `libvips-42.dll`, `sharp-win32-x64.node`, and declares `Apache-2.0 AND LGPL-3.0-or-later` in its package metadata. The Anthropic package declares license handling through its own included license/legal files.

`NOTICE.md` currently covers the app MIT license, corpus/study-data posture, DejaVu Sans, and provider credential cautions. It does not inventory the bundled Node runtime, npm packages, native DLLs, or their license files. The Windows and macOS release verification scripts check that `node.exe`/`node`, `node_modules`, sidecar entrypoints, installers, manifests, and summaries exist, but they do not require a third-party notice file, SBOM, dependency license inventory, or bundled upstream license texts. The release package script copies only installers plus release manifest/summary.

Impact: a public installer can bundle third-party runtime/native code without a machine-checked notice/compliance artifact. This is a release/compliance risk rather than an observed runtime defect.

Recommendation: add a public-release gate that builds a third-party notices/SBOM artifact from the sidecar lockfile and bundled Node runtime provenance, includes required upstream license texts, records Node version/hash/source, and fails if required notices are missing. Treat this as separate from corpus/resource attribution, which is already documented more thoroughly.

### 2. Low/Medium - Production build still ships starter Vite/Tauri branding assets

The production HTML still uses the Vite starter favicon:

- `app/index.html` references `/vite.svg` as the favicon.
- `app/public/vite.svg` and `app/public/tauri.svg` are present.
- After `npm run build`, `app/dist/index.html` still references `/vite.svg`, and `app/dist` contains both `vite.svg` and `tauri.svg`.
- Branded application icons already exist under `app/src-tauri/icons`, so this is not blocked by missing icon assets.

Impact: the installed WebView/browser chrome can show Vite branding, and production artifacts contain unused starter assets. This makes the release look unfinished and can confuse support/screenshots even though it is not a security issue.

Recommendation: replace the favicon reference with a Bible AI icon copied into `public/`, remove unused starter public assets, and optionally add a small release/static check that fails on `vite.svg`, `tauri.svg`, or unused `react.svg` starter assets in production surfaces.

### 3. Low - Cargo package metadata still has Tauri starter placeholders

`app/src-tauri/Cargo.toml` still says:

- `description = "A Tauri App"`
- `authors = ["you"]`

This conflicts with the otherwise branded product metadata in `tauri.conf.json` (`productName = "Bible AI"`, identifier `com.jm.bibleai`) and the release/docs surfaces.

Impact: package metadata, installer metadata, generated manifests, or downstream audits can show placeholder provenance even when the user-facing app is branded correctly.

Recommendation: update Cargo metadata before release: real description, author/organization, repository/homepage if applicable, and license alignment with the top-level MIT license.

### 4. Low - Settings displays a hard-coded app version separate from release metadata

`app/src/features/settings/SettingsInfoSections.tsx` hard-codes `APP_VERSION = "0.1.0"` while release scripts derive version from `tauri.conf.json` through `app/scripts/release-metadata.mjs`, and `app/package.json` also has its own `version = "0.1.0"`.

The values match today, but the UI test also asserts the hard-coded string in Settings. That makes future version bumps easy to miss in the in-app About surface.

Impact: release notes, installers, and Settings can drift after a version bump.

Recommendation: centralize version display. Options: generate a small build-time metadata module from `tauri.conf.json`, import package metadata through a supported Vite path, or expose an app metadata command from Tauri. Keep the e2e assertion tied to the same source rather than a duplicated literal.

## Reconfirmed Active Findings

These were already documented in earlier timestamped reports and still appear relevant in the current tree.

### Schema and import drift

- Runtime `USER_SCHEMA_VERSION` is `14`, but `data/schema.sql` still says its user section mirrors v12.
- `app/scripts/resources/import-resource-jsonl.mjs` still emits `user_schema_version: 13` despite an inline comment saying it must stay in sync with runtime schema.
- Backup/import accepts older schemas, so this does not currently block imports, but it weakens fixture metadata and developer confidence.

### Resource ingestion and backup import

- Generic backup JSON import can import resource sources/entries without enforcing the stricter scripted source-assessment gate.
- Resource backup import still lacks practical JSON size, row count, and large `resource_entries.body` budgets.
- Imported resource/source metadata can expose source/path details if the metadata contains them.

### Council/provider execution

- Council semantic-only retrieval can fail instead of degrading to keyword/FTS when semantic retrieval is unavailable.
- Council retrieval labels can overstate `hybrid` for explicit-reference queries.
- Frontend Council timeout does not cancel the backend sidecar/provider work.
- Provider voice timeouts in the sidecar do not cancel losing provider calls.
- Per-provider Settings test buttons still run the full diagnostics path rather than a scoped provider check.
- Council readiness can still look optimistic before every selected route is actually usable.
- Default AI model IDs should be reconfirmed against provider docs before any public release.

### Release and distribution

- Release manifests can include absolute local build paths.
- Release builds depend on ignored/local sidecar runtime and dependency artifacts.
- macOS release checks make signing/notarization optional unless stricter environment flags are set.
- The visible Cargo dependency features still show `keyring` with `windows-native` only; macOS credential storage needs a platform-specific release check.
- SQLite restore has improved validation, but it still accepts a minimal Bible AI-shaped database and uses a raw path entry workflow.

### Data integrity and UX polish

- Note deletion can leave note tag links behind.
- The taggable item contract is broader than fully implemented import/delete/list support.
- Theology links can go stale after linked objects are deleted.
- JSON import and SQLite restore refresh only part of the frontend in-memory state.
- Explicit Markdown Save As can overwrite an existing absolute Markdown path without backend overwrite policy.
- Clipboard failure handling remains inconsistent across Reader, Workspace, and Theology copy flows.
- Guided tour modal still needs stronger focus management.
- Ollama settings accept HTTPS while Rust `reqwest` is built without a TLS backend.

## Positive Checks From This Pass

- Production CSP is reasonably tight for the current architecture: external same-origin scripts are allowed through `default-src 'self'`, `unsafe-eval` is dev-only, objects are blocked, and frame ancestors are blocked.
- The saved-theme first-paint script is an external public file (`theme-init.js`), so the production CSP does not need inline script execution for theme startup.
- Tauri capabilities remain narrow: no broad filesystem, shell, or HTTP plugin permission was found in the default capability.
- LocalStorage usage is small and defensive. Values are constrained for theme, UI scale, tour dismissal, and provider setup dismissal.
- Actual installed sidecar optional dependencies on Windows include only the Windows Sharp package under `@img`, not every optional platform package from the lockfile.
- The in-app release/distribution copy correctly describes the app as a personal-use release candidate and public release as gated on clean-profile and multi-provider QA.

## Verification Run

- `npm run build` from `app/` - passed. Vite built 97 modules; output included `dist/index.html`, one CSS asset, one JS asset, `theme-init.js`, `vite.svg`, and `tauri.svg`.
- `npm run test:sidecar` from `app/` - passed, 66/66 tests.
- `npm audit --json` from `app/` - passed, 0 vulnerabilities across reported app dependency metadata.
- `npm audit --json` from `app/sidecar` - passed, 0 vulnerabilities across reported sidecar dependency metadata.

Not rerun in this pass:

- Full `npm run check`.
- Rust test suite.
- E2E suite.
- Release build/install smoke.

## Suggested Next Fix Order

1. Add third-party runtime/dependency notices or an SBOM release gate for bundled Node and sidecar npm/native dependencies.
2. Replace the Vite favicon and remove starter public assets from production output.
3. Fix Cargo package metadata placeholders.
4. Bring schema stamps/docs/import generator back into sync with `USER_SCHEMA_VERSION = 14`.
5. Continue with the higher-impact behavioral backlog: Council cancellation/fallback, resource import budgets/gates, stale tag/link cleanup, and scoped provider diagnostics.
