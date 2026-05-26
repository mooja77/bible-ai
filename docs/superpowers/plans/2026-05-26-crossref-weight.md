# Cross-Reference Weight Ranking Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make each cross-reference's relevance weight legible in the reader's Cross-refs tab via a compact per-row strength indicator.

**Architecture:** Pure frontend display change in `CrossRefsTab` (`VersePanel.tsx`). The list is already `weight DESC`-sorted by the backend and `CrossRef.weight` is already on the frontend, so we only add three small pure helpers (strength bucket / segment count / a11y label) and a 3-segment indicator per row. No backend, shared-type, or schema changes.

**Tech Stack:** React 19 + TypeScript, Tailwind v4, WebdriverIO e2e.

**Spec:** `docs/superpowers/specs/2026-05-26-crossref-weight-design.md`

**Verification note:** No frontend unit-test runner exists, so the trivial helpers stay inline and are verified by `npm run build` (tsc) + a small e2e assertion (Task 2). No JS test harness is added.

---

## File Structure

- `app/src/features/reader/VersePanel.tsx` — add module-scope helpers + the indicator inside `CrossRefsTab`. *(Task 1)*
- `app/tests/e2e/crossref-weight.spec.ts` — **new** e2e asserting the indicator renders; registered in `app/wdio.conf.mts`. *(Task 2)*

No other files change.

---

## Task 1: Strength helpers + indicator in `CrossRefsTab`

**Files:**
- Modify: `app/src/features/reader/VersePanel.tsx` (add helpers at module scope near `CrossRefsTab` ~line 360; modify the `refs.map(...)` `<button>` render ~lines 393–410).

- [ ] **Step 1: Add the pure helpers**

Add at module scope in `VersePanel.tsx`, just above `function CrossRefsTab(` (~line 360):

```tsx
type CrossRefStrength = "strong" | "medium" | "weak";

// Global thresholds from the corpus weight distribution (median 3, p90 ≈ 11);
// negatives are contested → weak. Tunable in one place.
function crossRefStrength(weight: number | null): CrossRefStrength {
  if (weight == null || weight <= 3) return "weak";
  if (weight >= 10) return "strong";
  return "medium";
}

function crossRefStrengthLevel(weight: number | null): number {
  const s = crossRefStrength(weight);
  return s === "strong" ? 3 : s === "medium" ? 2 : 1;
}

function crossRefStrengthLabel(weight: number | null): string {
  const s = crossRefStrength(weight);
  const word = s.charAt(0).toUpperCase() + s.slice(1);
  return weight == null
    ? `${word} cross-reference`
    : `${word} cross-reference — ${weight} vote${weight === 1 ? "" : "s"}`;
}
```

- [ ] **Step 2: Render the indicator in each row**

In `CrossRefsTab`'s return, the current row button is:

```tsx
          <button
            type="button"
            onClick={() => onJumpToVerse(r.to_verse_id, "KJV")}
            className="w-full text-left text-sm hover:bg-neutral-900/60 rounded px-2 py-1 transition-colors"
          >
            <span className="font-mono text-xs text-amber-300 mr-2">
              {r.book_name} {r.chapter}:{r.verse}
            </span>
            <span
              className="text-neutral-300"
              style={{ fontFamily: "var(--font-serif)" }}
            >
              {r.text || "(verse not in this translation)"}
            </span>
          </button>
```

Replace it with (adds `title`, an `sr-only` label, and the decorative 3-segment meter; keeps the inline citation+text flow unchanged):

```tsx
          <button
            type="button"
            onClick={() => onJumpToVerse(r.to_verse_id, "KJV")}
            title={crossRefStrengthLabel(r.weight)}
            className="w-full text-left text-sm hover:bg-neutral-900/60 rounded px-2 py-1 transition-colors"
          >
            <span className="sr-only">{crossRefStrengthLabel(r.weight)}</span>
            <span
              aria-hidden="true"
              data-testid="crossref-strength"
              className="inline-flex items-center gap-0.5 mr-2 align-middle"
            >
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className={
                    "inline-block w-1 h-3 rounded-sm " +
                    (i < crossRefStrengthLevel(r.weight)
                      ? "bg-amber-400/70"
                      : "bg-neutral-700")
                  }
                />
              ))}
            </span>
            <span className="font-mono text-xs text-amber-300 mr-2">
              {r.book_name} {r.chapter}:{r.verse}
            </span>
            <span
              className="text-neutral-300"
              style={{ fontFamily: "var(--font-serif)" }}
            >
              {r.text || "(verse not in this translation)"}
            </span>
          </button>
```

(Only the `<button>` inner content changes; the surrounding `<li key=...>` and `<ul>` are unchanged.)

- [ ] **Step 3: Build to verify**

Run (from `app/`): `npm run build`
Expected: `tsc` clean (no errors) + `vite build` succeeds.

- [ ] **Step 4: Commit**

```bash
git add app/src/features/reader/VersePanel.tsx
git commit -m "feat(reader): show cross-reference strength in the Cross-refs tab"
```

