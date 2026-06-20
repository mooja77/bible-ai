# Bible AI institutional trust, pastoral safety, accessibility, and community adoption recursive research

Generated: 2026-06-12 16:25:20 +01:00

Filename timestamp: 2026-06-12-162520

Repository: C:\JM Programs\BibleApp

Purpose: Continue the recursive research loop with a different lens from the prior market, architecture, release, corpus, eval, and local-first passes. This pass focuses on institutional trust, pastoral safety boundaries, youth and minors, accessibility, church/community distribution expectations, and adjacent faith tools that shape user expectations even if they are not direct competitors.

## Executive update

The previous loops correctly converged on a narrow wedge: a local-first, auditable Study Packet workflow for serious learners, small-group teachers, ministry volunteers, and eventually guided pilots with churches or training institutions. This loop does not overturn that strategy. It adds a missing condition: the app should not broaden beta distribution, church/seminary pilots, or public community support until its trust boundary is documented as explicitly as its AI and study workflow.

The product is already stronger than a generic Bible chatbot because it separates user judgment from AI output, keeps local-first privacy as a principle, supports exports, keeps source attribution visible, and has a serious study workflow. The gap is that pastoral safety, minors, accessibility, and institutional adoption are still mostly described in review docs rather than canonical product docs and release gates.

The improved plan is to keep the Study Packet wedge, but add five trust artifacts before wider beta:

1. `docs/sensitive-topic-safety-policy.md`
2. `docs/youth-and-minors-policy.md`
3. `docs/accessibility-release-gate.md`
4. `docs/institutional-pilot-readiness.md`
5. `docs/community-channel-policy.md`

These are not marketing documents. They are operational controls for what the app will and will not do.

## Recursive loop log

### Pass 1: Local baseline and trust surface

Local files reviewed:

- `docs/learning-ui-workflows.md`
- `docs/learning-testing-and-release-plan.md`
- `docs/privacy-and-distribution.md`
- `docs/learning-and-systematic-theology-plan.md`
- `docs/reviews/2026-06-12-161641-app-local-first-interoperability-offline-ai-rag-distribution-recursive-research.md`
- `docs/reviews/2026-06-12-154804-app-audience-wedge-market-pricing-learning-moat-recursive-research.md`
- `docs/reviews/2026-06-12-134528-app-global-hermeneutics-partnerships-enablement-recursive-research.md`
- `docs/reviews/2026-06-12-002818-app-community-content-privacy-eval-recursive-research.md`
- `docs/reviews/2026-06-11-234938-app-eval-safety-decision-research.md`
- `docs/specs/2026-05-26-overlay-keyboard-a11y-design.md`
- `docs/specs/2026-05-26-versepanel-tablist-a11y-design.md`
- `docs/specs/2026-05-30-ux-h4-setup-onboarding-design.md`

What is already solid:

- The app's learning workflow asks for the user's starting view before AI output and the user's judgment after AI output.
- The app separates user conclusions from AI suggestions in guided learning and export flows.
- Theology mode already prompts for pastoral or scholarly review where appropriate.
- The release plan already includes export attribution checks, provider setup checks, and manual QA around AI-assistant posture.
- Privacy documentation already treats provider keys, local SQLite data, backup/export, provider calls, and support bundles as separate concerns.
- Accessibility has real implementation work in overlays, tablists, and setup/onboarding.

What is still missing:

- There is no canonical sensitive-topic policy file.
- There is no canonical youth/minors policy file.
- There is no single accessibility release gate for the complete Study Packet workflow.
- There is no institutional pilot readiness checklist that a church, seminary, ministry, or training group could review before adoption.
- There is no community/support channel policy for Discussions, Discord, email support, issue templates, moderation, bad AI output reports, or sensitive disclosures.
- Safety appears to exist as prior research and intent, not as a product path with tests and routing behavior.

Key local inference: the app is philosophically aligned with human judgment and local control, but it needs enforceable release gates for the cases that can hurt users: crisis language, abuse, child safety, pastoral coercion, mental health, privacy leakage, and inaccessible workflows.

