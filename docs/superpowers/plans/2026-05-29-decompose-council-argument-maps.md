# Extract CouncilArgumentMaps from CouncilPanel.tsx Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Move `CouncilArgumentMaps` + `ArgumentNodeCard` + `buildFallbackArgumentMap` + `slugifyNodeId` out of `CouncilPanel.tsx` into `features/council/CouncilArgumentMaps.tsx`, verbatim, zero behavior change. Third CouncilPanel slice.

**Architecture:** Verbatim-sibling move (F8/F9 pattern). All four functions are exclusive and travel together; `formatPercent` stays shared in `councilTransparency` and is imported by the new module.

**Tech Stack:** React 19 + TypeScript.

**Spec:** `docs/superpowers/specs/2026-05-29-decompose-council-argument-maps-design.md`

**Verification:** `npm run build` + full `npm run check` + `npm run test:e2e:build` (council-mock renders the argument-maps section + exercises annotation persistence; flaky-cascade protocol applies). No new test.

---

## Task 1: Move the cluster, rewire CouncilPanel

**Files:** Create `app/src/features/council/CouncilArgumentMaps.tsx`; modify `app/src/features/council/CouncilPanel.tsx`.

- [ ] **Step 1: Capture verbatim** from `CouncilPanel.tsx`: `CouncilArgumentMaps` (988–1128), `ArgumentNodeCard` (1130–1180), `buildFallbackArgumentMap` (1182–1217), `slugifyNodeId` (1219–1225).

- [ ] **Step 2: Create `app/src/features/council/CouncilArgumentMaps.tsx`** with the imports from the spec's Design block: react `useEffect`/`useRef`/`useState`; from `lib/bible` the fns `listArgumentAnnotations`, `upsertArgumentAnnotation` + types `ArgumentAnnotation`, `ArgumentMap`, `ArgumentMapNode`, `CouncilPosition`, `CouncilResponse`; from `./councilTransparency` `formatPercent`. Then `export function CouncilArgumentMaps` (verbatim) and the other three as PRIVATE functions (verbatim). Confirm no reference to any other CouncilPanel identifier; if found, STOP and report. If tsc reports an import unused/missing, adjust ONLY the import set — never a body.

- [ ] **Step 3: Edit `CouncilPanel.tsx`:** delete all four functions (988–1225). Add `import { CouncilArgumentMaps } from "./CouncilArgumentMaps";`. From the `lib/bible` import block, REMOVE `listArgumentAnnotations`, `upsertArgumentAnnotation`, `type ArgumentMap`, `type ArgumentMapNode` (cluster-only). KEEP `type ArgumentAnnotation` (used at line 95), `CouncilPosition`, `CouncilResponse`, and the `formatPercent` import from councilTransparency (used at 855/1671/1677/1846/2145/2167/2175). Keep the `<CouncilArgumentMaps … />` call site (379–382) unchanged.

- [ ] **Step 4: Unused-symbol check.** Grep CouncilPanel.tsx: `listArgumentAnnotations`/`upsertArgumentAnnotation`/`ArgumentMap`/`ArgumentMapNode` → ZERO references (then the drops are correct). `ArgumentAnnotation` → still present (line 95 etc., import kept). `formatPercent` → still present (multiple). No remaining defs of the four moved functions.

- [ ] **Step 5: Build.** From `app/`: `npm run build` → tsc clean + vite build. Fix import sets and re-run until clean.

- [ ] **Step 6: Commit:**
```bash
git add app/src/features/council/CouncilArgumentMaps.tsx app/src/features/council/CouncilPanel.tsx
git commit -m "refactor(council): extract CouncilArgumentMaps from CouncilPanel"
```
(Do NOT `git add -A` — the unrelated `app/src-tauri/Cargo.toml` must stay uncommitted. Stage only the two files.)

---

## Task 2: Full gate + e2e + finish

- [ ] **Step 1: Full check gate.** From `app/`: `npm run check > /tmp/cam.log 2>&1; echo "NPM_EXIT=$?"; tail -n 8 /tmp/cam.log` → expect `NPM_EXIT=0`.
- [ ] **Step 2: E2E.** `npm run test:e2e:build` (from `app/`, ~10 min, 600000 ms timeout) → all specs pass. `council-mock.spec.ts` renders the argument-maps section (`data-testid="council-argument-maps"`). If failures are a contiguous block unrelated to council, re-run `npm run test:e2e` (no rebuild) to confirm green (known flaky cascade). INFRA failure → BLOCKED.
- [ ] **Step 3: Update spec status** → `Implemented`; commit `docs(refactor): mark decompose-council-argument-maps spec implemented`.
- [ ] **Step 4: Finish the branch** (finishing-a-development-branch): verify tests → merge to main.

---

## Self-Review (plan author)

- **Spec coverage:** 4 functions → new file (Step 2); CouncilPanel removes them, imports the component, drops the 4 dead symbols (Step 3); verbatim/no-behavior-change; build + full check + suite regression (Tasks 1/2) ✓.
- **Type/name consistency:** new module exports `CouncilArgumentMaps`, keeps the other three private; imports the exact symbols the bodies use; `formatPercent` stays shared (imported, not moved); `ArgumentAnnotation` kept in CouncilPanel; one-directional imports (no cycle); call site unchanged.
- **Exclusivity verified:** all four functions used only within the cluster / at the single call site (grounding); `listArgumentAnnotations`/`upsertArgumentAnnotation`/`ArgumentMap`/`ArgumentMapNode` have no non-cluster CouncilPanel uses.
- **Placeholder scan:** spec Design block lists the exact imports; `← verbatim` markers are copy instructions; exact commit command given.
