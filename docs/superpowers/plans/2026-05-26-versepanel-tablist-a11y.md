# VersePanel Tabs → ARIA Tablist Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the reader verse-detail tabs (Cross-refs / Highlight / Note) into a proper WAI-ARIA tablist with `role=tablist/tab/tabpanel`, `aria-selected`, roving tabindex, and Left/Right/Home/End arrow-key navigation.

**Architecture:** In `VersePanel.tsx`, add a `TABS` constant, group the three tabs in a `role="tablist"` with a keyboard handler (roving tabindex + automatic activation), refactor `TabButton` into a `forwardRef` `role="tab"` button, and wrap the (still conditionally-rendered) active content in one `role="tabpanel"`. Single-file frontend change; verified by an e2e in `reader-interactions.spec.ts`.

**Tech Stack:** React 19 + TypeScript, WebdriverIO + tauri-driver e2e.

**Spec:** `docs/superpowers/specs/2026-05-26-versepanel-tablist-a11y-design.md`

**Verification note:** No frontend unit runner; verified by `npm run build` (types — note the `forwardRef` generic + the aliased `ReactKeyboardEvent` import) and an e2e that opens the verse panel and drives the tablist with arrow/Home keys, asserting `aria-selected`, `aria-labelledby`, and `document.activeElement`.

---

## File Structure

- `app/src/features/reader/VersePanel.tsx` — **modify**; all six edits below. *(Task 1)*
- `app/tests/e2e/reader-interactions.spec.ts` — **modify**; one new `it` (already registered). *(Task 2)*

No backend/Rust/sidecar/type change.

---

## Task 1: ARIA tablist in `VersePanel.tsx`

**Files:**
- Modify: `app/src/features/reader/VersePanel.tsx`.

Make these six edits (READ the file first to confirm current line content; line numbers are approximate).

- [ ] **Step 1: Imports (line 1)**

Change:
```tsx
import { useEffect, useRef, useState } from "react";
```
to:
```tsx
import { forwardRef, useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
```

- [ ] **Step 2: Add the `TABS` constant**

After the existing `type Tab = "refs" | "highlight" | "note";` line (≈line 21), add:
```tsx

const TABS: { value: Tab; label: string }[] = [
  { value: "refs", label: "Cross-refs" },
  { value: "highlight", label: "Highlight" },
  { value: "note", label: "Note" },
];
```

- [ ] **Step 3: Add `tabRefs` + the keyboard handler inside `VersePanel`**

Find the line `const citation = \`${bookName} ${chapter}:${verse}\`;` (≈line 73). Immediately after it (before the first `useEffect`), add:
```tsx

  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const handleTabKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const current = TABS.findIndex((t) => t.value === tab);
    let next = current;
    if (event.key === "ArrowRight") next = (current + 1) % TABS.length;
    else if (event.key === "ArrowLeft") next = (current - 1 + TABS.length) % TABS.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = TABS.length - 1;
    else return;
    event.preventDefault();
    setTab(TABS[next].value);
    tabRefs.current[next]?.focus();
  };
```

- [ ] **Step 4: Replace the three `<TabButton>` lines with the tablist wrapper**

The current markup (≈lines 182–184):
```tsx
        <TabButton label="Cross-refs" active={tab === "refs"} onClick={() => setTab("refs")} />
        <TabButton label="Highlight" active={tab === "highlight"} onClick={() => setTab("highlight")} />
        <TabButton label="Note" active={tab === "note"} onClick={() => setTab("note")} />
```
Replace those three lines with:
```tsx
        <div role="tablist" aria-label="Verse details" className="flex gap-1" onKeyDown={handleTabKeyDown}>
          {TABS.map((t, index) => (
            <TabButton
              key={t.value}
              ref={(el) => {
                tabRefs.current[index] = el;
              }}
              label={t.label}
              value={t.value}
              active={tab === t.value}
              onClick={() => setTab(t.value)}
            />
          ))}
        </div>
```
(Leave the surrounding toolbar `<div className="flex flex-wrap gap-1 mb-3 border-b border-neutral-800">` and all the action controls after these lines unchanged — the tablist is now the first child of that toolbar.)

- [ ] **Step 5: Wrap the conditional content in a `role="tabpanel"`**

