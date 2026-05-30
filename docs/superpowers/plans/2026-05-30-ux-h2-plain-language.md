# UX H2 — Plain-language relabel (slice 1) — Implementation Plan

> Plain-language relabel of the Council retrieval controls (e2e-safe: selected by value/aria-label, not visible text). Full relabel deferred to coordinated slices / H7 because e2e hard-codes many visible strings.

**Spec:** `docs/superpowers/specs/2026-05-30-ux-h2-plain-language-design.md`
**Verification:** `npm run check` + full `npm run test:e2e:build`.

## Tasks (as executed)
- [x] Relabel strategy `<option>` visible text (values unchanged); "Cross-references" → "Include
  cross-references"; "Limit" → "Max passages" (+ aria-label). aria-labels + retrieval badge unchanged.
- [x] grep-confirm no e2e asserts the relabeled visible strings.
- [x] `npm run check` exit 0; `npm run test:e2e:build` 60 passing.
- [x] spec/plan committed; ff-merge to main.

## Self-review
- Scoped deliberately small + safe given the e2e string-coupling; documented the deferred broad
  relabel so it isn't lost. Sequential single calls; tsc/build the arbiter.
