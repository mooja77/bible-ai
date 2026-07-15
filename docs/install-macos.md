# macOS Install Guide

## Current Status

Bible AI is a public, MIT-licensed open-source project. Its macOS source path is
implemented: the project has a Darwin Node sidecar, native Apple Keychain
credential storage, `.app`/`.dmg` build scripts, and a macOS CI job that builds
and launch-smokes an ad-hoc `.app` bundle. On 2026-07-15 the release-candidate
workflow also built the complete Apple Silicon DMG with the checksum-verified
corpus, mounted it, copied `Bible AI.app`, launched the installed copy, and
verified non-empty `user.sqlite` creation.

The practical answer is:

- **Build and run from source on a Mac:** supported.
- **Build a local unsigned `.app`/`.dmg` on a Mac:** supported for development
  and testing.
- **Automated Apple Silicon DMG install/launch evidence:** passed on the
  `macos-26-arm64` GitHub runner.
- **Download an official DMG from GitHub Releases:** not available yet.
- **Treat macOS as manually verified for normal daily use:** not yet; the clean
  macOS profile, provider, backup/restore, Keychain, and Gatekeeper lap remains.

A final public macOS installer must still be Developer ID-signed, notarized,
stapled, and manually verified on a clean macOS profile. A Windows machine
cannot produce that final verified `.app`/`.dmg` release because the app needs a
Darwin-compatible sidecar runtime, macOS-native dependencies, Keychain checks,
and Gatekeeper/signing verification.

## Automated Candidate Evidence

The 2026-07-15 candidate was built from commit
`9adf30beb3c9ddd8304cbf364b4e4fcaf809d487` by
[GitHub Actions run 29406993816](https://github.com/mooja77/bible-ai/actions/runs/29406993816):

- architecture: Apple Silicon (`aarch64-apple-darwin`);
- DMG: `Bible AI_0.1.0_aarch64.dmg`, 605,836,814 bytes;
- corpus SHA-256:
  `782991bf79d4488753b82bf4b85ffdf134c59b1c3a9e76797c7d2fc9f788f394`;
- uploaded Actions artifact: 605,844,042 bytes, ZIP SHA-256
  `88b4783d7b3bbd05cc80888fcfdbe513a79bfc02f08a88257a13322dce34dbdf`.

This is an automated QA record, not a permanent download or public-release
approval. The candidate is ad-hoc signed, not notarized, and does not prove
Intel compatibility or a human clean-Mac workflow. It also predates the
2026-07-15 dependency baseline and must be rebuilt before release.

See [macOS Distribution Plan](macos-distribution-plan.md).
Maintainers should also follow the exact-artifact
[GitHub Release Process](github-release-process.md); it requires Developer ID,
notarization, stapling, and hash-bound clean-Mac evidence before promotion.

## Run From Source On A Mac

Install these prerequisites first:

- Xcode command-line tools (`xcode-select --install`).
- Node.js 22 and npm.
- Rust stable through `rustup`.
- Python 3 for the reproducible corpus build.
- Ollama with the checksum-locked embedding model when building the full corpus.

Then clone and prepare the repository:

```bash
git clone https://github.com/mooja77/bible-ai.git
cd bible-ai
python3 scripts/build_corpus.py
cd app
npm ci
npm run macos:sidecar:prepare
npm run macos:build-env:verify
npm run tauri -- dev
```

The corpus is generated rather than committed because of its size and source
review requirements. The build is resumable, downloads only checksum-locked
sources, and includes Ollama embedding stages; see the
[reproducible corpus guide](corpus-build.md) before starting it. If a verified
`data/corpus.sqlite` has already been supplied locally, do not rebuild it.

`npm run tauri -- dev` starts the complete desktop app. `npm run dev` by itself
starts only the Vite frontend and is not a functional substitute for the Tauri
desktop process.

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
npm ci
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