The current block (≈lines 260–268):
```tsx
      {tab === "refs" && <CrossRefsTab verseId={verseId} onJumpToVerse={onJumpToVerse} />}
      {tab === "highlight" && (
        <HighlightTab
          verseId={verseId}
          current={highlightColor}
          onChanged={onMutated}
        />
      )}
      {tab === "note" && <NoteTab verseId={verseId} onChanged={onMutated} />}
```
Replace it with:
```tsx
      <div
        role="tabpanel"
        id="verse-details-panel"
        aria-labelledby={`verse-tab-${tab}`}
        tabIndex={0}
        className="outline-none"
      >
        {tab === "refs" && <CrossRefsTab verseId={verseId} onJumpToVerse={onJumpToVerse} />}
        {tab === "highlight" && (
          <HighlightTab verseId={verseId} current={highlightColor} onChanged={onMutated} />
        )}
        {tab === "note" && <NoteTab verseId={verseId} onChanged={onMutated} />}
      </div>
```

- [ ] **Step 6: Refactor `TabButton` to a `forwardRef` `role="tab"`**

The current component (≈lines 335–358):
```tsx
function TabButton({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "px-3 py-1.5 text-xs border-b-2 transition-colors " +
        (active
          ? "border-amber-500 text-amber-200"
          : "border-transparent text-neutral-400 hover:text-neutral-200")
      }
    >
      {label}
    </button>
  );
}
```
Replace the whole function with:
```tsx
const TabButton = forwardRef<
  HTMLButtonElement,
  { label: string; value: Tab; active: boolean; onClick: () => void }
>(function TabButton({ label, value, active, onClick }, ref) {
  return (
    <button
      ref={ref}
      type="button"
      role="tab"
      id={`verse-tab-${value}`}
      aria-selected={active}
      aria-controls="verse-details-panel"
      tabIndex={active ? 0 : -1}
      onClick={onClick}
      className={
        "px-3 py-1.5 text-xs border-b-2 transition-colors " +
        (active
          ? "border-amber-500 text-amber-200"
          : "border-transparent text-neutral-400 hover:text-neutral-200")
      }
    >
      {label}
    </button>
  );
});
```

- [ ] **Step 7: Build**

Run (from `app/`): `npm run build`
Expected: `tsc` clean + `vite build` succeeds. (If `tsc` complains about the `forwardRef` generic or the `ReactKeyboardEvent` import, recheck Steps 1 and 6 verbatim.)

- [ ] **Step 8: Commit**

```bash
git add app/src/features/reader/VersePanel.tsx
git commit -m "feat(a11y): ARIA tablist + arrow-key nav for VersePanel tabs"
```

---

## Task 2: E2E — arrow-key tab navigation

**Files:**
- Modify: `app/tests/e2e/reader-interactions.spec.ts` — add the `it` below IMMEDIATELY AFTER the `it("opens the verse panel when a verse number is clicked", …)` test (ends ≈line 44), as the next test in the `describe`.

- [ ] **Step 1: Add the test**

It reuses the existing open sequence and the `clickVerseAction` helper already defined in the file:
```ts
  it("navigates VersePanel tabs with arrow keys (ARIA tablist)", async () => {
    const reader = await $("button=Reader");
    await reader.waitForClickable({ timeout: 10_000 });
    await reader.click();

    const jumpInput = await $('input[aria-label="Jump to reference"]');
    await jumpInput.waitForDisplayed({ timeout: 5_000 });
    await jumpInput.setValue("Genesis 1:1");
    await $("button=Go").click();
    const verseHeading = await $("h1*=Genesis");
    await verseHeading.waitForDisplayed({ timeout: 10_000 });

    await clickVerseAction('button[aria-label*="Verse"][aria-label*="actions"]');
    const panelHeader = await $("h3*=Verse");
    await panelHeader.waitForDisplayed({ timeout: 5_000 });

    // Tabs form an ARIA tablist; Cross-refs is selected by default.
    const tablist = await $('[role="tablist"]');
    await expect(tablist).toBeDisplayed();
    const refsTab = await $("#verse-tab-refs");
    const highlightTab = await $("#verse-tab-highlight");
    await expect(refsTab).toHaveAttribute("aria-selected", "true");

    // ArrowRight from the focused active tab moves selection + focus to Highlight.
    await browser.execute(() => document.getElementById("verse-tab-refs")?.focus());
    await browser.keys("ArrowRight");
    await expect(highlightTab).toHaveAttribute("aria-selected", "true");
    await expect(refsTab).toHaveAttribute("aria-selected", "false");
    const panel = await $("#verse-details-panel");
    await expect(panel).toHaveAttribute("aria-labelledby", "verse-tab-highlight");
    await browser.waitUntil(
      async () =>
        (await browser.execute(() => document.activeElement?.id ?? null)) === "verse-tab-highlight",
      { timeout: 5_000, timeoutMsg: "ArrowRight did not move focus to the Highlight tab" },
    );

    // Home returns to the first tab.
    await browser.keys("Home");
    await expect(refsTab).toHaveAttribute("aria-selected", "true");
    await browser.waitUntil(
      async () =>
        (await browser.execute(() => document.activeElement?.id ?? null)) === "verse-tab-refs",
      { timeout: 5_000, timeoutMsg: "Home did not move focus to the Cross-refs tab" },
    );

    // Close the panel.
    const closeBtn = await $('button[aria-label="Close verse panel"]');
    await closeBtn.click();
    await panelHeader.waitForDisplayed({ reverse: true, timeout: 3_000 });
  });
```

