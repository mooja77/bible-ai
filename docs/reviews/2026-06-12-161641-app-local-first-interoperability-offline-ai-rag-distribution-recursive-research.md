# Bible AI local-first, interoperability, offline AI, RAG, and distribution recursive research

Generated: 2026-06-12 16:16:41 +01:00

Filename timestamp: 2026-06-12-161641

Scope: another recursive research loop over the current app, local-first software patterns, export/interoperability standards, desktop AI tooling, embedded search/RAG options, LLM evaluation tools, packaging/distribution channels, and partner/community source ecosystems.

## Executive update

The previous loop narrowed the beta wedge to an auditable Study Packet workflow. This loop asks what technical and ecosystem choices make that workflow portable, trustworthy, and maintainable without turning the app into a hosted SaaS product.

Updated thesis: Bible AI should treat local-first ownership and interoperable export as part of the product, not as implementation details. A Study Packet should be useful even if the user later leaves the app, moves to Obsidian, cites sources in a paper, hands the packet to a small-group co-leader, or re-runs the same study with a different AI provider.

The strongest next technical moves are:

1. Define `Study Packet v1` as a portable folder/export contract, not only an in-app view.
2. Keep SQLite plus current FTS and BLOB-vector scan until latency/scale measurements prove a need for sqlite-vec, LanceDB, or Tantivy.
3. Add an OpenAI-compatible local endpoint adapter layer for local model hosts, but keep Ollama as the default because the app already has that path.
4. Add a small LLM/RAG evaluation harness before adding more AI surfaces.
5. Keep distribution conservative: signed manual installers and checksums before auto-update, Microsoft Store, WinGet, or Homebrew.
6. Keep collaboration/sync out of v0.1. Use export, backup, restore, and predictable file formats first.

## Pass loop summary

### Pass 1 - Current stack and implementation state

Local stack observed:

- Tauri 2 desktop shell.
- React 19, TypeScript, Vite 7, Tailwind 4.
- Rust backend with `rusqlite` and bundled SQLite.
- Node sidecar for Council providers.
- Provider wrappers for Claude, managed gateway, Gemini, and OpenAI.
- User-owned provider setup with OS credential vault storage.
- Local semantic retrieval through Ollama embeddings.
- Bundled corpus in `corpus.sqlite`.
- User data in local SQLite.
- Markdown, HTML, and PDF-oriented workspace/theology exports.

Current implementation details that matter:

- `docs/architecture.md` still lists `sqlite-vec` as the vector-store plan.
- `docs/data-sources.md` and `app/src-tauri/src/db.rs` show the current implementation is not sqlite-vec. Embeddings are stored as little-endian `f32` BLOBs in SQLite and searched by Rust cosine scan.
- `app/src-tauri/src/lib.rs` hard-codes `EMBED_MODEL` as `nomic-embed-text`.
- `app/src-tauri/src/ollama.rs` uses Ollama's native `/api/embeddings` endpoint.
- Semantic retrieval degrades to keyword/FTS when embeddings or Ollama are unavailable.
- Council sidecar providers are thin wrappers around remote/local provider calls and normalize JSON into one Council result schema.
- Provider secrets are stored in the OS credential vault and excluded from JSON backups.
- Tauri CSP is already present; production CSP is materially tighter than dev CSP.
- Release scripts are unusually mature for v0.1: manifest, hashes, package verification, archive verification, clean-profile manual gates, macOS prep, and sidecar staging all exist.

Recursive improvement over the previous docs: the next roadmap should explicitly separate "format/contract" work from "infrastructure replacement" work. The app already has enough infrastructure to prove a beta workflow. The missing technical moat is a durable packet contract, not a new database.

### Pass 2 - Local-first and interoperability research

Ink & Switch's local-first framing remains highly relevant: local-first software emphasizes user ownership, offline work, privacy, long-term preservation, and optional collaboration. Source: https://www.inkandswitch.com/essay/local-first/

For Bible AI, the practical interpretation should be:

- The local machine remains the source of truth for v0.1.
- Users should not need an account to read, search, annotate, export, or revisit research.
- Backups and exports must be understandable without the app.
- Collaboration and sync should not be introduced until file/export contracts are stable.

Automerge, Replicache, ElectricSQL, and similar tools prove that local-first sync is a serious space, but they are not automatic fits for this app's v0.1. Sources: https://automerge.org/, https://replicache.dev/, https://electric-sql.com/

Why not adopt sync now:

