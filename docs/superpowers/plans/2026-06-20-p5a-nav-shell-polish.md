# P5a — Navigation & Shell Polish — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the left navigation feel modern and calm — each mode gets a clean line icon beside its label, with a refined active/hover treatment using the design tokens — without changing any labels, routes, or accessible names (so the whole e2e suite, which selects `button=Reader` etc., keeps passing).

**Architecture:** Add a small presentational `ModeIcon` (inline SVGs, `currentColor` so they inherit the button's text color and re-theme automatically). Extend `ModeButton` with an optional `icon` prop rendered before the label; the label stays the visible/accessible text. `App.tsx` passes an icon per mode. Pure additive UI; no logic, routing, or data changes.

**Tech Stack:** React 19 + TS, Tailwind v4 + P2 tokens, inline SVG, WebdriverIO e2e.

**Spec:** `docs/superpowers/specs/2026-06-20-ui-ux-overhaul-design.md` §8 ("a slim, quiet persistent rail"). This is the first slice of P5; reader / search / settings / onboarding polish are separate follow-on slices.

**Hard constraint (regression):** `ModeButton` text content must remain exactly the label (`Reader`, `Council`, `Theology`, `Resources`, `Workspaces`, `Tags`, `Settings`). The SVG icon must be `aria-hidden` and contribute no text, so WebdriverIO's exact-text selector `$("button=Reader")` (used across smoke/council/reader/settings specs) still matches. Must also pass `layout-maxscale` (140%) and `contrast-light` (WCAG AA).

---

## File Structure

- `app/src/features/app-shell/ModeIcon.tsx` — **create**; one inline SVG per mode, `currentColor`, `aria-hidden`.
- `app/src/features/app-shell/ModeButton.tsx` — add optional `icon` prop + refined styling.
- `app/src/App.tsx` — pass `<ModeIcon mode="…" />` to each nav `ModeButton`.
- `app/tests/e2e/nav-shell.spec.ts` — **create**; nav still navigates + icons render + labels intact.

---

## Task 1: `ModeIcon` component

**Files:** Create `app/src/features/app-shell/ModeIcon.tsx`

- [ ] **Step 1: Implement.** Create the file with exactly:

```tsx
import type { Mode } from "../../lib/mode";

/** Small line icons for the main-nav modes. `currentColor` makes them inherit
 *  the ModeButton's text color (active/hover re-theme for free). aria-hidden —
 *  the button's text label remains the accessible name. */
export function ModeIcon({ mode }: { mode: Mode }) {
  const common = {
    width: 16,
    height: 16,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
    className: "flex-none",
  };
  switch (mode) {
    case "reader":
      return (
        <svg {...common}>
          <path d="M12 6.5C10.5 5.3 8.5 4.8 4 5v13c4.5-.2 6.5.3 8 1.5 1.5-1.2 3.5-1.7 8-1.5V5c-4.5-.2-6.5.3-8 1.5z" />
          <path d="M12 6.5v13" />
        </svg>
      );
    case "council":
      return (
        <svg {...common}>
          <path d="M12 3v18" />
          <path d="M5 7h14" />
          <path d="M5 7l-2.5 6a3 3 0 0 0 5 0L5 7z" />
          <path d="M19 7l-2.5 6a3 3 0 0 0 5 0L19 7z" />
        </svg>
      );
    case "theology":
      return (
        <svg {...common}>
          <path d="M3 9l9-5 9 5" />
          <path d="M5 9v8M10 9v8M14 9v8M19 9v8" />
          <path d="M3 20h18" />
        </svg>
      );
    case "resources":
      return (
        <svg {...common}>
          <path d="M12 3l9 5-9 5-9-5 9-5z" />
          <path d="M3 13l9 5 9-5" />
        </svg>
      );
    case "workspaces":
      return (
        <svg {...common}>
          <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z" />
        </svg>
      );
    case "tags":
      return (
        <svg {...common}>
          <path d="M4 4h7l9 9-7 7-9-9V4z" />
          <circle cx="8.5" cy="8.5" r="1.2" />
        </svg>
      );
    case "settings":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="3" />
          <path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M19.1 4.9L17 7M7 17l-2.1 2.1" />
        </svg>
      );
    default:
      return null;
  }
}
```

- [ ] **Step 2: Verify the `Mode` type.** Confirm `app/src/lib/mode.ts` exports a `Mode` union that includes `"reader" | "council" | "theology" | "resources" | "workspaces" | "tags" | "settings"`. Run `cd "C:/JM Programs/BibleApp/app" && npm run build` — expect PASS. If `Mode` has additional members, the `default: return null` arm covers them; if any of the seven is named differently, adjust the `case` labels to match the real union and report.

- [ ] **Step 3: Commit.**
```bash
cd "C:/JM Programs/BibleApp" && git add app/src/features/app-shell/ModeIcon.tsx && git commit -m "feat(shell): ModeIcon line icons for the main nav"
```

---

## Task 2: `ModeButton` icon support + refined styling

**Files:** Modify `app/src/features/app-shell/ModeButton.tsx`

- [ ] **Step 1: Implement.** Replace the entire contents of `app/src/features/app-shell/ModeButton.tsx` with:

```tsx
import type { ReactNode } from "react";

export function ModeButton({
  active,
  onClick,
  label,
  icon,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  icon?: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className={
        "w-full flex items-center gap-2.5 text-left text-sm px-3 py-2 rounded-md transition-colors " +
        (active
          ? "bg-amber-500/15 text-amber-100 font-medium shadow-sm"
          : "text-neutral-400 hover:bg-neutral-800 hover:text-neutral-200")
      }
    >
      {icon ? <span className="flex-none opacity-90">{icon}</span> : null}
      <span>{label}</span>
    </button>
  );
}
```

Notes: the visible/accessible text is still exactly `label` (the icon span has no text). `aria-current="page"` improves a11y for the active item. The flex layout keeps icon + label aligned; `gap-2.5` is modest so it won't overflow at 140%.

- [ ] **Step 2: Verify.** Run: `cd "C:/JM Programs/BibleApp/app" && npm run build`
Expected: PASS (the new optional `icon` prop is backward-compatible; existing call sites without `icon` still compile).

- [ ] **Step 3: Commit.**
```bash
cd "C:/JM Programs/BibleApp" && git add app/src/features/app-shell/ModeButton.tsx && git commit -m "feat(shell): ModeButton icon slot + aria-current"
```

---

## Task 3: Wire icons into the nav

**Files:** Modify `app/src/App.tsx`

- [ ] **Step 1: Import `ModeIcon`.** Near the other app-shell imports (around line 72–74, by `ModeButton`), add:
```ts
import { ModeIcon } from "./features/app-shell/ModeIcon";
```

- [ ] **Step 2: Pass an icon to each nav `ModeButton`.** In the `<nav aria-label="Main navigation">` block (~969–1005), add an `icon` prop to each of the seven `ModeButton`s, matching the mode. For example:
```tsx
            <ModeButton
              active={mode === "reader"}
              onClick={() => selectMode("reader")}
              label="Reader"
              icon={<ModeIcon mode="reader" />}
            />
```
Do this for all seven: `reader`, `council`, `theology`, `resources`, `workspaces`, `tags`, `settings` — each `icon={<ModeIcon mode="<that mode>" />}`. Leave `active`, `onClick`, `label` exactly as they are.

- [ ] **Step 3: Verify.** Run: `cd "C:/JM Programs/BibleApp/app" && npm run build`
Expected: PASS. No other call sites of `ModeButton` exist (it's nav-only) — confirm with `grep -rn "ModeButton" src/`.

- [ ] **Step 4: Commit.**
```bash
cd "C:/JM Programs/BibleApp" && git add app/src/App.tsx && git commit -m "feat(shell): main nav shows mode icons"
```

---

## Task 4: e2e — nav still works, icons render, labels intact

**Files:** Create `app/tests/e2e/nav-shell.spec.ts`; register in `app/wdio.conf.mts`

- [ ] **Step 1: Create `app/tests/e2e/nav-shell.spec.ts`:**
```ts
import { $, expect } from "@wdio/globals";

/**
 * The main nav: icons are decorative additions; labels and navigation must be
 * unchanged. Selecting by exact button text must still work (the whole suite
 * relies on it), and each nav button must carry an aria-hidden icon.
 */
describe("Navigation shell", () => {
  it("navigates by label and shows decorative mode icons", async () => {
    // Exact-text selectors must still resolve (icons add no text).
    const council = await $("button=Council");
    await council.waitForClickable({ timeout: 15_000 });
    await council.click();
    await (await $("h1=The Council")).waitForDisplayed({ timeout: 10_000 });

    const reader = await $("button=Reader");
    await reader.waitForClickable({ timeout: 10_000 });
    await reader.click();

    // The Council nav button carries an aria-hidden svg icon.
    const councilBtn = await $("button=Council");
    const icon = await councilBtn.$("svg[aria-hidden='true']");
    expect(await icon.isExisting()).toBe(true);

    // The button's accessible text is still exactly "Council".
    expect((await councilBtn.getText()).trim()).toBe("Council");
  });
});
```

- [ ] **Step 2: Register.** Append `"./tests/e2e/nav-shell.spec.ts"` to the `specs` array in `app/wdio.conf.mts` (last entry).

- [ ] **Step 3: Commit.**
```bash
cd "C:/JM Programs/BibleApp" && git add app/tests/e2e/nav-shell.spec.ts app/wdio.conf.mts && git commit -m "test(shell): nav navigates by label + renders mode icons"
```

---

## Task 5: Build, run e2e, full check (controller-driven)

- [ ] **Step 1: Build + stage.** `cd "C:/JM Programs/BibleApp/app" && npx tauri build --debug --no-bundle && node scripts/stage-debug-resources.mjs`
- [ ] **Step 2: Run the new + regression specs.** `cd "C:/JM Programs/BibleApp/app" && npx wdio run wdio.conf.mts --spec tests/e2e/nav-shell.spec.ts --spec tests/e2e/smoke.spec.ts --spec tests/e2e/layout-maxscale.spec.ts --spec tests/e2e/contrast-light.spec.ts --spec tests/e2e/council-mock.spec.ts` — expect all passing. (First-`button=Council`-click load flake → re-run once; only a deterministic isolated failure is real. msedgedriver/Edge mismatch → matching driver per memory.)
- [ ] **Step 3: Full check.** `cd "C:/JM Programs/BibleApp/app" && npm run check` — expect exit 0.
- [ ] **Step 4: Commit fixups.** `cd "C:/JM Programs/BibleApp" && git add -A && git commit -m "chore: P5a nav polish — checks green" || echo "nothing to commit"`

---

## Self-Review

- **Spec coverage (§8 slim quiet nav):** icons + refined active/hover → Tasks 1–3; labels/routes unchanged → constraint honored (icon is aria-hidden, text = label); `aria-current` adds a11y.
- **Placeholder scan:** none — complete code; commands + expected results given.
- **Type consistency:** `ModeIcon` takes `{ mode: Mode }` (from `lib/mode`); `ModeButton` gains optional `icon?: ReactNode`; App passes `<ModeIcon mode="…" />`. The seven `case` labels must match the real `Mode` union (Task 1 Step 2 verifies).
- **Regression control:** exact-text nav selectors preserved (new `nav-shell` spec asserts `getText() === "Council"` and the svg is aria-hidden); layout-maxscale + contrast-light run in Task 5; `ModeButton` is nav-only (no other call sites).
- **Environment risk:** Task 5 needs the debug build + msedgedriver matching Edge.
- **Scope:** this is P5 *slice 1* (nav/shell). Reader, search, settings, and onboarding polish are deliberately separate follow-on slices to keep each change small and the e2e regression surface contained.
