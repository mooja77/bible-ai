# Community Channel Policy

Status: DRAFT (for review)
Last updated: 2026-06-13

This document defines how Bible AI runs its public support and feedback
channels during beta. It implements EP-021 and the community-channel points of
Milestone 3 of the master plan.

These channels are a planned surface and are NOT fully active yet. During the
private beta, support is high-touch and direct (see
`docs/institutional-pilot-readiness.md` and the private beta plan). Public
issue templates described here are drafts to be enabled when the public beta
opens.

## Principles

- Public channels are for product feedback and reproducible problems, not for
  personal spiritual, medical, legal, or crisis disclosure.
- The AI assistant is not a pastor, counselor, doctor, lawyer, or emergency
  service, and the support channel is not one either.
- Public support must never become an unmanaged pastoral or crisis space.

## What Belongs In Public Issues

Appropriate for public issues and discussion:

- Bug reports with reproduction steps.
- Bad AI output reports, described in general terms.
- Source, citation, license, or attribution questions.
- Accessibility problems.
- Setup, install, and provider-configuration problems.
- Feature requests and usability feedback.

Not appropriate for public threads:

- Personal crisis, self-harm, abuse, or imminent-harm situations.
- Private spiritual counseling requests or confessional disclosures.
- Personal medical, legal, or financial situations.
- Anything containing secrets: provider API keys, gateway tokens, passwords.
- Private personal data about the reporter or third parties.

## Redirecting Sensitive Disclosures

If a public thread starts to contain a sensitive personal disclosure or a
crisis situation:

- Do not engage with it as a counseling or pastoral exchange in the public
  thread.
- Redirect the person away from the public channel toward real-world help and,
  where appropriate, a private support contact.
- Follow the routing and limits in the sensitive-topic safety policy
  (`docs/sensitive-topic-safety-policy.md`, EP-004). That policy governs how
  the product and the team handle sensitive topics; this document only governs
  the public channel hygiene around them.
- For security-sensitive disclosures (for example a vulnerability or a leaked
  secret), redirect to a private security contact rather than a public issue.

## Issue Template Set

Each template below must carry the same standing warning at the top:

> Do not paste secrets (API keys, gateway tokens, passwords) or sensitive
> personal disclosures into this issue. This is a public thread. For a personal
> crisis, contact real-world help, not this channel.

Planned templates:

1. Bad AI output. For a Council answer, explanation, or guided-learning output
   that was wrong, fabricated, unsafe, or overreaching. Ask for the prompt
   shape and what was wrong, not for private study content.
2. Source / license. For citation, attribution, translation rights, or license
   concerns about bundled or imported sources.
3. Privacy / export. For concerns about data movement, export contents, or
   support-bundle contents. Remind the reporter to review and redact before
   attaching anything.
4. Accessibility. For keyboard, screen-reader, focus, contrast, or text-scaling
   problems.
5. Setup / provider. For install, first-run, credential-vault, or provider /
   Ollama configuration problems.

## No Unmanaged Pastoral Or Crisis Space

- The project will not host a general social forum, prayer wall, or pastoral
  Q&A space during beta.
- Discussion features, if any are enabled, stay scoped to product use and are
  moderated against the redirect rules above.

## Decisions A Human Must Make

- Whether to use GitHub Issues as the public channel, or another tracker.
- Who moderates public channels and enforces the redirect rules.
- What the private security and private support contacts are, and who owns them.
- Whether any discussion/forum surface is enabled at all during public beta.

## Related Documents

- `docs/sensitive-topic-safety-policy.md` (EP-004)
- `docs/youth-and-minors-policy.md` (EP-005)
- `docs/distribution-channel-decision.md`
- `docs/institutional-pilot-readiness.md`
- `docs/privacy-and-distribution.md`
