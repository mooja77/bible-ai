# Bible AI market, competitor, tech, and plan research

Timestamp: 2026-06-11 23:04:19 +01:00

Filename timestamp: 2026-06-11-230419

Scope: additional external research and recursive synthesis for the current Bible AI desktop app. This pass combines repo review, competitor/market research, tool and technology checks, licensing checks, and a revised product plan.

Primary local context reviewed:

- `docs/architecture.md`
- `docs/council-protocol.md`
- `docs/feature-roadmap.md`
- `docs/privacy-and-distribution.md`
- `docs/open-resource-ingestion-plan.md`
- `docs/data-sources.md`
- `docs/testing-and-release-plan.md`
- `app/package.json`
- `app/sidecar/package.json`
- `app/src-tauri/tauri.conf.json`
- `app/src-tauri/capabilities/default.json`

## Executive synthesis

Bible AI should not position itself as another Bible chatbot. The strongest position is:

> A local-first Bible study workbench with auditable AI, source-grounded retrieval, visible theological disagreement, and exportable research workspaces.

The market has large casual demand, proven by YouVersion's scale, but the app is better aimed at serious lay readers, teachers, small-group leaders, privacy-conscious users, and pastors who need traceable reasoning rather than devotional friction reduction alone. The app's real wedge is the Council: independent voices, retrieval trace, provider manifest, source drawer, confidence rationale, and persistent workspaces.

The biggest current mismatch is that the app already contains a serious research engine, but the market will first judge it by setup simplicity, trust, citations, translation/resource breadth, and visible polish. The plan should keep the local-first/auditable architecture, but package it with simpler entry points, clearer provider setup, strong release evidence, and explicit source/license provenance.

## Recursive pass log

### Pass 0 - Local product thesis

The repo describes a modern e-Sword alternative with a Tauri desktop shell, React UI, SQLite corpus, local semantic retrieval, and a Node sidecar for multi-provider Council runs. The implemented app is broader than a reader: reader, search, workspaces, exports, bookmarks, original-language tags, semantic search, Council transparency, resource imports, backups, manual QA gates, and release packaging.

Self-improvement from this pass: treat "Bible AI" as a study workbench, not a single AI feature.

### Pass 1 - Competitor lanes

External research split the space into four lanes:

- Mass-market devotional Bible apps: YouVersion, Bible Gateway.
- Professional study suites: Logos, Accordance, Olive Tree.
- Free study/reference tools: Blue Letter Bible, STEP Bible, e-Sword.
- AI-native Bible tools: Bible Chat, BibleMate, Bible AI-style search/chat apps.

Self-improvement from this pass: the competitor matrix should compare user intent, not just feature checklists.

### Pass 2 - Market and user behavior

American Bible Society reported in 2025 that two-thirds of Bible users access the Bible digitally at least some of the time, and 62% of digital Bible users use Bible apps. YouVersion reported one billion device installs across its family of Bible apps. This validates large demand, but it also means casual Bible reading is already crowded and dominated by habitual mobile products.

Self-improvement from this pass: the app should not chase "daily verse" or broad social habits first. It should win deeper sessions where traceable research matters.

### Pass 3 - Tools, tech, and data

The app's current technology choices remain coherent:

- Tauri 2 is a reasonable desktop distribution layer when permissions and custom commands are reviewed carefully.
- SQLite FTS5 is a good fit for local corpus search.
- Local embeddings through Ollama are aligned with offline/private semantic search.
- Claude Agent SDK can support the sidecar concept, but provider setup, credit/billing behavior, tool permissions, and failure states need ongoing QA.
- Open/public-domain data can support a credible default corpus, but modern translations and premium commentaries remain the incumbents' moat.

Self-improvement from this pass: focus technical investment on provenance, licensing, release evidence, import bounds, and provider observability before adding more AI surface area.

### Pass 4 - Plan synthesis

The plan should now prioritize:

1. Public-release gates and trust artifacts.
2. Beginner-safe setup and "works offline except Council" onboarding.
3. Council outputs that are short by default, with transparency expandable.
4. Resource/source provenance visible everywhere.
5. A public-domain/open-resource expansion path with license checks.

