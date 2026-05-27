# Extract CommandPalette from App.tsx Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Move `CommandPalette` + its `CommandItem` type out of `App.tsx` into `features/app-shell/CommandPalette.tsx`, verbatim, zero behavior change.

**Architecture:** Same verbatim-move pattern as F1–F3. `CommandItem` type colocates with the component (App imports it).

**Tech Stack:** React 19 + TypeScript.

**Spec:** `docs/superpowers/specs/2026-05-26-decompose-command-palette-design.md`

**Verification:** `npm run build` + full `npm run check` + `npm run test:e2e:build` (full suite as regression; no palette-specific e2e). No new test.

---

## Task 1: Move CommandPalette + CommandItem

**Files:** Create `app/src/features/app-shell/CommandPalette.tsx`; modify `app/src/App.tsx`.

- [ ] **Step 1: Read** in `App.tsx`: the `type CommandItem = { … }` (lines ~92–97) and `function CommandPalette({ … }) { … }` (~1624 through its closing brace, ~1718). Capture verbatim.

- [ ] **Step 2: Create `app/src/features/app-shell/CommandPalette.tsx`:**
```tsx
import { useEffect, useRef, useState } from "react";

export type CommandItem = {
  id: string;
  label: string;
  detail: string;
  run: () => void;
};

// ← paste the exact CommandPalette function from App.tsx (add `export`)
export function CommandPalette({
  query,
  onQueryChange,
  items,
  onClose,
}: {
  query: string;
  onQueryChange: (value: string) => void;
  items: CommandItem[];
  onClose: () => void;
}) {
  // …verbatim body…
}
```
Confirm the body uses only its props + `useRef`/`useState`/`useEffect` + `CommandItem`. If it
references any other `App.tsx` identifier, STOP and report it.

- [ ] **Step 3: Edit `App.tsx`:** delete the `CommandItem` type (92–97) and the `CommandPalette`
function. Add near the other feature imports:
```tsx
import { CommandPalette, type CommandItem } from "./features/app-shell/CommandPalette";
```
Keep unchanged: `commandItems = useMemo<CommandItem[]>(…)`, `filteredCommandItems`, and the
`<CommandPalette … />` call site (~1511).

- [ ] **Step 4: Unused-symbol check.** `CommandItem` is still used in `App.tsx` (`commandItems: CommandItem[]`) → keep the `type CommandItem` in the import. Ensure no other now-unused imports.

- [ ] **Step 5: Build.** From `app/`: `npm run build` → tsc clean + vite build. Fix and re-run until clean.

- [ ] **Step 6: Commit:**
```bash
git add app/src/features/app-shell/CommandPalette.tsx app/src/App.tsx
git commit -m "refactor(app): extract CommandPalette + CommandItem from App.tsx"
```

---

## Task 2: Full gate + e2e + finish

- [ ] **Step 1: Full check gate.** From `app/`, capture the real exit: `npm run check > /tmp/cp.log 2>&1; echo "NPM_EXIT=$?"; tail -n 8 /tmp/cp.log` → expect `NPM_EXIT=0`.
- [ ] **Step 2: E2E.** `npm run test:e2e:build` (from `app/`, ~10 min, 600000 ms timeout) → all specs pass (full-suite regression). INFRA failure → BLOCKED.
- [ ] **Step 3: Update spec status** → `Implemented`; commit `docs(refactor): mark decompose-command-palette spec implemented`.
- [ ] **Step 4: Finish the branch** (finishing-a-development-branch): verify tests → merge to main.

---

## Self-Review (plan author)

- **Spec coverage:** `CommandItem` + `CommandPalette` → `features/app-shell/CommandPalette.tsx` (Task 1 Steps 2); App removes both + imports them (Step 3); verbatim/no-behavior-change; build + full check + suite regression (Tasks 1/2) ✓.
- **Type/name consistency:** new module exports `{ CommandPalette, CommandItem }` matching App's import; component prop shape unchanged; `CommandItem` still referenced in App via `commandItems: CommandItem[]`; one-directional import (no cycle).
- **Placeholder scan:** `← paste exact` is an explicit verbatim-copy instruction; exact import line + commands given.
