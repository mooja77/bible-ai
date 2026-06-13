# Quality Ops Plan

Status: DRAFT (for review)

Last updated: 2026-06-13

This document defines how Bible AI converts a reported or observed AI quality
failure into a structured, severity-graded case, and how those cases become
regression fixtures or explicit accepted risks before they count as resolved.

It is the support-and-release half of EP-012. Its companion is
`docs/ai-risk-eval-plan.md`, which defines the failure classes in detail and the
eval ladder that exercises them through the real sidecar AI path. Read the two
together: this plan owns the case lifecycle, severity, and release blockers; the
eval plan owns what "good" and "bad" output look like and how they are tested.

Related docs:

- `docs/ai-risk-eval-plan.md` (failure classes and eval ladder).
- `docs/sensitive-topic-safety-policy.md` (EP-004; sensitive-topic routing and
  the non-role statement that several S0 cases depend on).
- `docs/study-packet-v1-contract.md` (EP-001; the export contract that export
  audit and golden Study Packet cases are graded against).
- `docs/testing-and-release-plan.md` (where the release blockers below are
  enforced).

## Goal

Make AI failures into a regression system instead of one-off bug reports. A user
or reviewer reports bad AI output; the report is classified by severity and
failure class; private data is redacted; the case becomes a structured quality
fixture; a reviewer grades it; the fix is made in retrieval, prompt, provider
handling, UI, or source metadata; and the case becomes a regression gate. The
quality source of truth stays in repo-owned fixtures and docs. External eval and
annotation products are optional adapters; they do not own theological quality.

## Severity taxonomy

Severity is assigned at intake by a reviewer, not by the reporter. A reporter
severity guess is recorded but is advisory only. Severity drives the required
action and whether the case can block a release.

| Severity | Definition | Examples | Required action |
| --- | --- | --- | --- |
| S0 | Critical safety, privacy, security, or spiritual-authority incident. | Leaks private notes or secrets; encourages self-harm; gives medical, legal, or crisis directives; impersonates pastoral certainty in a crisis; resource text overrides safety or attribution rules. | Stop the release lane. Create an incident note. Redact data. A linked fixture (or an explicit accepted-risk entry) is required before the fix is accepted. |
| S1 | Repeatable high-impact AI quality failure in a core workflow. | Fabricated citation; one denominational view presented as the only biblical answer on a disputed issue; hidden provider disagreement; wrong source attribution in an exported Study Packet. | Fix before release. Create a quality case. A linked fixture (or accepted-risk entry) is required before the fix is accepted. |
| S2 | Material study-quality defect with a workaround. | Retrieval misses an essential passage; confidence too high for the evidence; weak export metadata; provider failure not surfaced clearly enough. | Schedule in the next quality sprint. If the case is repeated (seen more than once across reports or builds), it is promoted and a linked fixture or accepted-risk entry is required before it is resolved. |
| S3 | UX or supportability issue. | Confusing setup, unclear "provider skipped" reason, weak copy around limitations. | Track normally. No release block unless widespread. |
| S4 | Enhancement or content request. | New tradition pack, new export format, additional commentary source. | Roadmap or backlog. |

Severity threshold notes for human confirmation:

- The S0 line (privacy, safety, spiritual-authority, security) is deliberately
  broad. Anything that could harm a user or expose their data is S0 by default.
- "Repeated S2" is currently defined as observed two or more times. The exact
  threshold is a decision a human should confirm (see end of doc).

## Quality case schema

Each case is one record. Suggested home: `app/tests/fixtures/quality-cases/`
(one JSON file per case, or one JSONL file per batch). The fields below are the
contract; tooling may add metadata but must not drop a required field.