- The app's core evidence/judgment model is still being hardened.
- CRDT-style collaboration would create theological judgment merge questions, not just technical merge questions.
- Team/church deployment would need policy, identity, retention, audit, and support decisions.
- Current JSON export, SQLite backup, Markdown/HTML/PDF export, and local DB model already satisfy the first ownership requirement.

Interoperability standard to target:

- CommonMark-compatible Markdown for human-readable packet content. Source: https://commonmark.org/
- YAML front matter for packet metadata.
- Optional CSL JSON or BibTeX sidecar for bibliographic metadata where resources have citation-grade metadata. Zotero supports many bibliographic import/export formats. Source: https://www.zotero.org/support/dev/data_formats
- Pandoc-friendly Markdown so advanced users can convert packets into DOCX, PDF, HTML, LaTeX, or other formats. Source: https://pandoc.org/MANUAL.html
- Obsidian-friendly folder/file layout because Obsidian stores notes as Markdown files in a local vault. Source: https://obsidian.md/help/data-storage

Recommended `Study Packet v1` folder export:

```text
Study Packet Title/
  packet.md
  packet.json
  sources.csl.json
  resources/
    attribution.md
  evidence/
    retrieved-passages.json
    council-response.json
  exports/
    packet.html
    packet.pdf
```

Rules:

- `packet.md` is the primary human artifact.
- `packet.json` is the machine-readable contract for re-import or verification.
- `sources.csl.json` is optional but recommended when citation metadata exists.
- `resources/attribution.md` records license and attribution.
- `evidence/` stores the retrieval and Council trace, with secrets/local paths redacted.
- Generated AI sections are labeled.
- User judgment is separate from AI synthesis.

### Pass 3 - Desktop AI and local model tooling

Ollama remains the best default local model host for this app because it is already integrated and supports embeddings. Ollama also documents OpenAI compatibility for parts of the OpenAI API, which can reduce adapter friction later. Sources: https://docs.ollama.com/api/openai-compatibility and https://ollama.com/blog/embedding-models

LM Studio is a strong second local-host target because it exposes local models through OpenAI-compatible endpoints and is positioned around local/private model use on the user's computer. Sources: https://lmstudio.ai/ and https://lmstudio.ai/docs/developer/openai-compat

llama.cpp is the lower-level power-user route. Its server documents OpenAI-compatible chat, responses, embeddings, reranking, monitoring, and schema-constrained JSON. Source: https://github.com/ggml-org/llama.cpp/blob/master/tools/server/README.md

ONNX Runtime GenAI is relevant later for tighter native Windows/on-device integration, but its generate API is still documented as preview. Source: https://onnxruntime.ai/docs/genai/

Recommended adapter strategy:

1. Keep current Ollama native embedding path as the default.
2. Add a local AI provider abstraction that separates:
   - embedding endpoint,
   - chat endpoint,
   - model ID,
   - embedding dimension,
   - provider API dialect,
   - timeout/retry policy.
3. Add an `OpenAI-compatible local` path for LM Studio, llama.cpp server, and Ollama `/v1` compatibility where supported.
4. Do not allow users to switch embedding models against an existing corpus without a visible "corpus was embedded with X" warning.
5. Add corpus embedding metadata checks before semantic search:
   - model name,
   - dimension,
   - source corpus version,
   - embedding creation timestamp,
   - query embedding provider.

Key caution: OpenAI-compatible does not mean fully equivalent. Local servers differ in model listing, embeddings, tool calling, JSON reliability, context limits, and timeout behavior. Treat the adapter as a tested compatibility surface, not a blind URL setting.

### Pass 4 - Search and RAG infrastructure options

Current approach:

- SQLite stores source/corpus tables.
- FTS5 handles keyword search.
- `verse_embeddings` stores raw embedding BLOBs.
- Rust scans vectors and ranks by cosine similarity.
- Hybrid retrieval combines semantic and FTS paths.

This is appropriate for v0.1 because the corpus is small enough, the app is local, and the current system is easy to inspect.

SQLite FTS5 remains a good fit for exact wording, phrase, and lexical search. SQLite documents FTS5 ranking and BM25 custom ranking support. Source: https://sqlite.org/fts5.html

sqlite-vec is a plausible later upgrade because it is a small SQLite vector extension designed for local vector search, but its repository warns that it is pre-v1 and breaking changes should be expected. Source: https://github.com/asg017/sqlite-vec

Tantivy is a strong Rust-native option for larger full-text search workloads. It is a Lucene-inspired full-text search engine library in Rust. Source: https://github.com/quickwit-oss/tantivy

