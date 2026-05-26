# Council History Keyboard-Reveal Delete Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Reveal the `CouncilHistory` row delete button on keyboard focus (not just mouse hover), via `group-focus-within:opacity-100`.

**Architecture:** One className change in `CouncilHistory.tsx` + a keyboard-reveal assertion added to the existing `council-mock` e2e. No behavior change beyond the focus-reveal.

**Tech Stack:** React 19 + TypeScript, Tailwind v4, WebdriverIO e2e.

**Spec:** `docs/superpowers/specs/2026-05-26-council-history-focus-a11y-design.md`

**Verification:** `npm run build` + full `npm run check` + `npm run test:e2e:build` (the augmented council-mock test proves the keyboard reveal).

---

## Task 1: `group-focus-within` reveal in `CouncilHistory.tsx`

- [ ] **Step 1:** In `app/src/features/council/CouncilHistory.tsx`, the delete button className is:
```
"opacity-0 group-hover:opacity-100 text-neutral-500 hover:text-red-400 text-sm px-1 transition-opacity"
```
Change it to add `group-focus-within:opacity-100`:
```
"opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 text-neutral-500 hover:text-red-400 text-sm px-1 transition-opacity"
```

- [ ] **Step 2:** `npm run build` → expect tsc clean + vite build success.

- [ ] **Step 3:** Commit:
```bash
git add app/src/features/council/CouncilHistory.tsx
git commit -m "fix(a11y): reveal Council history delete on keyboard focus"
```

---

## Task 2: Keyboard-reveal e2e assertion

- [ ] **Step 1:** In `app/tests/e2e/council-mock.spec.ts`, test *"submits, renders, persists, restores, and deletes a Council session"*, the delete locator is defined as:
```ts
    const deleteButton = await $(
      `//button[@title="${question}"]/following-sibling::button[@aria-label="Delete session"]`,
    );
```
Immediately AFTER that `deleteButton` definition and BEFORE the existing `await scrollIntoView(restoredSessionRow);` line, insert:
```ts
    // Keyboard users reveal the delete affordance via focus-within, not just hover.
    await browser.execute((title) => {
      document.querySelector<HTMLElement>(`button[title="${title}"]`)?.focus();
    }, question);
    await browser.waitUntil(
      async () => (await deleteButton.getCSSProperty("opacity")).value === "1",
      { timeout: 5_000, timeoutMsg: "delete affordance not revealed on keyboard focus" },
    );
```
(The existing mouse hover + click delete steps remain unchanged after this, preserving mouse-path coverage.)

- [ ] **Step 2:** `npm run test:e2e:build` (from `app/`, ~10 min, 600000 ms timeout). Expect all specs pass including the augmented council-mock test. If `getCSSProperty("opacity").value` returns a non-`"1"` settled value (e.g. transition not complete), the `waitUntil` covers it; if it genuinely never reaches 1, recheck Task 1. INFRA failure → BLOCKED.

- [ ] **Step 3:** Commit:
```bash
git add app/tests/e2e/council-mock.spec.ts
git commit -m "test(a11y): council history delete revealed on keyboard focus"
```

---

## Task 3: Gate + finish

- [ ] **Step 1:** `npm run check` → exit 0.
- [ ] **Step 2:** Set the spec `Status:` to `Implemented`; commit `docs(a11y): mark council-history-focus spec implemented`.
- [ ] **Step 3:** Finish the branch (finishing-a-development-branch): verify tests → merge to main.

---

## Self-Review (plan author)

- **Spec coverage:** `group-focus-within:opacity-100` added (Task 1) ✓; keyboard-reveal e2e in the existing persisted-session test (Task 2) ✓; no other change ✓; build/check/e2e (Tasks 1–3) ✓.
- **Type/selector consistency:** `deleteButton` is the locator already defined in the test; `button[title="${question}"]` matches `CouncilHistory`'s select button (`title={session.question}`); `getCSSProperty("opacity").value` is the WDIO computed-style API returning a string like `"1"`.
- **Placeholder scan:** complete code + commands; no placeholders.