### Pass 2: Adjacent faith and learning competitors

This pass looked at tools that shape expectations even when they are not direct competitors.

#### YouVersion

YouVersion's Bible App is the mass-market habit and mobile Bible baseline. In January 2026, YouVersion announced the Bible App reached one billion installs. That scale matters because many Bible app users will expect instant onboarding, strong mobile polish, free access, reading plans, sharing, and community-like behavior.

Implication for this app:

- Do not try to beat YouVersion at daily devotional habit, mobile Bible reading, streaks, or broad consumer reach.
- Borrow expectation discipline: first-run flow must be simple, forgiving, and trustworthy.
- Keep the wedge: serious, auditable study artifacts for users doing deeper work.

Source:

- https://www.youversion.com/news/bible-app-reaches-one-billion-installs

#### Hallow

Hallow is a Christian prayer, meditation, sleep, Bible story, music, and community prayer app. It competes for daily spiritual attention, not for technical exegesis.

Implication for this app:

- Do not position the product as a prayer companion, devotional substitute, or spiritual care app.
- Avoid "AI pastor", "AI spiritual director", or "personal faith coach" language.
- If prayer/devotional surfaces are ever added, they need a different safety and pastoral review bar.

Source:

- https://hallow.com/

#### BibleProject

BibleProject's app and Classroom set a free structured learning benchmark with videos, podcasts, reading plans, and courses. It is not a Bible software clone. It is a high-trust learning pathway.

Implication for this app:

- The app's strongest non-technical benchmark is BibleProject-style learning clarity, not Logos-style library depth.
- Study Packet workflows should feel like guided learning artifacts, not chat transcripts.
- A "course handoff" or "learning trail" could become valuable later, but only after Study Packet v1 is dependable.

Sources:

- https://bibleproject.com/app/
- https://bibleproject.com/classroom/

#### RightNow Media

RightNow Media is an institutional and church-distributed Bible study video library. It matters because churches often buy or sponsor learning tools through organizational channels rather than asking individuals to discover them alone.

Implication for this app:

- If the app enters church pilots, the buyer/adopter may care less about AI novelty and more about policy, training, support, content rights, and accessibility.
- A church pilot needs a packet, not a sales pitch.
- Public beta and institutional beta should have different readiness gates.

Source:

- https://www.rightnowmedia.org/

#### Gloo and Barna-connected ministry AI

Gloo's AI product is positioned for churches and ministry teams. Gloo's State of the Church material reports that one in four Christians now turns to AI for answers about faith or spiritual growth. This is an important market signal and a safety warning.

Implication for this app:

- There is demand for faith AI, but users may treat generated text as spiritual authority.
- The app must be deliberately anti-authority in its AI posture: assistant, not pastor; research aid, not verdict; source trail, not oracle.
- The app should include sensitive-topic routing before Council generation, not only after the model responds.

Sources:

- https://www.gloo.com/products/gloo-ai
- https://www.gloo.com/our-brands/state-of-the-church

#### Planning Center and Subsplash

Planning Center and Subsplash represent operational church software expectations: accounts, permissions, communications, giving, media, support, pricing clarity, and administrative control. They are not direct competitors, but they shape what churches expect from software introduced into ministry workflows.

Implication for this app:

- Do not build church management features in v0.1.
- Do prepare institutional documentation before a church pilot.
- Defer organization accounts, admin dashboards, sync, collaboration, gateway administration, and church-wide deployment until the core product and trust controls are stable.

Sources:

- https://www.planningcenter.com/pricing
- https://www.subsplash.com/pricing

### Pass 3: Pastoral safety, minors, privacy, and accessibility

#### Sensitive religious data

Religious belief data is sensitive in many regulatory and practical contexts. GDPR Article 9 treats personal data revealing religious or philosophical beliefs as a special category. The UK ICO guidance also lists religious or philosophical beliefs as special category data.

