# Council Real-World QA

Status: partially complete as of 2026-05-05.

The app has synthetic fixture coverage for heavy provider disagreement, provider failure, and sparse evidence in `app/tests/fixtures/council-quality.json`; those fixtures are exercised by `app/tests/e2e/release-readiness.spec.ts`.

The first non-mock QA pass was run against Claude Code with mock mode disabled. A later multi-provider attempt detected Claude Code and Gemini, but Gemini quota/rate limits prevented a release-satisfying two-provider run. OpenAI and Anthropic API keys were not configured on this machine.

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
4. Review `app/tests/fixtures/council-real-weak-results.json`.
5. Ask additional manual questions through the Council for cases the script does not cover.
6. Save weak or surprising outputs as workspace Council results.
7. Export the workspace JSON.
8. Convert each weak result into a fixture entry with:
   - `question`
   - `weakness`
   - full `response`
   - provider status and error data
   - retrieved evidence
7. Tune prompts only where the failure is repeatable: vague rationale, overconfidence, missing citations, or hidden disagreement.

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