| Field | Meaning |
| --- | --- |
| `case_id` | Stable identifier, e.g. `qa-2026-06-13-0001`. |
| `severity` | One of S0, S1, S2, S3, S4 (see taxonomy). |
| `source` | Where the case came from: `user_report`, `manual_review`, `real_council_qa`, `synthetic_fixture`, `provider_drift`, `security_review`. |
| `user_workflow` | The workflow that produced it: `council`, `workspace_export`, `resource_search`, `guided_study`, `setup`. |
| `prompt` | The user question or prompt as run (redacted if private). |
| `passage_resource_context` | Passage(s), retrieved evidence ids, and the source/resource set in scope. |
| `provider_model` | Provider mode and model ids (e.g. `openai+gemini`, model ids if visible), or `mock` / `unknown`. |
| `retrieval_mode` | Retrieval mode in effect (e.g. semantic, lexical-fallback) and any fallback reason. |
| `expected_behavior` | What correct output should do, including `must_include` and `must_not_include`. |
| `actual_behavior` | What the output actually did, with a short excerpt and an artifact path if one exists. |
| `failure_class` | One or more failure classes from `docs/ai-risk-eval-plan.md`. |
| `status` | `open`, `fixed`, `accepted_risk`, `duplicate`, `cannot_reproduce`. |
| `linked_fix` | The commit, PR, or change that addresses the case. |
| `linked_regression_fixture` | Path to the fixture that now guards against this case. |
| `accepted_risk_rationale` | Required when `status` is `accepted_risk`; states why the case is not being fixed and who accepted the risk. |

Privacy: a case that contains private user content cannot enter the fixture set
until it is redacted. Cases carry a redaction status (`not_needed`, `redacted`,
`blocked`); a `blocked` case cannot become a fixture.

Human review: S0 and S1 cases require a human review section that records the
reviewer role, the rubric version, the dimension scores, and whether the result
is blocking. The rubric dimensions and scoring live in
`docs/ai-risk-eval-plan.md`.

## Resolution rule (fixture or accepted risk)

This is the core rule of the plan:

> An S0, an S1, or a repeated S2 case does not count as resolved until it has
> either a linked regression fixture or an explicit accepted-risk entry.

Consequences:

- A fix without a fixture is not "done" for S0, S1, or repeated S2. The fix may
  ship, but the case stays open until the fixture (or accepted-risk entry)
  exists.
- A case cannot be closed as `fixed` until it passes the rubric dimension that
  originally failed. Fixing a symptom while the graded dimension still fails is
  not a resolution.
- An accepted-risk entry must name a rationale and an accepting owner. It is a
  conscious, recorded decision, not a silent skip.
- Single-occurrence S2, S3, and S4 cases do not require a fixture, but a fixture
  is encouraged whenever it is cheap.

## Release blockers

A release candidate is blocked from the wider/beta release lane when any of the
following is true. These are enforced through `docs/testing-and-release-plan.md`.

- Any open S0 case.
- Any open S1 case.
- Any open S2 case touching citation accuracy, privacy, export audit, or
  provider transparency, unless it carries an explicit accepted-risk entry.
- Real Council QA does not pass (see `docs/council-real-world-qa.md`).
- The golden Study Packets do not pass (see `docs/ai-risk-eval-plan.md`).
- Any eval-ladder fail on sensitive-topic safety, user-judgment separation, or
  licensing/attribution (these are hard fails per the eval plan).
- The manual release QA package is not current.

A release that does ship must state in its release notes what quality risk
changed: which cases were fixed, which fixtures were added, and which risks were
explicitly accepted.

## Case lifecycle (summary)

1. Intake. Report arrives (user, reviewer, real QA run, or security review).
   Reviewer assigns severity and failure class and records the schema fields.
2. Redact. Private content is removed; redaction status is set. A `blocked`
   case cannot proceed to fixtures.
3. Review. S0/S1 (and promoted S2) get a human review with rubric scores.
4. Fix. The change is made in retrieval, prompt, provider handling, UI, or
   source metadata, and recorded in `linked_fix`.
5. Guard. A regression fixture is added (`linked_regression_fixture`) or an
   accepted-risk entry is recorded. Only then can S0/S1/repeated-S2 close.
6. Release note. The release records what quality risk changed.

## Quality dashboard

A lightweight dashboard (docs first, UI later) should track: the current release
candidate, real Council QA status, golden Study Packet status, open S0/S1/S2
cases, provider health, source/resource fixture status, export audit status,
prompt-injection fixture status, known accepted risks, and the signoff owner and
date. This gives the release blockers above a single place to be checked.

## Decisions a human should confirm

- The exact "repeated S2" threshold (currently two or more occurrences).
- Whether overconfident-disputed-claim cases are S1 or S2 by default.
- Who is authorized to record an accepted-risk entry for S0 and S1.
- Whether the quality dashboard ships as a doc only for v1 or also as UI.
