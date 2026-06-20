# Bible AI community, content, privacy, accessibility, and eval recursive research

- Generated: 2026-06-12 00:28:18 +01:00
- Filename timestamp: 2026-06-12-002818
- Scope: additional recursive research pass after the tools/competitors/market/tech refresh.
- Method: reread latest research/docs, identify remaining gaps, research current official sources, and fold findings back into the roadmap.

## Executive update

The research corpus is now large enough that the next risk is not "missing one more competitor." The next risk is that the project keeps accumulating timestamped research without promoting the strongest decisions into stable operating docs.

This pass adds a sharper next-step thesis:

> Move from research accumulation to beta operationalization: recruit a narrow cohort, standardize Study Packet exports, document content-rights strategy, add local AI eval fixtures, and turn privacy/accessibility into explicit release gates.

The app should not try to grow like YouVersion, Hallow, BibleProject, or other mobile devotional platforms. Their scale is real, but their job is different. Bible AI's first wedge remains serious study output: a user completes a source-grounded, exportable Study Packet that they trust enough to revisit or teach from.

## Recursive loop log

### Pass 1 - Remaining gaps after latest reports

Latest reports already cover:

- direct competitors,
- adjacent AI research tools,
- distribution/pricing,
- local-first privacy,
- no passive telemetry,
- Study Packet v1,
- Smart Research,
- source provenance,
- prompt-injection and theological-bias eval needs.

Remaining gaps found:

- first tester acquisition and community channel strategy are still too abstract;
- content standards are named but not translated into import strategy;
- privacy is framed as product posture but not fully mapped to sensitive religious data risk;
- accessibility is mentioned but not yet converted into a beta acceptance checklist;
- eval tooling is discussed, but the app still needs a practical fixture taxonomy and promotion path into canonical docs;
- repeated timestamped reports now need consolidation into stable docs.

Self-improvement from this pass:

- Stop treating timestamped research reports as the product plan.
- Promote decisions into stable docs before adding more feature surface.
- Make beta operations, content-rights, accessibility, and evals first-class release artifacts.

### Pass 2 - Acquisition, community, and go-to-market research

Mass Bible apps prove demand, but they do not define the first Bible AI route.

- YouVersion's official newsroom says its family of Bible apps is reaching one billion device installs. Its official app pages emphasize free Bible access, many languages, audio, plans, prayer, and habit loops.
- Hallow emphasizes guided prayer, reminders, streaks, journals, and a large audio/content library.
- BibleProject's app emphasizes free videos, classes, podcasts, reflection questions, annotated resources, and structured learning.
- Gloo and Barna signal a growing faith-tech infrastructure market, but that world is oriented around churches, organizations, and AI adoption by leaders, not a first independent desktop beta.

Decision:

- Bible AI should not attempt a public consumer growth loop yet.
- The first cohort should be manually recruited from serious lay learners, small-group teachers, pastors/ministry volunteers with limited tooling budget, and original-language beginners.
- The right first channel is direct invitation plus a plain feedback kit, not public ads, app-store SEO, or social virality.

Recommended beta recruiting plan:

1. Build a list of 8 to 12 candidates.
2. Pick 5 to 8 for the first beta round.
3. Give each one the same task: produce one Study Packet from one real passage/topic.
4. Collect structured feedback manually.
5. Use interviews and support bundles only with consent.

Recommended first channels:

- direct invite by email or message,
- GitHub Discussions only if testers are technical,
- a plain web form or email template if testers are nontechnical,
- optional Discord only after there is moderation capacity and a rules/onboarding policy.

Avoid for now:

- public waitlist without support capacity,
- paid acquisition,
- influencer launch,
- app-store launch,
- community server before a code of conduct/moderation plan,
- church-wide deployment before support/privacy docs exist.

### Pass 3 - Content standards, licensing, and partnership research

Bible AI already has a useful local corpus and source review workflow. The next content question is not "import everything." It is "which standards and rights paths should be supported without creating licensing debt?"

#### USFM and USX

USFM is widely used in Bible translation workflows and uses backslash markers to identify Scripture document elements. USX is an XML format derived from USFM's structure. Bible AI already uses eBible.org USFM content for WEB, so USFM should remain a first-class input standard.

Plan effect:

- Build source import around a USFM/USX normalization layer.
- Preserve enough marker metadata to support footnotes, headings, paragraphs, and study content later.
- Do not flatten all structure into verse text if Study Packet citation quality depends on section headings or notes.

