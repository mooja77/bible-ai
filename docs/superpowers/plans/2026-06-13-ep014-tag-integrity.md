# EP-014: Tag + stale-link integrity — Implementation Plan

> Deleting a note left orphaned tag links, and tag counts counted orphans so they
> disagreed with the visible tagged items. Clean note tags on delete; count only
> existing items. Stale theology/workspace links deferred (UX decision needed).

**Spec:** `docs/superpowers/specs/2026-06-13-ep014-tag-integrity-design.md`
**Verification:** `cargo test` + `npm run check` + `npm run test:e2e:build`.

## Tasks (as executed)

- [x] Verify gaps: `delete_note` (user_db.rs) didn't clean `item_tags` (unlike
  `delete_bookmark`); `list_tags_with_counts` counted all links incl. orphans
  while `list_tagged_items` filtered them - so counts could exceed visible items.
- [x] RED: `delete_note_clears_its_item_tags` and
  `list_tags_with_counts_ignores_orphaned_note_links`; both confirmed failing.
- [x] GREEN: `delete_note` deletes note `item_tags` first; `list_tags_with_counts`
  counts only links whose item still exists (correlated EXISTS).
- [x] Verify: `cargo test` 97/97; fmt + clippy `-D warnings` clean; `npm run
  check` green; `npm run test:e2e:build`.

## Notes

- Tags only apply to bookmarks + notes (study/council aren't tag-browsable), so
  the fix is bounded to those two paths; bookmarks were already handled.
- Count fix is defense-in-depth: agrees with `list_tagged_items` regardless of
  how an orphan arose, not just via the delete-path cleanup.
- DEFERRED follow-up: stale `theology_links` (target_id -> deleted council
  session / study item) need "source missing" rendering or guarded cleanup; UX
  decision + frontend work, out of this packet.
