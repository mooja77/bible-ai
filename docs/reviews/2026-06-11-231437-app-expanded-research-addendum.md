# Bible AI expanded research addendum

Timestamp: 2026-06-11 23:14:37 +01:00

Filename timestamp: 2026-06-11-231437

Related report: `docs/reviews/2026-06-11-230419-app-market-tech-research.md`

Scope: another research loop over adjacent competitors, data ecosystems, AI evaluation, release/security tooling, accessibility, and roadmap implications. This addendum is intentionally more operational than the prior market report.

## Executive update

The previous positioning still holds: Bible AI should not compete as a generic "Bible chatbot." The new research strengthens that conclusion and adds a sharper warning:

> The strongest near-term product is a local-first, auditable study workbench. The strongest long-term moat is not chat. It is trusted source handling, repeatable research workflows, and evaluated Council behavior.

New findings:

- Rebind is the most directly relevant new AI-study competitor because it combines licensed commentary content with AI conversation and cited answers.
- Dwell, Hallow, Glorify, and YouVersion show that Christian apps win habit loops through audio, prayer, community, reminders, and guided flow. Bible AI should borrow setup and habit design, not pivot into devotional media.
- API.Bible, Bible Brain, and the Digital Bible Library can solve connected access to modern translations, but they are not a simple offline-bundling answer.
- Berean Standard Bible, Open English Bible, STEPBible data, MACULA, and unfoldingWord are better candidates for open/local expansion, subject to per-source review and attribution/export rules.
- The Council needs a formal eval harness now. RAG faithfulness, context recall, prompt regression tests, disputed-question fixtures, and red-team checks should become release gates before more AI surface area is added.
- Public release work should add SBOM, signed update strategy, code signing, accessibility automation, and release artifact tree hashes to match the trust posture the product claims.

## Recursive loop results

### Loop 1 - Adjacent competitors

The prior report focused on YouVersion, Logos, Accordance, Olive Tree, Blue Letter Bible, STEP Bible, e-Sword, Bible Chat, and BibleMate. This loop added the adjacent categories that shape user expectations.

| Product | Lane | New signal | Product implication |
|---|---|---|---|
| Rebind Study Bible | AI plus licensed commentary | Rebind claims to turn the full NICOT/NICNT commentary set into an AI conversation with transparent citations. | This is the closest direct AI-study competitor. Bible AI cannot rely on "AI with citations" alone; it must lean into local data, multi-voice dissent, and user-owned/open resources. |
| Dwell | Audio Bible habit | Dwell sells listening, narrator choice, background music, memorization loops, and a subscription. | Audio and memorization are strong engagement loops, but not core v0.1. Add audio later only if it supports study packets or reading plans. |
| Hallow | Prayer and meditation habit | Hallow emphasizes guided prayer, sleep Bible stories, routine, and a large content library. | Hallow is not a study competitor, but it sets expectations for calm onboarding and daily habit design. |
| Glorify | Devotional habit | Glorify emphasizes daily devotionals, prayer, worship music, mindfulness, and daily relationship language. | Competing here would dilute the product. Borrow first-run warmth and streak-free continuity, not the devotional business model. |
| BibleProject | Free learning ecosystem | BibleProject offers videos, classes, podcasts, guides, reader, plans, and downloads. | Bible AI should support learning paths and source-backed explanations, not try to replace polished educational media. |
| GotQuestions.chat | AI search over human-written answers | GotQuestions.chat searches a large human-written ministry article library. | Bible AI needs a "source set" concept: answer quality depends on which library is being queried. |
| Bible Hub | Free web study suite | Bible Hub offers topical, Greek/Hebrew, concordance, commentary, dictionary, sermon, devotional, parallel, interlinear, Strong's, and cross-reference tools. | The free web baseline is very broad. Bible AI should reduce synthesis effort rather than merely add more panels. |
| Verbum | Catholic Logos lane | Verbum packages Catholic study resources and a free resource base. | Bible AI needs tradition-aware handling if it ever markets beyond a generic Protestant/default corpus. |

Self-improvement from this loop: the plan should explicitly separate "study workbench" from "habit devotional app." Bible AI can have gentle habit affordances, but the core product promise should remain researched, cited, and exportable study.

## Market update

The 2026 State of the Bible page says the 2025 uptick in Bible use and Scripture engagement largely returned to 2024 levels in 2026, while active weekly users stayed more stable. That matters because Bible AI should not assume a broad revival wave will carry adoption. It needs a concrete job to be done.