Self-improvement from this pass: every roadmap item should be evaluated by whether it improves trust, setup success, source depth, or research repeatability.

## Competitor map

| Product | Lane | Current external signal | Implication for Bible AI |
|---|---|---|---|
| YouVersion | Mass-market reader/devotional ecosystem | YouVersion says its Bible apps reached one billion device installs. | Huge demand exists, but habitual mobile reading is not the wedge for a desktop-first tool. |
| Bible Gateway | Web/mobile reference and study subscriptions | Bible Gateway positions itself around searchable Scripture, audio, reading plans, apps, and Plus resources. | Competing directly on web lookup breadth is weak; local workspaces and auditable AI are stronger. |
| Logos | Paid professional study platform | Logos markets cited answers, deep library search, study/preaching workflows, 250,000+ books/courses, and AI Smart Search/summaries. | Logos is the strongest study-suite competitor. Bible AI must differentiate on local-first privacy, transparent multi-voice reasoning, and open corpus provenance. |
| Accordance | Paid scholarly desktop study | Accordance emphasizes speed, flexibility, a Bible-centered platform, and serious users over 30+ years. | Accordance owns part of the scholarly desktop niche; Bible AI's wedge is not replacing scholarly libraries, but adding auditable AI to a simpler local workbench. |
| Olive Tree | Cross-platform study app and paid resource library | Olive Tree highlights offline access, split-screen Study Center, thousands of resources, sync, and modern translations/resources. | Olive Tree shows offline plus resources matters. Bible AI needs resource-pack depth and clean source browsing. |
| Blue Letter Bible | Free study/reference | BLB offers original-language lexicons, interlinear, dictionaries, TSK, many commentaries, notes, highlights, and parallel Bibles. | BLB is a strong free benchmark for lexical/commentary breadth. Bible AI must make depth easier to synthesize and export. |
| STEP Bible | Free/offline original-language tool | STEP offers desktop downloads, offline use, ancient language Bibles, and many languages. | STEP validates free offline original-language study. Bible AI should not underinvest in original-language UX. |
| e-Sword | Free desktop Bible study | e-Sword highlights simple searches, Strong's searches, integrated editor, and multi-platform availability. | e-Sword validates the "modern e-Sword" opportunity, but Bible AI needs a better setup, modern UX, and better data provenance. |
| Bible Chat | AI-native mobile faith app | Bible Chat claims an app experience with Bible chatbot answers, references, free tier, premium plan, and denomination/translation adaptation. | AI chat is now a crowded consumer lane. Bible AI should avoid vague spiritual companionship positioning and instead emphasize research auditability. |
| BibleMate AI | Agentic AI Bible study | BibleMate describes an autonomous AI agent for study plans and coordinating multiple Bible tools. | The agentic Bible-study lane is emerging. Bible AI's advantage is a local corpus, persistent workspace, and explicit evidence trail. |

## Market and positioning findings

1. Digital Bible use is normal, not niche.

American Bible Society's 2025 release says two-thirds of Bible users access the Bible digitally at least some of the time, and 62% of digital Bible users use Bible apps. YouVersion's one-billion-install milestone reinforces that mobile Bible engagement is enormous.

Plan effect: Bible AI should assume users already know Bible apps. The onboarding should say what is different in one screen: local study, source audit, Council disagreement, and exportable workspaces.

2. Serious study users pay for libraries and workflows.

Logos, Accordance, and Olive Tree all market depth: commentaries, study tools, original-language workflows, paid resources, sermons/teaching, offline access, and library search. This confirms that serious Bible study software is a real category with spending behavior.

Plan effect: Bible AI should not compete with premium libraries on day one. It should create a clean open-resource path, then optionally support licensed add-ons later.

3. AI Bible chat is now a commodity pattern.

Bible Chat, BibleMate, Faith Guide, Bible AI, GotQuestions.chat, and app-store AI Bible products show that "ask the Bible a question" is no longer distinctive. Many emphasize instant answers, prayer, devotionals, denominational adaptation, or agentic planning.

Plan effect: the Council should be framed as a trust mechanism, not just an AI answer box.

4. Theological bias is now a public issue.

A 2026 Scripture Engagement/Bible Society research page describes a pilot study examining whether AI Bible apps privilege certain theological traditions. This directly validates Bible AI's Council design: preserve minority views, show provider voices, and avoid pretending a single synthesis is neutral.

