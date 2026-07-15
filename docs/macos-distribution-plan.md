# macOS Distribution Plan

Bible AI is a public, MIT-licensed open-source project currently
release-packaged for Windows. macOS distribution is supported as a separate
release lane because the app must be built on macOS and must bundle a
Darwin-compatible Node sidecar runtime.

The macOS source lane is implemented. GitHub Actions builds and launch-smokes an
ad-hoc `.app`, verifies the Darwin Node resources, and checks that the native
Apple Keychain backend is compiled. A full-corpus Apple Silicon `.dmg` candidate
has also been built, mounted, copied, and launch-smoked on a macOS runner. A
public `.dmg` must still be Developer ID-signed, notarized, stapled, and manually
verified on a clean Apple computer. A Windows machine cannot produce the final
verified macOS public release.

## Goals

- Produce installable macOS `.app` and `.dmg` artifacts.
- Bundle `corpus.sqlite`, the Node sidecar, sidecar dependencies, and a macOS Node runtime at `sidecar/node/bin/node`.
- Verify first launch, Settings, provider keys, Council, exports, backup/restore, and Keychain credential storage on macOS.
- Add signing and notarization before public distribution outside local/test use.

## Current Constraint

The verified 2026-07-15 candidate is Apple Silicon-only and ad-hoc signed. It is
valid automated QA evidence, but it is not an Intel/universal package and does
not satisfy Gatekeeper, notarization, provider, Keychain persistence, or human
accessibility release gates.

The Windows release bundle includes:

- `sidecar/node/node.exe`
- Windows NSIS/MSI installers

macOS needs:

- `sidecar/node/bin/node`
- macOS-native `node_modules` optional packages
- the `apple-native` keyring feature for persistent Keychain storage
- Tauri `.app` and `.dmg` outputs from a macOS build host

The Rust sidecar launcher already supports this path: on non-Windows platforms it looks for `sidecar/node/bin/node`, then falls back to `BIBLE_AI_NODE` or system `node`.

## macOS Build Host Requirements

Use an Apple computer or macOS CI runner with:

- Xcode command line tools.
- Rust and Cargo.
- Node.js and npm.
- Tauri CLI dependencies installed through the normal app install flow.
- Provider credentials for real Council QA.
- Apple Developer signing/notarization credentials for public distribution.

## Release Scripts

Run these from `app/` on macOS:

```bash
npm run macos:sidecar:prepare
npm run macos:build-env:verify
npm run macos:release:build
```

The full build command does:

1. Copies the current macOS Node runtime into `app/sidecar/node/bin/node`.
2. Runs `npm ci --include=optional` in `app/sidecar` so native optional packages resolve for Darwin.
3. Verifies macOS build tools and sidecar runtime.
4. Runs `tauri build --bundles app,dmg`.
5. Verifies the `.app`, `.dmg`, bundled resources, sidecar runtime, manifest, summary, and release package.

Individual verification/package commands:

```bash
npm run macos:release:verify
npm run macos:release:manifest
npm run macos:release:manifest:verify
npm run macos:release:summary
npm run macos:release:summary:verify
npm run macos:release:package
npm run macos:release:package:verify
```

Expected macOS package output:

```text
app/src-tauri/target/release/macos-release-package
```

Expected release evidence:

- `macos-release-manifest.json`
- `macos-release-summary.md`
- DMG artifact copied into the package

## Signing And Notarization

Local unsigned builds are acceptable for development and private manual QA. Public macOS distribution requires:

1. Apple Developer ID signing identity.
2. Hardened runtime configuration through Tauri/macOS signing settings.
3. Notarization with Apple.
4. Stapling the notarization ticket to the distributed artifact.
5. Verification on a clean macOS user that Gatekeeper opens the app without bypass steps.

The script `npm run macos:release:verify` can enforce codesign verification when run on macOS with:

```bash
BIBLE_AI_REQUIRE_MACOS_CODESIGN=true npm run macos:release:verify
```

## macOS Manual QA Gate

Before declaring macOS installable:

1. Install from the DMG on a clean macOS user profile.
2. Confirm first launch and local data creation.
3. Open Settings and add at least two provider credentials.
4. Confirm credentials are stored in Keychain, not SQLite backups.
5. Run one real Council question with mock mode disabled.
6. Save a Council result to a workspace.
7. Export Markdown, HTML, PDF, backup JSON, and SQLite backup.
8. Restore backups into a fresh profile.
9. Confirm exports/source drawers contain no local paths, raw provider credentials, or credential names.
10. Confirm app restart preserves settings and workspaces.

## Public Release Gate

macOS public release is complete only when:

- `npm run macos:release:build` passes on macOS.
- A clean macOS profile manual QA pass is recorded.
- Signing/notarization verification passes for public builds.
- Release notes include macOS-specific installation notes.
- Windows release gates remain separate and passing.
