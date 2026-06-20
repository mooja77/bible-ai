# WC2 — Editorial Reader — Implementation Plan

> Sub-skill: subagent-driven-development. Phase WC2 of the world-class rebuild (WC1 shell DONE). Design law: `docs/superpowers/specs/2026-06-20-world-class-redesign-directives.md`. Architecture source: code-architect run a723fb25.

**Goal:** Make the reading view the text-is-hero experience — a single centered serif column with an elegant chapter heading — by tucking the busy controls (translation list, font/layout/density/sync, jump) into a compact **ReaderBar** with popovers. Default = single primary translation (ChapterReader hero column); multi-translation Compare stays opt-in (existing InterleavedReader/columns). Keep ALL functionality + e2e selectors (relocated behind popovers).

**Model:** `activeTranslations[0]` = primary; Compare = `activeTranslations.length > 1` (no new top-level state). New local state lives in ReaderBar (`translationPopoverOpen`, `settingsPopoverOpen`). Respect existing users' active translations.

## Files
- CREATE `app/src/components/Popover.tsx` — anchored popover primitive (open/onClose, click-outside via mousedown + Escape, panel `stopPropagation`, no portal). `role="dialog"`.
- CREATE `app/src/features/reader/ReadingSettingsMenu.tsx` — "Aa" popover content: font ±, layout select (`aria-label="Reader layout"`), density (`aria-label="Reader density"`), sync (`aria-label="Sync reader scrolling"`). `data-testid="reading-settings-popover"`.
- CREATE `app/src/features/reader/TranslationSwitcher.tsx` — trigger (`data-testid="translation-switcher-trigger"`, shows primary + compare count) + popover panel (`data-testid="translation-switcher-popover"`, `role="dialog"`) containing the translation checkbox list (KEEP `data-testid="translation-{code}"` on each input) + Compare/layout. Focus-trap; Escape returns focus to trigger.
- CREATE `app/src/features/reader/ReaderBar.tsx` — slim row: reference label ("Genesis 1"), TranslationSwitcher trigger, an ALWAYS-rendered slim jump input (`aria-label="Jump to reference"` + `button=Go`, never `display:none`), "Aa" trigger (`aria-label="Reading settings"`). `data-testid="reader-bar"`. Composes the two popovers.
- MODIFY `app/src/features/reader/ChapterReader.tsx` — editorial header (kicker book name + chapter numeral + gold rule, all `showChapterHeading`-gated) + drop-cap on the verse-1 text wrapper. Keep `<h1 ...>{bookName} {chapter}</h1>` text discoverable? NO — heading restructures; specs use `h1*=Genesis` → keep the book name in an element WebdriverIO `h1*=Genesis` matches: render `<h1>` containing the book name + chapter (e.g. keep `{bookName} {chapter}` inside an `<h1>` so `h1*=Genesis` still matches), OR verify which specs use it and adapt. **Confirm `h1*=Genesis` still resolves.**
- MODIFY `app/src/App.tsx` reader branch (~1111–1137) — replace the JumpBar + ReaderTopControls block with `<ReaderBar .../>` (same props/handlers); remove their imports (W6).
- MODIFY `app/src/App.css` — `:root` add `--motion-fade:110ms`, `--motion-expand:150ms`; add `.reader-kicker`, `.reader-chapter-rule` (aria-hidden gold gradient line), `.reader-drop-cap::first-letter` (serif, ~3.6em, `var(--color-amber-400)`).
- DELETE (W9) `JumpBar.tsx`, `ReaderTopControls.tsx`, `TranslationPicker.tsx` (folded into TranslationSwitcher).

## Tasks (each builds; only W6 changes e2e)
- **W1** Popover primitive. Build green.
- **W2** ReadingSettingsMenu (extract font/layout/density/sync from ReaderTopControls; same aria-labels). Build green.
- **W3** TranslationSwitcher (trigger + popover; keep `translation-{code}` testids; Compare + layout). Build green.
- **W4** ReaderBar (composes W1–W3 + jump input). Build green. *(W1–W4 are additive, not yet rendered — may be one commit.)*
- **W5** Editorial ChapterReader heading + App.css classes + motion tokens. Build green; run `contrast-light` (kicker/drop-cap must pass AA — kicker `--color-amber-300`, large heading) + `layout-maxscale` (drop-cap float must not overflow at 140%).
- **W6 (atomic swap + e2e)** Replace the reader controls block in App.tsx with `<ReaderBar>`; remove JumpBar/ReaderTopControls imports. Update specs:
  - Add helpers to `reader-interactions.spec.ts`: `openReadingSettings()` (click `[aria-label="Reading settings"]` → wait `reading-settings-popover`) and `openTranslationSwitcher()` (click `translation-switcher-trigger` → wait `translation-switcher-popover`). Call `openReadingSettings()` before any `select[aria-label="Reader layout"|"Reader density"]` or font controls (grep all occurrences); call `openTranslationSwitcher()` before any `translation-{code}` toggle. The jump input stays always-rendered → its specs need NO change.
  - `empty-translation-column.spec.ts`: restructure `setChecked`/`setExactActive` to open the translation switcher once, toggle codes, close it (mousedown-based click-outside; panel stops propagation), before asserting body text.
  - `smoke.spec.ts` "populates translation picker": open the switcher before `span={code}` checks; close after.
  - Run FULL suite → green (isolate flakes to prove env vs regression). Commit.
- **W7** (folded into W6 if done together) smoke translation-picker popover open.
- **W8** Popover motion (opacity+scale, `--motion-expand`, entrance `cubic-bezier(0,0,0.2,1)`). Build green.
- **W9** Delete JumpBar/ReaderTopControls/TranslationPicker; build + full suite green.

## Preserve (e2e): `translation-{code}`, `Jump to reference`+`Go`, `Reader layout`, `Reader density`, reader font-size labels, `absent-translations-note`, `interleaved-reader`, `h1*=Genesis`. New: `reader-bar`, `translation-switcher-trigger/-popover`, `reading-settings-popover`, `aria-label="Reading settings"`.

## Risks
- Popover click-outside must use `mousedown` + panel `stopPropagation` so multi-toggle loops don't self-close.
- Jump input must stay visible (never `display:none`) so its specs (no popover) keep working.
- `h1*=Genesis` must survive the editorial heading restructure — keep book name in the `<h1>`.
- Drop-cap float + 140% scale → verify `layout-maxscale`.
- Env: debug build + msedgedriver matching Edge; suite flakes under load → isolate to confirm.