This matters even if the first user base is in the United States. Bible study notes, prayer-like questions, theological doubts, family situations, pastoral crises, and church conflict can reveal highly sensitive personal information.

Implication for this app:

- Local-first is a competitive strength only if support, exports, logs, provider calls, and optional gateways preserve that trust.
- Support bundles must remain user-initiated and reviewable.
- Exports must continue excluding secrets, local paths, provider keys, environment identifiers, and hidden telemetry.
- Any future sync/account/gateway feature should receive a separate privacy review before implementation.

Sources:

- https://gdpr-info.eu/art-9-gdpr/
- https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/lawful-basis/special-category-data/what-is-special-category-data/

#### Minors and child-directed use

The FTC's COPPA rule changes in 2025 reinforce that child data handling has a stricter bar, including separate parental consent for third-party disclosures unless disclosure is integral to the product. The app is not currently designed as a child-directed product, and its use of AI providers makes youth deployment riskier.

Implication for this app:

- Do not market v0.1 to children or youth groups.
- Do not provide a classroom/youth-ministry pilot path until a minors policy exists.
- Do not collect age unless there is a clear policy reason and implementation plan.
- If the app is later used in a youth or school setting, it needs explicit consent, data flow, supervision, and support boundaries.

Source:

- https://www.ftc.gov/news-events/news/press-releases/2025/01/ftc-finalizes-changes-childrens-privacy-rule-limiting-companies-ability-monetize-kids-data

#### Mental health, crisis, abuse, and pastoral emergencies

The app is in a domain where users may ask questions that mix Scripture, guilt, abuse, suicidal ideation, coercion, mental health, family conflict, and church authority. SAMHSA's 988 Lifeline is the US crisis routing baseline. The APA has warned about risks from AI chatbots and wellness apps, especially around mental health and youth.

Implication for this app:

- The app must not act as a counselor, emergency service, pastor, legal advisor, or medical advisor.
- Sensitive-topic detection should happen before normal Council response generation.
- The app can still help users study Scripture, but the output mode should change when harm, abuse, child safety, medical/mental health, legal/financial, or emergency language is present.
- Crisis or imminent harm language should produce a concise safety response and real-world help routing, not a theological argument map.

Sources:

- https://www.samhsa.gov/mental-health/988
- https://www.apa.org/topics/artificial-intelligence-machine-learning/health-advisory-chatbots-wellness-apps
- https://jedfoundation.org/american-psychological-association-on-generative-ai/

#### Accessibility expectations

WCAG 2.2, Section 508, EN 301 549, and WebAIM practice data all point toward the same product-level requirement: users should be able to complete meaningful workflows without a mouse, without relying only on color, and without inaccessible custom controls.

Local accessibility work already exists, but it is fragmented across implementation specs. The release gate should become workflow-based:

- A keyboard-only user can create or load a study.
- A keyboard-only user can read the passage, search, open overlays, close overlays, and return focus.
- A keyboard-only user can run Council or guided learning flows.
- A keyboard-only user can review evidence, enter their judgment, export the Study Packet, and recover from errors.
- Screen-reader-visible labels exist for core controls.
- Focus order is stable.
- Text remains readable when scaled.
- Contrast is acceptable in the default theme.

Sources:

- https://www.w3.org/TR/WCAG22/
- https://www.section508.gov/manage/laws-and-policies/
- https://www.etsi.org/human-factors-accessibility/en-301-549-v3-the-harmonized-european-standard-for-ict-accessibility
- https://webaim.org/projects/screenreadersurvey10/

### Pass 4: Institutional adoption and community channels

Institutional adoption does not start with an admin console. It starts with trust documentation and a constrained pilot.

Before a church, ministry, school, seminary, or training group pilot, the app should have:

- A one-page AI posture statement.
- A privacy and data movement one-pager.
- A source rights and attribution statement.
- A sensitive-topic and pastoral safety policy.
- A minors and youth-use policy.
- An accessibility baseline and known gaps list.
- A support and incident response path.
- A sample Study Packet.
- A quickstart for local model and provider setup.
- A bad AI output report process.
- A support bundle review process.

