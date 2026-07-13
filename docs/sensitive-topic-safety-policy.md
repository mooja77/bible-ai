# Sensitive-Topic Safety Policy

Status: DRAFT — engineering candidate implemented; human safety review pending
Date: 2026-07-13
Packet: EP-004 (Trust and safety gate)

This is a draft for human and pastoral review. Three things in this draft
MUST be reviewed and finalized by a person before this policy is treated as
authoritative:

1. The exact crisis-resource list (numbers, names, URLs, and localization).
2. The exact non-role wording shown to users.
3. The taxonomy completeness and the router aggressiveness threshold.

Until those are confirmed, treat the wording and resource specifics here as
placeholders that capture intent, not final user-facing copy.

## Purpose

Bible AI is a local-first Bible study workbench. Users in this domain may ask
questions that mix Scripture with guilt, abuse, suicidal thoughts, coercion,
mental health, family conflict, and church authority. This policy defines how
the app must behave when a prompt is, or may be, a crisis or sensitive
disclosure rather than an ordinary study question.

This policy governs the Council feature, the guided learning flows, and any
other path that sends a user prompt to the AI sidecar for generation. It is a
release gate: the app must satisfy it before wider beta.

This policy is consistent with `docs/privacy-and-distribution.md`. Sensitive
detection runs locally and does not change the existing privacy posture: no
prompt content is sent to a hidden cloud moderation service as the first
implementation, and provider calls still only happen on the normal Council
path when the prompt is safe to study.

## Non-Role Statement

Bible AI is a study assistant. It is not, and must not present itself as:

- a pastor or spiritual director,
- a counselor or therapist,
- a doctor or mental-health clinician,
- a lawyer or legal advisor,
- a financial advisor,
- an emergency service or crisis support service.

The app does not replace prayer, a church community, professional care, or
emergency responders. It cannot keep anyone safe, cannot be present with a
person in crisis, and cannot take responsibility for a decision. When a prompt
touches the categories below, the app's job is to say this plainly and to point
the user toward real people and real services.

(Reviewer note: the precise wording above is a placeholder and must be
confirmed by a human, ideally with pastoral input, before it ships.)

## Sensitive-Topic Taxonomy

The router must recognize the following categories. A single prompt may match
more than one; the most safety-critical match wins.

1. Suicide and self-harm. Thoughts, intent, plans, or references to ending
   one's life or hurting oneself.
2. Imminent harm to others. Intent, plans, or threats to hurt or kill another
   person.
3. Domestic abuse. Abuse by a partner or family member, including physical,
   sexual, emotional, financial, or controlling behavior.
4. Sexual abuse. Sexual assault, coercion, or exploitation, current or past.
5. Child safety. Any indication that a child is being abused, neglected, or is
   in danger.
6. Medical or mental-health crisis. Acute medical emergencies and mental-health
   conditions where the app could be mistaken for clinical advice.
7. Legal or financial decisions. High-stakes legal or financial situations
   where authoritative-sounding output could cause real harm.
8. Pastoral emergency. Acute spiritual distress, grief, or crisis of faith that
   needs a present human, not a generated argument.
9. Spiritual abuse, coercion, manipulation, or threats. Misuse of religious
   authority to control, isolate, frighten, shame, or extract compliance.
10. Confession-like disclosures involving harm. A user disclosing that they
    have harmed, are harming, or intend to harm themselves or others, framed as
    a confession or as seeking absolution.

This list is not assumed to be complete. Adding a category is always preferred
over forcing a real disclosure into "ordinary study." Reviewers must confirm
the taxonomy covers the situations this audience will actually bring.

## Pre-Council Routing Behavior

Generation happens when a user prompt reaches the sidecar and `runCouncil`
(in `app/sidecar/council.mjs`) produces voices, synthesis, and an argument map.
The UI reaches that path through `askCouncil` from the Council panel
(`app/src/features/council/`).

The sensitive-topic router must run BEFORE that generation, on the same
prompt, on every Council and guided-learning request. Requirements:

- Rule-based first. The initial implementation is deterministic pattern and
  rule matching, not a learned cloud classifier.
- Local and inspectable. Detection runs on-device. The rules are readable and
  auditable. No prompt text is sent to a hidden remote moderation service as
  the first implementation.
- Routes before normal Council generation. When the router flags a prompt, the
  app must NOT start normal Council debate for that prompt. The sensitive
  response mode replaces the normal generation, it does not run alongside it.
- Conservative by design. False positives (flagging an ordinary prompt) are
  acceptable at beta scale. They cost the user a little friction. The router is
  allowed and expected to over-trigger.

### Critical judgment point: optimize against the false negative

For a safety classifier, the false positive and the false negative are not
symmetric, and the plan must not treat them as if they were.

- A false positive means a normal study question gets a safety message it did
  not need. The user is mildly inconvenienced. No one is harmed.
- A false negative means a real crisis disclosure slips through and is answered
  with normal theological debate or authoritative-sounding pastoral advice.
  This is the failure that can hurt someone.

Therefore the router MUST be tuned to over-trigger. When the rules are
uncertain, the prompt routes to sensitive response mode. "When in doubt, treat
it as sensitive" is the default, not the exception.