LanceDB is a stronger fit for larger multimodal/vector workloads than the current corpus needs. It can be embedded and is designed for vector search over AI workloads, but it would add another storage concept to a product that currently benefits from SQLite simplicity. Source: https://github.com/lancedb/lancedb

Decision: do not replace search infrastructure until there are measured failures.

Measure first:

- Search latency for keyword, semantic, and hybrid on the shipped corpus.
- Council retrieval latency by passage/topic.
- Time to first result after cold app start.
- Memory usage during semantic scan.
- False-positive retrieval noise on hard passage packets.
- Recall on the five beta acceptance cases from the previous report.

Trigger thresholds for a search upgrade:

- Semantic/hybrid search p95 exceeds 500 ms on ordinary beta machines.
- Council retrieval p95 exceeds 2 seconds before provider calls.
- Memory spikes make the app visibly unstable.
- Search quality cannot be improved with ranking/source-set tuning.
- Resource modules grow beyond what BLOB scan plus FTS5 can handle.

Upgrade ladder:

1. Tune current FTS5 and cosine scan.
2. Add better source filters and retrieval diagnostics.
3. Try sqlite-vec behind a feature flag.
4. Consider Tantivy for expanded commentaries/resources.
5. Consider LanceDB only if module/resource vectors become large and operationally painful in SQLite.

### Pass 5 - Evaluation, security, and AI quality tooling

The app already has strong sidecar tests and real Council QA fixtures. The missing layer is systematic LLM/RAG regression testing across real user workflows.

Promptfoo is a good candidate for prompt and RAG regression plus red-teaming because it is an open-source CLI/library for evaluating and red-teaming LLM apps, supports custom providers, and can run in CI. Source: https://www.promptfoo.dev/docs/intro/

Ragas is useful if the team wants systematic RAG metrics such as faithfulness, answer relevancy, context precision, and context recall. Source: https://docs.ragas.io/en/stable/

DeepEval is a broader LLM evaluation framework with many metrics and a Pytest-like developer model. Source: https://deepeval.com/docs/introduction

OWASP's LLM Top 10 is the right security checklist for prompt injection, insecure output handling, sensitive information disclosure, supply-chain risk, and related AI app risks. Source: https://owasp.org/www-project-top-10-for-large-language-model-applications/

NIST AI RMF Generative AI Profile is useful for governance, content provenance, pre-deployment testing, and incident disclosure framing. Source: https://www.nist.gov/publications/artificial-intelligence-risk-management-framework-generative-artificial-intelligence

Recommended eval ladder:

1. Keep the current deterministic unit and sidecar tests.
2. Add a local fixture set for `Study Packet v1`:
   - hard passage,
   - small-group teaching,
   - word study,
   - resource critique,
   - theology update.
3. Add a custom Node-based evaluator first, because the current sidecar is Node and the expected schema is app-specific.
4. Add Promptfoo for prompt/security regression after the custom evaluator can run the sidecar path.
5. Add Ragas or DeepEval only if the team needs standard RAG metrics or reports.

Minimum eval assertions:

- No uncited doctrinal claim in final synthesis.
- All cited evidence IDs exist in retrieved evidence.
- User judgment is not overwritten by AI synthesis.
- Source-set scope appears in export.
- Provider failures are visible.
- Secrets and local paths are redacted.
- The model refuses to cite sources outside the provided evidence when the prompt requires source-bounded answers.
- Prompt-injection text inside imported resources cannot override system rules.

### Pass 6 - Packaging, distribution, and updates

The current app already has unusually detailed release packaging scripts. The next decision is not "how do we build an installer?" It is "which distribution channel is trustable enough for the beta?"

Tauri's Windows installer docs confirm `.msi` and NSIS setup executable distribution. Source: https://v2.tauri.app/distribute/windows-installer/

Tauri's updater requires signed updates; update signatures cannot be disabled. Source: https://v2.tauri.app/plugin/updater/

Tauri Windows signing docs note that signing is not strictly required to execute on Windows, but unsigned browser-downloaded apps create SmartScreen friction. Source: https://v2.tauri.app/distribute/sign/windows/

Tauri macOS signing docs note signing/notarization requirements for browser-downloaded macOS apps to avoid broken/untrusted-app behavior. Source: https://v2.tauri.app/distribute/sign/macos/

GitHub Releases are practical for beta packages and can carry many release assets. GitHub also began exposing SHA-256 digests for uploaded release assets in 2025. Sources: https://docs.github.com/en/repositories/releasing-projects-on-github/about-releases and https://github.blog/changelog/2025-06-03-releases-now-expose-digests-for-release-assets/