YouVersion continues to show massive engagement. Its April 2026 Easter update reported an average of 18.7 million people engaging daily through Holy Week and 21.6 million people on Easter Sunday, a record for that holiday. Its June 2026 product update emphasized guided engagement, QR sharing, and friend mentions in plans.

Planning implications:

- Casual Bible engagement is huge, but mobile-first incumbents own it.
- Serious study and teaching are more defensible entry points for a desktop app.
- Community and sharing are powerful, but Bible AI should start with exportable study packets, not social networking.
- The "older/low-vision/nontechnical" UX plan already in the repo is strategically important, not cosmetic.

## Data ecosystem findings

### Connected/licensed routes

API.Bible and the Digital Bible Library are relevant if Bible AI later needs modern translations such as NIV, NKJV, NASB, The Message, NLT, Amplified, and other licensed content under a unified API/license route. The key architectural point is that this is a connected integration, not a default offline corpus unless the agreement permits bundling.

Bible Brain from Faith Comes By Hearing provides API access to Bible text, audio, and video, with a strong language and audio focus. This is strategically useful for audio/language reach, but it also introduces online dependencies, API terms, cache rules, and attribution requirements.

CrossWire/SWORD is useful as an ecosystem reference and possible import inspiration, but the license picture is mixed. CrossWire software is GPL, while text modules have differing copyrights and many compatible texts are not distributable by CrossWire. That means SWORD module import must be treated as user-import or per-module review, not bulk bundling.

### Open/local expansion candidates

| Source | Why it matters | Initial decision |
|---|---|---|
| Berean Standard Bible | Berean says the Berean Bible and Majority Bible texts were placed into the public domain as of 2023-04-30. | Strong candidate for a modern open English translation import review. |
| Open English Bible | OEB says it is under CC0/public domain and can be reused without restrictions. | Candidate, but inspect completion status, versification, and text stability before bundling. |
| STEPBible Data | STEPBible data is available under CC BY 4.0 terms and includes valuable language data. | Strong candidate for original-language enrichment, with attribution and change-record handling. |
| MACULA Greek/Hebrew | MACULA Greek license is CC BY 4.0 and includes syntax trees, morphology, word senses, frames, referents, synonyms, and mappings. | High-value future original-language path, but implementation complexity is high. |
| unfoldingWord resources | unfoldingWord biblical content resources use CC BY-SA 4.0. | Useful for translation/discipleship resources, but share-alike export implications need explicit UI. |
| Open Bible Stories | Open Bible Stories is open-licensed and oriented around narrative/discipleship. | Useful for learning mode, not core exegetical Council evidence by default. |
| Sefaria | Per previous report, each text has its own reuse status. | Keep strict per-text review gate. |

Self-improvement from this loop: add source classes to the plan:

- Class A: Bundled open corpus. Can ship offline.
- Class B: User-imported reviewed corpus. Local, but user/source-specific.
- Class C: Connected licensed API. Do not cache or redistribute beyond terms.
- Class D: Quarantined/unreviewed import. Searchable only after user confirms source terms.
- Class E: Blocked. Unknown, incompatible, or misleading license.

## AI evaluation and trust tooling

The current Council protocol already preserves retrieval traces, voices, provider manifest, confidence rationale, and source drawer data. That is a good foundation. The next improvement is a formal evaluation pipeline.

Recommended evaluation stack:

1. Retrieval evals in-repo.

- Track top-k recall for known passage questions.
- Track whether explicit references are always injected.
- Track sparse-evidence behavior for questions that should remain uncertain.
- Track hybrid versus FTS versus semantic retrieval.

2. RAG faithfulness metrics.

Ragas documents faithfulness as factual consistency between response and retrieved context. That maps well to Council output: every doctrinal claim in the short answer should be supportable by cited evidence or explicitly labeled as interpretive synthesis.

3. Prompt and provider regression with promptfoo.

Promptfoo is an open-source CLI/library for LLM evaluation and red teaming. It can run prompt/model/RAG benchmarks, assertions, CI checks, and adversarial tests. Use it or a small custom equivalent to check:

- No uncited doctrinal claims in the short answer.
- No hidden provider key names or local paths.
- Dissent is preserved for disputed questions.
- Provider failure is visible and confidence is adjusted.
- The answer refuses to invent Bible text or cite absent passages.

4. OWASP LLM risk checklist.

OWASP lists prompt injection and insecure output handling as top LLM application risks. For Bible AI, that means:

- Treat imported resources as untrusted prompt input.
- Never let retrieved commentary/resource text override the Council system prompt.
- Keep LLM output out of command execution and file paths.
- Sanitize exports and logs for secrets, local paths, and hidden prompt text.
- Bound prompt size and provider spend.

5. Theological-bias fixtures.

Add eval rows for questions across traditions:

- baptism: infant, believer, sacramental, symbolic
- Eucharist/Lord's Supper: Catholic, Lutheran, Reformed, memorial
- church polity: episcopal, presbyterian, congregational
- canon/deuterocanon
- gifts continuation/cessation
- election and free will
- women in ministry
- creation timing
- millennial views

Expected behavior is not a single winner. Expected behavior is accurate representation, cited evidence, named tensions, and no hidden default lens.

## Search and storage options

The current SQLite FTS5 plus Rust cosine scan is still adequate for v0.1. Do not add new search infrastructure before measuring.

Option guidance:

- Stay with SQLite FTS5 and embedding blobs for now. It is simplest, local, portable, and already working.
- Consider sqlite-vec later if corpus/resource growth makes linear vector scan too slow. Its own docs warn it is pre-v1, so avoid making it a release blocker.
- Consider Tantivy if local full-text search needs richer ranking, indexes, or fielded search beyond SQLite FTS5.
- Avoid Meilisearch for the desktop-first local app unless a separate local service becomes acceptable. It is strong for typo-tolerant app search and RAG, but adds service lifecycle complexity.
- Consider LanceDB only if research/resource scale becomes vector-heavy enough to justify a second embedded data store.

Self-improvement from this loop: add a "measure before replacing SQLite" rule to the technical plan.

## Release, supply-chain, and desktop trust

The app's public trust story now needs to match its AI trust story.

Recommended additions:

1. SBOM and third-party notices.

CycloneDX defines a full-stack Bill of Materials standard for supply-chain risk reduction. This repo has prior review notes about missing SBOM/third-party runtime notices for bundled Node, sidecar npm packages, native modules, and upstream license files. Make this a release artifact.

2. Signed updates and installers.

Tauri's updater requires signed updates. Tauri's Windows signing docs state signing is required for Microsoft Store listing and to prevent SmartScreen warnings for browser-downloaded apps. Even if v0.1 ships without auto-update, the release plan should document when signing starts and how unsigned private builds are labeled.

3. Release artifact tree hashes.

Prior reviews already flagged that directory artifacts such as `sidecar/`, `node_modules/`, and bundled runtime directories need deterministic tree hashes or per-file hash lists. Keep this in the release gate.

4. Accessibility automation.

WCAG 2.2 AA contrast requires 4.5:1 for normal text and 3:1 for large text. Axe-core is designed for automated accessibility testing alongside functional tests. The app already has accessibility-focused plans, but it should add automated checks to WebDriverIO or a lightweight browser pass for app shell, Settings, Reader, Search, Council, Workspace, and export preview.

5. Clean-profile evidence remains non-negotiable.

The repo's `docs/manual-release-qa-report.md` correctly says public Windows release remains blocked until clean-profile installer checklist and credential-vault profile checks are signed off. Market research reinforces this: a privacy-first AI Bible desktop app cannot hand-wave installer and credential evidence.

## Revised roadmap delta

This is not a full replacement for the previous plan. It is the next refinement.

### Now: public trust and release proof

- Complete manual clean-profile Windows evidence.
- Add SBOM/third-party notices for app, sidecar, bundled Node, native modules, and corpus/source artifacts.
- Add deterministic tree hashes for directory artifacts.
- Add custom Tauri command security checklist.
- Add import bounds for backup, SQLite restore, and resource JSONL.
- Add accessibility smoke automation.
- Add explicit unsigned/private build labeling.

### Next: source and data strategy

- Add source classes A-E to docs and import UI.
- Create a source candidate tracker for Berean, OEB, STEPBible Data, MACULA, unfoldingWord, API.Bible, Bible Brain, SWORD modules, and Sefaria.
- Build dry-run import preview that shows license, attribution, cache/export policy, row count, estimated size, and source class.
- Keep modern translations out of bundled offline corpus unless distribution rights are explicit.

### Next: Council quality system

- Add `docs/council-evaluation-plan.md`.
- Convert the existing real-world QA bank into structured eval cases.
- Add theological-bias fixtures where multiple traditions must be represented.
- Add faithfulness checks against retrieved evidence.
- Add prompt-injection/resource-injection tests.
- Add output checks for no uncited claims, no secret/path leaks, no invented citations, and visible provider failures.