Real disclosures are usually NOT keyword-obvious. People in crisis speak
indirectly, euphemistically, in the third person ("asking for a friend"), in
hypotheticals, in past tense, or wrapped in a Scripture question ("does the
Bible say my life still has worth"). A keyword list that only catches blunt
phrasings will pass the dangerous cases straight through to debate. The rules,
and especially the fixtures below, must target indirect and evasive phrasings
as a primary case, not an edge case.

## Sensitive Response Mode

When the router flags a prompt, the app responds in sensitive response mode
instead of running normal Council generation. This mode must:

- State limits plainly. Repeat the relevant part of the non-role statement: the
  app is a study assistant, not a counselor, pastor, doctor, lawyer, financial
  advisor, or emergency service.
- For crisis or imminent harm, lead with concise safety guidance and real-world
  help routing. This is the primary response. It is not buried under Scripture
  and is not framed as a theological argument.
- Route to real-world help using the UI locale as a conservative hint, never as
  proof of physical location. The implemented English candidates are: Ireland
  (`en-IE`): 112/999 and Samaritans 116 123; UK (`en-GB`): 999, NHS 111 and
  Samaritans 116 123; US (`en-US`): 988 and 911. Unknown locales receive no
  country-specific number and are directed to local emergency services and a
  present trusted person. These candidates are sourced from the HSE, NHS and
  988 Lifeline pages listed below, but remain blocked on named human review.
- Keep theological debate out of the crisis response. The app must not produce
  an argument map, a winner, or confident pastoral advice as the primary
  response to a crisis prompt.
- Allow bounded Scripture study only when safe. For the lower-acuity sensitive
  categories, the app may still offer limited Scripture study, but the advice
  limits must remain visible the whole time, and it must not drift into
  authoritative counsel.
- Never give authoritative pastoral, medical, legal, or financial direction.
  The app does not tell a user whether to leave a marriage, stop a medication,
  take a legal action, or accept a church's demand. It points to qualified
  humans.

For spiritual-abuse and coercion prompts specifically, sensitive response mode
should validate that coercion and control are not required by the faith, and
should point toward safe outside support, rather than adjudicating the
disputed doctrine as a normal debate.

## Fixture and Test Requirements

Sensitive-topic behavior is enforced by eval fixtures, and the gate is a
release blocker.

- Every taxonomy category has eval cases. Each of the ten categories above must
  have fixtures that assert the prompt routes to sensitive response mode and
  does NOT enter normal Council debate.
- Fixtures must include indirect and evasive phrasings, not only keyword-obvious
  ones. For each high-acuity category (suicide/self-harm, imminent harm,
  abuse, child safety) include third-person "asking for a friend" framings,
  hypotheticals, past-tense disclosures, euphemisms, and prompts that hide the
  disclosure inside a Scripture question. These indirect cases are the point of
  the test, because they are where a keyword router fails silently.
- Mixed prompts are tested. Include prompts that combine a genuine study
  question with a sensitive disclosure, and assert that the sensitive handling
  takes priority.
- Release blocks on failure. If a sensitive prompt produces normal Council
  debate, an argument map, a confident "winner," or authoritative pastoral,
  medical, legal, or financial advice, the release is blocked. This mirrors the
  Phase 4 exit criterion that sensitive prompts must not enter normal Council
  generation.
- The fixture set is reviewed by a human. Because the failure mode is a missed
  real disclosure, fixture coverage of indirect phrasings must be reviewed by a
  person, ideally with pastoral or crisis-response input, not assumed complete
  from the category checklist alone.

## Acceptance Criteria

- The app states its limits plainly in onboarding and Settings.
- The pre-Council router runs locally and before generation on every Council
  and guided-learning request.
- Sensitive prompts route to sensitive response mode and do not enter normal
  Council generation.
- Crisis prompts receive concise safety guidance and real-world help routing,
  not theological debate.
- Eval fixtures exist for every taxonomy category and include indirect and
  evasive phrasings.
- The release is blocked if any fixture produces normal debate or authoritative
  advice for a sensitive prompt.

## Open Items For Human Review

- Crisis-resource list: confirm the exact services, numbers, and URLs, and
  define the localization plan for non-US users before release.
- Non-role wording: confirm the exact user-facing limit statements, ideally
  with pastoral input.
- Taxonomy completeness: confirm the ten categories cover this audience and add
  any missing ones.
- Router aggressiveness: confirm the over-triggering threshold and sign off on
  accepting false positives in exchange for minimizing false negatives.

## References

- `docs/development-implementation-plan.md` (EP-004; Phase 4 sensitive
  categories and exit criteria).
- `docs/reviews/2026-06-12-163356-comprehensive-research-synthesis-and-master-plan.md`
  (Milestone 3: Trust and safety gates).
- `docs/reviews/2026-06-12-162520-app-institutional-trust-pastoral-safety-accessibility-community-recursive-research.md`
  (pastoral safety research).
- `docs/privacy-and-distribution.md` (privacy posture).
- SAMHSA 988 Suicide and Crisis Lifeline: https://www.samhsa.gov/mental-health/988
- 988 Suicide and Crisis Lifeline: https://988lifeline.org
- HSE urgent mental-health help (Ireland): https://www2.hse.ie/mental-health/services-support/get-urgent-help/
- NHS urgent mental-health support (UK): https://www.nhs.uk/every-mind-matters/urgent-support/
- APA health advisory on AI chatbots and wellness apps:
  https://www.apa.org/topics/artificial-intelligence-machine-learning/health-advisory-chatbots-wellness-apps
