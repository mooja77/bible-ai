# Decompose God-Components F4 — Extract CommandPalette from App.tsx — Design

- **Date:** 2026-05-26
- **Status:** Implemented (branch `decompose-command-palette`)
- **Theme:** F — Decompose god-components, sub-project 4
- **Owner:** John Moore

## Problem

`App.tsx` is ~1,718 lines (after F1–F3). The last clean self-contained sibling is the
**`CommandPalette`** (Ctrl+K palette, ~1624–~1718, ~95 lines). Prop-driven; extracting it (with its
`CommandItem` type) into `features/app-shell/` shrinks `App.tsx` by ~95 lines with zero behavior
change. Completes the easy App.tsx sibling extractions; the remaining F work (App() body hooks,
CouncilPanel) is riskier and separate.

## Goals

1. Move `CommandPalette` + its `CommandItem` type out of `App.tsx` into `features/app-shell/CommandPalette.tsx`, verbatim, zero behavior change.
2. `App.tsx` compiles and behaves identically.

## Non-goals (YAGNI)

- No change to `CommandPalette`'s markup/props/behavior — verbatim.
- No new Ctrl+K e2e (it's a pure move; the guarantee is verbatim + tsc + the full suite as
  regression — see Testing). A dedicated palette e2e is a separate, optional follow-up.
- No refactor of the `App()` body (it still builds `commandItems`/`filteredCommandItems`).

## Boundary analysis (from grounding)

- `CommandPalette` props: `query, onQueryChange, items (CommandItem[]), onClose`. Internal: `useRef`
  (input focus), `useState` (selectedIndex), two `useEffect`. References only its props + hooks +
  `CommandItem`. No App helpers/components.
- `CommandItem` type (`{ id, label, detail, run: () => void }`, App.tsx 92–97): used by `App()`
  (`commandItems`/`filteredCommandItems`) **and** `CommandPalette` (`items` prop). → colocate with the
  component and export it (App imports it).

## Design

### New `app/src/features/app-shell/CommandPalette.tsx`

```tsx
import { useEffect, useRef, useState } from "react";

export type CommandItem = {
  id: string;
  label: string;
  detail: string;
  run: () => void;
};

export function CommandPalette({ query, onQueryChange, items, onClose }: {
  query: string;
  onQueryChange: (value: string) => void;
  items: CommandItem[];
  onClose: () => void;
}) {
  // ← moved verbatim from App.tsx (body unchanged)
}
```

### `app/src/App.tsx`

- **Remove** the `CommandItem` type (92–97) and the `CommandPalette` function (~1624–~1718).
- **Add** an import near the other feature imports:
  `import { CommandPalette, type CommandItem } from "./features/app-shell/CommandPalette";`
- **Keep** unchanged: `commandItems = useMemo<CommandItem[]>(…)`, `filteredCommandItems`, and the
  `<CommandPalette query={commandPaletteQuery} onQueryChange={…} items={filteredCommandItems}
  onClose={…} />` call site (~line 1511).

## Data flow / behavior

Unchanged. `App()` still builds the command items and owns `commandPaletteOpen`/`commandPaletteQuery`
state; `CommandPalette` renders identically.

## Edge cases

- **No circular import:** `App.tsx` → `CommandPalette.tsx` → `react` only. One-directional.
- **`type CommandItem` still used in App** (`commandItems: CommandItem[]`) → imported with the `type`
  modifier; keep it (tsc errors if it were unused/missing).

## Testing

- **`npm run build`** (tsc) — catches any dangling reference / unused import. For a verbatim move,
  a clean type-check is a strong correctness signal (the code is identical, just relocated).
- **Full `npm run check`** green (capture the REAL npm exit code).
- **`npm run test:e2e:build`** — full suite as regression (no command-palette-specific test exists;
  this confirms nothing else broke). The palette itself is unchanged code.
- No new test (pure structural move; a Ctrl+K e2e is an optional future addition).

## Risks & mitigations

- **A missed reference** → tsc fails the build.
- **Accidental edit during the move** → must be verbatim; reviewers diff the moved component against
  the original; tsc + the suite confirm no breakage.
- **No direct e2e for the palette** → acceptable for a byte-identical relocation verified by tsc; the
  risk of a verbatim move altering runtime behavior is negligible.

## Rollout

Single feature branch `decompose-command-palette`. Files:
- **New:** `app/src/features/app-shell/CommandPalette.tsx`.
- **Modify:** `app/src/App.tsx` (remove the type + function; add the import).

Verify with `npm run check` + `npm run test:e2e:build`, then merge to `main`.
