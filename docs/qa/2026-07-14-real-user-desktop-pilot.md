# Real-user Windows desktop pilot — 2026-07-14

## Purpose and scope

This was a genuine desktop-use review of the private, non-commercial Bible AI
app. The release and debug executables were operated through the Windows UI with
isolated user-data profiles. The pass covered first-run experience, reading,
provider setup, Council use, workspaces, theology, resources, settings, and the
most important data-safety paths. Automated checks were then used to broaden the
coverage and guard each fix.

This report records what was actually exercised. It is not a claim that public
distribution, signing, human accessibility review, or multi-provider evaluation
is complete.

## Environment

- Windows desktop application, rebuilt from the current source.
- Fresh temporary profiles for the first-run and post-fix checks.
- Bundled KJV corpus and local resource library.
- Ollama `0.32` was detected and its configured endpoint was reachable.
- A real logged-in Claude Code provider was used for one Council run.
- Disposable credential-manager entries used by the post-fix mock checks were
  isolated from the normal profile and removed afterwards.

## User journeys exercised

- Opened a clean profile, read Genesis 1 immediately, and followed the seven-step
  start guide into Settings.
- Tested the Ollama endpoint and verified Claude Code login from Settings.
- Asked a real pastoral/theological Council question about Matthew 5:44, supplied
  a starting view, waited for completion, and reviewed the answer and evidence.
- Navigated directly to Matthew 5:44 and attempted the natural `Psalm 119` form.
- Created a workspace, saved a study note, and confirmed the saved data.
- Created a theology topic and reviewed its saved summary.
- Browsed the bundled Apostles' Creed resource with its citation, licence, and
  attribution information visible.
- Reviewed Tags and other empty states.
- Exercised the fixed Council and Reader paths again in rebuilt debug and release
  executables through the Windows UI.
- Covered backup and restore with the passing desktop end-to-end workflows; the
  manual backup-dialog lap was interrupted by unrelated desktop focus contention.

## Findings and resolutions

| Severity | Finding | Resolution | Post-fix evidence |
| --- | --- | --- | --- |
| High | Starting a Council run opened a visible bundled `node.exe` console, which stole keyboard focus from the app. | The Windows sidecar is now spawned with `CREATE_NO_WINDOW`. | Both rebuilt debug and release runs spawned the Council sidecar with `MainWindowHandle = 0` and no window title. |
| Medium | The natural singular form `Psalm 119` was rejected because the corpus book is named `Psalms`. | Added `Psalm` as an alias in both frontend and Rust reference resolution. | `Psalm 23:1` opened Psalms 23 in the desktop UI; Rust and desktop E2E regressions pass. |
| Medium | A verse named explicitly in a Council question could be retrieved correctly but displayed below higher semantic scores, and could disappear from the visible top results. | Explicit-reference evidence is now presented first, followed by descending retrieval strength; the explanatory copy was updated. | After asking about Acts 2:38, the first visible evidence item was Acts 2:38 in debug and release-path validation; the regression assertion passes. |

## Real Council observation

The real question asked how Christians should understand loving enemies in
Matthew 5:44 and what practical boundaries are wise in abuse. The starting view
said that the command calls for mercy and refusal of revenge without requiring a
person to remain in danger.

The run completed in roughly five minutes. Only Claude was available, and the UI
correctly disclosed that this was a one-voice result rather than a multi-provider
council comparison. The answer distinguished mercy and non-retaliation from
remaining in danger, and allowed separation, protection, accountability, and
civil or pastoral support. The session used explicit-reference, hybrid, and
cross-reference retrieval. Database inspection confirmed Matthew 5:44 was the
first explicitly retrieved row; the presentation-order defect described above
was therefore a UI problem, not a retrieval failure.

## Verification record

- `npm run check`: passed, including 127 Rust tests, strict Clippy, 157 sidecar
  tests, TypeScript checks, and corpus/resource/quality/leak checks.
- Production frontend build: passed.
- `cargo fmt --check` and `cargo check --locked`: passed.
- The first combined Windows desktop E2E run passed 79 tests; one stateful Reader
  test timed out while waiting for Genesis after many preceding workflows.
- The immediate isolated Reader rerun passed 16/16, including the timed-out range
  workflow and the new singular-Psalm regression.
- The final combined Windows desktop E2E rerun passed cleanly: 80/80 in 4m 26s.
- The new explicit-reference evidence regression passed in the combined run.
- The existing backup/restore desktop workflows passed.
- `npx tauri build --no-bundle`: passed and produced a rebuilt optimized release
  executable.
- Final release UI check: a Council run launched exactly one bundled Node sidecar;
  it had no visible window or title.

The initial timeout is retained here for transparency. The immediate complete
Reader-spec pass and subsequent clean 80/80 combined pass support classifying it
as a transient shared-session/test-harness failure rather than an app regression.

## Remaining limits

- Only one real AI provider was configured, so disagreement, minority-view, and
  synthesis behaviour across multiple real providers was not evaluated in this
  pilot. Mock-provider coverage remains in the automated suite.
- A human screen-reader/keyboard-only accessibility pass is still required before
  making accessibility release claims.
- Installer signing and public-distribution gates are intentionally outside this
  private, non-commercial app pilot.
- A calm bad-key/offline failure-path lap should be repeated manually when a
  dedicated, interruption-free desktop is available, even though automated error
  handling coverage passes.