Community channels need the same discipline. A Discord, public forum, GitHub Discussions board, or support mailbox can become a place where users disclose spiritual, mental health, family, abuse, or crisis information. The app should not open public community support channels without a code of conduct, moderation posture, escalation boundaries, and templates that redirect sensitive disclosures away from public threads.

## Improved product thesis

The app should be positioned as:

> A local-first Bible study workbench that helps serious learners produce auditable Study Packets with sources, reasoning trails, and their own judgment clearly separated from AI assistance.

It should not be positioned as:

- An AI pastor.
- A prayer replacement.
- A counselor.
- A crisis support service.
- A theological authority.
- A church management platform.
- A devotional habit app.
- A youth ministry product.
- A Logos replacement.
- A generic Bible chatbot.

## Product moat after this pass

The practical moat is not just "local AI plus Bible data." Others can copy that.

The stronger moat is the combination of:

- Local-first data ownership.
- Auditable Study Packets.
- Human judgment before and after AI.
- Source trails and exportability.
- Conservative provider and gateway boundaries.
- Sensitive-topic safety routing.
- Accessibility release gates.
- Institutional pilot readiness.
- Content rights discipline.
- A narrow audience wedge.

This moat is slower and less glamorous than broad AI chat, but it is more defensible for the serious-study user.

## Recommended canonical docs

### 1. `docs/sensitive-topic-safety-policy.md`

Minimum contents:

- Scope and non-scope.
- The app is not a pastor, counselor, emergency service, doctor, lawyer, or financial advisor.
- Sensitive-topic taxonomy:
  - Suicide and self-harm.
  - Imminent harm to others.
  - Domestic abuse.
  - Sexual abuse.
  - Child safety.
  - Medical or mental health.
  - Legal or financial decisions.
  - Pastoral emergency.
  - Spiritual abuse, coercion, manipulation, or threats.
  - Confession-like disclosures involving harm.
- Routing behavior before Council generation.
- Output style for sensitive-topic routes.
- Crisis resource localization plan.
- Eval fixtures and release blockers.
- Support channel escalation rules.

### 2. `docs/youth-and-minors-policy.md`

Minimum contents:

- v0.1 is not child-directed.
- No youth group, school, or child-focused marketing.
- No under-13 product path.
- No classroom pilot without separate approval and data flow review.
- AI provider data movement must be explicit for supervised youth use.
- No community channel use by minors without a moderation and consent policy.
- Future requirements for youth use.

### 3. `docs/accessibility-release-gate.md`

Minimum contents:

- Keyboard-only Study Packet checklist.
- Screen reader label checklist.
- Focus management checklist.
- Overlay/dialog requirements.
- Color contrast and text scaling checklist.
- Known gaps table.
- Manual QA script.
- Optional automated checks with Playwright and axe.

### 4. `docs/institutional-pilot-readiness.md`

Minimum contents:

- Pilot eligibility.
- What the app does and does not do.
- Privacy/data movement summary.
- AI provider setup options.
- Local model setup notes.
- Source rights and attribution statement.
- Sensitive-topic policy summary.
- Accessibility baseline.
- Support process.
- Incident reporting.
- Sample pilot agenda.
- Sample Study Packet.
- Exit criteria.

### 5. `docs/community-channel-policy.md`

Minimum contents:

- Supported channels.
- What belongs in public issues/discussions.
- What should not be posted publicly.
- Sensitive disclosure handling.
- Bad AI output report template.
- Accessibility issue template.
- Source/license issue template.
- Privacy/support bundle concern template.
- Moderation and code of conduct.
- Response time expectations.

## Product implementation recommendations

### P0 before wider beta

