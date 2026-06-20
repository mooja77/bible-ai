# Bible AI market, tech, and plan refresh loop

Generated: 2026-06-11 23:56:53 +01:00

Scope: additional recursive research pass after the prior app review, market research, competitor research, workflow ecosystem, global governance, launch operations, and eval/safety/economics addenda. This document refreshes the plan against current competitor movement, repo reality, local-first technical options, Scripture licensing infrastructure, and AI safety/trust pressure.

## Executive update

The app's strongest path is still not "another Bible chatbot." The current market is splitting into:

1. Massive free engagement platforms such as YouVersion.
2. Deep professional study libraries such as Logos and Verbum.
3. AI faith chat companions such as Bible Chat, bible.ai, BibleMate, Biblia.chat, and similar mobile apps.
4. Open/offline Bible tools with lower polish but strong ownership and extensibility.
5. Scripture infrastructure providers such as Digital Bible Library, API.Bible, Bible Brain, Open.Bible, and YouVersion Platform.

Bible AI's best wedge is a local-first study workbench with auditable AI. That means the product should prioritize source-linked smart search, local study packets, Council transparency, provider privacy choices, and evidence-preserving export before it adds broader devotional/community or cloud convenience features.

The revised plan is:

1. Consolidate the app's many planning docs into a dated decision index.
2. Turn "Source Set v1" and "Study Packet v1" into the core user-facing objects.
3. Build a local "Smart Research" workflow before expanding chat-like features.
4. Add eval/safety gates before public AI beta.
5. Keep modern copyrighted translations out of the bundled corpus until a specific rights path is chosen.
6. Treat release/distribution and provider privacy as product features, not afterthoughts.

## Recursive pass log

### Pass 1: repo and docs reality check

The current repository is further along than the original architecture sketch alone suggests:

- Tauri 2 desktop app with React, TypeScript, Tailwind, Rust, SQLite, and Node sidecar.
- Offline corpus with KJV, ASV, WEB, YLT, WLC, TR, Strong's data, cross-references, FTS5, and local embeddings.
- User data stored separately from the read-only corpus.
- Ollama-backed embeddings and semantic retrieval already exist.
- Council provider abstraction exists with Claude Code login, OpenAI, and Gemini paths.
- Workspaces, export, reader/search flows, settings disclosures, release scripts, and QA gates are documented.
- `data-sources.md` is already a strong source/license control document.

The biggest internal risk is planning sprawl. There are many correct docs, but the next step needs one source-of-truth decision index that says which plans are active, superseded, or deferred.

### Pass 2: competitor movement

The market has moved from "Bible app with search" toward "AI-assisted search, summaries, and study continuation."

Key observations:

- Logos Smart Search is a serious benchmark. It supports natural-language AI-assisted search across Bible, books, and all resources, includes synopsis cards, links claims to resources, and can continue into Study Assistant.
- YouVersion is not competing primarily on deep study. It competes on global reach, free access, habit formation, social/community engagement, multi-language distribution, and partner infrastructure. Its 2026 update emphasizes guided engagement, QR sharing, and Plans with Friends.
- YouVersion Platform now offers embedded Bible reader technology and high-level engagement analytics to other ministries/developers. That makes basic Bible-reader functionality easier for competitors to add.
- YouVersion's privacy policy says it uses AI to synthesize/process information for personalization and operations, while stating it does not use AI to generate new AI-created content.
- Bible Chat and similar apps present AI as conversational faith help, often with denomination/translation personalization. That space is crowded and trust-sensitive.
- BibleMate-style positioning as an AI companion/counselor is a caution zone for this app because it increases pastoral, crisis, and mental-health risk.

Conclusion: compete upward on auditability and local control, not sideways on chat volume.

### Pass 3: technical stack options

The current stack remains sensible:

- Tauri 2 is a good desktop shell for a local-first Bible app.
- SQLite remains the right default database.
- FTS5 plus local embeddings is enough for v0.1/v0.2.
- Ollama remains a practical local model host for embeddings.
- The Node sidecar is acceptable while provider orchestration is moving quickly.

Important correction from current docs:

- `architecture.md` still names `sqlite-vec` as the vector store.
- `data-sources.md` says the current implementation stores embedding vectors as SQLite BLOBs and scans them in Rust with cosine similarity, with no sqlite-vec runtime dependency.

That is not a blocker, but it should become an explicit decision:

- Keep BLOB + Rust cosine scan for the current corpus and early beta.
- Benchmark sqlite-vec only when resource library growth makes linear scan visibly slow.
- Do not add a separate vector database service for desktop v0.x.
- Consider llama.cpp only if the app starts bundling local models or needs an OpenAI-compatible local server alternative to Ollama.

### Pass 4: content and licensing infrastructure

The app's source discipline is a major differentiator. The wider ecosystem confirms that Scripture licensing is not a minor implementation detail:

- Digital Bible Library exists to organize, license, and distribute Scripture content at scale.
- API.Bible provides access to a large catalog of public-domain, Creative Commons, and licensed translations through one API/license relationship.
- Open.Bible provides Creative Commons Bible texts and maps for reuse.
- Bible Brain provides text, audio, and video Bible API access through Faith Comes By Hearing.
- YouVersion Platform reduces Bible-reader and licensing friction for partner apps.

Recommendation:

- Do not bundle modern copyrighted translations unless rights are explicitly granted.
- Treat API.Bible/DBL/YouVersion Platform as integration options, not default dependencies.
- Preserve the local public-domain/open-license bundle as the app's baseline.
- For any API-backed copyrighted content, keep it visibly separate from bundled local content and mark online/licensed/export limits in the UI.

### Pass 5: AI trust, compliance, and security pressure

The app sits in a sensitive category because Bible questions can overlap with crisis, abuse, health, pastoral care, doctrine, family conflict, and private spiritual disclosures.

Current external pressure:

- OWASP's LLM risk list emphasizes prompt injection, insecure output handling, training/data poisoning, denial of service, supply chain, and related risks.
- EU AI Act transparency rules for generative AI begin in August 2026.
- FTC attention to AI companion chatbots increases the need to document safety evaluation, teen/child risk handling, data retention, and user-facing boundaries.
- Major faith platforms emphasize trust, privacy, and careful AI use rather than unbounded AI spiritual authority.

Recommendation:

- Keep AI features framed as study assistance.
- Make AI-generated sections identifiable.
- Add provider/data-handling docs before any managed gateway.
- Add sensitive-topic safety policy before public beta.
- Keep cloud tracing and telemetry off by default.

## Competitor and market map

| Segment | Examples | Strength | Weakness / opening for Bible AI |
| --- | --- | --- | --- |
| Global free engagement | YouVersion, Bible.com, YouVersion Platform | Scale, free access, language coverage, social plans, habit loops | Not built as a local-first research workbench |
| Professional study library | Logos, Verbum, Accordance | Deep libraries, AI-assisted search, summaries, paid resources | Expensive/complex, library-lock-in, less local-user-owned in spirit |
| AI faith chat | Bible Chat, bible.ai, BibleMate, Biblia.chat, Hail Mary AI Chat | Simple conversational UX, mobile-first, fast answers | Trust, citations, pastoral safety, and interpretive nuance vary widely |
| Open/offline Bible tools | e-Sword, Xiphos, AndBible, STEP, Blue Letter Bible | Ownership, offline use, free/open resources | Often less polished, weaker modern AI/audit workflows |
| Dev/data infrastructure | DBL, API.Bible, Bible Brain, Open.Bible, YouVersion Platform | Licensing/content access and multi-language scale | They are enabling layers, not full local-first research environments |
| Devotional/audio/prayer apps | Dwell, Hallow, Glorify, BibleProject app | Habit, audio, devotion, guided experience | Not primarily contested-interpretation study systems |

## Product strategy update

### Positioning

Use:

> A local-first Bible study workbench that helps users search, compare, reason, and export source-linked study packets with optional AI assistance.

Avoid:

> AI pastor, AI spiritual counselor, AI devotional companion, or "the Bible chatbot."

### Primary target user

The current app is best suited for:

- Serious lay Bible students.
- Small-group teachers.
- Pastors or ministry volunteers who cannot justify Logos-level cost/complexity.
- Users who care about offline access, source provenance, and model/provider transparency.
- Users who want AI help but do not want opaque spiritual answers.

It is not yet optimized for:

- Daily devotional habit formation.
- Church-wide social/community tools.
- Audio-first prayer/meditation.
- Full professional sermon-library replacement.
- Children/teens.

### Feature wedge

The feature wedge should be:

1. Ask a natural-language Bible/theology question.
2. See local source retrieval first.
3. Inspect source set, translations, cross-references, and original-language hooks.
4. Run Council only when the issue is contested or interpretive.
5. Save/export a Study Packet with claims, sources, user judgment, and timestamp.

This wedge is defensible because it combines local corpus, auditable retrieval, personal judgment, and export. Chat apps can answer faster. Logos can go deeper with paid libraries. YouVersion can reach more people. Bible AI can be the transparent middle ground.

