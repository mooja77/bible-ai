# Bible AI persona, workflow benchmark, and decision index research

Generated: 2026-06-12 00:08:31 +01:00

Scope: additional recursive research pass focused on under-covered product execution questions: first beta personas, practical workflow benchmarks, Bible study market signals, AI trust posture, validation tools, and a working decision index for the growing research corpus.

## Executive update

The next plan improvement is not another broad feature list. The app already has many feature and research documents. The missing layer is a decision index that says who the first beta serves, which workflows prove value, and which competitor expectations must be met.

Updated thesis:

> Bible AI should first win as a local-first study packet generator for serious Bible learners and small-group teachers who want auditable sources, transparent AI help, and exportable conclusions.

This is narrower than "Bible AI for everyone" and more actionable than "a modern e-Sword with AI." It gives the beta a measurable job: help a user turn one hard passage, topic, or doctrinal question into a defensible study packet with sources, dissent, user judgment, and export metadata.

## Recursive loop log

### Pass 1: existing docs and repo gap scan

The repo already contains strong plans for:

- Reader/search/workspaces/export.
- Council audit and transparency.
- Human judgment and systematic theology.
- Open resource ingestion and licensing.
- Privacy and distribution.
- Testing and public release gates.

Gap found:

- No single active decision index.
- No formal persona and jobs-to-be-done spec.
- No competitor workflow benchmark table that converts market research into product acceptance criteria.
- No explicit beta success metric.
- No current plan that says which workflows are allowed to wait even if they are already designed.

### Pass 2: competitor workflow benchmark

Competitors create different user expectations:

- Logos sets the benchmark for AI-assisted search, synopsis, cited resource links, and continuation into a study assistant.
- Accordance sets expectations for speed, Bible-centered deep study, and in-program tutorial support for serious users.
- Olive Tree sets expectations for a split Study Center that follows the Bible text and keeps resources beside the passage.
- Blue Letter Bible sets expectations for free access to commentaries, Greek/Hebrew word tools, concordances, and parallel study.
- STEP Bible sets expectations for offline use, original-language access, and multi-language reach.
- YouVersion sets expectations for free access, global Scripture scale, habit formation, and community, but it is not the main benchmark for deep local research.

Implication: Bible AI should not try to beat all of these at once. The first beta should prove a smaller but sharper workflow: local smart research to study packet to user judgment to export.

### Pass 3: user and market signal scan

Research signals support a careful, trust-first beta:

- Pew found meaningful U.S. use of religious apps and websites, including scripture reading and religion search, but not universal adoption.
- Lifeway reports that most churchgoers value Scripture, while only about a third report daily Bible reading. That suggests the app should support focused study sessions and teaching prep, not only daily streaks.
- Barna reports practicing Christians are both optimistic and concerned about AI, and church leaders are worried about data privacy, plagiarism, message integrity, and authenticity.
- Lifeway reports pastors and churchgoers have mixed views about AI in ministry.
- Bible Society/Scripture Engagement published a 2026 pilot study on AI Bible apps and theological bias, directly validating the app's emphasis on visible dissent and evidence.

Implication: the app should present AI as bounded study assistance, not spiritual authority. The beta should make privacy, provenance, bias handling, and user judgment visible in normal workflow.

### Pass 4: technical execution and validation scan

The technical risk is not the stack choice. Tauri, SQLite, Rust, React, and the Node sidecar are coherent for this product. The risk is failing to validate the stack around trust-sensitive workflows.

Validation gaps to add:

- Accessibility scan coverage for Reader, Search, Council, Settings, and Export using Playwright plus axe-core.
- Tauri capability/permission review as a release checklist item.
- Prompt injection and untrusted-resource-content evals.
- Smart Research benchmark fixtures.
- Study Packet export metadata validation.
- Source/license UI snapshot tests.

### Pass 5: plan refinement

The prior plan said to create Source Set v1, Study Packet v1, Smart Research, and a decision index. This pass refines that into a beta shape:

1. Define personas and jobs.
2. Build Smart Research around competitor benchmark cases.
3. Make Study Packet export the primary success artifact.
4. Harden Council with evals and sensitive-topic routing.
5. Gate release with privacy, permissions, accessibility, and source-license checks.

## Draft decision index

This section should become the seed for a stable `docs/decision-index.md` or another timestamped decision-index report.

### Active operating docs