#### OSIS and SWORD

OSIS is an XML standard for Bibles and biblical research texts. CrossWire/SWORD supports OSIS, TEI, ThML, and plain text for module creation, but its module file format should be accessed through the SWORD API rather than treated as a stable direct file format.

Plan effect:

- Treat OSIS as a useful interchange format.
- Treat SWORD modules as an ecosystem integration, not a simple file parser.
- Review module licenses one by one; do not assume all SWORD modules are redistributable.

#### API.Bible and Digital Bible Library

API.Bible and the Digital Bible Library provide access to many translations, including modern licensed translations. That is a rights/channel path, not a bundled-content shortcut.

Plan effect:

- If modern translations become a product goal, evaluate API.Bible/DBL as permissioned access rather than scraping or bundling.
- Keep local bundled content limited to public-domain/open-license sources unless explicit rights are granted.
- Add a source expansion decision doc before adding modern translations.

#### Open content partners

Potentially useful open-source/open-content paths include:

- eBible.org for downloadable open/public texts,
- unfoldingWord for open translation resources,
- Open.Bible projects for open biblical data,
- CrossWire/SWORD for ecosystem awareness and module workflows,
- public-domain church history and creeds with explicit provenance.

Decision:

- Content expansion should be staged behind a `source-expansion-strategy` doc and import acceptance tests.
- Each source needs license, attribution, redistribution, derivative-use, export, and AI-use review fields.

### Pass 4 - AI eval, security, privacy, and accessibility tooling

#### AI eval tooling

The strongest immediate fit is still local fixtures plus a small optional external-tool prototype.

Tools reviewed:

- promptfoo: useful for local prompt regression and red-team cases.
- Ragas: useful vocabulary for RAG metrics such as context precision/recall and answer relevancy, but judge-model dependence needs care.
- DeepEval: useful Pytest-like LLM testing framework, again with LLM-as-judge caveats.
- OpenAI Evals: useful if the project wants hosted or API-driven evals for OpenAI-specific flows, but it should not become the whole provider-agnostic truth source.

Decision:

- Adopt an in-repo eval fixture schema first.
- Prototype promptfoo only after fixtures exist.
- Use Ragas/DeepEval only for supplementing, not replacing, human-reviewed theological/source fixtures.

Minimum fixture categories:

1. Retrieval correctness.
2. Source grounding.
3. Citation/provenance retention.
4. Theological disagreement/dissent.
5. Sensitive-topic handling.
6. Prompt injection from imported resources.
7. Provider failure and malformed JSON handling.
8. Study Packet export metadata.

#### Security and LLM risk

OWASP's LLM risk work treats prompt injection as a top LLM application risk. This maps directly to Bible AI because imported resources, user notes, and retrieved passages can become untrusted context.

Decision:

- Treat imported resource text as untrusted content.
- Add malicious resource fixtures before public AI beta.
- Keep source text, user notes, generated synthesis, and model instructions separated in prompts and exports.

#### Privacy and sensitive religious data

GDPR Article 9 and UK ICO guidance classify data revealing religious or philosophical beliefs as special category data. CCPA/CPRA also gives special handling to sensitive personal information. The local-first desktop app reduces remote-processing exposure, but the moment the app adds accounts, passive telemetry, hosted sync, support uploads, or a managed gateway, privacy obligations and user expectations become much more serious.

This is not legal advice; it is a product-risk implication:

- Do not collect passive telemetry in private beta.
- Do not auto-upload notes, searches, prompts, or Council sessions.
- Do not make support bundles automatic.
- Do not add cloud sync without a privacy and retention design.
- Do not operate a public managed gateway without published logging, retention, routing, billing, and deletion terms.

Support bundle rule:

- User initiates it.
- User previews it.
- Secrets are excluded.
- Private notes are excluded by default.
- Logs are redacted.
- Provider/model/build metadata is included.
- Retrieval/source IDs are included when useful.

#### Accessibility

WCAG 2.2, Section 508, EN 301 549, and WebAIM screen-reader research all point toward making accessibility a release gate rather than late polish.

Bible AI has a dense desktop interface: Reader, Search, Council, Theology, Resources, Settings, and export flows. Accessibility cannot be reduced to color contrast alone.

Recommended beta accessibility checklist:

- keyboard-only path through Reader, Search, Council, Settings, and Export;
- visible focus indicators;
- target size and spacing checks for dense toolbars;
- no modal focus traps;
- screen-reader names for icon buttons and tabs;
- correct heading structure in long Council results;
- readable high-contrast states;
- text scaling check;
- export preview usable without mouse;
- no overlapping text in scaled UI;
- automated axe/Playwright scan for stable screens.

Decision:

- Add an `accessibility-release-gate` doc before the next public installer claim.
- Keep accessibility tied to the beta workflow: "Can a keyboard-only user produce a Study Packet?"

### Pass 5 - Revised roadmap after this loop

The next phase should be "canonicalization and beta readiness," not another feature phase.

#### Phase A - Promote research into stable docs

Create the canonical docs listed below, using the timestamped reports as source material.

High priority:

1. `docs/decision-index.md`
2. `docs/beta-operating-model.md`
3. `docs/beta-feedback-kit.md`
4. `docs/study-packet-v1.md`
5. `docs/source-expansion-strategy.md`
6. `docs/ai-risk-eval-plan.md`
7. `docs/support-bundle-policy.md`
8. `docs/accessibility-release-gate.md`

Update existing docs:

1. `docs/architecture.md` - correct current vector storage to BLOB embeddings plus Rust cosine scan.
2. `docs/privacy-and-distribution.md` - add no passive telemetry and manual support bundle language.
3. `docs/install-windows.md` - add private-beta installer and SmartScreen/code-signing caveat.
4. `README.md` - clarify managed gateway is supported but not public-default without operator privacy terms.
5. `docs/testing-and-release-plan.md` - add AI eval, accessibility, capability review, and Study Packet export gates.

#### Phase B - Private beta package

Create:

- one private/test Windows installer or source-run path,
- one feedback kit,
- one support bundle policy,
- one beta task script,
- one Study Packet export target,
- one issue/discussion/form path.

Beta task:

> Produce one Study Packet from a real passage/topic, with sources, notes, a user judgment, and export metadata.

#### Phase C - Evals and trust gates

Before sharing beyond trusted testers:

- run existing build/checks,
- run clean-profile installer QA,
- run provider redaction checks,
- run source-grounding fixtures,
- run prompt-injection fixtures,
- run sensitive-topic fixtures,
- run Study Packet export validator,
- run accessibility smoke checks,
- review Tauri capabilities.

#### Phase D - Public release decision

Only after private beta:

- decide public/open-source/source-available posture,
- decide funding model,
- decide whether GitHub Releases are enough,
- decide whether WinGet/Microsoft Store is justified,
- decide whether managed gateway is still deferred,
- decide whether modern translation access is API/DBL-based, licensed-pack-based, or still deferred.

## Operating decisions promoted by this pass

| Area | Decision | Reason |
| --- | --- | --- |
| Growth | Manual beta recruiting before public launch | The app needs workflow proof, not scale. |
| Community | GitHub/email first; Discord later | Avoid moderation/support burden before docs exist. |
| Content standards | USFM/USX first, OSIS second, SWORD as ecosystem/API integration | Matches current eBible path and avoids brittle direct module parsing. |
| Modern translations | Permissioned API/licensing path only | Avoid copyright and redistribution risk. |
| Eval tooling | In-repo fixtures first; promptfoo prototype second | Keeps privacy and theological review close to code. |
| Privacy | No passive telemetry; no automatic support uploads | Religious notes/questions can reveal sensitive beliefs. |
| Accessibility | Beta release gate, not polish | Dense study UI must be usable by keyboard/screen-reader users. |
| Docs | Promote stable docs now | Timestamped research is useful but not enough for execution. |

## Updated beta cohort spec

Target 5 to 8 testers:

- 2 serious lay learners,
- 2 small-group teachers,
- 1 pastor or ministry volunteer,
- 1 original-language beginner if available,
- 1 accessibility-sensitive user if available,
- 1 technically comfortable tester for logs/support bundle feedback.

Screening criteria:

- willing to use a Windows desktop app or source-run setup;
- willing to complete one real study task;
- comfortable reviewing a privacy note;
- willing to provide structured feedback;
- not expecting a finished public product.

Feedback questions:

1. Could you install or run it?
2. Could you find a passage/topic workflow without live help?
3. Did AI setup block you?
4. Did the source trail increase or reduce trust?
5. Was the Study Packet useful enough to keep?
6. What confused you?
7. What would stop you from using it again?
8. Did anything feel theologically overconfident or pastorally unsafe?
9. Did anything feel privacy-invasive?
10. Would you recommend this to a similar user after fixes?