## Updated roadmap

### Phase A: Decision index and doc consolidation

Purpose: reduce planning sprawl and make the next work obvious.

Deliverables:

- Timestamped decision index under `docs/reviews`.
- Active/superseded/deferred labels for major planning docs.
- One short "next 10 implementation decisions" list.
- Link each research addendum to the roadmap decision it changes.

Exit criteria:

- A contributor can read one index and know which plan to execute next.

### Phase B: Source Set v1 and Study Packet v1

Purpose: make trust visible in the main workflow.

Deliverables:

- Source Set schema: translations, original-language sources, cross-refs, resource modules, filters, license status, online/offline marker.
- Study Packet schema: question, passage, source set, retrieved evidence, AI sections, user notes, user judgment, provider/model metadata, timestamp, export rules.
- UI labels that distinguish bundled local public-domain/open-license sources from online/licensed sources.

Exit criteria:

- Every exported AI answer includes enough metadata to audit what sources and providers produced it.

### Phase C: Smart Research mode

Purpose: compete with the useful part of Logos Smart Search without copying the whole Logos ecosystem.

Deliverables:

- One-box natural-language search over local corpus.
- Result categories: verses, cross-references, Strong's/original-language matches, module entries.
- A short synopsis generated only from retrieved sources.
- Footnote/citation links into the source drawer.
- Toggle between precise keyword, meaning, and hybrid search.

Exit criteria:

- A user can ask "where are light and darkness contrasted?" and get auditable local results without running a full Council session.

### Phase D: Council hardening

Purpose: make the most distinctive AI workflow reliable enough for beta.

Deliverables:

- Sensitive-topic pre-route.
- In-repo eval fixture runner.
- Provider data-handling matrix.
- Council output contract tests.
- Retrieval trace verification.
- Cost/token budget warnings.
- Graceful provider failure behavior.

Exit criteria:

- Council answers have regression tests for disputed theology, sparse evidence, provider failure, sensitive topics, and citation integrity.

### Phase E: Open resource library expansion

Purpose: deepen study value without depending on copyrighted commercial libraries.

Deliverables:

- Candidate-source admission workflow.
- Resource manifest validation.
- Export attribution checks.
- Open.Bible/API.Bible/DBL/Bible Brain integration decision.
- Public-domain/commentary/theology resource seed set.

Exit criteria:

- Adding a resource requires passing source/license/provenance checks before it can appear in search or export.

### Phase F: Beta packaging and trust release

Purpose: ship a testable app without compromising privacy posture.

Deliverables:

- Signed Windows build path.
- Manual update path first; Tauri updater later when signing keys and update server are ready.
- Redacted support bundle.
- No passive telemetry.
- Privacy and AI limitations page in-app.
- Release checklist with public-source/license status.

Exit criteria:

- A beta user can install, use offline study features, configure provider choices, export study packets, and send a redacted support bundle manually.

## Tooling decisions

### Keep

- Tauri 2 for desktop shell.
- React/TypeScript/Tailwind for frontend.
- Rust commands for local DB and app-native work.
- SQLite as core storage.
- FTS5 for keyword search.
- Current BLOB + Rust cosine scan for early embedding search.
- Ollama for user-owned local embeddings.
- Node sidecar for fast-moving provider orchestration.
- Local release/QA scripts.

### Add soon

- A small in-repo eval runner.
- A central plan/decision index.
- A sensitive-topic fixture set.
- A Study Packet export metadata validator.
- A source-set/license UI snapshot test.

### Benchmark before adopting

- sqlite-vec for larger module/resource libraries.
- llama.cpp as an alternative local model server.
- promptfoo for local provider/prompt regression.
- Ragas/DeepEval for RAG metrics after fixture schema exists.
- OpenTelemetry/OpenInference only for dev-only traces or redacted support bundles.

### Avoid for now

- External vector database service.
- Passive analytics/telemetry.
- Session replay.
- SaaS AI trace logging by default.
- Managed model gateway before privacy/subprocessor docs.
- Bundled copyrighted translations without explicit rights.

## Self-improved plan changes from this loop

| Earlier direction | Refined direction |
| --- | --- |
| "AI Council is the marquee feature" | Council remains distinctive, but Smart Research should become the lower-friction daily workflow |
| "Offline-first Bible app with AI" | "Local-first auditable study workbench" is the clearer market position |
| "Use sqlite-vec" | Keep current BLOB/cosine scan until a benchmark proves sqlite-vec is needed |
| "Corpus expansion later" | Source Set v1 and Study Packet v1 should come before large corpus expansion |
| "Release readiness after features" | Release trust, privacy, and support bundle design should be part of beta readiness |
| "Competitors are Bible apps" | Competitors also include Scripture infrastructure platforms and AI-assisted study/search layers |