| Doc | Status | Role |
| --- | --- | --- |
| `docs/architecture.md` | Active with correction needed | System overview; vector-store statement should be updated to match current BLOB/cosine implementation |
| `docs/feature-roadmap.md` | Active but broad | Product phase history and future feature map |
| `docs/testing-and-release-plan.md` | Active | Release and E2E gates |
| `docs/privacy-and-distribution.md` | Active | Current privacy and public release posture |
| `docs/data-sources.md` | Active | Source/license truth for bundled corpus |
| `docs/learning-and-systematic-theology-plan.md` | Active but post-beta | Human judgment, theology, and guided learning arc |
| `docs/learning-ui-workflows.md` | Active but post-beta | Detailed theology/learning workflows |
| `docs/open-resource-ingestion-plan.md` | Active | Resource admission and licensing workflow |

### Active research conclusions

| Conclusion | Source report |
| --- | --- |
| Differentiate as local-first auditable study, not generic Bible chat | `2026-06-11-230419-app-market-tech-research.md` and later reports |
| Add Source Set v1 and Study Packet v1 | `2026-06-11-232124-app-workflow-ecosystem-research.md`, `2026-06-11-235653-app-market-tech-plan-refresh.md` |
| Add sensitive-topic policy before public AI beta | `2026-06-11-234938-app-eval-safety-decision-research.md` |
| Avoid passive telemetry and cloud traces by default | `2026-06-11-233506-app-launch-ops-research.md`, `2026-06-11-234938-app-eval-safety-decision-research.md` |
| Keep copyrighted translations out until rights path is explicit | `docs/data-sources.md`, `2026-06-11-233012-app-global-ai-governance-research.md` |
| Benchmark sqlite-vec before adopting | `2026-06-11-235653-app-market-tech-plan-refresh.md` |

### Decisions now promoted by this pass

1. The first beta persona is the serious learner / small-group teacher, not the casual devotional user.
2. The first beta success artifact is a Study Packet, not a chat transcript.
3. Smart Research should be the daily workflow; Council should be reserved for contested or high-complexity questions.
4. The app should add competitor-inspired workflow tests, not just unit tests.
5. The release gate should include accessibility and Tauri permission review.

## Primary beta personas

### Persona 1: serious lay learner

Job:

- "When I hit a difficult passage or doctrine, help me gather sources, compare views, and avoid pretending I know more than I do."

Needs:

- Fast local search.
- Plain-language explanation.
- Source drawer.
- Dissent and uncertainty.
- User-authored conclusion.

Do not optimize first for:

- Social sharing.
- Daily streaks.
- AI devotional encouragement.

### Persona 2: small-group teacher

Job:

- "When I need to prepare a discussion, help me produce a fair study packet with passages, likely questions, disputed views, and notes I can review before teaching."

Needs:

- Study Packet export.
- Discussion questions.
- Major interpretive positions.
- Evidence for and against.
- Clean attribution.

Do not optimize first for:

- Slide decks.
- Sermon ghostwriting.
- Church management integrations.

### Persona 3: pastor or ministry volunteer with limited tooling budget

Job:

- "When I need a research pass but cannot justify a large paid library, help me use public-domain and open-license resources responsibly."

Needs:

- Trustworthy corpus.
- Resource provenance.
- Original-language hooks.
- Strong export/backup.
- No hidden provider routing.

Do not optimize first for:

- Full Logos replacement.
- Paid library marketplace.
- Sermon manuscript generation.

### Persona 4: original-language beginner

Job:

- "When I see a key word, help me inspect Strong's, morphology, occurrences, and translation patterns without pretending I am fluent in Greek or Hebrew."

Needs:

- Word study panel.
- Occurrence lists.
- Translation comparison.
- Cautions about lexical overreach.
- Links back to context.

Do not optimize first for:

- Advanced syntactic database workflows.
- Manuscript image collation.
- Academic publication tooling.

### Persona 5: resource curator

Job:

- "When I import or cite a resource, help me know whether I can use it, export it, and attribute it correctly."

Needs:

- Manifest validation.
- License badge.
- Attribution preview.
- Export restrictions.
- Source review notes.

Do not optimize first for:

- Frictionless import of ambiguous sources.
- Scraping modern copyrighted content.

## Jobs-to-be-done map

| Situation | Desired outcome | App workflow |
| --- | --- | --- |
| I have a hard passage | Understand main interpretive options | Smart Research -> Council if disputed -> My Judgment |
| I need to teach a group | Prepare a fair, source-linked handout | Study Packet export |
| I am unsure if AI is biased | Inspect sources, positions, and dissent | Council evidence audit and bias notes |
| I want to study a word | See original-language data in context | Word Study -> occurrences -> source links |
| I found a public-domain source | Use it without license confusion | Resource manifest -> source review -> import |
| I need to continue later | Preserve the work locally | Workspace -> Study Packet -> backup/export |

