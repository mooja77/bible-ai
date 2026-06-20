# Bible AI global, hermeneutics, partnerships, and enablement recursive research

- Generated: 2026-06-12 13:45:28 +01:00
- Filename timestamp: 2026-06-12-134528
- Scope: additional recursive research pass after the learning/local-AI/supply-chain/governance report.
- Method: reread newest reports plus corpus/resource docs, research current official sources, and fold findings back into a revised plan.

## Executive update

The next unmet risk is contextual credibility.

Bible AI already has a defensible local-first Study Packet direction. The next planning layer should make sure that future growth does not flatten language, canon, tradition, source rights, or user support into a generic "AI Bible answer."

This pass promotes a tighter public-readiness thesis:

> Bible AI should stay English/private-beta first, but its data model, prompts, exports, support flow, and roadmap should become multilingual-ready, tradition-explicit, partnership-aware, and teachable.

Four plan changes follow:

1. Add a globalization/content-metadata plan before adding more translations.
2. Add an interpretive-lens/tradition policy before expanding public AI use.
3. Separate publisher/library licensing, nonprofit grants, and open-source sustainability into different paths.
4. Build a user enablement kit before inviting a wider beta cohort.

## Recursive loop log

### Pass 1 - Remaining strategic gaps

The prior reports already covered:

- Study Packet v1,
- Smart Research,
- private beta operations,
- no passive telemetry,
- source expansion,
- AI evals,
- accessibility,
- release integrity,
- learning science,
- local runtime strategy,
- sync deferral,
- open-source governance.

This repo scan found four underdeveloped areas:

- The data model already has `tradition_family` in theology positions, but there is no formal policy for interpretive lens metadata.
- `docs/phase-13-corpus-roadmap.md` handles deuterocanon and alternate versification, but not a broader multilingual/content metadata model.
- `docs/open-resource-ingestion-plan.md` has strong source admission rules, but not a partnership/funding decision model.
- The app has guided tours and onboarding work, but no beta user enablement kit with task scripts, sample packets, and support taxonomy.

Self-improvement:

- Stop treating "bias mitigation" as prompt copy only.
- Treat language, canon, tradition, source rights, and user support as product data.
- Add stable docs before expanding corpus, public beta, or institutional pilots.

### Pass 2 - Global and multilingual Bible tech

Global Bible platforms operate at a scale Bible AI should not attempt in early beta:

- YouVersion presents thousands of Bible versions across thousands of languages and a free mobile-first habit/community model.
- Scripture Earth focuses on Scripture resources in thousands of languages, often including text, audio, video, PDFs, glossaries, and offline access.
- The Digital Bible Library exists to make Scripture text, audio, video, print, and braille resources easier to access and license across languages.
- Wycliffe and partner statistics show enormous global translation progress, but also ongoing language and access complexity.

Decision:

- Do not pursue multilingual UI or broad language coverage for the private beta.
- Do make translation/source metadata strong enough that later multilingual expansion does not require redesign.

Recommended metadata fields for future content planning:

- language name,
- BCP 47 or ISO language code where known,
- script,
- text direction,
- canon scope,
- versification system,
- translation family/edition,
- source owner or copyright holder,
- license and redistribution permissions,
- derivative-use rules,
- AI-use/export constraints where applicable,
- audio/video availability,
- update/version date,
- source checksum,
- attribution text,
- known omissions or edition-specific absences.

Plan effect:

- Create `docs/globalization-and-content-metadata.md`.
- Keep English-first beta, but require new corpus candidates to declare canon, language, script, license, and versification explicitly.
- Label absence correctly: a missing verse in a source edition is not always a corpus bug.

### Pass 3 - Hermeneutics, tradition metadata, and theological-bias mitigation

Bible Society's AI Bible apps and theological bias report reinforces a central risk: AI Bible products can present a narrow theological outlook as if it were neutral. ATS/Atla theological-education work likewise shows that AI use in theology is being treated as a formation and ethics issue, not merely a productivity tool.

The app already has a good foothold:

- Council shows multiple positions.
- Council preserves dissent.
- Theology positions include a `tradition_family` field in the local data model.
- Source and license metadata are already part of imported resources.

Gap:

- There is not yet a policy for when and how tradition/lens metadata appears in AI output, exports, issue reports, and eval fixtures.

Recommended interpretive lens metadata:

- `tradition_family`: Protestant, Catholic, Orthodox, Jewish, academic-critical, other, mixed, unspecified.
- `canon_scope`: Protestant 66-book, Catholic, Orthodox, Jewish Tanakh, custom/source-specific.
- `interpretive_lens`: grammatical-historical, historical-critical, canonical, theological/confessional, literary, devotional, other.
- `source_set_scope`: local Bible text only, open resources, imported resource set, user-selected sources.
- `confidence_boundary`: where the app has enough evidence and where it does not.
- `minority_positions`: preserved when meaningful and sourced.
- `user_lens`: optional user-entered context, not a hidden assumption.

Output policy:

- Avoid "the Christian view" as an unlabeled final answer.
- Prefer "major positions include..." for disputed issues.
- Label source and tradition limitations.
- Distinguish Scripture text, historical tradition, confessional source, commentary, and model synthesis.
- Let the user choose "compare across traditions" versus "work within this source set/lens."
- Export the active lens and source set with Study Packets.

Eval additions:

- Add fixtures where the same question should surface Catholic/Protestant/Orthodox/Jewish canon or tradition differences.
- Add fixtures where a minority position must be preserved if supported by the provided source set.
- Add fixtures that fail if the app presents one tradition's answer as the only Christian answer without qualification.

Plan effect:

- Create `docs/interpretive-lens-and-tradition-policy.md`.
- Update `docs/ai-risk-eval-plan.md` once it exists.
- Add Study Packet metadata fields for canon scope, source set, and interpretive lens.

### Pass 4 - Publisher/library, nonprofit, grants, and partnerships

The funding and content paths should not be collapsed into one decision.

#### Publisher and library path

Digital Bible Library and API.Bible are rights and licensing routes for modern translations. They are not shortcuts around permission, redistribution, or local bundling limits.

Decision:

- Keep modern copyrighted translations out of bundled local corpus until explicit rights exist.
- If modern translation access becomes important, evaluate API.Bible/DBL as permissioned access with clear online/offline limits.
- Treat publisher partnerships as a later business/legal project, not a private-beta dependency.

#### Open-source funding path

NLnet and Sovereign Tech style programs are relevant only if the project is meaningfully free/open-source and contributes reusable open technology, privacy, accessibility, or infrastructure value.

Decision:

- Do not plan around grant funding until the public/open-source posture is decided.
- If applying later, emphasize local-first study data control, accessibility, open resource provenance, and reusable eval/source-ingestion tooling.

#### Scripture engagement and ministry research grants

American Bible Society grant examples show that Scripture-engagement research and young-adult engagement projects can receive small grants. That path fits a measured beta or research pilot better than product monetization.

Decision:

- A future grant application should be framed as Scripture engagement and responsible AI evaluation, not as "build a Bible chatbot."
- Useful grant artifact: anonymized beta findings on whether auditable AI improves source checking and user judgment.

#### Institutional/church pilot path

Seminary, church, and small-group pilots require:

- AI-use policy,
- privacy notes,
- source rights,
- support path,
- sample Study Packets,
- pastoral/sensitive-topic boundaries,
- accessibility baseline,
- clear statement that the app is not a pastor, counselor, or theological authority.

Plan effect:

- Create `docs/partnership-and-funding-strategy.md`.
- Add "grant/pilot readiness" as a later phase after private beta.
- Do not contact publishers or institutions before the beta operating docs exist.

### Pass 5 - Training, support, adoption, and enablement workflows

The app is dense. The support model cannot rely on users reading every architecture or release doc.

Service-design and UX sources point toward a simple principle:

- understand user needs,
- solve the whole task,
- keep the primary path simple,
- reveal advanced details progressively,
- make empty states instructional,
- collect structured feedback.

Bible AI should ship a beta enablement kit before expanding testers.

Recommended beta enablement kit:

1. `10-minute-first-study.md` - one task from passage to Study Packet.
2. `ai-setup-quickstart.md` - personal keys, local/no-key path, managed gateway caveat.
3. `privacy-one-page.md` - what stays local, what provider calls send, what is never collected automatically.
4. `sample-study-packet.md` - a complete example with sources, user notes, and exported metadata.
5. `bad-ai-output-report.md` - how to report hallucination, overconfidence, missing dissent, bad citation, bias, or unsafe response.
6. `support-bundle-walkthrough.md` - what it includes and how to review/redact.
7. `small-group-teacher-task.md` - prepare a 45-minute discussion from one passage.
8. `original-language-beginner-task.md` - inspect a word without lexical overreach.

Support taxonomy:

- installation/setup,
- provider/auth/billing confusion,
- local Ollama/embedding issue,
- source/license issue,
- AI output quality issue,
- theological-bias issue,
- sensitive-topic safety issue,
- accessibility issue,
- export/backup/restore issue,
- release/security issue.

Recommended support channels:

- private beta: email/form/manual template;
- technical beta: GitHub issue forms and Discussions;
- public docs: static docs site later, Docusaurus or equivalent only when docs versioning/search becomes worth maintaining;
- community chat: defer until there is moderation capacity.

Plan effect:

- Create `docs/user-enablement-and-support-plan.md`.
- Add issue templates only after the support taxonomy is stable.
- Add one sample Study Packet before asking external testers for one.

## Revised roadmap after this loop

### Promote now

Add these stable docs to the canonicalization backlog:

1. `docs/globalization-and-content-metadata.md`
2. `docs/interpretive-lens-and-tradition-policy.md`
3. `docs/partnership-and-funding-strategy.md`
4. `docs/user-enablement-and-support-plan.md`

These join the already proposed canonical docs:

1. `docs/decision-index.md`
2. `docs/beta-operating-model.md`
3. `docs/beta-feedback-kit.md`
4. `docs/study-packet-v1.md`
5. `docs/learning-design-principles.md`
6. `docs/source-expansion-strategy.md`
7. `docs/ai-risk-eval-plan.md`
8. `docs/support-bundle-policy.md`
9. `docs/accessibility-release-gate.md`
10. `docs/release-integrity-and-supply-chain.md`
11. `docs/data-portability-and-sync-policy.md`
12. `docs/governance-and-community-policy.md`

### Update existing docs

1. `docs/phase-13-corpus-roadmap.md` - add language/script/canon/versification metadata requirements.
2. `docs/open-resource-ingestion-plan.md` - add AI-use/export constraints and publisher/rights-holder distinction.
3. `docs/testing-and-release-plan.md` - add tradition-lens, multilingual metadata, and bad-AI-output report fixtures.
4. `docs/privacy-and-distribution.md` - add institutional pilot and managed gateway caveats.
5. `README.md` - clarify English/private-beta focus and future multilingual readiness.

### Defer

- multilingual UI,
- broad language corpus expansion,
- DBL/API.Bible integration,
- publisher licensing negotiations,
- public docs website,
- Discord/community chat,
- church-wide or seminary-wide pilot,
- grant applications,
- paid content/library marketplace.

### Add beta acceptance checks

Study Packet metadata:

- source set included,
- canon scope included,
- translation/module identifiers included,
- interpretive lens/tradition field included when applicable,
- source limitations included,
- user judgment included,
- AI synthesis separated from user notes.

Theological-bias report path:

- tester can report "bad AI output" using a structured form,
- report captures source set, question, provider/model, expected problem category, and redacted output,
- categories include missing dissent, unlabeled tradition lens, bad citation, unsupported certainty, unsafe pastoral response, and hallucinated source.

Content expansion:

- each candidate source declares language, script, canon scope, license, redistribution, export rights, and AI-use constraints.

## Decision register additions

| Area | Decision | Why |
| --- | --- | --- |
| Multilingual strategy | English private beta; metadata-ready for later | Global language scale is real but not an early wedge. |
| Translation expansion | Rights-first, metadata-first | Avoid content debt and unlabeled canon/versification confusion. |
| Tradition handling | Explicit lens metadata | Prevents one tradition's answer from masquerading as neutral. |
| Bias mitigation | Evals plus source/lens UI, not prompt copy alone | Theological bias is structural and workflow-level. |
| Publisher path | Defer DBL/API.Bible/licensing until beta proves value | Licensed content is a legal/product program. |
| Grants | Later, if tied to responsible AI and Scripture engagement evidence | Grants need clear outcomes and governance. |
| User enablement | Build kit before widening beta | Dense tools need task scripts, samples, and support taxonomy. |
| Support channels | Manual/forms first; chat/docs site later | Keeps support load manageable. |

## Source links used in this pass

- Wycliffe Global Scripture Access 2025: https://wycliffe.net/global-scripture-access/
- Wycliffe UK translation statistics 2026: https://wycliffe.org.uk/statistics/
- Scripture Earth: https://scriptureearth.org/00eng.php
- YouVersion official site and languages: https://www.youversion.com/ and https://www.bible.com/languages
- Digital Bible Library: https://library.bible/
- American Bible Society DBL overview: https://www.americanbible.org/news/articles/10-years-of-the-digital-bible-library/
- United Bible Societies DBL translation page: https://translation.bible/tools-resources/digital-bible-library/
- Every Tribe Every Nation: https://eten.bible/
- Bible Society AI Bible apps and theological bias: https://www.biblesociety.org.uk/research/ai-bible-apps-and-theological-bias-report
- Association of Theological Schools: https://www.ats.edu/
- Atla F[AI]thfully Co-Creating: https://www.atla.com/ai-te-series/
- In Trust ATS/Atla AI theological education event: https://www.intrust.org/news-insights/faithfully-co-creating/
- SBL Handbook of Style official page: https://www.sbl-site.org/sbl-press/browse-books/sbl-handbook-of-style/
- NLnet funding: https://nlnet.nl/funding.html and https://nlnet.nl/propose/
- Sovereign Tech Agency: https://www.sovereign.tech/
- American Bible Society Ministry Insights Grant: https://www.americanbible.org/ministry-insights-grant/
- American Bible Society faculty grant announcement: https://www.americanbible.org/news/press-releases/articles/american-bible-society-awards-four-grants-to-christian-universities/
- GOV.UK Service Manual and Service Standard: https://www.gov.uk/service-manual and https://www.gov.uk/service-manual/service-standard
- Nielsen Norman Group progressive disclosure: https://www.nngroup.com/articles/progressive-disclosure/
- Nielsen Norman Group empty states: https://www.nngroup.com/articles/empty-state-interface-design/
- GitHub Discussions docs: https://docs.github.com/discussions
- GitHub issue forms syntax: https://docs.github.com/en/communities/using-templates-to-encourage-useful-issues-and-pull-requests/syntax-for-issue-forms
- Docusaurus docs/versioning: https://docusaurus.io/docs and https://docusaurus.io/docs/versioning

