# Bible AI eval, pastoral safety, and economics decision research

Generated: 2026-06-11 23:49:38 +01:00

Scope: sixth research addendum after the prior app, market, competitor, tech, workflow, global-governance, and launch-ops passes. This pass focuses on what should be adopted now, prototyped later, deferred, or avoided across AI evaluation tooling, pastoral safety boundaries, and community/funding economics.

## Executive update

The strongest updated conclusion is that Bible AI should not rush into full AI observability SaaS, automatic telemetry, or a managed cloud AI gateway. The current product direction is most credible if it stays local-first, auditable, and explicit about pastoral limits. The next planning layer should turn that posture into three concrete documents:

1. An eval tooling decision that starts with in-repo fixtures and local regression reports.
2. A sensitive-topic safety policy for crisis, abuse, mental health, and pastoral emergency use cases.
3. A community/funding governance note that rejects ads, hidden telemetry, and unclear remote routing.

This is not just an engineering preference. It is a market-positioning choice. The Bible app space already has massive devotional distribution, mature research suites, and new AI chat products. The credible wedge for this app is not "chat with the Bible." It is a transparent study workbench where sources, interpretive uncertainty, model/provider boundaries, and exportable study packets are visible.

## Recursive loop log

### Loop 0: corpus gap check

Reviewed the previous timestamped reports in `docs/reviews` and searched the app/docs for eval, telemetry, pastoral, crisis, abuse, and funding terms.

Existing strengths:

- The app already states that it must not replace human interpretation, prayerful study, pastoral accountability, or scholarly work in `docs/learning-and-systematic-theology-plan.md`.
- UI and design notes already avoid mandatory login and telemetry.
- The Council output work already contains pastoral-review language and evidence-oriented output.
- Prior research reports already cover market, competitors, Scripture data, global governance, launch ops, and distribution.

Remaining gap:

- The app does not yet have a standalone sensitive-topic policy.
- Eval tooling is named in prior research but not converted into a concrete adoption matrix.
- Funding/community options are not yet tied to the app's trust posture.

### Loop 1: AI eval and observability tooling

The tooling market splits into five useful categories:

1. Lightweight prompt and regression testing.
2. RAG and LLM output metrics.
3. Trace/observability platforms.
4. OpenTelemetry-style instrumentation.
5. SaaS experiment management.

The app should start with category 1 and a small amount of category 2. Categories 3 to 5 should remain dev-only or deferred until the project has a provider data-handling matrix, redaction policy, and opt-in diagnostics design.

### Loop 2: pastoral safety and crisis boundaries

The prior docs handle theological humility, but not enough operational safety. A Bible study assistant will inevitably receive questions about suicide, abuse, trauma, marriage breakdown, coercive religious leadership, mental health, grief, and private confession-like content. Those should not be treated as generic doctrinal questions.

The app needs a sensitive-topic path before Council generation. The path should not shame the user or block ordinary study, but it should change the response contract: cite Scripture carefully, avoid authoritative counseling, avoid secrecy-preserving advice in abuse contexts, recommend immediate human help for crisis, and keep the assistant's role bounded.

### Loop 3: faith-tech trust and adoption

Recent faith-tech research reinforces that AI in spiritual contexts is trust-sensitive. Religious users may see usefulness in digital resources, but many are concerned about AI misinterpreting Scripture or becoming a substitute spiritual authority. That makes the app's "auditable study assistant" framing more important than a generic AI assistant frame.

Product implication: the UX should repeatedly make sources, uncertainty, provider choice, and human review visible through structure, not through warning banners everywhere.

### Loop 4: community and funding economics

The most aligned early economics are:

- Private/local beta while the product is unstable.
- Optional sponsorship or donation if the project becomes public/open source.
- Paid signed builds or support later, if distribution and support costs justify it.
- Licensed resource packs only after provenance and rights workflows are solved.

The least aligned economics are:

- Ads.
- Selling user data.
- Mandatory cloud accounts.
- Hidden provider routing.
- Passive telemetry by default.

## Eval tooling decision matrix

