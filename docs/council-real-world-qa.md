# Council Real-World QA

Status: current grounded two-provider machine gate **complete** as of
2026-07-14; SHA-bound human confidence review remains pending.

## Current contract status — 2026-07-14

The current fixture contains 20 non-mock, two-voice results from Claude Code
(`sonnet`, subscription route) and local Granite 4.1 8B/Ollama. All 20 pass the
strict machine contract: both providers succeeded on every question; grounding,
scope, judge, route-diversity, soft-layer, and kill-test objects are complete;
there are zero sidecar errors and zero output-level weakness flags; visible
quotations are corpus-exact; and named primary passages are present.

`npm run qa:real-council:verify -- --fixture
tests/fixtures/council-real-results.json` passes with `claude=20` and
`ollama=20`. The fixture was captured at `2026-07-14T01:39:58Z`; cumulative
recorded case time is 7,569,325 ms, with 366,685 ms median, 238,759 ms minimum,
and 605,502 ms maximum. This is machine evidence, not a theological endorsement:
the separate 20-case human confidence review is regenerated from the fixture's
SHA-256 and remains unsigned.

## 2026-07-13/14 Granite + Claude Run

- Command: `python scripts/run_real_council_qa.py --limit 20 --evidence-limit 24 --providers claude --claude-code --continue-on-error --resume`
- Environment: `OLLAMA_VOICE_MODEL=granite4.1:8b` and
  `OLLAMA_NUM_CTX=32768`.
- Provider diagnostics: Claude Code (`sonnet`) available in subscription mode;
  Ollama available as `granite4.1:8b`; disabled API/gateway providers were not
  counted.
- Results: 20 questions complete, 0 sidecar errors, 0 run warnings, 0
  output-weak results, 20 verified grounding reports, and two successful
  non-mock providers per question.
- Resume behavior: the long first pass persisted 19 clean results before the
  outer command window ended. The surviving single writer completed case 20,
  whose `single_position` flag exposed a real Sermon-on-the-Mount retrieval
  miss. After a regression-tested topical seed was added, a targeted resume
  retained exactly 19 verified cases and regenerated only case 20. The final
  case contains six grounded positions and no weakness flags.

Live QA found and fixed several harness/provider defects:

- progress events are consumed until the correlated terminal sidecar response;
- Ollama requests cap default context at 8,192 tokens, with
  `OLLAMA_NUM_CTX` available for evidence-heavy QA;
- invalid local structured output receives one bounded regeneration attempt;
- voice output size is bounded without dropping evidence classification;
- multiple explicit passages are interleaved instead of allowing the first
  canonical book to exhaust the evidence limit;
- whole-chapter queries reserve capacity for topical/FTS evidence;
- John 6:51-58 and assurance/security/warning passages have reviewed topical
  seeds;
- James 2/Romans 4 argument centers and Sermon-on-the-Mount/apostolic-ethics
  parallels have regression-tested topical seeds;
- unnumbered book aliases no longer match inside numbered books (`John` inside
  `1 John`);
- corpus-exact text repair runs before model regeneration only when the cited
  verse id was actually retrieved, followed by a fresh grounding pass; invented
  ids and uncited positions still fail;
- missing/unavailable trust stages and grounding failure are always output-level
  weakness flags;
- `--resume` reuses only grounded, stage-complete, quote-hydrated, weakness-free
  results from the same provider/model diagnostics.

Saved Google, OpenAI, Anthropic, and gateway credentials were not used for the
passing run; their values were never logged. Claude used the local Claude Code
subscription session, and Granite used local Ollama. Do not edit response or
stage objects by hand; rerun weak cases through the real providers.

The app has synthetic fixture coverage for heavy provider disagreement, provider failure, and sparse evidence in `app/tests/fixtures/council-quality.json`; those fixtures are exercised by `app/tests/e2e/release-readiness.spec.ts`.

The sections below preserve historical runs and the defects they exposed. Their
older fixtures have been replaced by the current Granite + Claude artifact and
must not be used as current release evidence.

## 2026-05-07 Multi-Provider Release-Gate Run

- Command: `python scripts/run_real_council_qa.py --limit 20 --evidence-limit 24 --providers gemini,openai --continue-on-error`
- Providers: Gemini and OpenAI.
- Results: 20 questions completed, 0 sidecar request errors.
- Provider coverage: Gemini succeeded on 20/20 questions; OpenAI succeeded on 20/20 questions.
- Full fixture: `app/tests/fixtures/council-real-results.json`
- Output-weak fixture: `app/tests/fixtures/council-real-weak-results.json`
- Verification: `npm run qa:real-council:verify -- --fixture tests/fixtures/council-real-results.json` passed.

Findings:

- Anthropic API authentication was configured, but the account returned a low-credit error during the 20-question run. Anthropic is not used for the passing release-gate fixture.
- The Trinity question needed topical seed references because keyword-only retrieval matched "basis" language in unrelated Pilate texts. The QA runner now adds Trinity reference seeds before FTS retrieval.
- Synthesis now repairs omitted evidence objects from visible supporting/challenging verse IDs, so a position with a verse-id trail does not render as an empty evidence panel.

## 2026-05-05 Multi-Provider Attempt

- Command: `python scripts/run_real_council_qa.py --limit 20 --continue-on-error`
- Providers detected: Claude Code and Gemini.
- Results: 20 questions completed, 0 sidecar request errors.
- Provider failures: Gemini failed on 20/20 questions with `429 Too Many Requests` after retry handling.
- Full fixture: `app/tests/fixtures/council-real-results.json`
- Output-weak fixture: `app/tests/fixtures/council-real-weak-results.json`
- Sidecar log: `app/tests/fixtures/council-real-qa-sidecar.log`

