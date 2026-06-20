# Bible AI global data, AI governance, and provider strategy research

Timestamp: 2026-06-11 23:30:12 +01:00

Filename timestamp: 2026-06-11-233012

Related reports:

- `docs/reviews/2026-06-11-230419-app-market-tech-research.md`
- `docs/reviews/2026-06-11-231437-app-expanded-research-addendum.md`
- `docs/reviews/2026-06-11-232124-app-workflow-ecosystem-research.md`

Scope: fourth external research loop. This pass focuses on gaps not fully covered by the prior reports: global Scripture-data standards, localization, provider data handling, AI governance/privacy, local-model strategy, institutional education use cases, and a consolidated next-plan.

## Executive update

The prior strategic line still holds:

> Bible AI is a local-first Bible study workbench that turns Scripture, open resources, and multi-voice AI into auditable study packets while preserving source provenance, theological disagreement, and user judgment.

This loop adds a governance layer:

> Bible AI should also be explicit about source provenance, provider data handling, and AI risk controls before it scales content, integrations, or public distribution.

The product can differentiate by being unusually transparent:

- what sources are searched
- what leaves the device
- which provider handled the request
- which data policy applies
- which model produced which answer
- which claims are grounded, interpretive, uncertain, or disputed
- which exports carry licensing or share-alike obligations

That is not just compliance hygiene. In this space, it is part of the product value.

## Recursive loop log

### Loop 0 - Existing research trail

The existing reports now cover competitors, market, open resources, workflow ecosystems, study packets, source sets, release hardening, and AI evaluation. The remaining weak points were global Scripture formats, provider privacy nuance, governance, and local-model/provider strategy.

Self-improvement: add an explicit "trust operations" layer to the roadmap.

### Loop 1 - Global Scripture-data ecosystem

Research added Paratext, Digital Bible Library, Scripture App Builder, Scripture Burrito, USFM/USX, PTXprint, SIL/UBS tooling, and API.Bible/Bible Brain implications.

Self-improvement: Bible AI should not invent its own Bible import/export worldview. It should align future corpus/resource pipelines with the Scripture technology ecosystem where practical.

### Loop 2 - AI governance and privacy

Research added NIST AI RMF, NIST Generative AI Profile, EU AI Act, FTC AI claim guidance, ICO AI/data protection guidance, and official provider data-handling pages.

Self-improvement: add a provider data-handling matrix and AI claims policy. The app should avoid broad claims such as "private AI" unless the selected provider path actually supports that claim.

### Loop 3 - Local model/provider strategy

Research added llama.cpp, LM Studio, OpenAI-compatible local endpoints, Ollama privacy, OpenAI/Anthropic/Gemini policy differences, and MCP implications.

Self-improvement: keep Ollama as the supported local path now, but design the provider layer so LM Studio/llama.cpp can be added through a generic OpenAI-compatible local endpoint later.

### Loop 4 - Institutional and education use cases

Research added Thirdmill, Seminary Now, BibleMesh, and Logos education/academic programs.

Self-improvement: Bible AI is not an LMS, but it can produce auditable assignments, study packets, guided worksheets, and mentor-review exports.

## Global Scripture-data findings

### Standards and ecosystems that matter

| Ecosystem | What it does | Implication for Bible AI |
|---|---|---|
| Paratext | Widely used Bible translation software built around Scripture translation, checking, and publishing workflows. | Future imports should respect USFM/USX and translation-project metadata rather than only ad hoc JSON. |
| Digital Bible Library | Licensing/distribution platform for Bible texts, audio, video, and braille with API access. | Treat as a connected/licensed source route, not as a public-domain corpus. |
| API.Bible | Developer API for many modern Bible translations. | Useful for connected Bible lookup if terms allow; not a default offline bundle. |
| Bible Brain | API/access layer for Scripture text, audio, and video, especially global/language reach. | Good candidate for future audio/language mode, with online dependency and licensing controls. |
| Scripture App Builder | SIL tool for building custom Scripture apps with text/audio for Android/iOS, including non-store distribution routes. | Shows that offline/local-language access matters globally; Bible AI should not assume app-store-only distribution patterns. |
| Scripture Burrito | Portable manifest-based Scripture data interchange format. | Strong candidate inspiration for Bible AI source-pack manifests and study-packet source metadata. |
| USFM/USX | Common Bible translation/publishing markup formats. | Future translation importers should prefer structured parsers over lossy plain-text ingestion. |
| PTXprint | Publication tool for Paratext USFM or DBL bundles. | Reinforces that source packages, metadata, and publication output are connected workflows. |

### Product implications

1. Add a "Bible source package" layer.

