# Bible AI

Bible AI is an offline-first desktop Bible study app for reading Scripture, comparing arguments, saving research, and building a personal systematic theology.

The app is designed around one principle: AI should assist learning and judgment, not replace them. Its Council workflow makes provider voices, retrieved evidence, disagreement, confidence, and source data visible so users can inspect why one argument worked better than another.

Bible AI is a [public open-source project on GitHub](https://github.com/mooja77/bible-ai). The application source code is licensed under MIT. Bundled Bible texts, lexicons, cross-references, and imported study resources retain their own licences and attribution requirements; references to a free/non-commercial release scope apply to those distribution decisions, not to the MIT source-code licence.

## What You Can Do

- Read and search public-domain Bible translations in a local desktop app.
- Compare passages, translations, notes, highlights, bookmarks, and saved searches.
- Ask theological questions through a transparent multi-provider Council.
- Review the Council process, evidence use, argument maps, voice disagreement, confidence rationale, and raw source drawer.
- Save studies into Workspaces and export them to Markdown, HTML, or PDF.
- Build a dynamic systematic theology by linking passages, Council sessions, resources, positions, and your own conclusions.
- Search open resources with visible source, license, and attribution metadata.
- Use your own AI provider access, local tools, or a managed gateway.

## Who It Is For

Bible AI is for people who want help studying Scripture without turning the study process into a black box.

It is especially useful for:

- Bible readers who want searchable local study notes.
- Students comparing theological arguments.
- Pastors, teachers, and small groups preparing studies.
- Users building a long-term systematic theology notebook.
- Developers experimenting with transparent AI-assisted research workflows.

Bible AI is not intended to be a theological authority. The app keeps the user responsible for reading the evidence, weighing arguments, and recording their own judgment.

## Main App Areas

### Reader

Read Scripture by book and chapter, switch translations, adjust reader layout, search the corpus, save bookmarks, add notes, highlight verses, and select verse ranges for deeper study.

### Council

Ask interpretive or disputed theological questions. The Council retrieves candidate evidence, runs configured AI voices, compares positions, and shows the reasoning artifacts used to form the synthesis.

After a Council answer, users can inspect:

- Which provider voices ran, failed, or were skipped.
- Which passages were retrieved and why.
- Which evidence supported, challenged, or was ignored by each position.
- Why one position ranked above another.
- Confidence rationale and unresolved tensions.
- Source JSON for audit and export verification.

### Theology

Build a living systematic theology. Create doctrine topics, write conclusions, record unresolved questions, add competing positions, and link evidence from Scripture, resources, workspaces, and Council sessions.

### Resources

Search imported open resources and review license/attribution information before using them in studies or exports.

### Workspaces

Collect passages, search hits, notes, explanations, resource entries, and Council sessions into reusable studies. Export workspaces when you want to share or archive a study.

### Settings

Configure AI providers, run provider tests, review data sources, manage backups, view privacy/distribution notes, and inspect app release status.

## First-Time Use

1. Open the app.
2. Use the built-in guided tour to understand Reader, Council, Theology, Resources, Workspaces, and Settings.
3. Read and search Scripture without any AI setup.
4. Open `Settings` when you want AI-assisted Council answers.
5. Use `Guided AI setup`.
6. Choose one setup path:
   - `Personal keys`: your own OpenAI, Anthropic, or Gemini API keys.
   - `Local/no hosted key`: Claude Code login if available, plus optional Ollama.
   - `Managed gateway`: a team/public gateway URL and optional token.
7. Click `Save & test`.
8. Open `Council` and check `Voices before submit` before asking a question.

## AI Provider Setup

Bible AI does not ship with shared OpenAI, Anthropic, Gemini, or gateway credentials. Each user configures their own provider access on their own machine.

Supported hosted providers:

- OpenAI API
- Anthropic API
- Google Gemini API

Other supported options:

- Claude Code login
- Ollama
- Managed gateway for team or public deployments

Important subscription note: a ChatGPT, Claude, or Gemini consumer subscription is not the same thing as API billing. Hosted API use generally requires provider API access and billing from that provider.

Provider credentials are stored in the operating-system credential vault and are excluded from JSON backups.

See [User-Owned AI Provider Setup](docs/user-owned-ai-setup.md).

## Privacy And Data

Bible AI is local-first.

- Reading data, notes, highlights, workspaces, theology topics, bookmarks, and Council history are stored on the local machine.
- Provider calls send the user question and retrieved evidence only to the configured provider or gateway.
- Provider keys and gateway tokens are not committed, bundled, exported, or included in release packages.
- JSON backups redact provider secrets.
- Source drawers and release checks are designed to avoid leaking local paths or provider key names.

See [Privacy And Distribution](docs/privacy-and-distribution.md).

## Data Sources

The app is built around public-domain and open-license source review. Bundled and imported resources have visible source and license metadata in Settings.

Current source areas include:

- Public-domain Bible translations.
- Original-language and word-study data where available.
- Cross-reference and resource metadata.
- User-imported open resources with attribution gates.

See [Data Sources](docs/data-sources.md) and [Notice](NOTICE.md).

## Installation Status

Bible AI is an open-source, Windows-first project hosted publicly on GitHub.

Windows packaging exists, but the public installer is not verified unless clean-profile installer QA and credential-vault verification have been completed. If that gate cannot be completed, generated Windows installers should be treated as private/test builds only.

There are currently no downloadable binaries on the GitHub Releases page. Until a release is published, clone the repository and run or build the app from source.

The repository now includes a fail-closed, two-stage GitHub Release pipeline:
it builds a private immutable candidate, binds manual QA to the exact installer
hashes, and promotes those same files only after the protected release gates
pass. See the [GitHub Release Process](docs/github-release-process.md).

macOS source builds are supported: the repository includes a Darwin Node sidecar, native Apple Keychain storage, and `.app`/`.dmg` build scripts. The release-candidate workflow has also built a full-corpus Apple Silicon DMG, mounted it, copied the app, launch-smoked it, and verified local `user.sqlite` creation on a macOS runner. There is not yet a permanent, manually approved, Developer ID-signed/notarized GitHub Release DMG. See [macOS Install Guide](docs/install-macos.md) and [macOS Distribution Plan](docs/macos-distribution-plan.md).

Install guides:

- [Windows Install Guide](docs/install-windows.md)
- [macOS Install Guide](docs/install-macos.md)

## Run From Source

Prerequisites:

- Node.js 22.12 or newer (or another version supported by the pinned Vite release)
- Rust stable toolchain
- Tauri 2 prerequisites for your operating system
- Python 3 for corpus ingestion scripts
- Ollama with the corpus lock's embedding model when generating a full corpus

Install dependencies (the Node sidecar has its own `package.json`):

```bash
cd app
npm install
cd sidecar && npm install && cd ..
```

Start the full desktop application in development mode:

```bash
npm run tauri -- dev
```

`npm run dev` starts only the Vite frontend. The Tauri command above starts the
desktop shell, local database, credential vault, and Council sidecar as well.

Run checks:

```bash
npm run check
npm run check:trust
npm run test:e2e:build
```

`test:e2e:build` verifies the locally installed Microsoft Edge version, installs
the exact Microsoft-signed EdgeDriver into an ignored project cache, and then
runs the disposable-profile Tauri WebView suite. See [Testing and Release](docs/testing-and-release-plan.md).

Corpus rebuild and Council evaluation processes:

- [Reproducible corpus build](docs/corpus-build.md)
- [Council confidence-adjustment review](docs/council-confidence-review.md)

Build a Windows release package:

```bash
cd app
npm run release:build
```

Build a macOS package on macOS:

```bash
cd app
npm run macos:release:build
```

The generated corpus database is not committed. See the data-source docs and scripts for ingestion details.

## Repository Layout

```text
app/                 Tauri 2 desktop app: React, TypeScript, Rust
app/sidecar/         Node sidecar for Council/provider orchestration
data/                SQLite schema and local corpus build outputs
docs/                Architecture, roadmap, release, data-source, and UX docs
scripts/             Corpus ingestion and QA helpers
prompts/             Prompt and planning artifacts
```

## Documentation

- [Architecture](docs/architecture.md)
- [Feature Roadmap](docs/feature-roadmap.md)
- [Technical Implementation Plan](docs/technical-implementation-plan.md)
- [Testing And Release Plan](docs/testing-and-release-plan.md)
- [Council Transparency Plan](docs/council-transparency-visualization-plan.md)
- [Learning And Systematic Theology Plan](docs/learning-and-systematic-theology-plan.md)
- [Open Resource Ingestion Plan](docs/open-resource-ingestion-plan.md)
- [Data Sources](docs/data-sources.md)
- [Reproducible Corpus Build](docs/corpus-build.md)
- [Windows Install Guide](docs/install-windows.md)
- [macOS Install Guide](docs/install-macos.md)
- [User-Owned AI Provider Setup](docs/user-owned-ai-setup.md)
- [Privacy And Distribution](docs/privacy-and-distribution.md)
- [Release Notes](docs/release-notes.md)
- [GitHub Release Process](docs/github-release-process.md)
- [2026-07-13 Deep Review and Implementation Report](docs/reviews/2026-07-13-project-deep-review-and-implementation-report.md)
- [Trust Remediation Programme](docs/reviews/2026-07-13-trust-remediation-programme.md)

## Contributing

Contributions are welcome, especially around testing, documentation, UI polish, source review, corpus ingestion, and release verification.

Before opening a pull request:

1. Keep provider keys and local secrets out of commits.
2. Run `npm run check` from `app/`.
3. Update docs when behavior changes.
4. Keep transparency and user judgment central to AI features.

See [Contributing](CONTRIBUTING.md) and [Security](SECURITY.md).

## License

Source code is licensed under the MIT License.

Study data, Bible texts, lexicons, cross-references, and other resources may have separate licenses and attribution requirements. See [LICENSE](LICENSE), [NOTICE](NOTICE.md), and [Data Sources](docs/data-sources.md).
