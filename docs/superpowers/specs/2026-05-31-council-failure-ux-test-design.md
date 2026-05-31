# Council failure UX — automated coverage — Design

- **Date:** 2026-05-31
- **Status:** Implemented
- **Theme:** Testing / robustness. Follows from the question "what testing should
  be done so the app works perfectly for our users?"

## Context — what already exists

A coverage review found the two areas first proposed (backup/restore integrity,
AI-error classification) are **already well covered**, so they were NOT
duplicated:

- Backup/restore round-trip integrity — `user_db.rs` unit tests:
  `roundtrip_export_import_merge_preserves_user_rows`,
  `merge_import_remaps_autoincrement_ids_and_links`,
  `replace_import_overwrites_existing_rows`, `import_rejects_unknown_table_names`,
  `export_snapshot_orders_rows_and_skips_empty_tables`.
- AI provider error classification — `sidecar/tests/shared.test.mjs`
  (`classifyProviderError`: auth / quota / network / timeout / server / parse /
  unknown, with hints).
- Council happy path, persistence, restore, delete — `council-mock.spec.ts`.

## The real gap

`classifyProviderError` is unit-tested, but **no test exercised the UI when the
council actually fails**. The council mock (`BIBLE_AI_MOCK_COUNCIL=1`) only ever
succeeds, so the error state — the single most likely real-world experience for a
non-technical user with a bad key / no network — was never rendered in a test.

Inspecting the failure path revealed the UX itself was thin: a failed
`askCouncil` set the `error` state and rendered a bare
`<ErrorState message={error} />` — a generic red box titled "Error" with the raw
message and **no way to recover**. `String(e)` does pass the sidecar's message
(and its actionable hint) through, but the framing was unhelpful for a
non-technical user. So this work both **adds coverage and improves the UX**: the
council error now shows a clear title ("The Council could not finish") and a
"Try again" button that re-runs the question.

## Approach — sentinel failure injection (mock-only)

The e2e suite runs as one shared session with `BIBLE_AI_MOCK_COUNCIL=1` fixed, so
a per-test env toggle is impossible. Instead, a **sentinel question** drives the
failure: inside the mock-only branch of `mockCouncilResponse`, a question
containing `__FORCE_COUNCIL_ERROR__` throws a classifiable, plain-language auth
error. The throw:

- lives **inside** the `BIBLE_AI_MOCK_COUNCIL === "1"` branch, so it is
  unreachable in a production build;
- propagates through the real failure path (sidecar dispatcher catches it →
  `{ok:false,error}` → Rust `Err` → frontend invoke rejection → `ErrorState`),
  so the test covers the production code path, not a test-only shortcut.

Retrieval runs before the sidecar (a zero-evidence question errors earlier with
"No relevant passages"), so the spec uses a real creation question that
deterministically retrieves evidence, then appends the sentinel.

## What the new tests assert

- `sidecar/tests/council.test.mjs` — in mock mode the sentinel question rejects
  with an actionable message (names Settings, says "try again").
- `tests/e2e/council-error.spec.ts` — asking a sentinel question shows
  "The Council could not finish", surfaces the actionable hint ("API key" +
  "Settings"), offers a "Try again" button, and shows **no** "Synthesis"
  (no false success) — within a bounded wait (no hang).

## Out of scope (documented, not built)

- The frontend has **no client-side timeout** on a council run; it relies on the
  Rust sidecar's 1800s timeout. A 30-minute spinner is itself a poor UX for a
  non-technical user. Flagged as a product follow-up, not a test.
- Visual / alignment / font, real-provider, performance, accessibility, and
  first-run-on-a-clean-machine checks inherently need a human or a real
  environment; see the manual test plan in the chat summary.