## Competitor workflow acceptance criteria

### Smart Research benchmark

Inspired by Logos Smart Search:

- Natural-language search accepts questions without special syntax.
- Results include local verses first.
- A synopsis is generated only from retrieved sources.
- Every sentence-level claim in the synopsis links to a source row or is clearly marked as synthesis.
- User can continue into Council when the issue is contested.
- User can save the result as a Study Packet section.

Test prompt:

- "Where are light and darkness contrasted in the Bible?"

Acceptance:

- Returns relevant verses from local corpus.
- Explains why each result appeared.
- Shows source links.
- Does not require a Council run.

### Study Center benchmark

Inspired by Olive Tree:

- Resource drawer follows selected passage.
- Relevant cross-references, Strong's items, and module entries appear next to the text.
- User can pin a resource beside the passage.
- User can add the resource excerpt to a Study Packet with attribution.

### Deep study benchmark

Inspired by Accordance, Blue Letter Bible, and STEP:

- Fast chapter navigation.
- Parallel translation view.
- Strong's and morphology lookup.
- Occurrence search.
- Commentaries/resources linked by passage.
- Search remains useful offline.

### Trust benchmark

Inspired by the app's own differentiator:

- No passive telemetry.
- Provider routing is visible.
- User data remains local unless a provider call or explicit export is triggered.
- AI output is labeled and export metadata includes provider/model where relevant.
- Sensitive-topic route changes the answer contract.

## Revised beta plan

### Beta track 1: Smart Research

Goal:

- Make the app useful before the user pays Council cost or sends content to any provider.

Deliverables:

- Natural-language local search entry.
- Keyword/meaning/hybrid toggle.
- Source-linked synopsis.
- Results grouped by verses, cross-references, Strong's/original language, and resources.
- Save to workspace and Study Packet.

Exit criteria:

- Five benchmark research questions work offline with no provider configured.

### Beta track 2: Study Packet v1

Goal:

- Make the value tangible outside the app.

Deliverables:

- Stable packet schema.
- Markdown export first.
- Optional HTML/PDF after schema stabilizes.
- Includes question, source set, retrieved evidence, AI sections, user notes, user judgment, timestamp, and attribution.

Exit criteria:

- A teacher can export one packet and understand what is AI-authored, user-authored, and source-authored.

### Beta track 3: Council hardening

Goal:

- Keep the distinctive AI workflow, but make it safe enough for real use.

Deliverables:

- In-repo eval runner.
- Sensitive-topic fixtures.
- Bias/disputed-topic fixtures.
- Provider-failure fixtures.
- Prompt-injection fixtures for imported resources.
- Citation integrity checks.

Exit criteria:

- The Council can fail partially without crashing, leaking secrets, or producing uncited overconfidence.

### Beta track 4: Trust release gate

Goal:

- Ship a beta that matches the app's privacy claims.

Deliverables:

- Tauri capability/permission review.
- Accessibility scan on main workflows.
- Redacted support bundle.
- Clean-profile Windows install evidence.
- Provider data-handling matrix.
- Source/license public release checklist.

Exit criteria:

- A user can verify what is local, what is sent to providers, what is exported, and what is never collected by default.

## Validation backlog

Add these checks before public beta:

1. `Smart Research` fixture set with 5 natural-language prompts.
2. Study Packet export metadata validator.
3. `@axe-core/playwright` accessibility scan for main views.
4. Tauri capabilities/permissions checklist.
5. Imported-resource prompt-injection fixtures.
6. Sensitive-topic route fixtures.
7. Theological bias fixtures using disputed questions across traditions.
8. Source/license UI snapshot test.
9. Provider routing disclosure test.
10. No-telemetry regression check for code paths that might add analytics or remote logging.

## Documentation backlog after this loop

Stable operating docs to create:

- `docs/decision-index.md`
- `docs/personas-and-jobs.md`
- `docs/smart-research-mode.md`
- `docs/source-set-v1.md`
- `docs/study-packet-v1.md`
- `docs/sensitive-topic-safety-policy.md`
- `docs/council-eval-tooling-decision.md`
- `docs/trust-release-gate.md`

Existing docs to update:

- `docs/architecture.md`: correct vector-store description to match the current BLOB + Rust cosine implementation.
- `docs/testing-and-release-plan.md`: add accessibility scans, Tauri permission review, Smart Research benchmark, Study Packet export metadata validation, and prompt-injection fixtures.
- `docs/privacy-and-distribution.md`: add explicit "no passive telemetry" and "support bundle is user-initiated" language if not already present in the public-facing copy.