WinGet can be a later Windows distribution channel; Microsoft documents it as the Windows Package Manager CLI for installing, upgrading, removing, and configuring apps. Source: https://learn.microsoft.com/en-us/windows/package-manager/winget/

Homebrew Cask can be a later macOS distribution channel after macOS signing/notarization is stable. Source: https://docs.brew.sh/Cask-Cookbook

Recommended distribution sequence:

1. Private beta: manual signed Windows installers plus release manifest, hashes, and support-bundle instructions.
2. Public beta: GitHub Releases with signed installers, checksums, release notes, known issues, and downgrade/rollback instructions.
3. Later: Tauri updater after signing, update JSON hosting, rollback policy, and support process are mature.
4. Later: WinGet for Windows power users.
5. Later: Homebrew Cask for macOS users after macOS build/signing is proven.
6. Later: Microsoft Store only if consumer trust/discovery benefits outweigh store packaging overhead.

Do not add auto-update in v0.1 unless:

- release signing keys are protected,
- update server or static JSON process is documented,
- rollback procedure exists,
- support can distinguish failed install/update states,
- the app can surface release notes and update channel clearly,
- the package contains no bundled secrets or local developer artifacts.

### Pass 7 - Content, partners, and community source ecosystem

The app's content posture remains correct: ship only public-domain or permissively licensed resources by default, and make licenses visible.

Useful source/partner ecosystems:

- eBible.org distributes Bible files and hosts the World English Bible family. Source: https://ebible.org/
- CrossWire/SWORD is an established open-source Bible software/module ecosystem. Source: https://www.crosswire.org/sword/index.jsp
- Open Scriptures provides Hebrew Bible morphology and related biblical data projects. Source: https://github.com/openscriptures/morphhb
- Sefaria exposes developer tools and open Jewish text data, while each text/version still has its own license. Sources: https://developers.sefaria.org/ and https://developers.sefaria.org/docs/usage-of-our-name-and-logo
- Digital Bible Library is a major Scripture licensing/access platform, not a quick open-bundle source. Source: https://library.bible/

Recommended posture:

- Treat open-resource importers as product differentiators.
- Treat DBL/Biblica/modern translation access as partner/licensing work, not a scraping or "just import it" task.
- Make module manifests strong enough for community resources:
  - source URL,
  - license,
  - attribution text,
  - version/date,
  - redistribution status,
  - export attribution rules,
  - source-contact or maintainer field,
  - checksum,
  - import date.

Do not launch a public module marketplace yet. Start with a curated source catalog and a manifest validator.

## Updated technical thesis

Bible AI should be a local-first Bible research workstation with a stable evidence/export contract.

The app should optimize for:

- Local reading/search/workspaces by default.
- User-owned provider keys and local AI hosts.
- Source-bounded retrieval and transparent Council output.
- Portable study artifacts.
- Rights-aware resource imports.
- Evaluated prompt/retrieval changes.
- Conservative release/distribution operations.

It should not optimize for:

- Hosted SaaS dashboards.
- Account-first sync.
- Real-time collaboration.
- Generic chatbot volume.
- Rapid model-provider churn without compatibility tests.
- Replacing SQLite because another vector database is fashionable.

## Self-improved plan

### P0 - Study Packet v1 contract

Create `docs/study-packet-v1-spec.md` with:

- Markdown structure.
- JSON schema.
- source metadata fields.
- attribution appendix rules.
- AI-generated section labels.
- user judgment fields.
- evidence trace fields.
- export folder layout.
- re-import expectations.
- redaction requirements.

Implementation acceptance:

- Export a packet folder from a Workspace.
- Re-open/import `packet.json` into the app.
- Verify packet export contains no local paths or provider secrets.
- Verify packet export identifies source scope and model/provider scope.

### P0 - Interop export profile

Create `docs/interop-export-profile.md` with:

- CommonMark subset.
- Obsidian-friendly link conventions.
- Pandoc conversion notes.
- optional CSL JSON/BibTeX sidecar.
- attachment/resource layout.
- Hebrew/Greek/RTL export caveats.
- file naming rules.

Implementation acceptance:

- Packet opens cleanly in a plain text editor.
- Packet opens cleanly in Obsidian as a folder of Markdown files.
- Packet can be converted by Pandoc without losing headings/source sections.
- Source metadata survives copy/export.

### P0 - Local AI compatibility contract