---

## Task 2: E2E — indicator renders for a cross-referenced verse

**Files:**
- Create: `app/tests/e2e/crossref-weight.spec.ts`
- Modify: `app/wdio.conf.mts` (add the spec to the `specs` array, before `release-readiness.spec.ts`).

Context: the verse panel opens via the verse's actions button, and the **Cross-refs tab is the default tab** (`VersePanel` initial `tab = "refs"`), so opening a verse panel shows cross-references immediately. Pick a heavily cross-referenced verse (Genesis 1:1). FIRST read `app/tests/e2e/notes-search.spec.ts` and `app/tests/e2e/reader-interactions.spec.ts` to copy EXACTLY how they reach the reader, dismiss the tour, navigate to Genesis 1:1 (jump-to-reference input + Go), open a verse's actions panel (`button[aria-label="Verse 1 actions"]`), and any waits/conventions. Reuse their selectors.

- [ ] **Step 1: Write the spec**

```ts
import { browser, $, expect } from "@wdio/globals";

describe("Cross-reference strength", () => {
  it("shows a strength indicator for each cross-reference", async () => {
    // (reuse the existing specs' steps to reach the reader, dismiss the tour,
    //  navigate to Genesis 1:1, and open Verse 1's actions panel — the
    //  Cross-refs tab is the default tab.)
    // ... open Genesis 1:1 verse panel ...

    // The default Cross-refs tab lists refs; each carries a strength indicator.
    const strength = await $('[data-testid="crossref-strength"]');
    await strength.waitForDisplayed({ timeout: 15000 });
  });
});
```

Fill the elided setup by mirroring `notes-search.spec.ts` (which already navigates to Genesis 1:1 and opens `button[aria-label="Verse 1 actions"]`). If Genesis 1:1 happens to have no cross-references in the corpus, switch to another well-known verse (e.g. navigate to John 3:16 and open `button[aria-label="Verse 16 actions"]`). Keep waits consistent with the other specs.

- [ ] **Step 2: Register + run**

Add `"./tests/e2e/crossref-weight.spec.ts"` to the `specs` array in `app/wdio.conf.mts` (before `release-readiness.spec.ts`). Run (from `app/`, allow ~10 min; set the command timeout to 600000 ms): `npm run test:e2e:build`
Expected: the new spec passes and all pre-existing specs still pass. If it fails for INFRA reasons (driver/build), report BLOCKED with details; if Genesis 1:1 lacks refs, switch verses and re-run.

- [ ] **Step 3: Commit**

```bash
git add app/tests/e2e/crossref-weight.spec.ts app/wdio.conf.mts
git commit -m "test(reader): e2e for cross-reference strength indicator"
```

---

## Task 3: Full gate + finish

- [ ] **Step 1: Full check gate**

Run (from `app/`): `npm run check`
Expected: exit 0 (TS build, cargo fmt/check/test, clippy `-D warnings`, sidecar tests — Rust is unchanged so this is mostly the TS build + the unchanged suite).

- [ ] **Step 2: Manual smoke (optional)**

Launch the app, open a verse with cross-references (e.g. Genesis 1:1), and confirm each cross-reference shows a 1–3 segment strength meter, strongest-first, with a tooltip showing the vote count; confirm it reads sensibly in both light and dark themes.

- [ ] **Step 3: Update spec status**

In `docs/superpowers/specs/2026-05-26-crossref-weight-design.md`, set `Status:` to `Implemented`. Commit:
```bash
git add docs/superpowers/specs/2026-05-26-crossref-weight-design.md
git commit -m "docs(reader): mark cross-reference-weight spec implemented"
```

- [ ] **Step 4: Finish the branch** via the finishing-a-development-branch workflow (verify tests → present merge/PR options).

---

## Self-Review (completed by plan author)

- **Spec coverage:** legible per-row strength (Task 1 indicator) ✓; raw signal on demand (Task 1 `title` + `sr-only` with vote count) ✓; honest global thresholds weak ≤3 / medium 4–9 / strong ≥10 (Task 1 `crossRefStrength`) ✓; no backend/type/schema change (only `VersePanel.tsx` + an e2e spec) ✓; accessibility via text not color alone (Task 1 `sr-only` + `title`, meter `aria-hidden`) ✓; testing via build + e2e, helper inline (Tasks 1–2, no JS runner added) ✓; non-goals respected (no relative bar, no grouping, no filtering, list order unchanged) ✓.
- **Type consistency:** `crossRefStrength`/`crossRefStrengthLevel`/`crossRefStrengthLabel` all take `(weight: number | null)`, matching `CrossRef.weight: number | null` from `bible.ts`; `CrossRefStrength` union `"strong"|"medium"|"weak"` used consistently; the e2e selector `[data-testid="crossref-strength"]` matches the indicator span in Task 1.
- **Placeholder scan:** Task 1 has complete code; Task 2's setup is intentionally "mirror the existing reader spec" (the only honest way to match the real tour/navigation helpers) with an explicit verse fallback — no vague code steps.
