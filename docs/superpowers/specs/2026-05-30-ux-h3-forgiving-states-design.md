# UX H3 — Forgiving reference input — Design

- **Date:** 2026-05-30
- **Status:** Implemented (merged to `main`)
- **Theme:** H — UX for non-technical users, sub-project 3 (slice 1: reference input). See `2026-05-30-ux-enhancement-plan.md`.

## Problem

The reader's "Jump to reference" box silently fails on natural lay inputs. Plan friction #8:
a book-only input like "John" or "1 John" returns nothing; the error
("Use a reference like John 3:16 or John 3:16-4:2.") and placeholder
("John 3:16 or John 3:16-18") under-document what's accepted.

## Scope (slice 1)

Reference input only — the highest-value, lowest-risk H3 piece. (Empty-state CTAs and full-name
translation labels are deferred — see below — to keep this slice e2e-safe and small.)

### `lib/verse.ts`
- Extract the book-resolution logic into a private `resolveBook(rawBook, books)` (reused by both
  paths; returns `undefined` on empty/unknown).
- `parseReference`: when the input has **no chapter** (regex doesn't match, e.g. "John", "1 John",
  "1John") but the whole string resolves to a known book → return that book at **chapter 1**
  (`verseId` = book ch1:v1, citation = "<book> 1"). All existing paths (chapter-only, verse,
  same-chapter range, cross-chapter range, reversed-range rejection, numbered books) unchanged.

### `App.tsx`
- Friendlier parse-fail message: *"Hmm, I couldn't find that. Try a book, chapter, or verse — like
  "John", "John 3", "John 3:16", or "John 3:16-4:2"."*
- Richer placeholder: *"Go to… e.g. John, John 3, or John 3:16"*.
- `aria-label="Jump to reference"` (the e2e hook) unchanged.

## Testing

- Standalone node behavioral check (12 cases): book-only "John"/"1 John"/"1John"/"Genesis" → ch1;
  chapter-only, verse, same-chapter range, cross-chapter range still correct; unknown/empty/garbage
  → null. All pass.
- `npm run build` + full `npm run check` green. No e2e asserts the old placeholder/error strings
  (grep-confirmed). The existing reader-interactions jump-box tests (full references) regression-cover
  the parse path. Full `npm run test:e2e:build` green.
- No new e2e added this slice (the file-read tooling was returning corrupted content during
  authoring, making a heading-dependent assertion unsafe to write; the node behavioral test +
  existing jump e2e provide coverage).

## Out of scope (later H3 slices)
- Empty-state "do the first thing" CTA buttons for Council/Workspaces/Theology/Resources (additive;
  each already has a basic empty state).
- Translation pickers showing full name + code ("King James Version · KJV") — needs an audit of
  whether release-readiness/smoke assert bare codes first.

## Rollout

Branch `ux-h3-forgiving-states`. Modify: `lib/verse.ts`, `App.tsx`, spec/plan. Verify with
`npm run check` + `npm run test:e2e:build`, then ff-merge to `main`.