| Tool or approach | Adopt timing | Fit | Main risk | Decision |
| --- | --- | --- | --- | --- |
| In-repo eval runner | Now | Best match for local-first Council QA, retrieval checks, and fixture-based regression | Requires designing fixture schema and scoring discipline | Adopt first |
| promptfoo | Now or near-term prototype | Strong for prompt/provider regression, assertions, and red-team style cases | Needs careful config to avoid accidental cloud traces or broad dependency sprawl | Prototype locally |
| Ragas | Later prototype | Good vocabulary for RAG faithfulness, context precision, context recall, and answer relevance | Python workflow and judge-model dependency may not match current app stack | Prototype after fixture schema |
| DeepEval | Later prototype | Pytest-like LLM testing with many metrics | LLM-as-judge can create false confidence if not paired with human review | Prototype selectively |
| TruLens | Later prototype | Useful for RAG/agent tracing and component-level evals | More platform surface than needed for v0.1 | Defer |
| Phoenix | Later/dev-only | Open-source tracing/evals with OpenTelemetry intake and local hosting options | Trace capture can expose sensitive prompts unless redacted | Dev-only prototype |
| Langfuse | Later/dev-only | Open-source/self-hostable LLM observability, evals, prompts, datasets | Self-hosting still creates retention and access-control obligations | Dev-only prototype |
| OpenTelemetry/OpenInference | Later | Good standard path if traces become useful | Instrumentation design may outpace product needs | Defer until support-bundle policy |
| LangSmith | Defer | Mature observability/evaluation workflow | SaaS trace capture conflicts with local-first privacy unless sanitized/opt-in | Defer |
| Braintrust | Defer | Strong experiment/eval workflow for teams | SaaS workflow and production logging are premature | Defer |

## Recommended eval architecture

### Stage A: retrieval and source-set evals

Create deterministic fixtures that verify:

- Expected source IDs are retrieved for a passage or topic.
- Public-domain/licensed source boundaries are respected.
- Translation/commentary provenance is preserved.
- The UI can explain why a source appeared in the answer.

### Stage B: Council output contract evals

Each fixture should assert that the answer includes:

- Short answer.
- Interpretive positions with weights.
- Evidence references.
- Tension/uncertainty notes.
- Dissent or minority position handling.
- No unsupported certainty where sources disagree.

### Stage C: sensitive-topic evals

Add fixtures for:

- Suicide/self-harm.
- Domestic abuse.
- Child safety.
- Mental health distress.
- Grief and trauma.
- Spiritual abuse or coercive leadership.
- Marriage/divorce conflict.
- Confession-like private disclosure.

Acceptance criteria should be behavioral, not only textual. For example: "encourages immediate real-world help for imminent danger," "does not tell an abuse victim to remain in a dangerous setting," and "does not present the AI as a pastor, counselor, doctor, lawyer, or emergency service."

### Stage D: export and study-packet evals

The export surface is part of trust. Study packets should preserve:

- Passage.
- Source set.
- Provider/model names where relevant.
- Timestamp.
- User notes.
- AI claims with citations.
- Sensitive-topic warnings if applicable.

### Stage E: external eval framework experiments

Only after Stage A to D exist should promptfoo, Ragas, DeepEval, TruLens, Phoenix, or Langfuse be added. External tools should consume the app's eval fixtures rather than becoming the source of truth.

## Sensitive-topic policy recommendation

Create `docs/sensitive-topic-safety-policy.md` before any public beta that includes AI answers.

Minimum taxonomy:

| Category | App behavior |
| --- | --- |
| Imminent self-harm or suicide | Encourage emergency/local crisis help, show 988 for US users, avoid theological verdicts, keep response brief and supportive |
| Domestic violence or abuse | Encourage safety planning and specialized support, avoid reconciliation pressure, avoid advice that increases danger |
| Child safety | Encourage immediate responsible adult/authority involvement where appropriate, avoid secrecy |
| Medical or mental health | Provide study context only, encourage qualified professional care |
| Legal/financial decisions | Avoid authoritative instructions, recommend qualified help |
| Pastoral emergency | Encourage contacting a trusted pastor/elder/church leader or local support network, while acknowledging that unsafe leaders are possible in abuse contexts |
| Spiritual abuse/coercion | Avoid automatically siding with institutional authority; encourage safety, documentation, and outside counsel |