## Risks newly elevated

| Risk | Why it matters | Mitigation |
| --- | --- | --- |
| Planning sprawl | Too many correct docs can still leave execution unclear | Create `docs/decision-index.md` |
| Persona drift | Building for everyone weakens beta value | Prioritize serious learner and small-group teacher |
| Chat-app comparison | Users may judge the app by speed of answer | Make Smart Research fast and local before Council |
| Theological bias | External research now directly studies AI Bible app bias | Add disputed-topic fixtures and visible dissent |
| Pastoral overreach | AI companion/counselor framing is common in the market | Keep study assistant framing and sensitive-topic routing |
| Accessibility regressions | Dense research UIs can become keyboard/screen-reader hostile | Add axe scans plus manual keyboard pass |
| Tauri permission creep | Desktop app power can expand attack surface | Review capabilities and keep scopes narrow |
| Imported resource prompt injection | Resource text may contain hostile or misleading instructions | Treat imported resource text as data, never instructions |

## Refined next 10 implementation decisions

1. Create `docs/decision-index.md` from the draft index in this report.
2. Create `docs/personas-and-jobs.md` with the five beta personas above.
3. Decide whether Smart Research lives inside Search or becomes its own mode.
4. Define Study Packet v1 schema before adding new export surfaces.
5. Define Source Set v1 schema before expanding external resources.
6. Add the five Smart Research benchmark prompts.
7. Add a Tauri permissions/capabilities review checklist to release gating.
8. Add Playwright/axe accessibility coverage or an equivalent accessibility gate.
9. Add prompt-injection fixtures for imported resources and source snippets.
10. Update `docs/architecture.md` to reflect current semantic-search implementation.

## Sources consulted

- Logos Smart Search help: https://support.logos.com/hc/en-us/articles/23526184005261-Find-Answers-Faster-with-Smart-Search
- Logos AI tools for Bible study: https://support.logos.com/hc/en-us/articles/30128615450765-Using-AI-Tools-for-Smarter-Bible-Study
- Accordance getting started: https://www.accordancebible.com/getting-started-with-accordance/
- Accordance Word Study quick tip: https://www.accordancebible.com/accordance-quicktip-using-the-word-study-feature/
- Olive Tree iOS app features: https://www.olivetree.com/blog/apps/ios/
- Olive Tree Study Center help: https://help.olivetree.com/hc/en-us/articles/360018338672-Windows-Study-Center
- Blue Letter Bible: https://www.blueletterbible.org/
- Blue Letter Bible Strong's tutorial: https://www.blueletterbible.org/help/BLBStrongs.cfm
- STEP Bible downloads: https://www.stepbible.org/downloads.jsp
- Pew Research Center, religious technology use: https://www.pewresearch.org/religion/2023/06/02/online-religious-services-appeal-to-many-americans-but-going-in-person-remains-more-popular/
- American Bible Society State of the Bible 2026: https://sotb.americanbible.org/
- Lifeway Research, Bible reading frequency: https://news.lifeway.com/2026/02/10/lifeway-research-finds-fewer-than-1-in-3-churchgoers-read-the-bible-daily/
- Lifeway Research, pastors and churchgoers on AI: https://news.lifeway.com/2026/04/21/pastors-churchgoers-see-ai-as-concerning-and-confusing-according-to-lifeway-research/
- Barna, tech/media/faith 2026: https://www.barna.com/research/state-of-the-church-2026-trends/
- Barna, church leaders and AI concerns: https://www.barna.com/research/church-leaders-ai-usage-concerns/
- Barna, Christians view AI as gift and threat: https://www.barna.com/research/christians-view-ai-gift-threat/
- Scripture Engagement, AI Bible apps and theological bias: https://scripture-engagement.org/content/ai-bible-apps-and-theological-bias/
- Playwright accessibility testing: https://playwright.dev/docs/accessibility-testing
- Microsoft Inclusive Design: https://inclusive.microsoft.design/
- Microsoft Learn, designing inclusive software: https://learn.microsoft.com/en-us/windows/apps/design/accessibility/designing-inclusive-software
- Tauri security overview: https://v2.tauri.app/security/
- Tauri capabilities: https://v2.tauri.app/security/capabilities/
- Tauri permissions: https://v2.tauri.app/security/permissions/
- OWASP Top 10 for LLM Applications: https://owasp.org/www-project-top-10-for-large-language-model-applications/