## Next 10 implementation decisions

1. Decide whether to create a central `docs/reviews/...decision-index.md` or a non-timestamped `docs/decision-index.md`.
2. Decide whether Smart Research is a new mode or an extension of existing Search/Council panels.
3. Define Source Set v1 fields.
4. Define Study Packet v1 fields and export metadata.
5. Decide whether BLOB/cosine search performance is acceptable for the current corpus by measuring it.
6. Pick the first 20 eval fixtures: 10 doctrinal, 5 retrieval, 5 sensitive-topic.
7. Decide whether promptfoo is worth adding now or after the in-repo runner.
8. Decide whether API.Bible/DBL/Open.Bible/Bible Brain are roadmap candidates or research-only references for now.
9. Decide the beta privacy posture in product language: no telemetry, manual support bundles, explicit provider routing.
10. Decide whether the architecture doc should be corrected now to match current vector storage implementation.

## Documentation backlog

Create these in timestamped or stable docs, depending on whether they are reports or active operating docs:

- `docs/reviews/YYYY-MM-DD-HHMMSS-app-decision-index.md`
- `docs/source-set-v1.md`
- `docs/study-packet-v1.md`
- `docs/smart-research-mode.md`
- `docs/sensitive-topic-safety-policy.md`
- `docs/council-eval-tooling-decision.md`
- `docs/provider-data-handling-matrix.md`
- `docs/observability-boundary.md`

Recommended rule:

- Use timestamped files for research/reviews.
- Use stable filenames for active product specs that the app is expected to implement.

## Open research gaps

1. User research: interview 5 to 10 target users who teach, lead small groups, or study disputed topics.
2. Performance: benchmark FTS5, semantic search, hybrid retrieval, and export on low-end Windows hardware.
3. Licensing: contact or review terms for API.Bible/DBL/YouVersion Platform if modern translations become a roadmap goal.
4. AI safety: define exact sensitive-topic response templates and eval fixtures.
5. Product packaging: choose personal/private beta, GitHub release, signed Windows installer, or store path.
6. Accessibility: run a real keyboard/screen-reader pass on Reader, Search, Council, Settings, and Export.
7. Corpus: decide whether to prioritize commentaries/resources over additional translations.

## Sources consulted

- Logos Smart Search help: https://support.logos.com/hc/en-us/articles/23526184005261-Find-Answers-Faster-with-Smart-Search
- Logos AI tools for Bible study: https://support.logos.com/hc/en-us/articles/30128615450765-Using-AI-Tools-for-Smarter-Bible-Study
- YouVersion June 2026 update: https://blog.youversion.com/2026/05/whats-new-in-the-bible-app-june-2026/
- YouVersion Platform announcement: https://www.youversion.com/news/introducing-youversion-platform
- YouVersion privacy policy: https://www.bible.com/privacy
- Bible Chat: https://thebiblechat.com/
- bible.ai: https://www.bible.ai/
- BibleMate: https://www.biblemate.org/
- Biblia.chat: https://biblia.chat/
- Tauri updater docs: https://v2.tauri.app/plugin/updater/
- Ollama nomic-embed-text: https://ollama.com/library/nomic-embed-text
- Ollama embedding models: https://ollama.com/blog/embedding-models
- llama.cpp server docs: https://github.com/ggml-org/llama.cpp/blob/master/tools/server/README.md
- sqlite-vec: https://github.com/asg017/sqlite-vec
- Digital Bible Library: https://library.bible/
- API.Bible docs: https://docs.api.bible/
- API.Bible licensing overview: https://api.bible/bibles
- Bible Brain API reference: https://www.faithcomesbyhearing.com/bible-brain/api-reference
- Open.Bible: https://open.bible/
- OWASP Top 10 for LLM Applications: https://owasp.org/www-project-top-10-for-large-language-model-applications/
- NIST AI Risk Management Framework: https://www.nist.gov/itl/ai-risk-management-framework
- European Commission AI Act overview: https://digital-strategy.ec.europa.eu/en/policies/regulatory-framework-ai
- FTC AI chatbot inquiry: https://www.ftc.gov/news-events/news/press-releases/2025/09/ftc-launches-inquiry-ai-chatbots-acting-companions