(If `toHaveAttribute` is unavailable in this WDIO version, use `await expect(refsTab).toHaveAttr("aria-selected", "true")` — but `toHaveAttribute` is the current matcher; try it first.)

- [ ] **Step 2: Run the e2e suite**

Run (from `app/`, allow ~10 min; set the command timeout to 600000 ms): `npm run test:e2e:build`
Expected: the new test passes AND all pre-existing specs pass — including the existing `"opens the verse panel when a verse number is clicked"` test, which still finds `button=Cross-refs`/`Highlight`/`Note` (the tabs remain text-bearing `<button>`s). If the aria-selected/focus assertions fail but the app behaves correctly when you inspect, recheck Task 1 Steps 4/6; do not weaken assertions for an app bug. INFRA failures → report BLOCKED.

- [ ] **Step 3: Commit**

```bash
git add app/tests/e2e/reader-interactions.spec.ts
git commit -m "test(a11y): e2e for VersePanel tablist arrow-key navigation"
```

---

## Task 3: Full gate + finish

- [ ] **Step 1: Full check gate**

Run (from `app/`): `npm run check`
Expected: exit 0 (TS build, cargo fmt/check/test, clippy, all `node --check`, sidecar tests — Rust/sidecar unchanged).

- [ ] **Step 2: Update spec status**

In `docs/superpowers/specs/2026-05-26-versepanel-tablist-a11y-design.md`, change `Status:` from `Draft` to `Implemented`. Commit:
```bash
git add docs/superpowers/specs/2026-05-26-versepanel-tablist-a11y-design.md
git commit -m "docs(a11y): mark VersePanel tablist spec implemented"
```

- [ ] **Step 3: Finish the branch** via the finishing-a-development-branch workflow (verify tests → present merge/PR options).

---

## Self-Review (completed by plan author)

- **Spec coverage:** tablist/tab/tabpanel + aria-selected/aria-controls/aria-labelledby (Steps 4/5/6) ✓; roving tabindex (`tabIndex={active ? 0 : -1}`, Step 6) ✓; Left/Right wrap + Home/End + automatic activation (Step 3 handler) ✓; no visual change / conditional panel mounting preserved (Step 5 keeps the `tab === …` guards) ✓; e2e drives arrows + asserts aria + focus (Task 2) ✓; build + check (Tasks 1/3) ✓.
- **Type consistency:** `TABS` is `{ value: Tab; label: string }[]`; `TabButton` now takes `value: Tab` and is `forwardRef<HTMLButtonElement, …>`; the tablist `ref={(el) => { tabRefs.current[index] = el; }}` matches `tabRefs: useRef<(HTMLButtonElement | null)[]>`; `handleTabKeyDown` is typed `ReactKeyboardEvent<HTMLDivElement>` (aliased import, Step 1) and bound to the `<div role="tablist">` `onKeyDown`; ids `verse-tab-${value}` / `verse-details-panel` match between tab `id`/`aria-controls`, panel `id`/`aria-labelledby`, and the e2e selectors.
- **Placeholder scan:** every step has complete code + exact commands; the `toHaveAttribute`/`toHaveAttr` note is a concrete fallback, not a placeholder.
