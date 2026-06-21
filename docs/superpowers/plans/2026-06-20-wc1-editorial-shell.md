# WC1 — Editorial Shell & ⌘K Command Surface — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Steps use `- [ ]`. This is phase WC1 of the ground-up world-class rebuild.

**Goal:** Replace the dense persistent left sidebar in `app/src/App.tsx` with a chrome-less editorial frame — a slim **TopBar** + the ⌘K **command palette** as the primary navigation/action surface — relocating every sidebar control to a proper new home without losing functionality or e2e coverage.

**Design law:** `docs/superpowers/specs/2026-06-20-world-class-redesign-directives.md` (chrome-less, ⌘K-first, Calm Editorial palette [already in App.css], 66-CPL reading, motion 150–200ms, keep the animation engine).

**Architecture source:** code-architect blueprint (run a3654f55). Key principle: **build everything additively first (T1–T6), then delete the sidebar atomically with its spec updates (T7).** Each task is a building, e2e-green commit. Never reach T7 by skipping a task.

**Tech:** React 19 + TS, Tailwind v4 + CSS tokens, WebdriverIO e2e. All state stays in `App.tsx` (no stores/context — established pattern). Verbatim-move components out, import-adjust, tsc-verify.

---

## Files to create
- `app/src/features/app-shell/AppShell.tsx` — root `flex-col`: skip-link (MUST be first child) + TopBar + `<main id="main-content">` + overlays.
- `app/src/features/app-shell/TopBar.tsx` — slim bar: wordmark, contextual title, compact 7-mode icon strip (ModeButton w/ `sr-only` label), Start-guide, book-nav + nav-drawer toggles, theme toggle, ⌘K button, ui-scale trio.
- `app/src/features/search/SearchPanel.tsx` — full overlay: SearchScopeControl + `input[type="search"]` + SearchStrategyControl + filter selects + results. `data-testid="search-panel"`.
- `app/src/features/reader/JumpBar.tsx` — `input[aria-label="Jump to reference"]` + `button=Go` (reader main, above heading).
- `app/src/features/reader/ReaderTopControls.tsx` — translation chips (`data-testid="translation-{code}"`), reader font pills, layout/density selects, sync-scroll.
- `app/src/features/reader/BookNav.tsx` — left drawer: BookList + ChapterGrid. `data-testid="book-nav"`.
- `app/src/features/app-shell/NavigationDrawer.tsx` — wraps NavigationShortcuts. `data-testid="nav-drawer"`.

## Files to modify
- `app/src/App.tsx` — host AppShell; add `searchPanelOpen`/`bookNavOpen`/`navDrawerOpen` state + `/` keydown; extend commandItems with dynamic "Jump to/Search for [query]"; delete `<aside>` (T7).
- `app/src/features/app-shell/CommandPalette.tsx` — rewrite in place: grouped + fuzzy results; `onJumpToReference`/`onSearch`/`translations` props. Keep `role=dialog`, `aria-label="Command palette"`, `data-testid="command-palette-results"`.
- `app/src/features/app-shell/ModeButton.tsx` — compact: `<button aria-label={label}>` icon + `<span class="sr-only">{label}</span>` (preserves `$("button=Reader")` via textContent) + `aria-current`.
- `app/src/App.css` — add `--motion-fade:110ms`, `--motion-expand:150ms`, `--motion-toast:240ms`; classes `.top-bar`, `.search-panel`, `.book-nav`, `.nav-drawer`.

## Control relocation
mode nav → TopBar icon strip (sr-only text) · theme/⌘K/ui-scale → TopBar right · Start-guide + provider-setup-prompt + new-user-guide-prompt → TopBar (keep testids) · search (+scope/strategy/translation/testament/book filters) → SearchPanel (open via `/` or ⌘K) · jump-to-reference → JumpBar · reading translation/font/layout/density/sync → ReaderTopControls · BookList/ChapterGrid → BookNav drawer · NavigationShortcuts (bookmarks/history/searches/workspaces) → NavigationDrawer.

## Critical constraints
- **Skip-link must be the literal first element child** of `.app-shell` (smoke.spec asserts `firstElementChild`).
- **`$("button=Reader")` etc.** must keep working → mode buttons carry visible-to-textContent `sr-only` label. (Fallback if it fails: add `data-testid="mode-nav-{mode}"` + update nav-shell.spec.)
- Keep these testids/labels intact (relocated): `ui-scale-dec/inc/value`, `Switch to light/dark theme`, `translation-{code}`, `Jump to reference`, `button=Go`, `Reader layout`, `Reader density`, `search-strategy-*`, `Search translation/testament/book`, `new-user-guide-prompt`, `provider-setup-prompt`, `command-palette-results`.
- The global `warning` banner must remain visible on all screens (move to AppShell/TopBar level).

