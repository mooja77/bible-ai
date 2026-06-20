# Bible AI AI economics, provider risk, gateway, and runtime recursive research

- Generated: 2026-06-12 13:57:27 +01:00
- Filename timestamp: 2026-06-12-135728
- Scope: additional recursive research pass after the global/hermeneutics/partnerships/enablement report.
- Method: reread latest reports, inspect provider/gateway code paths, research current official provider/runtime sources, and fold findings back into the plan.

## Executive update

This pass adds a practical operating thesis:

> Bible AI should keep user-owned provider keys as the default until it has explicit cost budgets, provider drift tests, gateway abuse controls, and model-routing policy.

The current app is correctly shaped for private beta: the user owns OpenAI, Anthropic, Gemini, Claude Code, Ollama, or a managed-gateway credential. The risk appears when Bible AI becomes the payer or operator. A single app-owned gateway changes the product from "local study tool" into "AI service operator" with billing, rate-limit, abuse, privacy, moderation, support, and model-lifecycle obligations.

This pass promotes five decisions:

1. Add a provider economics and model-routing policy before any hosted/gateway rollout.
2. Add per-session and per-month cost estimates to beta planning before pricing.
3. Add provider drift/deprecation checks because model IDs and pricing change.
4. Keep Ollama optional and explain local model disk/memory expectations plainly.
5. Treat managed gateway as an enterprise/team feature requiring quotas, abuse controls, logging policy, and billing ownership.

## Recursive loop log

### Pass 1 - Local app/provider state

Relevant local findings:

- `docs/user-owned-ai-setup.md` correctly says consumer ChatGPT/Claude/Gemini subscriptions are not the same as API billing.
- The setup doc lists default model IDs: Anthropic `claude-sonnet-4-6`, OpenAI `gpt-5`, Gemini `gemini-2.5-flash`.
- `app/sidecar/providers/openai.mjs` uses direct REST calls to OpenAI with a default `gpt-5`, retryable HTTP handling, and a 600 second default timeout.
- `app/sidecar/providers/gateway.mjs` posts the same Council voice payload to `/council/voice` and accepts either structured result JSON or parseable text.
- The managed gateway is an implementation hook, not an operating model.

Gap:

- There is no canonical provider-cost matrix.
- There is no cost budget per Council session.
- There is no token-count estimate visible to users.
- There is no gateway quota/billing/abuse policy.
- There is no model deprecation/drift policy.

Plan improvement:

- Add provider economics and routing docs before widening beta.
- Keep managed gateway hidden/advanced unless an operator publishes terms.

### Pass 2 - Provider pricing, rate limits, and data controls

Current official provider docs show a volatile cost surface:

- OpenAI pricing changes by model, service tier, cached input, Batch API, priority processing, and data residency.
- Anthropic Sonnet pricing is lower than top-tier models but still meaningful at multi-voice Council volume; prompt caching can reduce repeated context cost but needs deliberate prompt structure.
- Gemini pricing includes free/paid tier differences, model differences, context caching, and optional grounding costs.
- Providers enforce rate limits and spend limits at account, project, or organization levels.
- Model deprecations and preview/stable model lifecycle changes are normal.
- API data controls differ from consumer products and from managed/enterprise arrangements.

Decision:

- Bible AI should not hard-code a single "best" model as the product assumption.
- The app should support a model tier map:
  - local/offline,
  - cheap hosted,
  - balanced hosted,
  - frontier/high-cost,
  - user custom.
- The beta should document expected provider costs as estimates, not guarantees.

Cost policy recommendation:

- Show a plain warning before first Council run: multi-provider AI calls may incur API charges.
- Estimate likely cost range when token counts are known.
- Let users set a local "soft budget per Council run" even if enforcement is advisory for direct user-owned keys.
- For gateway mode, enforce hard limits server-side.

### Pass 3 - Managed gateway operating risk

A managed gateway introduces a different product:

- app-owned or team-owned provider keys,
- centralized billing,
- per-user quotas,
- abuse filtering,
- request logging decisions,
- retention policy,
- support obligations,
- key rotation,
- downtime handling,
- incident response,
- possible usage-based billing.

Tools and patterns reviewed:

- Cloudflare rate limiting can cap request rates and protect APIs from abuse/cost overruns.
- Stripe usage-based billing meters can track usage if the gateway becomes paid.
- OpenAI moderation can classify harmful content before or after model calls, but safety policy still needs app-specific routing for religious/pastoral contexts.
- Provider rate limits and spend limits can fail in different ways, so gateway policy must handle provider-specific 429s, retries, and fallback.

Decision:

