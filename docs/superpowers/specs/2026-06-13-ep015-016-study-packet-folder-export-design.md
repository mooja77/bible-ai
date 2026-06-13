# EP-015 / EP-016: Study Packet folder export — Design

- **Date:** 2026-06-13
- **Status:** Implemented (folder export + manifest; user chose the folder format)
- **Gate:** Study Packet v1 (Gate 3)
- **Source:** `docs/development-implementation-plan.md` EP-015/016; format decision
  (multi-file folder) made by the user; contract in
  `docs/study-packet-v1-contract.md`.

## What shipped

The first end-to-end Study Packet **folder** export:

1. **Rust folder writer** (earlier commit `bcd866a`): `export_study_packet`
   command + `write_study_packet_dir`, path-traversal-safe filenames.
2. **Write-boundary leak guard** (this work): `write_study_packet_dir` now scans
   every file with `packet_content_leaks` (provider keys, local paths, UNC paths)
   and refuses to create the folder if any file is dirty -- fail-closed, the
   last line of defense behind the JS scanner (EP-017). 5 Rust tests total.
3. **TS packet builder** `features/council/studyPacket.ts`:
   `buildStudyPacketFiles(question, response, judgment)` renders the contract's
   files -- README.md, question.md, passage.md, evidence.md, council.md,
   judgment.md, sources.md -- with explicit Scripture / Source / AI / User
   labels, plus `manifest.json` (schema `bible-ai/study-packet`, app/retrieval/
   provider/translation metadata, including the EP-010 retrieval fallback reason).
4. **UI**: an "Export Study Packet" button in the Council result toolbar
   (`data-testid="export-study-packet"`) that builds the files, calls
   `exportStudyPacket`, and shows the written folder path.

## Architecture decisions

- **Leak guard in Rust at the write boundary**, not in the browser: the JS
  scanner imports `node:fs` (CLI) so it is not browser-importable, and the write
  boundary is the most robust place to fail closed. The JS scanner remains the
  fuller CI scan over sample packets. Two layers of defense.
- **Builder is typed TS in `src/`** (tsc-checked against `CouncilResponse`), and
  because wdio specs run in Node, the e2e verifies the *actual written files* on
  disk -- giving content verification without a frontend unit harness.

## Scope / follow-ups

- `app_version` is the hardcoded `0.1.0` (matches the app today); sourcing it and
  `corpus_version` + embedding metadata from release/corpus layers is the
  contract's noted follow-up.
- Optional `bibliography.csl.json` / Obsidian niceties are not included yet.
- The 5 sample packets (EP-018) can now be generated from real sessions.

## Testing

- 5 Rust tests (`study_packet_tests`): filename safety, multi-file write, unsafe
  filename rejected (nothing written), leaked-secret refused (nothing written),
  `packet_content_leaks` flags keys/paths but not Scripture.
- New e2e (`council-mock.spec.ts`): run a mock Council, click Export, read the
  written folder from disk and assert README.md/council.md exist, `manifest.json`
  parses with `schema = "bible-ai/study-packet"`, and council.md contains the
  synthesis.
- `npm run check` green (108 Rust tests, 81 sidecar); `npm run test:e2e:build`.
