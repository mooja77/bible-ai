# Extract InterleavedReader from App.tsx Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Move `InterleavedReader` + the shared `ReaderLayout`/`ReaderDensity` types out of `App.tsx` into `features/reader/`, verbatim, zero behavior change.

**Architecture:** Same verbatim-move pattern as F1/F2. Reader-layout types → `features/reader/types.ts`; `InterleavedReader` → `features/reader/InterleavedReader.tsx`. `App.tsx` imports both and removes the local definitions.

**Tech Stack:** React 19 + TypeScript.

**Spec:** `docs/superpowers/specs/2026-05-26-decompose-interleaved-reader-design.md`

**Verification:** `npm run build` + `npm run test:e2e:build` (the interleaved-layout smoke test) + full `npm run check`. No new test.

---

## Task 1: Move InterleavedReader + reader types

**Files:** Create `app/src/features/reader/types.ts` + `app/src/features/reader/InterleavedReader.tsx`; modify `app/src/App.tsx`.

- [ ] **Step 1: Read the source ranges** in `App.tsx`:
  - `type ReaderLayout = "columns" | "interleaved";` and `type ReaderDensity = "comfortable" | "compact";` (lines 90–91).
  - `function InterleavedReader({ … }) { … }` (~1531 through its closing brace, ~1661).

- [ ] **Step 2: Create `app/src/features/reader/types.ts`:**
```ts
export type ReaderLayout = "columns" | "interleaved";
export type ReaderDensity = "comfortable" | "compact";
```

- [ ] **Step 3: Create `app/src/features/reader/InterleavedReader.tsx`** with the component moved VERBATIM (add `export`), and imports:
```tsx
import type { Translation, Verse } from "../../lib/bible";
import type { ReaderDensity } from "./types";

export function InterleavedReader({
  // …verbatim props…
}: {
  // …verbatim prop types…
}) {
  // …verbatim body…
}
```
Confirm the body uses no React hooks (no `react` import needed) and references only its props +
`Translation`/`Verse` fields + `ReaderDensity`. If it uses any other `App.tsx` identifier, STOP and
report it.

- [ ] **Step 4: Edit `App.tsx`:** delete the `ReaderLayout` + `ReaderDensity` type defs (90–91) and
the `InterleavedReader` function. Add imports near the other feature imports:
```tsx
import { InterleavedReader } from "./features/reader/InterleavedReader";
import type { ReaderLayout, ReaderDensity } from "./features/reader/types";
```
Keep unchanged: the `<InterleavedReader … />` call site (~1429) and all `ReaderLayout`/`ReaderDensity`
uses in `App()` (`readerLayout`/`readerDensity` state, `setReaderLayoutSetting`/`setReaderDensitySetting`,
the `as ReaderLayout`/`as ReaderDensity` casts, the load defaults).

- [ ] **Step 5: Unused-symbol check.** After removal, ensure no now-unused imports remain in `App.tsx`
(the build flags them).

- [ ] **Step 6: Build.** From `app/`: `npm run build` → tsc clean + vite build. Fix and re-run until clean.

- [ ] **Step 7: Commit:**
```bash
git add app/src/features/reader/types.ts app/src/features/reader/InterleavedReader.tsx app/src/App.tsx
git commit -m "refactor(app): extract InterleavedReader + reader-layout types from App.tsx"
```

---

## Task 2: Full gate + e2e + finish

- [ ] **Step 1: Full check gate.** From `app/`, capture the real exit: `npm run check > /tmp/il.log 2>&1; echo "NPM_EXIT=$?"; tail -n 8 /tmp/il.log` → expect `NPM_EXIT=0`.
- [ ] **Step 2: E2E.** `npm run test:e2e:build` (from `app/`, ~10 min, 600000 ms timeout) → all specs pass, especially `smoke.spec.ts` *"switches to interleaved compact layout for parallel translations"* (renders `InterleavedReader`). INFRA failure → BLOCKED.
- [ ] **Step 3: Update spec status** → `Implemented`; commit `docs(refactor): mark decompose-interleaved-reader spec implemented`.
- [ ] **Step 4: Finish the branch** (finishing-a-development-branch): verify tests → merge to main.

---

## Self-Review (plan author)

- **Spec coverage:** reader types → `features/reader/types.ts` (Task 1 Step 2); `InterleavedReader` → `features/reader/InterleavedReader.tsx` (Step 3); App removes both + imports them (Step 4); verbatim/no-behavior-change ("paste exact"); build + interleaved e2e (Tasks 1/2) ✓.
- **Type/name consistency:** new module exports match App imports (`{ InterleavedReader }`, `type { ReaderLayout, ReaderDensity }`); component prop shape unchanged; `InterleavedReader` imports only `ReaderDensity`; one-directional imports (no cycle).
- **Placeholder scan:** `← verbatim` markers are explicit verbatim-copy instructions (byte-identical move of a ~130-line component), not vague placeholders; exact import lines + commands given.