### Later: adjacent engagement features

- Add study plans only after workspaces and exports are strong.
- Add audio only if it supports study workflows: listen to passage, quote timing, memorization, reading plan progress.
- Add BibleProject-style guided learning only as curated workflows over existing local resources, not as a media platform.
- Add community/sharing only through exportable study packets before any account-based social features.

## Product principles after this loop

1. Do not chase the devotional app lane.

Bible AI should feel calm and approachable, but its reason to exist is serious study with auditability.

2. Make source sets explicit.

Every AI answer should make clear what it searched: bundled corpus, user resources, connected API content, or a selected source pack.

3. Treat theological disagreement as a feature.

The Council should explain why faithful interpreters disagree, not flatten the answer.

4. Prefer local/open by default and connected/licensed by choice.

This preserves privacy and distribution simplicity while leaving room for future paid/licensed integrations.

5. Test AI behavior like product behavior.

The Council is a core feature. Its quality, safety, and bias behavior need regression tests just like search, backup, and export.

## Concrete doc updates recommended

The next document set should be:

- `docs/source-provenance-policy.md`
  - Define source classes A-E.
  - Define bundled, user-imported, connected, quarantined, and blocked behavior.
  - Define export rules and attribution display rules.

- `docs/council-evaluation-plan.md`
  - Define eval schema, question bank, faithfulness checks, theological-bias cases, provider-failure cases, and release thresholds.

- `docs/release-security-checklist.md`
  - Define custom command review, Tauri permissions/CSP review, sidecar boundary, SBOM, tree hashes, signing, updater, credential vault, and clean-profile evidence.

- `docs/competitive-landscape.md`
  - Merge both research reports into a stable competitor table with source dates and lanes.

- `docs/product-positioning.md`
  - Record target users, non-goals, wedge, core promise, and language to avoid.

## Key sources from this loop

- Rebind Study Bible: https://classics.rebindapp.com/study-bible/
- Dwell: https://dwellapp.io/
- Dwell pricing: https://dwellapp.io/pricing
- Glorify: https://www.glorify.global/app
- Hallow: https://hallow.com/
- BibleProject: https://bibleproject.com/
- GotQuestions.chat: https://www.gotquestions.chat/
- Bible Hub: https://biblehub.com/
- Verbum Free Edition: https://verbum.com/free-edition
- 2026 State of the Bible update: https://sotb.americanbible.org/the-bible-in-america-today/
- YouVersion June 2026 update: https://blog.youversion.com/2026/05/whats-new-in-the-bible-app-june-2026/
- YouVersion Easter 2026 engagement: https://www.youversion.com/news/easter-marks-the-highest-bible-engagement-day-in-youversion-history
- Faith Apps Unite announcement: https://www.youversion.com/news/faith-apps-unite-in-historic-moment-for-the-bible
- Digital Bible Library: https://library.bible/
- API.Bible docs: https://docs.api.bible/
- Bible Brain: https://www.faithcomesbyhearing.com/audio-bible-resources/bible-brain
- CrossWire SWORD: https://crosswire.org/sword/index.jsp
- CrossWire license note: https://www.crosswire.org/sword/about/license.jsp
- unfoldingWord content: https://unfoldingword.org/for-translators/content/
- Berean Bible licensing: https://berean.bible/licensing.htm
- Open English Bible: https://openenglishbible.org/
- STEPBible Data: https://github.com/STEPBible/STEPBible-Data
- MACULA Greek license: https://github.com/Clear-Bible/macula-greek/blob/main/LICENSE.md
- Ragas faithfulness: https://docs.ragas.io/en/latest/concepts/metrics/available_metrics/faithfulness/
- promptfoo intro: https://www.promptfoo.dev/docs/intro/
- OWASP LLM Top 10: https://owasp.org/www-project-top-10-for-large-language-model-applications/
- CycloneDX: https://cyclonedx.org/
- Tauri updater: https://v2.tauri.app/plugin/updater/
- Tauri Windows code signing: https://v2.tauri.app/distribute/sign/windows/
- WCAG 2.2: https://www.w3.org/TR/WCAG22/
- axe-core: https://github.com/dequelabs/axe-core
- sqlite-vec: https://github.com/asg017/sqlite-vec
- Tantivy docs: https://docs.rs/tantivy/
- Meilisearch overview: https://www.meilisearch.com/docs/getting_started/overview
- LanceDB quickstart: https://docs.lancedb.com/quickstart