Plan effect: add explicit "tradition and interpretation lens" metadata to Council answers and evaluation fixtures.

5. Trust calibration matters more than confidence theater.

Google PAIR's explainability/trust guidance emphasizes helping users understand capabilities, limits, data, and confidence. Microsoft HAX provides general human-AI interaction guidelines. NN/g's 2026 information-seeking research says users choose AI for exploration/synthesis but still rely on search when accuracy and trusted sources matter.

Plan effect: keep source drawer, retrieval trace, confidence rationale, and voice audit trail, but present them progressively so new users are not buried.

## Technical and tooling findings

### Current stack fit

The current stack is appropriate for this product:

- React 19, Vite, Tailwind, and WebDriverIO cover the frontend and E2E base.
- Tauri 2 gives desktop distribution with small permissions surface.
- Rust plus rusqlite is a good fit for local corpus, backup, restore, export, and retrieval logic.
- SQLite FTS5 is appropriate for local verse/resource full-text search.
- Ollama embeddings fit local semantic search and privacy-first RAG.
- Node sidecar isolates provider SDK/API differences from the Tauri command layer.

### Security and platform implications

Tauri's capability system is permission-based, and the app currently grants only `core:default` and `dialog:allow-save`. The CSP is also restrictive in production. That is good. The important review area is now custom Rust commands, especially import/export/backup/restore paths, provider settings, and any sidecar invocation boundary.

Recommended technical actions:

- Add a custom-command security review checklist to release QA.
- Add import size/time budgets for JSON backup, SQLite restore, and resource JSONL import.
- Add deterministic directory tree hashes to release manifests for bundled sidecar/node/resource directories.
- Keep provider secrets exclusively in the OS credential vault and keep tests scanning exports/source drawers for leak signals.

### Retrieval and search

SQLite FTS5 and local embedding blobs are enough for v0.1. The app does not need to add a vector extension immediately. The practical next step is not a new search engine; it is evaluation:

- Build a retrieval eval set from common Bible questions, disputed passages, lexical questions, and sparse-evidence questions.
- Track top-k evidence quality for FTS, semantic, hybrid, and hybrid plus cross-reference strategies.
- Store expected source types and allowed uncertainty, not a single "right" answer.

### Provider and sidecar architecture

The sidecar's provider abstraction is strategically valuable because competitors usually hide AI routing. Preserve that design.

Recommended technical actions:

- Make provider diagnostics part of onboarding completion, not a hidden settings affordance.
- Record provider availability, skipped reasons, model identifiers, and gateway health in a supportable diagnostics export.
- Add cost/credit notes for Claude Agent SDK and API-key flows.
- Treat managed gateway privacy notes as required before any public release using that route.

### Tools worth adding

- `axe-core` or equivalent accessibility checks for app shell and major panels.
- A license/SBOM workflow such as CycloneDX for app and sidecar dependencies.
- A source-manifest validator that fails imports when attribution, license, version/date, or redistribution assessment is missing.
- A release artifact tree-hash tool for `sidecar/`, `node_modules/`, and bundled corpus resources.
- A retrieval/Council eval harness that can run mock fixtures, real-provider samples, and regression comparisons.
- Optional later: `sqlite-vec` only if measured corpus/resource scale makes Rust cosine scans a real bottleneck.

## Data and licensing findings

The app's current data policy is correct: ship public-domain or permissively licensed data by default, and do not bundle modern copyrighted translations without explicit rights.

Specific source checks:

- WEB/eBible states the World English Bible is public domain while retaining trademark rules around the name.
- Sefaria's developer docs distinguish public-domain texts, Creative Commons texts with possible requirements, and texts with unverified copyright status.
- Open Scriptures MorphHB says lemma/morphology data is CC BY 4.0 and WLC text is public domain.
- OpenBible cross references are downloadable and generally CC BY, with ESV quotations separately copyrighted.

Plan effect: source import UX should never collapse "free to access" into "safe to redistribute." Every imported source needs license class, attribution, export rules, and whether it can be bundled, user-imported only, or blocked.

## Product opportunities

### Near-term public release priorities