## Study Packet v1 acceptance contract

A Study Packet is beta-ready only if it includes:

- title/topic/passage,
- timestamp,
- app version/build,
- source set,
- translation/module identifiers,
- retrieved evidence,
- generated synthesis,
- dissent/uncertainty where applicable,
- user notes,
- user judgment,
- provider/model metadata when AI is used,
- privacy note for exported private content,
- attribution/license section,
- Markdown export that can be read outside Bible AI.

It should not include:

- provider keys,
- gateway tokens,
- hidden system prompts,
- unrelated private notes,
- raw database dumps,
- unsupported theological certainty,
- uncited claims disguised as source findings.

## Source links used in this pass

- YouVersion official site/newsroom: https://www.youversion.com/ and https://www.youversion.com/newsroom
- YouVersion one billion installs announcement: https://www.youversion.com/news/bible-app-reaches-one-billion-installs
- Hallow official site/features: https://hallow.com/ and https://hallow.com/features/
- BibleProject app/classes: https://bibleproject.com/app/ and https://bibleproject.com/classroom/
- Gloo official site and State of the Church: https://www.gloo.com/ and https://www.gloo.com/our-brands/state-of-the-church
- Barna 2026 tech/media/faith trends: https://www.barna.com/research/state-of-the-church-2026-trends/
- GitHub Discussions docs: https://docs.github.com/discussions
- GitHub Sponsors docs: https://docs.github.com/en/sponsors/receiving-sponsorships-through-github-sponsors/about-github-sponsors-for-open-source-contributors
- Open Collective fiscal hosting: https://opencollective.com/fiscal-hosting
- Discord rules and onboarding docs: https://support.discord.com/hc/en-us/articles/1500000466882-Rules-Screening-FAQ and https://support.discord.com/hc/en-us/articles/11074987197975-Community-Onboarding-FAQ
- USFM official docs: https://paratext.org/usfm/
- USX official docs: https://markups.paratext.org/usx/
- OSIS official/CrossWire docs: https://crosswire.org/osis/ and https://wiki.crosswire.org/OSIS_Bibles
- CrossWire file formats/module docs: https://wiki.crosswire.org/File_Formats and https://www.crosswire.org/sword/develop/swordmodule/
- API.Bible and Digital Bible Library docs: https://docs.api.bible/ and https://library.bible/
- eBible.org downloads: https://ebible.org/download.php
- unfoldingWord content: https://unfoldingword.org/for-translators/content/
- Open.Bible: https://open.bible/
- Promptfoo docs/red team: https://www.promptfoo.dev/docs/intro/ and https://www.promptfoo.dev/docs/red-team/
- Ragas docs/metrics: https://docs.ragas.io/en/stable/ and https://docs.ragas.io/en/stable/concepts/metrics/available_metrics/
- DeepEval docs: https://deepeval.com/ and https://deepeval.com/docs/getting-started
- OpenAI evals docs: https://developers.openai.com/api/docs/guides/evals and https://developers.openai.com/api/docs/guides/evaluation-best-practices
- OWASP LLM risks/prompt injection: https://owasp.org/www-project-top-10-for-large-language-model-applications/ and https://genai.owasp.org/llmrisk/llm01-prompt-injection/
- GDPR Article 9: https://gdpr-info.eu/art-9-gdpr/
- UK ICO special category data guidance: https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/lawful-basis/special-category-data/what-is-special-category-data/
- California CCPA official page: https://oag.ca.gov/privacy/ccpa
- FTC mobile health app privacy/security tool: https://www.ftc.gov/business-guidance/resources/mobile-health-apps-interactive-tool
- W3C WCAG 2.2: https://www.w3.org/TR/WCAG22/
- WCAG focus appearance: https://www.w3.org/WAI/WCAG22/Understanding/focus-appearance.html
- WCAG target size minimum: https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html
- Section508.gov: https://www.section508.gov/
- Access Board ICT accessibility standards: https://www.access-board.gov/ict/about/
- EN 301 549 overview: https://accessible-eu-centre.ec.europa.eu/content-corner/digital-library/en-3015492021-accessibility-requirements-ict-products-and-services_en
- WebAIM Screen Reader Survey 10: https://webaim.org/projects/screenreadersurvey10/

