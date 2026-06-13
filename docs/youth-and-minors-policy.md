# Youth And Minors Policy

Status: DRAFT (for review)
Last updated: 2026-06-13

> This is a draft. The legal and COPPA-style framing below is a product and
> trust posture, not legal advice. A human reviewer (and, before any
> youth-directed use, qualified legal counsel) must confirm this framing
> before it is treated as authoritative.

## Summary

Bible AI v0.1 is built and tested for adult, personal study use. It is not
child-directed, and it is not designed or marketed for minors. This policy
states the boundary for the current beta and the requirements that would have
to be met before any youth-directed use.

## Scope Of v0.1

- v0.1 is not a child-directed product.
- It is not designed, named, themed, or marketed for children or teens.
- The intended user is an adult studying for personal or scholarly use.
- The app provides AI-assisted Bible study. It is not a pastor, counselor,
  teacher, doctor, lawyer, or emergency service, and it is not a substitute
  for adult supervision or church/community oversight.

## No Under-13 Path And No Children's Data

- There is no under-13 sign-up, account, or onboarding path in the app.
- The app does not knowingly collect personal information from children.
- Consistent with the privacy posture in `docs/privacy-and-distribution.md`,
  user notes, workspaces, bookmarks, highlights, and Council sessions are
  stored in local SQLite, and backups/exports are created only when the user
  requests them.
- This is a conservative, COPPA-style posture (avoid any child-directed path
  and any knowing collection of children's data). It is a product boundary,
  not a legal determination, and needs legal review before being relied on.

## No Youth, Classroom, Or School Deployment In Beta

During the beta, Bible AI must not be deployed for or marketed to:

- youth groups or youth ministry programs,
- classrooms, Sunday school, or other minor-serving instruction,
- schools or any K-12 institutional setting.

There is no supported configuration for distributing the app to minors or for
operating it on a minor's behalf in the beta.

## No Youth Pilot Without Separate Review

A youth pilot is any structured use of the app by, or directed at, minors,
including supervised classroom or youth-group trials.

No youth pilot may proceed without a separate, documented review covering at
least:

- a dedicated written policy specific to the youth pilot,
- a documented data flow (what is collected, where it is stored, what is sent
  to AI providers, and retention),
- a supervision and consent plan (responsible adults, and verifiable parental
  or guardian consent where required),
- legal review of applicable child-protection and privacy obligations.

Until that review is completed and approved, the answer to any youth pilot
request is no.

## Future Review Requirements

Before any youth-directed use is permitted, the following must be true and
documented:

1. Legal review of COPPA-style and other applicable child-privacy and
   child-protection obligations for the target use and region.
2. A youth-specific data-flow review showing minimized collection, clear
   storage and retention, and disclosed provider routing for any AI calls.
3. A consent and supervision model with verifiable parental/guardian consent
   where required and clear adult oversight.
4. Sensitive-topic and crisis handling reviewed for a youth audience, building
   on `docs/sensitive-topic-safety-policy.md`.
5. Age-appropriate content, language, and safety boundaries defined and tested.
6. A named owner accountable for the youth program and for incident response.

Absent all of the above, Bible AI remains an adult, non-child-directed app.

## Items Needing Human/Legal Sign-Off

- Confirmation that the COPPA-style framing and "no knowing collection of
  children's data" claim are accurate for how the app is distributed.
- Confirmation of the legal definition of "minor" and any age thresholds used.
- Confirmation that the future-review requirements are sufficient before any
  youth-directed use.