- Do not operate a public managed gateway during private beta.
- If a team/private gateway is used, it needs a written operator policy.

Minimum managed gateway policy:

- operator identity,
- provider routing,
- billing owner,
- per-user quota,
- per-IP and per-account rate limits,
- max prompt size,
- max output tokens,
- max Council runs per day,
- moderation/sensitive-topic routing,
- logging fields,
- retention period,
- redaction rules,
- deletion process,
- incident contact,
- provider outage behavior,
- abuse suspension process.

Gateway implementation requirements before public use:

- hard per-user quotas,
- server-side token counting or conservative request sizing,
- request IDs without storing full private notes by default,
- per-provider cost ledger,
- provider-specific retry/backoff handling,
- model allowlist,
- no arbitrary user-supplied provider/model passthrough,
- dashboard or exportable usage report for operator,
- privacy notice matching actual logs.

### Pass 4 - Local/offline runtime and hardware expectations

Local/offline mode is a key trust differentiator, but it needs clearer expectations:

- The Bible AI desktop app itself can stay lightweight because Tauri and SQLite are appropriate for local desktop apps.
- SQLite FTS5 is a good local full-text search layer.
- Ollama is optional and external.
- Ollama's Windows docs say the binary install needs at least 4GB of space, and models can require tens to hundreds of GB.
- Ollama's context-length docs warn that larger contexts increase memory/VRAM requirements.
- Ollama's FAQ explains CPU/GPU loading behavior, which affects perceived speed.

Decision:

- Separate "Bible AI minimum requirements" from "optional local AI requirements."
- Do not make Ollama mandatory for first-run value.
- Keep keyword search, reader, workspaces, and exports fully useful without Ollama.
- Add a local runtime troubleshooting doc before beta testers are asked to use semantic/local model features.

Recommended performance budget:

- app starts to Reader without provider setup;
- keyword search returns quickly on bundled corpus;
- no AI setup required for reading/search/export;
- meaning search clearly says when Ollama is unavailable;
- Council has visible progress and timeout/error states;
- export works without AI providers;
- local model docs warn about disk and memory before setup.

### Pass 5 - Provider drift and model lifecycle

Model IDs, prices, context windows, default behaviors, privacy terms, rate limits, and deprecation dates change. This matters more for Bible AI than a normal AI toy because generated output can influence theological study and users may cite exported packets later.

Decision:

- Treat provider/model behavior as a moving dependency.
- Add provider drift QA to release gates.

Provider drift checklist:

- verify default model IDs still exist,
- verify pricing links are still current,
- verify data-control links are still current,
- verify structured-output expectations still pass,
- verify malformed JSON handling still passes,
- verify provider error classification still works,
- verify rate-limit hints still make sense,
- verify model names exported in Study Packets,
- record provider/model/date in real Council QA fixtures.

Recommended canonical docs:

- `docs/ai-provider-economics-and-routing.md`
- `docs/model-lifecycle-and-provider-drift-policy.md`
- `docs/managed-gateway-operating-policy.md`
- `docs/local-ai-runtime-requirements.md`

## Provider economics matrix

| Path | Cost owner | Fit now | Main risk | Decision |
| --- | --- | --- | --- | --- |
| No AI / offline only | User has no API cost | Strong | Lower AI value, but reader/search/export still work | Keep first-class |
| Ollama local embeddings | User hardware/storage | Strong for semantic retrieval | Setup, disk, RAM/VRAM confusion | Keep optional |
| Claude Code login | User subscription/session | Useful for some users | Consumer privacy/retention/account-limit complexity | Keep but explain |
| User-owned OpenAI API key | User API account | Strong | User billing surprise, model deprecation | Keep with warnings |
| User-owned Anthropic API key | User API account | Strong | Rate/spend limits, model drift | Keep with warnings |
| User-owned Gemini API key | User API account | Strong | Free/paid tier confusion, quota limits | Keep with warnings |
| Private/team managed gateway | Team/operator | Later/private | Operator owns privacy/billing/support | Allow only with operator policy |
| Public managed gateway | App owner | Defer | Abuse, billing, privacy, legal/support burden | Avoid until business model exists |

## Recommended model-routing policy

Default routing:

1. Use local reader/search/workspace/export without AI.
2. Use keyword search first for simple lookup.
3. Use Ollama embeddings only when available and helpful.
4. Use one low-cost hosted model for simple explanation when configured.
5. Use multi-provider Council only for disputed/high-complexity questions.
6. Reserve frontier/high-cost models for synthesis or explicitly user-selected runs.

Never default to:

- multi-provider Council for every question,
- app-owned paid gateway for all users,
- high-cost frontier model for every explanation,
- hidden fallback from user-owned provider to app-owned provider,
- model change without exporting the model name.

## Cost controls to add before public beta

Client-side/user-owned keys:

- first-run API billing explanation,
- "test provider" before first Council,
- estimated provider/model count before submit,
- visible list of providers that will run,
- local warning for long questions/source sets,
- user-visible model IDs in output/export.

Gateway mode:

- hard quota per user/day/month,
- max tokens in/out,
- max evidence rows,
- request rate limits,
- model allowlist,
- abuse/sensitive-topic gate,
- usage ledger,
- operator-visible cost report,
- opt-in support log export.

## Documentation backlog created by this loop

High priority:

1. `docs/ai-provider-economics-and-routing.md`
2. `docs/model-lifecycle-and-provider-drift-policy.md`
3. `docs/managed-gateway-operating-policy.md`
4. `docs/local-ai-runtime-requirements.md`

Updates to existing docs:

1. `docs/user-owned-ai-setup.md` - add provider pricing/rate-limit caveat and local AI hardware note.
2. `docs/privacy-and-distribution.md` - add managed gateway operator obligations.
3. `docs/testing-and-release-plan.md` - add provider drift QA and model ID checks.
4. `docs/beta-operating-model.md` once created - add "no public gateway" rule.
5. `README.md` - make clear that AI cost depends on the user's configured provider.

## Decision register additions

| Area | Decision | Why |
| --- | --- | --- |
| AI cost owner | User-owned keys by default | Keeps private beta sustainable and honest. |
| Cost estimates | Add before wider beta | Users need billing clarity before Council runs. |
| Gateway | Defer public gateway | Billing, abuse, and privacy obligations are larger than current beta scope. |
| Model routing | Tiered routing, not one default model | Prices and capabilities change. |
| Provider drift | Add release-gate checks | Model IDs, prices, and behavior are unstable dependencies. |
| Local AI | Optional Ollama, not required | Avoid blocking core value on local model setup. |
| Local hardware | Document separately | Bible AI app requirements differ from local model requirements. |
| Moderation | Gateway-only/server policy later | Private local app should not add hidden cloud moderation. |

## Source links used in this pass

- OpenAI pricing: https://openai.com/api/pricing/ and https://developers.openai.com/api/docs/pricing
- OpenAI data controls: https://developers.openai.com/api/docs/guides/your-data
- OpenAI rate limits: https://developers.openai.com/api/docs/guides/rate-limits
- OpenAI model deprecations: https://developers.openai.com/api/docs/deprecations
- OpenAI prompt caching and Batch API: https://developers.openai.com/api/docs/guides/prompt-caching and https://developers.openai.com/api/docs/guides/batch
- OpenAI moderation: https://developers.openai.com/api/docs/guides/moderation
- Anthropic Sonnet pricing: https://www.anthropic.com/claude/sonnet
- Anthropic model overview/pricing: https://platform.claude.com/docs/en/about-claude/models/overview and https://platform.claude.com/docs/en/about-claude/pricing
- Anthropic rate limits: https://platform.claude.com/docs/en/api/rate-limits
- Anthropic prompt caching: https://platform.claude.com/docs/en/build-with-claude/prompt-caching
- Anthropic consumer terms/privacy update: https://www.anthropic.com/news/updates-to-our-consumer-terms
- Google Gemini pricing: https://ai.google.dev/gemini-api/docs/pricing
- Google Gemini rate limits: https://ai.google.dev/gemini-api/docs/rate-limits
- Google Gemini model lifecycle: https://ai.google.dev/gemini-api/docs/models
- Google Gemini API terms: https://ai.google.dev/gemini-api/terms
- Google Gemini Enterprise zero data retention: https://docs.cloud.google.com/gemini-enterprise-agent-platform/resources/zero-data-retention
- Cloudflare rate limiting: https://developers.cloudflare.com/waf/rate-limiting-rules/ and https://developers.cloudflare.com/waf/rate-limiting-rules/best-practices/
- Stripe billing meters: https://docs.stripe.com/api/billing/meter and https://docs.stripe.com/billing/subscriptions/usage-based/advanced/about
- Ollama Windows requirements: https://docs.ollama.com/windows
- Ollama hardware/GPU support and FAQ: https://docs.ollama.com/gpu and https://docs.ollama.com/faq
- Ollama context length: https://docs.ollama.com/context-length
- SQLite FTS5: https://sqlite.org/fts5.html
- SQLite limits: https://sqlite.org/limits.html
- Tauri app size: https://v2.tauri.app/concept/size/

