# Cross-Reference Weight Ranking — Design

- **Date:** 2026-05-26
- **Status:** Approved (design); ready for implementation plan
- **Theme:** "Surface hidden features" enhancement pass, sub-project 3
- **Owner:** John Moore

## Problem

The reader's verse panel has a Cross-refs tab that lists cross-references for the selected verse.
Each cross-reference carries a relevance `weight` (OpenBible-style vote counts: corpus range
−86…1277, median 3, p90 ≈ 11; negatives = contested). The backend (`db::get_cross_refs`) already
returns them **sorted strongest-first** (`ORDER BY cr.weight DESC NULLS LAST`), and the TS
`CrossRef` type already carries `weight: number | null` — but `CrossRefsTab` ignores it entirely.
So the user sees an ordered list with no indication of *why* it's ordered or which references are
strongly vs. weakly attested.

## Goals

1. Make each cross-reference's relative strength legible at a glance.
2. Show the raw signal on demand (tooltip with the vote count).
3. Keep it honest: "strong" means the same thing on every verse (global thresholds), so a verse
   whose best cross-reference is globally weak is shown as such rather than faked to look strong.

## Non-goals (YAGNI)

- No backend change (ordering + weight delivery already exist).
- No `bible.ts` change (`CrossRef.weight` already exposed).
- No relative-to-this-verse scaling (misleading), no Strong/Medium/Weak section grouping (the list
  is already sorted; headers would duplicate the order).
- No re-weighting, filtering by strength, or hiding weak refs.

## Approach

**Global fixed thresholds + a compact per-row strength indicator.** A pure helper buckets each
ref by its vote weight, and the row renders a small 3-segment indicator (filled per tier) plus a
tooltip with the raw count. Thresholds are derived from the corpus weight distribution and are
trivially tunable.

## Design (`app/src/features/reader/VersePanel.tsx`, `CrossRefsTab` only)

### Strength helper (module-scope, pure)

```ts
type CrossRefStrength = "strong" | "medium" | "weak";

function crossRefStrength(weight: number | null): CrossRefStrength {
  if (weight == null || weight <= 3) return "weak";   // median is 3; negatives = contested
  if (weight >= 10) return "strong";                  // ~top 10% (p90 ≈ 11)
  return "medium";                                    // 4–9
}
```

### Indicator

For each (already weight-sorted) cross-reference row, render a compact 3-segment bar before the
citation:
- `strong` → 3 segments filled, `medium` → 2, `weak` → 1.
- Filled segments use a muted amber (`bg-amber-400/70` — a small fill, readable in both themes;
  `amber-400` is intentionally not remapped); empty segments use `bg-neutral-700`, which re-themes
  to a light gray under `[data-theme="light"]` via the neutral-scale remap. Each segment is a
  small fixed-size span; the group is `aria-hidden` (decorative).
- The row's existing `<button>` gets a `title` and an `sr-only` label conveying the strength +
  raw count, e.g. `"Strong cross-reference — 23 votes"`. When `weight == null`, the label omits
  the count (`"Weak cross-reference"`); this won't occur in the bundled corpus (all rows have a
  weight) but is handled defensively.

### Layout

The indicator sits at the start of the row, left of the `book chapter:verse` citation, vertically
aligned. The existing citation + verse text rendering and the `onJumpToVerse` click behavior are
unchanged. The list stays flat and in the backend's `weight DESC` order.

## Data flow

```
CrossRefsTab fetches getCrossRefs(verseId, "KJV", 20)  // already weight-sorted, weight included
  → for each ref: crossRefStrength(ref.weight) → 3-segment indicator + tooltip/sr-only label
  → click → onJumpToVerse (unchanged)
```

## Error handling

- `weight == null` → treated as `weak`, count omitted from the label. (Not expected in the bundled
  corpus.)
- Negative weights → `weak` (contested). Existing loading/error/empty states of `CrossRefsTab`
  are unchanged.

## Testing

- The project has **no frontend unit-test runner**, so the trivial `crossRefStrength` helper is
  kept inline and verified via the visual/e2e check rather than introducing a JS test harness.
- **E2E (WDIO):** open a verse known to have cross-references (e.g. via the reader → a verse with
  refs), open the Cross-refs tab, and assert a strength indicator element renders for at least one
  ref (`data-testid="crossref-strength"`). Mirror existing reader-interactions spec conventions.
- `npm run build` (tsc + vite) clean; full `npm run check` green; `npm run check:full` (e2e)
  before merge.

## Risks & mitigations

- **Threshold subjectivity** → thresholds are derived from the corpus distribution (median 3,
  p90 ≈ 11) and isolated in one helper, so they are easy to tune; documented inline.
- **Visual clutter** → a single compact 3-segment bar per row, muted colors, decorative
  (`aria-hidden`) with the meaning surfaced via tooltip + sr-only text; does not crowd the citation.
- **Accessibility** → strength is conveyed in text (title + sr-only), not color alone.

## Rollout

Single feature branch `crossref-weight`. No schema, backend, or shared-type changes — the change is
confined to `CrossRefsTab` in `VersePanel.tsx` plus one e2e spec. Verify with `npm run check:full`
before merge to `main`.
