# Bible AI

Bible AI is an offline-first desktop Bible study app with a transparent multi-provider "Council" workflow for disputed theological questions. It is built to help users inspect evidence, compare arguments, record their own judgments, and build a personal systematic theology without handing their thinking over to an AI answer.

The current app is Windows-first, with macOS distribution scripts and release gates documented for a future Apple build.

## Features

- Public-domain Bible corpus architecture with SQLite search.
- Reader, search, notes, highlights, bookmarks, workspaces, and exports.
- Council workflow with multiple provider voices, visible evidence, disagreement, argument maps, and user judgment panels.
- User-owned provider setup for OpenAI, Anthropic, Gemini, Claude Code, Ollama, and managed gateways.
- Provider credentials stored in the operating-system credential vault.
- Dynamic systematic theology workspace with linked passages, Council sessions, resources, conclusions, and guided study.
- Open-resource ingestion workflow with source review and attribution gates.
- Windows release packaging with NSIS/MSI verification.
- macOS release plan and scripts for `.app`/`.dmg` builds on a Mac.

## Repository Layout

```text
app/                 Tauri 2 desktop app: React, TypeScript, Rust
app/sidecar/         Node sidecar for Council/provider orchestration
data/                SQLite schema and local corpus build outputs
docs/                Architecture, roadmap, release, data-source, and UX docs
scripts/             Corpus ingestion and real-provider QA helpers
prompts/             Prompt and planning artifacts
```

## Development Setup

Prerequisites:

- Node.js 22 or newer
- Rust stable toolchain
- Tauri 2 prerequisites for your operating system
- Python 3 for corpus ingestion scripts

Install app dependencies:

```bash
cd app
npm install
```

Run checks:

```bash
npm run check
```

Start the app in development:

```bash
npm run dev
```

The generated corpus database is not committed. See [`docs/data-sources.md`](docs/data-sources.md) and the scripts in [`scripts/`](scripts/) for source and ingestion details.

## Provider Setup

Bible AI does not ship with shared OpenAI, Anthropic, Gemini, or gateway credentials. Test keys used during development are not included in the repository or release packages. Each user connects their own provider accounts on their own machine.

For normal desktop use:

1. Open `Settings`.
2. Use `Guided AI setup` to choose `Personal keys`, `Local/no hosted key`, or `Managed gateway`.
3. Paste the user's own OpenAI, Anthropic, or Gemini API key into the matching field, or enter the local/gateway settings for that setup path.
4. Click `Save & test`.
5. Open `Council` and confirm the voice preview shows which providers will run.

For local development, copy `.env.example` to `.env` and fill only your own local keys. Never commit `.env`.

Supported hosted providers require user-owned API access:

- OpenAI API
- Anthropic API
- Google Gemini API

Other supported options:

- Claude Code login
- Ollama
- Managed gateway for team deployments

See [`docs/user-owned-ai-setup.md`](docs/user-owned-ai-setup.md).

## Release Status

Windows packaging is the active release lane:

```bash
cd app
npm run release:build
```

The public Windows release gate still requires clean-profile manual installer and credential-vault verification. See [`docs/manual-release-qa-report.md`](docs/manual-release-qa-report.md).

macOS packaging must run on macOS:

```bash
cd app
npm run macos:release:build
```

See [`docs/macos-distribution-plan.md`](docs/macos-distribution-plan.md).

## Documentation

- [`docs/architecture.md`](docs/architecture.md)
- [`docs/feature-roadmap.md`](docs/feature-roadmap.md)
- [`docs/technical-implementation-plan.md`](docs/technical-implementation-plan.md)
- [`docs/testing-and-release-plan.md`](docs/testing-and-release-plan.md)
- [`docs/data-sources.md`](docs/data-sources.md)
- [`docs/privacy-and-distribution.md`](docs/privacy-and-distribution.md)
- [`docs/learning-and-systematic-theology-plan.md`](docs/learning-and-systematic-theology-plan.md)

## License

Source code is licensed under the MIT License. Study data, Bible texts, lexicons, and other resources may have separate licenses and attribution requirements; see [`NOTICE.md`](NOTICE.md) and [`docs/data-sources.md`](docs/data-sources.md).
