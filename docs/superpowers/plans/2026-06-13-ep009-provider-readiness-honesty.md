# EP-009: Provider readiness honesty — Implementation Plan

> The Council preview claimed providers were "ready"/"will run" on key presence
> alone, with no verification. Relabel presence-only as "configured"; guard via
> e2e.

**Spec:** `docs/superpowers/specs/2026-06-13-ep009-provider-readiness-honesty-design.md`
**Verification:** `npm run check` + `npm run test:e2e:build`.

## Tasks (as executed)

- [x] Verify the two surfaces: Settings (`ProviderStatusCard`) already honest
  (configured/ok/check from real diagnostics); Council preview
  (`CouncilVoicePanels`) overclaimed "will run"/"ready" on key presence only.
- [x] RED: e2e asserts the voice preview contains "configured" and not "ready to
  run"/"will run"; confirmed failing on the pre-fix build.
- [x] GREEN: pill "will run" -> "configured" (4 sites), header "ready to run" ->
  "configured", count "N/M ready" -> "N/M configured".
- [x] Verify: no logic keys off the old string; `npm run check` green; full
  `npm run test:e2e:build`.

## Notes

- "configured" matches the vocabulary `SettingsPrimitives.ProviderStatusCard`
  already uses, unifying the two surfaces.
- No frontend unit harness exists, so the honesty contract is pinned at the
  e2e/UI level (header + count render regardless of keys -> deterministic in the
  no-key e2e env). Per-pill relabel rides the same change, verified by build.
- True "verified"/"failed" states in the Council preview would require plumbing
  diagnostics into it -- deliberately out of scope; Settings already shows that.