Findings:

- The run proves the multi-provider path can discover two non-mock providers, but it does not satisfy the release gate because the second provider did not contribute successful answers.
- Gemini provider handling now retries temporary `429` and `5xx` responses and requests JSON output where supported.
- Prompt rules now explicitly forbid uncited doctrinal positions; sparse retrieval should become a low-confidence evidence limitation rather than a list of uncited views.

Follow-up gate:

- Re-run the same script after Gemini quota resets or with a valid OpenAI/Anthropic API key configured.
- Treat the gate as passed only if at least two non-mock providers contribute successful answers across the QA set.
- Verify the saved fixture with `npm run qa:real-council:verify -- --fixture tests/fixtures/council-real-results.json`.
  This gate requires a completed non-mock run, at least 20 results, no sidecar request errors, and at least two successful non-mock providers per question.

## 2026-05-02 Non-Mock Run

- Command: `python scripts/run_real_council_qa.py --limit 20 --continue-on-error`
- Providers: Claude available; Gemini unavailable; OpenAI unavailable.
- Results: 20 questions completed, 0 sidecar errors.
- Full fixture: `app/tests/fixtures/council-real-results.json`
- Output-weak fixture: `app/tests/fixtures/council-real-weak-results.json`
- Sidecar log: `app/tests/fixtures/council-real-qa-sidecar.log`

Findings:

- All 20 results carry `limited_provider_coverage` because only Claude was available.
- Prompt tuning removed the earlier possible-overconfidence cases in this one-provider run.
- Explicit passage retrieval now injects named references before FTS/semantic results, fixing weak retrieval for questions such as `1 Timothy 2`, `John 6`, `Acts 2:38`, and `Romans 13`.
- Two outputs still need review because retrieved evidence was too sparse for the position structure: the Trinity question and the Sermon on the Mount question.

Follow-up gate:

- Re-run the same script with at least two non-mock providers configured.
- Promote any remaining output-level weak cases into targeted fixtures or prompt/retrieval changes.

## Real Provider Runbook

Run this with mock mode disabled and at least two providers configured.

1. Set provider credentials in Settings.
2. Use Settings > Provider Status > Test all providers.
3. Run `python scripts/run_real_council_qa.py --limit 20 --continue-on-error`.
   On Windows, this runner loads provider credentials saved by Settings from Windows Credential Manager for the child sidecar process. It does not print or write the secret values. Use `--no-credential-vault` if you want to rely only on shell environment variables.
   To avoid a known quota-limited provider from turning every result into a provider-failure fixture, use `--providers claude,openai` or another two-provider allowlist for the release-gate run.
   If the Anthropic API key is present but the configured Anthropic model is unavailable, add `--claude-code` so the Claude voice uses the local Claude Code login instead.
   For long local runs, add `--resume` after the first complete attempt. It
   reuses only results that already pass grounding/stage/quote checks and only
   when saved provider/model diagnostics match the current run.
4. Run `npm run qa:real-council:verify -- --fixture tests/fixtures/council-real-results.json` from `app/`.
5. Review `app/tests/fixtures/council-real-weak-results.json`.
6. Ask additional manual questions through the Council for cases the script does not cover.
7. Save weak or surprising outputs as workspace Council results.
8. Export the workspace JSON.
9. Convert each weak result into a fixture entry with:
   - `question`
   - `weakness`
   - full `response`
   - provider status and error data
   - retrieved evidence
10. Tune prompts only where the failure is repeatable: vague rationale, overconfidence, missing citations, or hidden disagreement.

## Question Bank

1. How should Romans 9 be weighed in debates about election?
2. How should James 2 and Romans 4 be compared?
3. What does 1 Timothy 2 imply about church leadership?
4. How should 1 Corinthians 11 be interpreted today?
5. What is the strongest biblical case for and against infant baptism?
6. What is the strongest biblical case for and against believer's baptism?
7. How should Hebrews 6 be understood in perseverance debates?
8. How should Hebrews 10 be understood in perseverance debates?
9. What does the New Testament teach about divorce and remarriage?
10. What is the relationship between Israel and the church?
11. How should Revelation 20 be interpreted across millennial views?
12. What does Scripture teach about spiritual gifts continuing?
13. How should Genesis 1 be read in relation to creation timing?
14. What is the biblical basis for the Trinity?
15. How should John 6 be weighed in Eucharistic debates?
16. How should Acts 2:38 be interpreted?
17. What is the biblical case for church discipline?
18. How should Romans 13 be applied to unjust governments?
19. What does Scripture teach about assurance of salvation?
20. How should the Sermon on the Mount relate to Christian ethics?
21. What is the biblical case for congregational, presbyterian, and episcopal polity?
22. How should women prophesying in 1 Corinthians 11 relate to 1 Timothy 2?
23. What is the relationship between faith, repentance, and works?
24. What does Scripture teach about hell and final judgment?
25. How should Old Testament law apply to Christians?
26. What is the biblical case for Sabbath continuity or discontinuity?
27. How should the household codes be interpreted today?
28. What is the role of tradition in biblical interpretation?
29. How should disputed passages be handled when manuscript evidence is mixed?
30. What does Scripture teach about the deuterocanonical books, if anything?

## Fixture Acceptance Criteria

Each captured weak result should preserve the original provider disagreement, source evidence, synthesis, confidence rationale, and provider errors. Do not reduce a weak output to a prose summary; the source drawer and visualization tests need the full structured payload.
