# Manual UX walkthrough — Bible AI

A human-driven pass for the things automated tests can't see: look, feel,
real AI, and first-run. Built for a non-technical operator. Launch the current
debug build at `app/src-tauri/target/debug/app.exe`.

For each item, mark ✅ / ❌ and jot what looked wrong. "Wrong" = anything a
normal user would find confusing, ugly, misaligned, mis-sized, or broken.

> Tip: do a first lap at the **default** text size, then a second lap at the
> **largest** App text size (the A−/A+ control) to catch scaling/alignment bugs.

## 1. First impression & layout (the issues you reported)
- [ ] The app opens to a clear starting screen — you can tell what to do next.
- [ ] Nothing overlaps, clips, or is cut off in the sidebar, header, or main area.
- [ ] Buttons, labels, and rows line up; spacing looks even (no cramped/crooked bits).
- [ ] Font sizes feel consistent — headings vs body vs small labels look intentional,
      not randomly large/tiny.
- [ ] The indigo theme looks deliberate and readable (good contrast, no grey-on-grey).
- [ ] Toggle light/dark — both are readable; nothing disappears or clashes.

## 2. Text size control (recently changed)
- [ ] The "App text size  A− 100% A+" row is visible and clearly labelled.
- [ ] A+ enlarges the **whole** UI (not just one area); A− shrinks it; the % updates.
- [ ] At the largest size, re-check section 1 — still aligned, nothing overlaps.
- [ ] The size persists after closing and reopening the app.

## 3. Reading
- [ ] Pick a book/chapter — text loads and is comfortable to read.
- [ ] Open a long chapter (e.g. **Psalm 119**) — scrolling is smooth, no freeze.
- [ ] Turn on a second translation — columns/interleaving line up and are legible.
- [ ] Verse actions (highlight, note, bookmark, "ask the Council about this verse")
      work and look right.

## 4. The Council — happy path with REAL AI
> This needs a real provider configured in Settings (key, or logged-in Claude Code).
- [ ] Ask a real question. While it runs you see live feedback (elapsed time +
      stage/"thinking" panel), not a dead spinner.
- [ ] A normal answer returns in a reasonable time and is readable & well laid out.
- [ ] The result leads with something understandable to a non-expert (not a wall
      of jargon).

## 5. The Council — failure & timeout (recently added)
- [ ] Break it on purpose: enter a **bad API key** (or disconnect the internet),
      then ask. You should get a **calm, plain message** titled "The Council could
      not finish" with a **Try again** button — NOT a raw error or endless spinner.
- [ ] "Try again" re-runs the question.
- [ ] (Optional) A genuinely stuck provider should stop on its own within ~5 minutes
      with the "taking longer than expected" message + Try again.

## 6. Your data is safe
- [ ] Make a few notes / tags / bookmarks.
- [ ] Settings → back up (JSON and/or SQLite). The app confirms where it saved.
- [ ] Restore from that backup — you're warned it's destructive and must confirm;
      your notes/tags/bookmarks come back intact.

## 7. Settings & onboarding
- [ ] The guided tour (if shown) is clear; its buttons (e.g. "Open Reader") work.
- [ ] Connecting a provider is understandable for a non-techie; bad URLs/keys show
      a helpful inline message, not a crash.
- [ ] Nothing in Settings looks misaligned at either text size.

## 8. First-run on a CLEAN profile (most important for new users)
> Use a fresh Windows user / VM, or `npm run qa:manual-gates:create-user`.
- [ ] First launch is welcoming, not an error or empty void.
- [ ] With no AI configured yet, the Council screen explains how to get started
      (a "connect a provider / open Settings" prompt), rather than failing.
- [ ] Reading works immediately without any setup.

---

### How to report back
Just tell me the section number + what looked wrong (one line each), e.g.
"2: at max size the nav buttons overlap the logo" or "5: bad-key error showed a
raw 'Error: invoke...' string." I'll fix the actual thing in a targeted pass.

### Companion: release/data gates
`npm run qa:manual-gates:template` generates `release/manual-release-gates.json`
— the install / credential-vault / secret-leak / backup-restore gates to fill in
on a clean profile before a public release. This UX walkthrough is the
user-experience complement to that security/data checklist.