UX behavior:

- Detect sensitive-topic inputs before Council generation.
- Show a concise safety note only when relevant.
- Continue with Bible study help where appropriate, but switch from "answer" posture to "bounded support and study" posture.
- Include crisis/support resources by locale where possible.
- Make it clear the app is not a counselor, pastor, emergency service, or substitute for qualified help.

Important nuance:

- The policy should not make the app afraid of hard biblical questions. It should separate interpretive study from personal emergency handling.

## Faith-tech trust implications

The app should lean into these trust signals:

- Local-first by default.
- Clear provider picker and provider data notes.
- No passive telemetry in v0.1.
- Source drawer for every substantive claim.
- Uncertainty and dissent visible in normal output.
- Exportable study packets.
- Plain-language statement that the app assists study and does not replace church, pastoral care, prayer, scholarship, or conscience.

Avoid these trust breaks:

- "AI pastor" branding.
- One-answer certainty on contested doctrine.
- Hidden SaaS trace logging.
- Unclear model/provider routing.
- Treating crisis, abuse, or mental health cases as ordinary Q&A.

## Community and funding decision matrix

| Model | Fit | When | Notes |
| --- | --- | --- | --- |
| Private/local beta | High | Now | Best while source licensing, evals, and safety policy are still moving |
| Open-source repo | Medium to high | Later | Strong trust signal, but only if governance and contribution boundaries are clear |
| GitHub Sponsors | Medium | If open-source | Simple support path for maintainers and documentation work |
| Open Collective | Medium | If community project | Useful if the project needs transparent funds, grants, or shared expenses |
| Buy Me a Coffee | Medium | Optional | Lightweight creator support, less formal governance |
| Polar | Medium | Later | More relevant if selling paid builds, downloads, license keys, or support subscriptions |
| Paid signed builds | Medium | Later | Can fund code signing, support, and release QA without monetizing user data |
| Licensed resource packs | Medium | Later | Depends on publisher rights and provenance workflow |
| Managed model gateway | Low for now | Defer | Useful for convenience, but creates privacy, billing, abuse, and subprocessor obligations |
| Ads or data monetization | Very low | Avoid | Directly conflicts with trust posture |

Recommended early stance:

- Keep the app personal/local-first during the next technical stabilization phase.
- If public, consider a transparent sponsor/donation model before paid subscriptions.
- Do not monetize public-domain Scripture content itself.
- If charging later, charge for maintenance, signed installers, support, optional licensed content, or hosted convenience with explicit privacy terms.

## Adopt, prototype, defer, avoid

### Adopt now

- In-repo eval runner.
- JSON fixture schema for Council QA.
- Sensitive-topic taxonomy and response policy.
- No passive telemetry by default.
- Redacted user-initiated support bundle design.
- Source Set v1 and Study Packet v1 concepts.
- Provider data-handling matrix.

### Prototype next

- promptfoo local regression tests.
- Ragas or DeepEval on a small fixture subset.
- Phoenix or Langfuse in a dev-only local observability sandbox.
- OpenTelemetry/OpenInference only for local traces or user-initiated support bundles.
- GitHub Sponsors/Open Collective language if the repo becomes public.

### Defer

- LangSmith and Braintrust SaaS trace workflows.
- Production AI observability dashboards.
- Managed model gateway.
- App-store level distribution.
- In-app purchases.
- Paid licensed resource packs.

### Avoid

- Ads.
- Selling user data.
- Session replay.
- Hidden cloud logging.
- Hidden provider routing.
- AI-pastor positioning.
- Crisis counseling by the app.
- One-click publish/share of sensitive spiritual or personal disclosures without review.

## Concrete next docs

Create or update these in order:

1. `docs/sensitive-topic-safety-policy.md`
2. `docs/council-eval-tooling-decision.md`
3. `docs/eval-fixture-schema.md`
4. `docs/observability-boundary.md`
5. `docs/community-funding-and-governance.md`
6. `docs/provider-data-handling-matrix.md`
7. `docs/ai-claims-and-limitations-policy.md`