Create `docs/local-ai-provider-contract.md` with:

- Ollama native embedding path.
- OpenAI-compatible endpoint expectations.
- LM Studio and llama.cpp server compatibility test cases.
- embedding dimension/model checks.
- timeout and error taxonomy.
- local provider setup UX requirements.
- no silent re-embedding rule.

Implementation acceptance:

- Settings can test Ollama, LM Studio, and llama.cpp-style endpoints separately.
- Semantic search refuses or degrades clearly when query embedding provider does not match corpus embedding metadata.
- Local chat provider cannot access tools/files unless explicitly added later.

### P0 - Evaluation harness

Create `docs/ai-eval-harness-plan.md` with:

- fixture packet set,
- hard passage cases,
- prompt-injection cases from imported resources,
- citation validity checks,
- source-scope checks,
- redaction checks,
- provider failure checks,
- pass/fail thresholds.

Implementation acceptance:

- `npm run qa:study-packet:eval` or equivalent runs without real provider keys using mock fixtures.
- Optional real-provider mode can be run manually.
- Output is machine-readable and archived with release evidence.

### P1 - Search measurement before infrastructure change

Create `docs/search-rag-measurement-plan.md` with:

- benchmark corpus size,
- beta machine profiles,
- p50/p95 latency budgets,
- memory budgets,
- retrieval recall fixtures,
- false-positive analysis,
- decision thresholds for sqlite-vec/Tantivy/LanceDB.

Implementation acceptance:

- Current BLOB cosine scan has baseline numbers.
- FTS5/hybrid quality is measured against beta packet cases.
- No search infra replacement is approved without metrics.

### P1 - Curated source catalog

Create `docs/curated-source-catalog-plan.md` with:

- allowed source classes,
- manifest requirements,
- checksum/version policy,
- attribution rules,
- source risk levels,
- source-review workflow,
- public/private module distinction.

Implementation acceptance:

- At least five resource manifests pass validation.
- Source catalog can be exported as a content BOM.
- Community resource import remains possible but labeled unreviewed.

### P2 - Distribution channel plan

Create `docs/distribution-channel-plan.md` with:

- private beta package path,
- GitHub Release checklist,
- signing/certificate custody,
- rollback/downgrade notes,
- future updater criteria,
- future WinGet criteria,
- future Homebrew criteria,
- macOS signing/notarization gate.

Implementation acceptance:

- Manual signed installer beta can be shipped with release manifest and support instructions.
- Auto-update remains blocked until update-signing and rollback are operational.

## New decision register

1. Study Packet is a file/export contract, not only an app view.
2. Local-first means readable exports and backups before sync.
3. Do not add collaboration or CRDT sync in v0.1.
4. Keep current SQLite/FTS/BLOB-vector search until metrics justify replacement.
5. Treat `sqlite-vec` as a possible feature-flagged upgrade, not a current dependency.
6. Treat LanceDB as later for large resource/vector workloads, not current Bible corpus search.
7. Add OpenAI-compatible local endpoint support, but test each local server explicitly.
8. Keep Ollama as the default local embedding host because the app already supports it.
9. Do not silently mix embedding models or dimensions.
10. Add prompt/RAG evals before adding more AI answer surfaces.
11. Use Promptfoo/Ragas/DeepEval selectively; do not outsource app-specific theological correctness to generic metrics.
12. Keep private beta distribution manual and signed before auto-update.
13. Do not launch a public module marketplace until source review, attribution, and support rules are mature.
14. Treat DBL/modern translations as licensing partnerships, not default import sources.
15. Use Obsidian/Pandoc/Zotero compatibility as the practical interop target.

## Immediate findings to fix or document

### Finding 1 - Architecture doc drift on vector store

`docs/architecture.md` still lists `sqlite-vec` as the vector-store choice. Current implementation uses SQLite BLOBs and Rust cosine scan.

Recommendation: update the architecture doc in a follow-up to say:

- planned/original vector store: sqlite-vec,
- current implementation: BLOB vectors plus Rust cosine scan,
- reason: simpler runtime, no extension dependency,
- upgrade trigger: benchmark failure or large resource corpus.

### Finding 2 - Embedding model contract needs to be explicit

The app hard-codes `nomic-embed-text`, and corpus embeddings are model-specific. If local AI provider support expands, the app needs a visible model/dimension contract.

Recommendation: add corpus embedding metadata to Settings and export traces.

### Finding 3 - Export is implemented but not yet a formal external contract

Markdown/HTML/PDF exports exist, but the product strategy now depends on packets being portable artifacts.

