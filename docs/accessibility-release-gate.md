# Accessibility Release Gate

Status: DRAFT (for review)
Last updated: 2026-06-13

This document defines accessibility as a workflow release gate for the Bible AI
desktop app, not as scattered UI polish. It exists because the app targets
non-technical and low-vision readers, so a study session must be completable
without a mouse, with visible focus, readable text, and acceptable contrast.

The gate has three parts:

1. A keyboard-only Study Packet core test (manual).
2. A per-screen accessibility checklist (manual + automated where noted).
3. A release-gate rule that blocks wider beta when the core test fails.

This is EP-011 in `docs/development-implementation-plan.md`. It complements
`docs/testing-and-release-plan.md` (automated coverage) and
`docs/study-packet-v1-contract.md` (the artifact produced at the end of the
core test).

## Scope

In scope:

- Keyboard-only completion of the full Study Packet workflow.
- Focus order, visible focus, focus return, and focus traps.
- Dialog and tablist semantics for overlays and tabbed panels.
- Screen-reader-visible labels on icon buttons and critical controls.
- Text scaling, light/dark contrast, and no overlap at supported sizes.

Out of scope for v0.1:

- Full screen-reader certification across multiple readers and OS versions.
- Localization or right-to-left layout.
- Mobile or touch accessibility (the app is desktop WebView only).

## Core Test: Keyboard-Only Study Packet Path

A tester must complete this entire path using the keyboard only. The mouse must
not be touched once the test begins. Use Tab and Shift+Tab to move, Enter and
Space to activate, Escape to close overlays, and arrow keys inside tablists,
menus, and lists.

Pass condition: every step below is reachable, operable, and reversible by
keyboard, with focus always visible and never lost.

1. Open a passage.
   - From the app shell, reach Reader mode by keyboard.
   - Select a book, chapter, and passage (for example, Genesis 1).
   - The passage renders and reading focus is somewhere predictable.

2. Search.
   - Reach the search control by keyboard.
   - Enter a query and submit.
   - Move through results with the keyboard and open one result.
   - Focus lands on the navigated passage, not back at the top of the page.

3. Open and close overlays.
   - Open at least one overlay (verse panel, command palette, or a settings
     dialog) by keyboard.
   - Confirm focus moves into the overlay when it opens.
   - Press Escape; the overlay closes and focus returns to the control that
     opened it.
   - Repeat for each overlay type encountered in the workflow.

4. Run Council or guided learning.
   - Reach Council mode (or guided learning) by keyboard.
   - Enter a question and start the run.
   - Wait for the result; progress and status are announced or visibly
     reachable, not mouse-only.

5. Review evidence.
   - Move into the evidence and transparency panels.
   - Use arrow keys to move across any tablist (positions, evidence,
     retrieval trace).
   - Confirm each tab is reachable and its panel content is readable.

6. Enter a judgment.
   - Reach the judgment input by keyboard.
   - Enter a position rating and any follow-up text.
   - Save the judgment; confirmation is visible without the mouse.

7. Export the Study Packet.
   - Reach the export or copy-as-markdown action by keyboard.
   - Trigger the export and confirm the success state is reachable and
     readable.

8. Recover from an error.
   - Trigger or simulate an error path (for example, a Council run with no
     provider configured, or a failed action).
   - Confirm the error notice is reachable, readable, and dismissable by
     keyboard, and that focus is not stranded on a hidden or removed element.

If any step cannot be completed by keyboard alone, the core test fails.

## Per-Screen Checklist

Run this checklist on Reader, Council, Settings, and any overlay reached during
the core test. Each item is either covered by automation (noted) or requires
manual QA.

- Focus order is stable and follows visual reading order.
- Focus state is visible on every interactive element. (Manual.)
- Escape closes overlays and returns focus to the opener. (Manual.)
- Overlays expose dialog semantics (role, label, and modality). (Manual.)
- Tabbed panels expose tablist semantics with arrow-key navigation. (Manual.)
- Icon buttons have screen-reader-visible labels. (Manual.)
- No critical control is unlabeled. (Manual.)
- Text scaling to the largest step remains usable, with no overflow or clipped
  text. (Automated: `layout-maxscale.spec.ts`; manual confirmation in the real
  WebView.)
- Contrast is acceptable in the default light theme. (Automated:
  `contrast-light.spec.ts`.)
- Contrast is acceptable in the default dark theme. (Manual; dark is the
  default and is visually verified.)
- Controls do not overlap at supported window sizes. (Partly automated via
  the overflow/spill checks in `layout-maxscale.spec.ts`; manual at small and
  resized windows.)
- Keyboard shortcuts do not trap focus. (Manual.)

## What Is Already Automated

The following are objective, repeatable guards in the e2e suite. They run with
`npm run check:full` (see `docs/testing-and-release-plan.md`) and count as
coverage for their respective checklist items.

- `app/tests/e2e/layout-maxscale.spec.ts` -- drives the App text-size control
  to its largest step (140%) and asserts that Reader, Council, and Settings
  have no horizontal viewport overflow, no elements spilling past the right
  edge, and no clipped (non-intentionally-truncated) text. This covers the
  "no overflow or clipping at large text" and most of the "no overlap"
  concerns.

- `app/tests/e2e/contrast-light.spec.ts` -- composites surface layers and
  asserts WCAG AA contrast (4.5:1 normal text, 3:1 large/bold) for visible
  text across Reader, Council, Settings, Theology, and Resources in light
  mode. This covers the "contrast in light mode" item.

- `app/tests/e2e/ui-scale.spec.ts` -- asserts the whole-app text-size control
  raises the document root font-size and updates its readout, then resets.
  This covers the "text scaling mechanism works" precondition that
  `layout-maxscale.spec.ts` then stresses at the maximum.

These specs prove that text scaling, overflow/clipping, and light-mode AA
contrast are mechanically enforced. They do not exercise keyboard navigation,
focus behavior, screen-reader labels, or dark-mode contrast.

## What Requires Manual QA

The following cannot be fully proven by the current automation and must be
verified by a human tester before wider beta:

- The complete keyboard-only Study Packet path (the core test above). Real
  WebView keyboard and focus behavior is not exercised by the headless specs.
- Visible focus state on every interactive element.
- Escape closing each overlay and returning focus to the opener.
- Dialog and tablist semantics as experienced by a screen reader.
- Screen-reader-visible labels on icon buttons and critical controls.
- Dark-mode contrast (dark is the default and is visually verified, not
  asserted in an automated spec).
- Absence of focus traps from keyboard shortcuts and overlays.

Optional automation may be added over time (Playwright coverage of the Study
Packet path, axe checks for the app shell and major panels) if the tooling
stays low-friction, but manual QA in the real WebView remains required.

## Release Gate Rule

Wider beta is BLOCKED if the complete keyboard-only Study Packet core test
fails manual QA.

- The blocker applies to the full path. A single step that cannot be completed
  by keyboard alone (for example, an overlay that cannot be closed by Escape,
  or an export that is mouse-only) fails the gate.
- The automated specs above are necessary but not sufficient: green automation
  does not satisfy the gate on its own, because the gate is defined by the
  manual keyboard-only path.
- Known gaps must be listed (see below). An unresolved gap on the core path is
  a blocker; an unresolved gap off the core path is a documented limitation,
  not a blocker, unless it prevents completion of the workflow.

## Known Gaps

Record outstanding accessibility gaps here as they are found, with screen,
description, whether the core path is affected, and status. Maintain this list
each release cycle.

- (none recorded yet -- populate during the first manual QA pass)