1. Complete the manual clean-profile QA evidence gate.
2. Add size/time budget tests for backup import, SQLite restore, and resource JSONL import.
3. Fix visual-only active navigation state.
4. Make provider setup completion depend on real diagnostics, including local Claude Code availability.
5. Add shortcut E2E coverage for documented keyboard behavior.
6. Add deterministic tree hashes to release manifests.
7. Update resource fixture schema versions to match current schema expectations.
8. Add confirmation affordances for destructive user-data controls.

These are unchanged from the deeper code review because market research reinforces trust/release quality as a prerequisite.

### Market-backed feature priorities

1. "Simple answer first, audit on demand" Council UI.

Show a short answer, cited passages, unresolved tensions, and next-step buttons first. Keep voice matrix, retrieval trace, and raw source drawer behind clear tabs/disclosure.

2. Example question library.

Seed questions by task:

- Explain this passage.
- Compare interpretations.
- Prepare a small-group discussion.
- Trace a word/theme.
- Build a sermon/study outline.
- Check a claim against Scripture.

3. Tradition/interpretation lens.

Do not let the AI silently imply one tradition is the default. Add answer metadata for "interpretive lens detected/requested", "traditions represented", and "traditions not represented."

4. Source provenance badges.

Every verse, lexicon entry, cross-reference, resource entry, and AI quote should expose source, license, local/remote status, and export rules.

5. Open resource packs.

Prioritize curated public-domain and permissively licensed packs:

- Classic creeds/confessions with clear public-domain status where applicable.
- Public-domain commentaries.
- Public-domain dictionaries/lexicons.
- Early church and historical theology where license and translation status are clear.
- Sefaria-derived Jewish resources only after per-text license review.

6. Study packet export.

Export not just notes, but a "research packet": passage text, citations, source list, Council prompt/options, evidence, voices, unresolved tensions, and user conclusions.

7. Teaching mode.

For small-group leaders and teachers, turn a workspace into questions, outline, handout, and discussion prompts, while labeling AI-generated content and user-authored conclusions separately.

## Risk register

| Risk | Severity | Why it matters | Mitigation |
|---|---:|---|---|
| AI overtrust in theological answers | High | Users may treat fluent answers as authority. | Short answers with citations, uncertainty, dissent, tradition labels, and source drawer. |
| Licensed translation/resource moat | High | Logos/Olive Tree/Bible Gateway have modern translations and paid libraries. | Open corpus first, explicit license UX, optional licensed add-ons later. |
| Setup friction | High | Council value depends on Claude/API/gateway configuration. | Diagnostics-led setup wizard, offline mode clarity, provider tests before completion. |
| Public release trust | High | Desktop installers need clean-profile evidence and no secret leaks. | Complete manual gate, tree hashes, SBOM/license scan, credential vault checks. |
| Provider cost/runtime drift | Medium | Claude/API behavior and billing can change. | Provider manifests, diagnostics exports, clear cost/credit notes, graceful fallback. |
| Import performance/DoS | Medium | User-controlled backup/resource files can freeze or exhaust memory. | File size, row count, timeout, schema, and transaction-budget gates. |
| Theological bias criticism | Medium | AI Bible apps are already being studied for bias. | Preserve multiple views, evaluate disputed questions, label lenses and minority positions. |
| UX density | Medium | Serious app surfaces can overwhelm casual users. | Progressive disclosure, plain-language defaults, examples, and guided first run. |

## Revised plan

### Phase A - Trustable public release

- Complete clean-profile manual QA evidence.
- Add custom-command security review checklist.
- Add import/restore budget tests.
- Add release tree hashes and dependency/license inventory.
- Add provider diagnostics export.
- Re-run `npm run check:full`, release verify, sidecar tests, and public release gate.

Exit criteria: public release gate passes without hand-filled placeholders, artifacts are reproducible enough to verify, and no provider secrets appear in backups/exports/source drawers.

### Phase B - First-run comprehension

- Replace generic provider/setup cues with a guided setup path:
  - Read and search offline.
  - Use local Claude Code login.
  - Use personal API keys.
  - Use managed gateway.
- Completion should require actual diagnostics for the selected path.
- Add example Council questions and "try offline search first" flow.
- Add a plain-language "what leaves this computer" panel before first Council run.

