# Windows Install Guide

## Current Status

Bible AI is a public, MIT-licensed open-source project. It is Windows-first and
can be run from source today.

Windows installer packaging exists, but the installer is not a verified public release unless clean-profile manual QA has been completed. If that QA gate cannot be completed, treat generated NSIS/MSI installers as private test builds only.

“Private test build” describes the verification and distribution status of that
installer; it does not mean the GitHub repository or source code is private.

Use the GitHub Releases page only after a release explicitly says the Windows clean-profile gate has passed.

## Option 1: Run From Source

Use this path until a verified public installer is published.

Prerequisites:

- Windows 10 or Windows 11.
- Node.js 22 or newer.
- Rust stable toolchain.
- Tauri 2 Windows prerequisites.
- Python 3 if running corpus ingestion scripts.
- Ollama with the corpus lock's embedding model when generating a full corpus.

Commands:

```powershell
cd "C:\path\to\bible-ai"
python scripts\build_corpus.py
cd app
npm ci
npm ci --prefix sidecar
npm run tauri -- dev
```

The generated corpus is not committed. See the
[reproducible corpus guide](corpus-build.md) before starting its resumable build.
`npm run dev` starts only the Vite frontend; use the Tauri command above to run
the complete desktop application.

Run checks:

```powershell
npm run check
```

## Option 2: Private Test Installer

Only use this for private testing unless the release notes say the clean-profile release gate passed.

Build installers:

```powershell
cd "C:\path\to\bible-ai\app"
npm run release:build
```

Expected installer outputs are under:

```text
app/src-tauri/target/release/bundle/nsis
app/src-tauri/target/release/bundle/msi
```

Install one generated installer, launch Bible AI, and complete first-run setup.

## First Launch

1. Open Bible AI.
2. Use the guided tour if you are new to the app.
3. Read and search Scripture without AI setup if desired.
4. Open `Settings`.
5. Use `Guided AI setup`.
6. Choose `Personal keys`, `Local/no hosted key`, or `Managed gateway`.
7. Click `Save & test`.
8. Open `Council` and review `Voices before submit`.

## Provider Keys

Bible AI does not include shared OpenAI, Anthropic, Gemini, or gateway credentials.

Each user adds their own credentials locally. Provider secrets are stored in the Windows Credential Manager and are excluded from JSON backups.

See [User-Owned AI Provider Setup](user-owned-ai-setup.md).

## Release Caveat

The Windows public installer gate requires manual testing on a separate clean Windows profile or VM. If that is not possible, the project should not describe Windows installers as public-release-ready. Users should run from source or use clearly labeled private/test installers.