---

## Tasks (each = a green-suite commit)

### T1 — TopBar scaffold *(additive; 0 e2e changes)*
- [ ] Create `TopBar.tsx` (wordmark, breadcrumb, ⌘K button, theme toggle, ui-scale trio with their testids, toggle placeholders).
- [ ] App.tsx: wrap shell as `flex-col` → TopBar + `<div class="flex flex-1 overflow-hidden">` around existing aside+main.
- [ ] Move theme toggle + ui-scale (`data-testid="ui-scale-*"`, `aria-label="Switch to … theme"`) to TopBar; remove the duplicates from the sidebar.
- [ ] `data-testid="top-bar"`. Build + run `ui-scale.spec`, `contrast-light.spec` → green. Commit.

### T2 — SearchPanel overlay *(updates search specs now)*
- [ ] Create `SearchPanel.tsx` with ALL search controls (scope, `input[type="search"]`, strategy w/ `search-strategy-*`, the 3 filter selects w/ their aria-labels, results). Mount lazily on `searchPanelOpen`.
- [ ] App.tsx: add `searchPanelOpen` state + `/` keydown (ignore when target is INPUT/TEXTAREA) to open it. Remove the sidebar search block.
- [ ] Update specs to open SearchPanel (`browser.keys("/")` then wait `[data-testid="search-panel"]`) before search asserts: `smoke.spec` (~144), `search-semantic.spec`, `notes-search.spec` (~77–84), and `workspace.spec`'s `runSidebarSearch()` helper (~15–46). Build + run those 4 → green. Commit.

### T3 — CommandPalette rewrite *(0 e2e changes)*
- [ ] Rewrite `CommandPalette.tsx`: grouped categories, fuzzy token-overlap scorer, dynamic top items "Jump to \"{query}\"" + "Search for \"{query}\"", translation-switch commands. Add `onJumpToReference`/`onSearch`/`translations` props; wire in App.tsx commandItems. Keep dialog role/label/testid.
- [ ] Build + run `smoke.spec` (palette open) → green. Commit.

### T4 — JumpBar + ReaderTopControls *(additive; 0 e2e changes)*
- [ ] Create `JumpBar.tsx` + `ReaderTopControls.tsx`; render in App.tsx reader branch above the chapter heading. Keep sidebar reader controls for now (duplicate testids; sidebar is first in DOM so specs still hit it). Build → green. Commit.

### T5 — BookNav drawer *(additive; 0 e2e changes)*
- [ ] Create `BookNav.tsx` (BookList+ChapterGrid); `bookNavOpen` state; `book-nav-toggle` in TopBar; render overlay. Build → green. Commit.

### T6 — NavigationDrawer *(additive; 0 e2e changes)*
- [ ] Create `NavigationDrawer.tsx` (wraps NavigationShortcuts); `navDrawerOpen` state; `nav-drawer-toggle` in TopBar. Build → green. Commit.

### T7 — Remove the sidebar *(the atomic pivot)*
- [ ] Delete `<aside class="app-sidebar">` from App.tsx; `<main>` becomes the AppShell child below TopBar. Ensure skip-link first-child + mode-button sr-only labels + Start-guide text + relocated `new-user-guide-prompt`/`provider-setup-prompt` testids.
- [ ] In the SAME commit, update specs that reach now-removed sidebar items: open BookNav before `$("button=Genesis")`/`$("button=John")` in `empty-translation-column.spec`, `layout-maxscale.spec`, `smoke.spec`; open NavDrawer before bookmark/tag asserts in `backup-restore.spec`, `tags-browse.spec`. Run the FULL suite → all green. Commit.

### T8 — Motion polish *(0 e2e changes)*
- [ ] Add the motion tokens; SearchPanel fade-in (`--motion-fade`, decelerate `cubic-bezier(0,0,0.2,1)`); BookNav/NavDrawer slide (`--motion-expand`). Build → green. Commit.

### T9 — a11y + final suite
- [ ] Verify skip-link first-child, focus order, drawer focus-trap/Escape, `aria-current` on active mode. Run full `npm run check` + full e2e. Commit.

---

## Self-review
- **Coverage:** chrome-less shell + ⌘K (Directives 1,2) → T1–T7; editorial palette already in place; motion tokens (Directive 5) → T8; a11y → T9. Reader/Council/rest reskins are later phases (WC2–WC5).
- **Regression control:** additive T1–T6 keep the app+suite working; T7 deletes the sidebar and updates all 8 affected specs in one commit; sr-only nav text + relocated testids preserve selectors.
- **Risk:** sr-only `button=Reader` selector — fallback testids ready (T7). Env: e2e needs the debug build + msedgedriver matching Edge.