The current app already has manifests for resources. The next iteration should define Bible/source packages using ideas from Scripture Burrito:

- package id
- source type
- file list
- versification
- language/script
- copyright/license
- attribution
- source coverage
- import rules
- export rules
- review status

2. Treat language and versification as first-class.

The app currently uses a 66-book Protestant reference model and has already deferred Douay-Rheims because of versification mismatch. Global Scripture data will multiply this issue.

Recommended model:

- `canon_profile`
- `versification_profile`
- `language_code`
- `script_direction`
- `source_coverage`
- `missing_or_extra_books`
- `reference_mapping_status`

3. Separate study resources from Scripture texts.

The app should keep a hard boundary between:

- Scripture text
- original-language base text
- lexical/morphology data
- cross-reference data
- commentary/resource data
- AI-generated study output
- user-authored conclusions

This matters for licensing, Council prompts, exports, and user trust.

4. Add global/localization backlog, but not before release trust.

Useful later:

- right-to-left polishing beyond current Hebrew support
- language-specific fonts
- transliteration display controls
- source coverage warnings
- per-language search tokenization
- local Bible pack import
- localized UI copy

Do not pursue this before public release evidence, source provenance, and Council evals are stable.

## Provider data-handling findings

Provider privacy varies enough that the app should not collapse all AI paths into "AI helpers."

| Path | Research signal | App implication |
|---|---|---|
| Ollama local | Ollama says local runs do not send prompts/data back to ollama.com. | Best privacy story for embeddings and small local tasks. Label as local only when actually using local models. |
| OpenAI API | OpenAI says API data is not used to train models unless the user opts in. | Good user-owned key option, but still remote processing. Show remote provider disclosure. |
| Anthropic API | Anthropic commercial/API docs say commercial API inputs/outputs are not used for training by default. | Good user-owned key option, but keep retention/ZDR details out of generic claims unless configured. |
| Claude Code consumer login | Anthropic separates consumer products from commercial/API products; Claude Code under consumer plans has different data-training/retention controls. | The app should distinguish Claude Code login from Anthropic API key in Settings and privacy copy. |
| Gemini API | Gemini API terms warn that human reviewers may process unpaid-service input/output and say not to submit sensitive/confidential/personal information to unpaid services. | The setup UI should flag Gemini unpaid vs paid/project privacy posture if detectable or at least warn clearly. |
| Managed gateway | Data handling depends entirely on the gateway operator. | Public gateway requires published routing, logging, retention, billing, abuse-monitoring, and provider-subprocessor notes. |

### Required UI/docs improvement

Add `docs/provider-data-handling-matrix.md` and expose the same concepts in Settings:

- provider
- auth method
- local or remote
- sends question
- sends retrieved evidence
- sends user resources
- training default
- retention default
- human review possibility
- zero-retention possibility
- cost/billing owner
- managed gateway operator
- last verified source date

The current app already says provider calls send the user's question and retrieved evidence. This pass adds that the statement must become provider-specific.

## AI governance findings

### NIST AI RMF and Generative AI Profile

NIST's AI RMF is voluntary, but it is a useful structure for this app because it maps well to known risks:

- governance
- content provenance
- pre-deployment testing
- incident disclosure
- data privacy
- harmful bias
- information integrity
- IP concerns
- human-AI configuration

Bible AI already has strong starts: source drawer, provider manifest, retrieval trace, user judgment, export sanitization, and release gates. It needs a single governance checklist that ties these together.

### EU AI Act

Bible AI is likely not a high-risk AI system if used as personal religious study software, but it can still trigger transparency and consumer-protection expectations if marketed poorly. Avoid claims that the AI gives authoritative spiritual, pastoral, legal, medical, or mental-health direction.

Recommended positioning:

- "study assistant"
- "source-grounded research"
- "compare interpretations"
- "record your own judgment"
- "not pastoral, medical, legal, or professional advice"

Avoid:

- "God's answer"
- "the Bible's definitive answer" for disputed topics
- "private AI" when remote providers are selected
- "unbiased theology"
- "guaranteed accurate"

### FTC AI claims

FTC enforcement around deceptive AI claims means marketing and in-app claims should be evidence-based. Bible AI should only claim:

- offline reading/search when actually offline
- local AI only when local model path is selected
- provider privacy only according to the selected provider's official policy
- multi-provider Council only when more than one provider actually ran
- public release verified only when manual release gates pass

### ICO / data protection

If the app serves UK/EU users or managed gateway/team use, treat AI provider routing and logs as data-protection design issues. A local-only app is simpler; a managed gateway creates controller/processor questions, retention policies, and user notices.

