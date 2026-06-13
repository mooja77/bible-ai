# EP-020: Sensitive-topic router — Design

- **Date:** 2026-06-13
- **Status:** Implemented (rule-based router + routing + notice; crisis wording
  needs pastoral sign-off)
- **Gate:** AI safety (Gate 4)
- **Source:** `docs/development-implementation-plan.md` EP-020;
  `docs/sensitive-topic-safety-policy.md` (EP-004 draft).

## Background

A crisis or sensitive disclosure must never enter normal Council generation and
be answered with theological debate. Nothing enforced this before.

## Change

A local, rule-based pre-Council router:

- **`classify_sensitive_topic(question) -> Option<category>`** (Rust, pure,
  unit-tested): lowercases the prompt and matches conservative marker sets for
  self-harm/suicide, harm-to-others, abuse, and child-safety. Deliberately
  over-triggers (false positives are acceptable; the dangerous failure is the
  false negative), and includes euphemistic / third-person phrasings, not only
  keyword-obvious ones.
- **Routing in `ask_council`**: the classifier runs immediately after question
  validation, **before any retrieval, provider call, or session persistence**. A
  flagged prompt returns `{ sensitive_topic: { category, message } }` and the
  Council never runs (and nothing is saved to history).
- **`SENSITIVE_TOPIC_MESSAGE`**: a calm safety message stating the app is not a
  counselor/doctor/pastor/emergency service and pointing to real help (US 988 /
  911). Marked `TODO(pastoral-review)` -- the exact wording and non-US
  localization need human/pastoral sign-off before release.
- **Frontend**: `CouncilResponse.sensitive_topic` type; `CouncilPanel` renders a
  calm amber safety notice (`data-testid="sensitive-topic-notice"`) when set and
  skips the entire normal result view.

## Scope / what needs a human

- The **rule coverage and the crisis wording** are a starting point that requires
  pastoral/professional review and expansion (the policy doc says so). The code,
  routing, and tests are complete; the words are `TODO(pastoral-review)`.
- A learned/cloud classifier is explicitly out of scope (local rule-based first,
  per the policy).

## Testing

- 3 Rust unit tests: direct crisis prompts flagged; indirect/euphemistic/
  third-person phrasings flagged; ordinary study questions ("Romans 9 election",
  "Did Jesus die for our sins", "forgive someone who hurt me") NOT flagged.
- e2e (`council-mock.spec.ts`): a sensitive prompt shows the safety notice
  (containing 988) and produces **no** Synthesis -- the Council did not run.
- `cargo test` 111; `npm run check` green; `npm run test:e2e:build`.
