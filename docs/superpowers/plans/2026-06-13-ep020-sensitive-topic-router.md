# EP-020: Sensitive-topic router — Implementation Plan

> A crisis prompt must not get a Council debate. Add a local rule-based router
> that intercepts sensitive prompts before generation and returns a calm safety
> notice. Crisis wording is marked for pastoral sign-off.

**Spec:** `docs/superpowers/specs/2026-06-13-ep020-sensitive-topic-router-design.md`
**Verification:** `cargo test` + `npm run check` + `npm run test:e2e:build`.

## Tasks (as executed)

- [x] RED: 3 Rust tests (direct crisis flagged; indirect/euphemistic/third-person
  flagged; ordinary study questions not flagged); confirmed failing.
- [x] GREEN: `classify_sensitive_topic` (conservative marker sets, over-triggers);
  `ask_council` short-circuits before retrieval/provider/persistence, returning
  `{ sensitive_topic: { category, message } }`; `SENSITIVE_TOPIC_MESSAGE` const
  marked `TODO(pastoral-review)`.
- [x] Frontend: `CouncilResponse.sensitive_topic` type; `CouncilPanel` renders a
  calm safety notice and skips the normal result view.
- [x] e2e: a sensitive prompt -> safety notice (with 988), no Synthesis.
- [x] Verify: `cargo test` 111; fmt + clippy clean; `npm run check` green;
  `npm run test:e2e:build`. (Fixed an edit that put the `#[tauri::command]`
  attribute above the new const instead of `ask_council`.)

## Notes

- The classifier runs before the mock-council branch, so the router works in the
  e2e/mock environment too.
- NEEDS A HUMAN: pastoral/professional review of the rule coverage and the crisis
  wording + non-US resource localization before release. Code is complete.
