# macOS Install Guide

## Current Status

Bible AI has macOS distribution scripts and a macOS release plan, but there is not yet a verified public `.dmg` release.

A public macOS installer must be built and verified on an Apple computer or macOS CI runner. A Windows machine cannot produce the final verified macOS `.app`/`.dmg` release because the app needs a Darwin-compatible sidecar runtime, macOS-native dependencies, Keychain checks, and Gatekeeper/signing verification.

Until a release explicitly provides a verified macOS DMG, Apple users should treat macOS support as planned rather than public-release-ready.

See [macOS Distribution Plan](macos-distribution-plan.md).

## Future Public DMG Install

When a verified DMG is available:

1. Download the `.dmg` from the GitHub Releases page.
2. Open the DMG.
3. Drag `Bible AI.app` to `Applications`.
4. Launch Bible AI.
5. Complete first-run setup in `Settings`.
6. Use `Guided AI setup` to choose `Personal keys`, `Local/no hosted key`, or `Managed gateway`.
7. Click `Save & test`.
8. Open `Council` and review `Voices before submit`.

## Build On A Mac

Use an Apple computer or macOS CI runner with:

- Xcode command line tools.
- Node.js and npm.
- Rust stable toolchain.
- Tauri 2 macOS prerequisites.
- Optional Apple Developer signing and notarization credentials for public distribution.

Commands from `app/`:

```bash
npm install
npm run macos:release:build
```

The macOS release build runs sidecar preparation, build-environment verification, Tauri `.app`/`.dmg` build, manifest generation, summary generation, and release-package verification.

Expected package output:

```text
app/src-tauri/target/release/macos-release-package
```

## Manual QA Before Public Release

Before publishing a macOS DMG:

1. Install from the DMG on a clean macOS user profile.
2. Confirm first launch and local data creation.
3. Add provider credentials through Settings.
4. Confirm credentials are stored in Keychain, not SQLite backups.
5. Run a real Council question with mock mode disabled.
6. Test workspace save/export, backup, restore, restart, and source drawers.
7. Confirm exports do not include local paths or raw credentials.
8. Verify signing/notarization and Gatekeeper behavior for public distribution.

If these steps have not been completed on macOS, do not publish the DMG as a verified public release.
