# EP-015 / EP-016: Study Packet folder export — Implementation Plan

> Build the multi-file Study Packet folder export the user chose: render the
> contract files + manifest, write them as a folder, guard against leaks, and
> verify the written files end-to-end.

**Spec:** `docs/superpowers/specs/2026-06-13-ep015-016-study-packet-folder-export-design.md`
**Verification:** `cargo test` + `npm run check` + `npm run test:e2e:build`.

## Tasks (as executed)

- [x] Rust folder writer + path-traversal-safe filenames + command (`bcd866a`).
- [x] RED/GREEN: write-boundary leak guard (`packet_content_leaks` +
  `contains_windows_path`) in `write_study_packet_dir`; 2 new Rust tests
  (leaked-secret refused writes nothing; helper flags keys/paths not Scripture).
- [x] TS builder `features/council/studyPacket.ts` (typed, tsc-checked):
  README/question/passage/evidence/council/judgment/sources + manifest.json with
  Scripture/Source/AI/User labels.
- [x] UI: "Export Study Packet" button + status in the Council toolbar.
- [x] e2e: run mock Council -> Export -> read the written folder from disk and
  assert files + manifest schema + council content.
- [x] Verify: `npm run check` green (108 Rust, 81 sidecar); `npm run test:e2e:build`.

## Notes

- Architecture: leak guard lives in Rust at the write boundary (the JS EP-017
  scanner is not browser-importable and CI-scans samples); builder is typed TS,
  content verified by the Node-side e2e reading the written files.
- Follow-ups: app_version/corpus_version/embedding metadata sourcing; sample
  packets (EP-018); optional bibliography/Obsidian export.