1. Create the five canonical trust docs listed above.
2. Add sensitive-topic eval fixtures for self-harm, abuse, child safety, mental health, legal/financial, spiritual abuse, pastoral emergency, and mixed theological questions.
3. Add a pre-Council sensitive-topic router.
4. Keep the first router rule-based and conservative.
5. Make the router local and inspectable; avoid hidden cloud moderation as the first implementation.
6. Add a release-blocking check that sensitive-topic fixtures do not produce normal Council debate responses.
7. Add onboarding copy that says the app is a study assistant, not a pastor, counselor, doctor, lawyer, financial advisor, or emergency service.
8. Add issue templates for bad AI output, sensitive-topic concerns, accessibility issues, source/license issues, and privacy/support-bundle concerns.
9. Add a keyboard-only manual QA script for the complete Study Packet path.
10. Add the institutional pilot packet before any church/seminary pilot.

### P1 after P0 is stable

1. Add localized crisis/help resource configuration.
2. Add optional accessibility automation with Playwright and axe.
3. Add a sample Study Packet export gallery for beta testers.
4. Add a small-group pilot script that does not require accounts, sync, or shared private data.
5. Add "report bad AI output" from within a generated result, with user-reviewed export only.
6. Add provider data movement explanations in setup UI.
7. Add a user-facing "what leaves my machine" view.

### P2 deliberately deferred

1. Organization admin console.
2. Church-wide deployment tooling.
3. Shared workspaces.
4. Cloud sync.
5. Managed gateway for institutions.
6. Youth group product mode.
7. Public social features.
8. AI pastoral coaching.
9. Prayer companion mode.
10. Community answer marketplace.

## Decision register

1. Keep the wedge as serious-study Study Packets, not general spiritual companionship.
2. Treat adjacent faith apps as expectation baselines, not strategy targets.
3. Treat churches and institutions as a later pilot channel, not a reason to build church-management features now.
4. Do not market v0.1 to minors or youth groups.
5. Do not use "AI pastor" language.
6. Do not let sensitive-topic prompts flow into normal Council generation.
7. Do not open public community support without moderation and sensitive-disclosure rules.
8. Do not ship wider beta without a keyboard-only Study Packet release gate.
9. Keep support bundles user-reviewed and user-initiated.
10. Treat source rights, privacy, accessibility, and pastoral safety as product features.

## Risk register

| Risk | Current likelihood | Current impact | Mitigation |
| --- | --- | --- | --- |
| Users treat AI as spiritual authority | High | High | AI posture statement, human-judgment workflow, source trails, no AI-pastor branding |
| Crisis or abuse prompt receives normal theological answer | Medium | High | Pre-Council sensitive-topic router, eval fixtures, release blockers |
| Privacy leakage through provider calls or support bundles | Medium | High | Local-first defaults, provider data explanations, user-reviewed support bundles, export checks |
| Youth/minor use appears before policy exists | Medium | High | Explicit no-minors policy, no youth marketing, no youth pilots |
| Accessibility debt blocks serious users | Medium | Medium | Workflow-based accessibility release gate |
| Church pilot asks for admin/sync/gateway too early | Medium | Medium | Institutional pilot readiness doc, defer admin/sync until core is stable |
| Community channel collects sensitive disclosures publicly | Medium | High | Community channel policy, templates, moderation, redirect sensitive disclosures |
| App chases mass-market devotional features | Medium | Medium | Keep Study Packet wedge and decision register visible |

## Updated beta readiness checklist

The app is ready for a narrow beta only when:

- Study Packet v1 is usable end to end.
- User judgment is captured separately from AI output.
- Export labels AI and user content separately.
- Source rights and attribution are visible.
- Provider data movement is understandable.
- No provider keys, secrets, local paths, build paths, or environment identifiers appear in exports.
- Sensitive-topic fixtures route away from normal Council response generation.
- The complete Study Packet path passes keyboard-only QA.
- Known accessibility gaps are listed.
- The user can report bad AI output without automatically uploading private data.
- The five trust docs exist.

The app is ready for an institutional pilot only when:

- All narrow beta items are true.
- An institutional pilot packet exists.
- The institution understands data movement and provider choices.
- The pilot does not require youth/minor use.
- The pilot does not require cloud sync or organization admin features.
- There is an incident/support contact path.
- There is a sample Study Packet and training agenda.