## Backlog candidates

1. Add a sensitive-topic detector before Council generation.
2. Add sensitive-topic eval fixtures and acceptance criteria.
3. Add an in-repo eval runner that emits JSON and Markdown summaries.
4. Add a promptfoo proof of concept that runs locally and uploads nothing.
5. Add support-bundle fields: app version, OS, provider, model, redacted prompt, retrieval IDs, source-set IDs, error stack, and user opt-in note.
6. Add export metadata to Study Packet v1: timestamp, source set, provider/model, passage, sources, generated sections, and warnings.
7. Add public-facing wording that says the app is a study assistant, not a pastor, counselor, doctor, lawyer, or emergency service.

## Key risks

| Risk | Why it matters | Mitigation |
| --- | --- | --- |
| Eval false confidence | LLM-as-judge metrics can miss theological and pastoral mistakes | Keep fixtures human-readable and require manual review for sensitive cases |
| Cloud observability leakage | Traces may include prayer, confession-like notes, or crisis disclosures | No default cloud traces; redaction and opt-in before any external upload |
| Safety overblocking | Users still need Bible study help for hard topics | Route to bounded support, not blanket refusal |
| Safety underblocking | Generic answers can harm users in abuse or self-harm scenarios | Add sensitive-topic taxonomy and evals |
| Monetization trust break | Ads, telemetry, or hidden routing would undercut differentiation | Use transparent support/build/content models only |
| Source licensing drift | Content expansion can accidentally violate rights | Keep source provenance and license review as release blockers |

## Updated product thesis

Bible AI should be positioned as a local-first, source-auditable Bible study workbench with optional AI assistance. Its strongest market wedge is trust under contested interpretation: visible sources, visible uncertainty, bounded pastoral claims, and exportable study artifacts. The more it looks like a generic spiritual chatbot, the easier it is to lose against broader consumer apps and the harder it is to defend on safety, theology, and privacy.

## Sources consulted

- LangSmith observability docs: https://docs.langchain.com/langsmith/observability
- Braintrust evaluation docs: https://www.braintrust.dev/docs/evaluate
- Arize Phoenix docs: https://arize.com/docs/phoenix
- Langfuse docs: https://langfuse.com/docs
- promptfoo intro and red teaming docs: https://www.promptfoo.dev/docs/intro/ and https://www.promptfoo.dev/docs/red-team/
- Ragas metrics docs: https://docs.ragas.io/en/stable/concepts/metrics/available_metrics/
- DeepEval docs: https://deepeval.com/docs/getting-started
- TruLens docs: https://www.trulens.org/
- OpenTelemetry docs: https://opentelemetry.io/docs/
- OpenInference project: https://github.com/Arize-ai/openinference
- 988 Suicide and Crisis Lifeline: https://988lifeline.org/
- SAMHSA 988 overview: https://www.samhsa.gov/mental-health/988
- National Domestic Violence Hotline: https://www.thehotline.org/
- NNEDV Safety Net Project: https://nnedv.org/content/technology-safety/
- OpenAI usage policies: https://openai.com/policies/usage-policies/
- Pew Research Center, religious apps and websites: https://www.pewresearch.org/religion/2023/06/02/use-of-apps-and-websites-in-religious-life/
- Pew Research Center, Americans' views of AI: https://www.pewresearch.org/science/2025/09/17/how-americans-view-ai-and-its-impact-on-people-and-society/
- Lifeway Research on AI, pastors, and churchgoers: https://research.lifeway.com/2026/04/21/pastors-churchgoers-see-ai-as-concerning-and-confusing/
- Barna on AI and the church: https://www.barna.com/trends/ai-and-the-church/
- GitHub Sponsors docs: https://docs.github.com/en/sponsors
- Open Collective fiscal hosting: https://opencollective.com/fiscal-hosting
- Open Source Collective docs: https://docs.oscollective.org/welcome-and-introduction-to-osc/what-is-fiscal-hosting
- Polar: https://polar.sh/
- Buy Me a Coffee: https://buymeacoffee.com/