## Local model and provider strategy

### Current strategy remains good

The current app uses:

- Ollama for local embeddings/semantic retrieval.
- Remote/frontier providers for Council reasoning.
- Node sidecar as provider abstraction.
- OS credential vault for secrets.

Keep this split.

### Add a local-provider abstraction later

Ollama should remain the supported local path for v0.1, but future local model support can be broader through OpenAI-compatible local endpoints:

- LM Studio local server exposes OpenAI-compatible and Anthropic-compatible endpoints.
- llama.cpp server exposes OpenAI-compatible chat/completions/embeddings routes and supports quantized models on CPU/GPU.
- Other local runtimes can fit a base-URL plus model-name profile if the app uses a generic adapter.

Recommended future setting:

```text
Local model endpoint:
- Provider: Ollama | OpenAI-compatible local endpoint
- Base URL
- Chat model
- Embedding model
- Supports JSON schema: yes/no
- Max context
- Hardware note
- Test local model
```

### Do not use local models for everything

Use local models first for:

- semantic embeddings
- query expansion
- passage summaries
- workspace titles
- teaching-packet drafts
- source classification hints
- low-stakes explanations clearly marked as local draft

Keep frontier/multi-provider Council for:

- disputed doctrine
- original-language exegesis
- multi-tradition comparison
- high-confidence study packets
- questions requiring nuanced synthesis

### Provider cost and reliability controls

Add:

- per-run estimated token budget
- evidence limit cost estimate
- provider timeout display
- provider allowlist for a Council run
- cheap/fast vs deep/research mode
- retry policy visible in source drawer
- cost owner: user key, Claude Code subscription, managed gateway

## Institutional and education use cases

The education market is not just "students use Bible apps." Logos has institutional/academic programs, Seminary Now offers ministry training, Thirdmill offers free seminary-level content, and BibleMesh has theological education pathways.

Bible AI should not become a video-course platform or LMS. It can serve educators by producing auditable study artifacts:

- assignment packet
- passage study worksheet
- compare-views worksheet
- student reflection export
- mentor review export
- source appendix
- Council trace for instructor review
- "what I concluded and why" user judgment

This aligns with the app's existing Theology and Guided Learning work.

Future institutional mode:

- disable remote providers by default
- require source-set selection
- watermark AI-generated sections
- require user reflection before AI answer
- export instructor-readable packet
- keep all data local unless the user explicitly exports

## Consolidated roadmap delta

### Immediate: Trust operations

Add docs and release gates for:

- provider data-handling matrix
- AI claims policy
- source package/source-set policy
- Council eval plan
- release security checklist
- public build labels

Do this before adding more visible AI features.

### Next: Source package and source set v1

Implement or document:

- source classes A-E from prior report
- source package manifest inspired by Scripture Burrito
- source set selection in Council
- exact source-set snapshot saved with Council sessions
- source-set appendix in study packets
- quarantine flow for unknown imports

### Next: Provider transparency v1

Implement or document:

- provider data-handling table in Settings
- per-provider "what leaves this device"
- Claude Code vs Anthropic API distinction
- Gemini unpaid-service warning
- managed gateway privacy-note requirement
- local model endpoint strategy

### Next: AI governance/eval v1

Implement or document:

- NIST-inspired AI risk checklist
- prompt injection/resource injection tests
- faithfulness checks
- theological-bias fixtures
- provider data-leak tests
- export-source/license checks
- marketing/in-app claims review

### Later: Global Scripture data

Implement only after core release quality:

- USFM/USX import path
- Scripture Burrito-compatible manifest import/export
- versification profiles
- canon profiles
- language/script metadata
- local Bible pack import
- Scripture App Builder-style distribution lessons for offline regions

## Documentation plan after this loop

Add these to the previous recommended doc set:

- `docs/provider-data-handling-matrix.md`
  - Provider-by-provider data flow, retention/training notes, cost owner, source date.

- `docs/ai-governance-and-claims-policy.md`
  - What the app may claim, what it must not claim, how release evidence backs claims.

- `docs/global-scripture-data-strategy.md`
  - Paratext, USFM/USX, DBL, API.Bible, Bible Brain, Scripture Burrito, versification/canon plan.

- `docs/local-model-strategy.md`
  - Ollama now, OpenAI-compatible local endpoints later, low-risk vs high-risk tasks.

- `docs/institutional-study-workflows.md`
  - Student/mentor/teacher packet flows, reflection-before-AI rule, export formats.

Recommended order now:

1. `docs/source-provenance-policy.md`
2. `docs/provider-data-handling-matrix.md`
3. `docs/ai-governance-and-claims-policy.md`
4. `docs/source-set-workflows.md`
5. `docs/study-packet-format.md`
6. `docs/council-evaluation-plan.md`
7. `docs/release-security-checklist.md`
8. `docs/local-model-strategy.md`
9. `docs/global-scripture-data-strategy.md`
10. `docs/product-positioning.md`
11. `docs/competitive-landscape.md`
12. `docs/institutional-study-workflows.md`

Reasoning: provenance, provider handling, and claims policy must come before public positioning. They define what can honestly be said.

## Concrete app backlog items

1. Settings: Provider data handling panel.
2. Settings: Provider path labels: local, personal API, Claude Code login, managed gateway.
3. Council: Source set selector with simple default and advanced details.
4. Council: Save source-set snapshot on every session.
5. Council: Save provider data-handling snapshot on every session.
6. Export: Add provider/model/source-set appendix to study packets.
7. Import: Add source package manifest review for Scripture/resource packs.
8. Tests: Add prompt-injection fixture using hostile imported resource text.
9. Tests: Add provider disclosure tests for source drawers/exports.
10. Release: Add AI claims checklist to public release verification.

## Key risks newly emphasized

| Risk | Severity | Mitigation |
|---|---:|---|
| App claims "private" while remote providers receive evidence | High | Provider-specific data-handling UI and export appendix. |
| Claude Code login and Anthropic API are treated as equivalent | High | Separate setup labels, docs, and privacy copy. |
| Gemini unpaid-service use surprises users | High | Show warning and recommend paid/API privacy review for sensitive study. |
| Global Bible imports break references through versification mismatch | High | Add canon/versification profiles before broad imports. |
| Scripture license terms are confused with API access | High | Keep connected licensed APIs separate from bundled offline corpus. |
| Local models produce weak doctrinal reasoning | Medium | Use local models for low-risk tasks; require Council for disputed doctrine. |
| AI governance stays spread across docs | Medium | Add a single governance/claims policy and release checklist. |
| Institutional users need audit/export more than chat | Medium | Build instructor/mentor-readable packets, not LMS features. |

## Sources from this loop

- Paratext: https://paratext.org/
- UBS Paratext overview: https://translation.bible/tools-resources/paratext/
- Digital Bible Library: https://library.bible/
- UBS Digital Bible Library overview: https://translation.bible/tools-resources/digital-bible-library/
- API.Bible docs: https://docs.api.bible/
- Bible Brain: https://www.faithcomesbyhearing.com/audio-bible-resources/bible-brain
- Scripture App Builder: https://software.sil.org/scriptureappbuilder/
- Scripture App Builder about: https://software.sil.org/scriptureappbuilder/about/
- Scripture Burrito: https://www.tools.bible/tools/scripture-burrito
- Scripture Burrito docs: https://docs.burrito.bible/en/latest/introduction/
- PTXprint: https://software.sil.org/ptxprint/
- USFM extended study content: https://ubsicap.github.io/usfm/notes_study/index.html
- NIST AI RMF: https://www.nist.gov/itl/ai-risk-management-framework
- NIST Generative AI Profile: https://www.nist.gov/publications/artificial-intelligence-risk-management-framework-generative-artificial-intelligence
- EU AI Act overview: https://digital-strategy.ec.europa.eu/en/policies/regulatory-framework-ai
- FTC AI guidance hub: https://www.ftc.gov/industry/technology/artificial-intelligence
- ICO AI and data protection: https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/artificial-intelligence/
- OpenAI data controls: https://developers.openai.com/api/docs/guides/your-data
- Anthropic commercial/API training policy: https://privacy.claude.com/en/articles/7996868-is-my-data-used-for-model-training
- Anthropic API retention docs: https://platform.claude.com/docs/en/manage-claude/api-and-data-retention
- Gemini API terms: https://ai.google.dev/gemini-api/terms
- Ollama FAQ: https://docs.ollama.com/faq
- LM Studio local server docs: https://lmstudio.ai/docs/developer/core/server
- LM Studio OpenAI-compatible docs: https://lmstudio.ai/docs/developer/openai-compat
- llama.cpp server docs: https://github.com/ggml-org/llama.cpp/blob/master/tools/server/README.md
- Claude Agent SDK docs: https://code.claude.com/docs/en/agent-sdk/overview
- Thirdmill: https://thirdmill.org/
- Thirdmill Institute: https://thirdmillinstitute.org/
- Seminary Now: https://seminarynow.com/pages/about
- BibleMesh degree pathways: https://biblemesh.com/degree-pathways/
- Logos education: https://www.logos.com/education
- Logos academic discount: https://www.logos.com/academic-discount