## What to watch in the next research loop

The next pass should examine:

- Actual app flows against the proposed sensitive-topic router.
- Current UI copy for any accidental spiritual-authority language.
- The exact Study Packet export format as a candidate institutional artifact.
- Whether a rule-based sensitive-topic classifier can be added with low false-negative risk.
- Whether the app's first-run AI setup explains "what leaves my machine" clearly enough.
- Whether accessibility gaps are concentrated in custom overlays, keyboard traps, or unlabeled icon buttons.
- Whether community support should begin as GitHub Issues only, email only, or private invite-only discussions.

## Source trail

Local repository sources:

- `docs/learning-ui-workflows.md`
- `docs/learning-testing-and-release-plan.md`
- `docs/privacy-and-distribution.md`
- `docs/learning-and-systematic-theology-plan.md`
- `docs/specs/2026-05-26-overlay-keyboard-a11y-design.md`
- `docs/specs/2026-05-26-versepanel-tablist-a11y-design.md`
- `docs/specs/2026-05-30-ux-h4-setup-onboarding-design.md`
- `docs/reviews/2026-06-12-161641-app-local-first-interoperability-offline-ai-rag-distribution-recursive-research.md`
- `docs/reviews/2026-06-12-154804-app-audience-wedge-market-pricing-learning-moat-recursive-research.md`
- `docs/reviews/2026-06-12-134528-app-global-hermeneutics-partnerships-enablement-recursive-research.md`
- `docs/reviews/2026-06-12-002818-app-community-content-privacy-eval-recursive-research.md`
- `docs/reviews/2026-06-11-234938-app-eval-safety-decision-research.md`

External sources:

- YouVersion Bible App one billion installs: https://www.youversion.com/news/bible-app-reaches-one-billion-installs
- BibleProject app: https://bibleproject.com/app/
- BibleProject Classroom: https://bibleproject.com/classroom/
- Hallow: https://hallow.com/
- RightNow Media: https://www.rightnowmedia.org/
- Gloo AI: https://www.gloo.com/products/gloo-ai
- Gloo State of the Church: https://www.gloo.com/our-brands/state-of-the-church
- Planning Center pricing: https://www.planningcenter.com/pricing
- Subsplash pricing: https://www.subsplash.com/pricing
- GDPR Article 9: https://gdpr-info.eu/art-9-gdpr/
- UK ICO special category data guidance: https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/lawful-basis/special-category-data/what-is-special-category-data/
- FTC COPPA rule changes: https://www.ftc.gov/news-events/news/press-releases/2025/01/ftc-finalizes-changes-childrens-privacy-rule-limiting-companies-ability-monetize-kids-data
- SAMHSA 988 Lifeline: https://www.samhsa.gov/mental-health/988
- APA health advisory on AI chatbots and wellness apps: https://www.apa.org/topics/artificial-intelligence-machine-learning/health-advisory-chatbots-wellness-apps
- JED Foundation summary of APA generative AI advisory: https://jedfoundation.org/american-psychological-association-on-generative-ai/
- WCAG 2.2: https://www.w3.org/TR/WCAG22/
- Section 508 laws and policies: https://www.section508.gov/manage/laws-and-policies/
- ETSI EN 301 549 accessibility standard: https://www.etsi.org/human-factors-accessibility/en-301-549-v3-the-harmonized-european-standard-for-ict-accessibility
- WebAIM Screen Reader User Survey 2024: https://webaim.org/projects/screenreadersurvey10/

## Bottom line

This loop strengthens, rather than changes, the app strategy. The best path remains a narrow serious-study beta around auditable Study Packets. The new requirement is that the trust boundary must become concrete before distribution expands. A local-first Bible AI tool can be meaningfully different from both devotional apps and Bible software suites, but only if pastoral safety, privacy, accessibility, source rights, and human judgment are treated as first-class product surfaces.