Recommendation: formalize packet export before adding more UI surfaces.

### Finding 4 - Eval harness should precede more Council/Smart Research expansion

The Council prompt is sophisticated. That increases the value of regression tests, especially for citation validity, prompt injection in resources, and provider failures.

Recommendation: build app-specific eval fixtures first, then layer Promptfoo/Ragas/DeepEval if useful.

### Finding 5 - Distribution docs are strong, but channel strategy should be explicit

The app has release scripts and QA gates. The docs should make clear that auto-update, WinGet, Homebrew, Store distribution, and module marketplaces are later-stage decisions.

Recommendation: add a distribution channel decision doc before public beta.

## Source trail

Local sources reviewed:

- `app/package.json`
- `app/src-tauri/Cargo.toml`
- `app/src-tauri/tauri.conf.json`
- `app/src-tauri/src/db.rs`
- `app/src-tauri/src/lib.rs`
- `app/src-tauri/src/ollama.rs`
- `app/sidecar/package.json`
- `app/sidecar/providers/_shared.mjs`
- `docs/architecture.md`
- `docs/user-owned-ai-setup.md`
- `docs/data-sources.md`
- `docs/privacy-and-distribution.md`
- `docs/testing-and-release-plan.md`
- `docs/ui-workflows.md`
- `docs/reviews/2026-06-12-154804-app-audience-wedge-market-pricing-learning-moat-recursive-research.md`

External sources reviewed:

- Ink & Switch local-first essay - https://www.inkandswitch.com/essay/local-first/
- Automerge - https://automerge.org/
- Replicache - https://replicache.dev/
- ElectricSQL - https://electric-sql.com/
- CommonMark - https://commonmark.org/
- Pandoc manual - https://pandoc.org/MANUAL.html
- Zotero bibliographic data formats - https://www.zotero.org/support/dev/data_formats
- Obsidian data storage - https://obsidian.md/help/data-storage
- Ollama OpenAI compatibility - https://docs.ollama.com/api/openai-compatibility
- Ollama embedding models - https://ollama.com/blog/embedding-models
- LM Studio - https://lmstudio.ai/
- LM Studio OpenAI compatibility - https://lmstudio.ai/docs/developer/openai-compat
- llama.cpp server - https://github.com/ggml-org/llama.cpp/blob/master/tools/server/README.md
- ONNX Runtime GenAI - https://onnxruntime.ai/docs/genai/
- SQLite FTS5 - https://sqlite.org/fts5.html
- sqlite-vec - https://github.com/asg017/sqlite-vec
- Tantivy - https://github.com/quickwit-oss/tantivy
- LanceDB - https://github.com/lancedb/lancedb
- Promptfoo - https://www.promptfoo.dev/docs/intro/
- Ragas - https://docs.ragas.io/en/stable/
- DeepEval - https://deepeval.com/docs/introduction
- OWASP Top 10 for LLM Applications - https://owasp.org/www-project-top-10-for-large-language-model-applications/
- NIST AI RMF Generative AI Profile - https://www.nist.gov/publications/artificial-intelligence-risk-management-framework-generative-artificial-intelligence
- Tauri Windows installer - https://v2.tauri.app/distribute/windows-installer/
- Tauri updater - https://v2.tauri.app/plugin/updater/
- Tauri Windows code signing - https://v2.tauri.app/distribute/sign/windows/
- Tauri macOS code signing - https://v2.tauri.app/distribute/sign/macos/
- GitHub Releases docs - https://docs.github.com/en/repositories/releasing-projects-on-github/about-releases
- GitHub release asset digests changelog - https://github.blog/changelog/2025-06-03-releases-now-expose-digests-for-release-assets/
- WinGet docs - https://learn.microsoft.com/en-us/windows/package-manager/winget/
- Homebrew Cask cookbook - https://docs.brew.sh/Cask-Cookbook
- eBible.org - https://ebible.org/
- CrossWire SWORD - https://www.crosswire.org/sword/index.jsp
- Open Scriptures Hebrew Bible - https://github.com/openscriptures/morphhb
- Sefaria developers - https://developers.sefaria.org/
- Sefaria copyright/data use - https://developers.sefaria.org/docs/usage-of-our-name-and-logo
- Digital Bible Library - https://library.bible/

## Bottom line

The next durable moat is not another AI feature. It is a portable, rights-aware, source-audited Study Packet contract backed by measured local retrieval, explicit local AI compatibility, and release/eval gates that prove the app is trustworthy on a user's own machine.
