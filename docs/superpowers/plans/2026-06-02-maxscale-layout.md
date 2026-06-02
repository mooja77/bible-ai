# Layout integrity at max text size — Implementation Plan

> Captions/labels must wrap (not overflow their cell) at the largest App text
> size; add a permanent regression guard so this never silently regresses.

**Spec:** `docs/superpowers/specs/2026-06-02-maxscale-layout-design.md`
**Verification:** `npm run check` + full `npm run test:e2e:build`.

## Tasks (as executed)
- [x] **Audit (became the test):** drove the running app to 140% and dumped DOM
  overflow/clip findings on Reader/Council/Settings; hardened into
  `tests/e2e/layout-maxscale.spec.ts` (assert no overflow/spill/clipped text;
  exclude intentional sr-only/truncated elements and form controls). Registered
  in `wdio.conf.mts` after `empty-translation-column.spec.ts`.
- [x] **Fix:** additive Tailwind only —
  `CouncilVoicePanels` voice card `min-w-0` + detail `break-words`;
  `SettingsPrimitives` `SetupCheckPill` `min-w-0` + label/detail `break-words`;
  `ProviderStatusCard` `min-w-0` + badge `shrink-0` + detail `break-words`.
- [x] **Verify:** `npm run check` 66/66; full `npm run test:e2e:build` 65/65 on a
  clean run (earlier reds were wedged-startup flakes — confirmed by clean re-run).

## Notes
- Iterated on the guard twice: excluded form controls (the `Max passages` number
  input's spinner padding is not clipped text), and added `break-words` to the
  pill **label** too (a single long word like "providers" with `tracking-wider`
  can exceed a narrow cell even when wrapping is allowed).
- No screenshots: the user's desktop had many live sessions open; the DOM audit
  is the safer and more rigorous runtime check here.
