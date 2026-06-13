# Institutional Pilot Readiness

Status: DRAFT (for review)
Last updated: 2026-06-13

This document defines what must be ready before Bible AI runs a pilot with a
church, ministry, seminary, or training group. It implements EP-021 and
Milestone 10 of the master plan.

Institutional pilots are NOT active and are NOT being solicited yet. They are
blocked until the private beta and the trust/safety policy gates are stable.
This document describes a future readiness state, not a current offering.

## Preconditions

Before any institutional pilot is offered:

- The private beta acceptance cases are passing (Milestone 9).
- The sensitive-topic safety policy and routing are in place (EP-004).
- The accessibility release gate has run and its known gaps are documented
  (EP-011, `docs/accessibility-release-gate.md`).
- The public-release P0 gates can pass for the build being piloted (see
  `docs/distribution-channel-decision.md`).

## Pilot Packet

The pilot packet is the set of materials handed to a responsible institutional
adopter. It must contain:

- AI posture statement. What the AI assistant is and is not; that it holds no
  spiritual authority and is a study aid.
- Privacy and data-movement one-pager. What stays local, what leaves the
  machine on a provider call, and what is never collected.
- Source rights and attribution statement. What corpus and resources are
  bundled, under what license, and how attribution is preserved in exports.
- Sensitive-topic safety policy (EP-004).
- Youth / minors policy (EP-005). v0.1 is not child-directed.
- Accessibility baseline and known gaps.
- Support and incident path. Who to contact, expected response posture, and how
  incidents are handled.
- Sample Study Packet. A representative export so the adopter sees the actual
  product object.
- Local model / provider setup quickstart.
- Bad AI output reporting process. How a pilot participant reports a wrong,
  fabricated, or overreaching AI output.
- Support-bundle review process. How a user-initiated, reviewable support
  bundle is produced and what it does and does not contain.
- Pilot agenda and exit criteria. What the pilot will test, over what period,
  and what counts as success or failure.

## Institutional Constraints

These constraints hold for any early pilot and must be stated to the adopter:

- No youth-group pilots until a youth policy and consent / data-flow reviews
  exist.
- No church-wide deployment until support, training, and incident paths are
  mature.
- No organization admin console yet.
- No shared workspaces yet.
- No managed-gateway subscription until cost, privacy, retention, abuse,
  support, and billing are measured.

## Data And Privacy Posture For Pilots

- The app remains a local-first personal-use tool. Each participant runs their
  own install with their own provider credentials.
- There is no central account, no org tenancy, and no cloud sync.
- Provider calls send only the participant's Council question and retrieved
  evidence to the configured provider or gateway, consistent with
  `docs/privacy-and-distribution.md`.
- No passive collection of reading, search, prompts, notes, or resource
  content.

## Definition Of Done

A responsible institutional adopter can understand exactly what the app does,
what data moves, what it does not do, and how incidents are handled, before any
participant installs it.

## Decisions A Human Must Make

- Who owns institutional support and incident response, and what response
  posture is promised.
- Which institution types are in scope for a first pilot, given the no-youth
  and no-church-wide constraints.
- Whether a managed gateway is ever offered to institutions, and only after the
  cost / privacy / retention / abuse / support / billing measurements exist.
- Who signs off that the preconditions above are met before a pilot starts.

## Related Documents

- `docs/distribution-channel-decision.md`
- `docs/community-channel-policy.md`
- `docs/privacy-and-distribution.md`
- `docs/testing-and-release-plan.md`
- `docs/sensitive-topic-safety-policy.md` (EP-004)
- `docs/youth-and-minors-policy.md` (EP-005)
- `docs/accessibility-release-gate.md` (EP-011)