Exit criteria: a clean user can understand what works offline and what requires a provider in under two minutes.

### Phase C - Council as differentiator

- Redesign Council output into summary, citations, disagreements, and audit tabs.
- Add tradition/lens metadata and disputed-question fixtures.
- Add retrieval/Council eval harness.
- Add study packet export.
- Preserve raw evidence and provider manifests for advanced users.

Exit criteria: the Council is visibly more trustworthy than a generic AI chat answer.

### Phase D - Open resource depth

- Build curated open resource packs with per-source manifests.
- Add visible source/license/export badges.
- Add resource import dry-run preview.
- Expand original-language workflows only where source metadata is clear.

Exit criteria: Bible AI can credibly serve a serious study session using bundled/open resources without depending on copyrighted libraries.

### Phase E - Market validation

- Test positioning with three user groups:
  - serious lay readers/small-group leaders
  - pastors/teachers
  - privacy/offline-first users
- Track setup success, first valuable Council run, export use, and source drawer/audit usage.
- Avoid optimizing for daily devotional retention until the research-workbench wedge is validated.

Exit criteria: users can articulate why Bible AI is different from YouVersion, Logos, e-Sword, and Bible Chat.

## Documentation changes recommended next

Create or update:

- `docs/product-positioning.md`: local-first auditable Bible study workbench, target segments, non-goals.
- `docs/competitive-landscape.md`: maintain this competitor matrix with source dates.
- `docs/council-evaluation-plan.md`: disputed-question, sparse-evidence, provider-failure, and tradition-bias fixtures.
- `docs/source-provenance-policy.md`: license classes, attribution, export rules, bundled vs user-imported rules.
- `docs/release-security-checklist.md`: custom Tauri command review, sidecar boundary, credentials, imports, artifact hashes.

## Key sources

- YouVersion install milestone: https://www.youversion.com/news/bible-app-reaches-one-billion-installs
- American Bible Society State of the Bible 2025 release: https://www.americanbible.org/news/press-releases/articles/sotb-2025-release/
- Logos platform: https://www.logos.com/
- Logos Smart Search: https://support.logos.com/hc/en-us/articles/23526184005261-Find-Answers-Faster-with-Smart-Search
- Logos AI tools: https://support.logos.com/hc/en-us/articles/30128615450765-Using-AI-Tools-for-Smarter-Bible-Study
- Accordance: https://www.accordancebible.com/
- Olive Tree app overview: https://www.olivetree.com/blog/apps/ios/
- Blue Letter Bible Android features: https://www.blueletterbible.org/android/
- STEP Bible downloads/offline support: https://www.stepbible.org/downloads.jsp
- e-Sword: https://www.e-sword.net/
- Bible Gateway resources: https://www.biblegateway.com/resources/
- Bible Chat: https://thebiblechat.com/
- BibleMate AI: https://biblemate.ai/
- Scripture Engagement on AI Bible apps and theological bias: https://scripture-engagement.org/content/ai-bible-apps-and-theological-bias/
- Tauri capabilities: https://v2.tauri.app/security/capabilities/
- Tauri CSP: https://v2.tauri.app/security/csp/
- SQLite FTS5: https://sqlite.org/fts5.html
- Ollama embeddings: https://docs.ollama.com/capabilities/embeddings
- Ollama embed API: https://docs.ollama.com/api/embed
- Claude Agent SDK: https://code.claude.com/docs/en/agent-sdk/overview
- World English Bible copyright: https://ebible.org/engwebp/copyright.htm
- Sefaria copyright/data use: https://developers.sefaria.org/docs/usage-of-our-name-and-logo
- Open Scriptures MorphHB: https://github.com/openscriptures/morphhb
- OpenBible cross references: https://www.openbible.info/labs/cross-references/
- Microsoft HAX guidelines: https://www.microsoft.com/en-us/haxtoolkit/ai-guidelines/
- Google PAIR explainability and trust: https://pair.withgoogle.com/chapter/explainability-trust/
- NN/g AI information seeking: https://www.nngroup.com/articles/ai-search-infoseeking/
- NN/g progressive disclosure: https://www.nngroup.com/articles/progressive-disclosure/
