# EP-014: Tag + stale-link integrity — Design

- **Date:** 2026-06-13
- **Status:** Implemented (tag-integrity scope); stale theology/workspace link
  rendering deferred (see Scope).
- **Gate:** Data integrity (Gate 2)
- **Source:** `docs/development-implementation-plan.md` EP-014; ground-truthed in
  `docs/reviews/2026-06-13-ep-roadmap-ground-truth.md`.

## Background

Tags apply only to **bookmarks and notes** (`list_tagged_items` /
`list_tags_with_counts` union only `'bookmark'` and `'note'`; study/council
items are not tag-browsable). Two integrity gaps existed:

1. **Note deletion left orphaned tag links.** `delete_bookmark` clears its
   `item_tags` rows, but `delete_note` (`user_db.rs`) deleted only the
   `user_notes` row — its `item_tags` (keyed on `verse_id`) survived.
2. **Tag counts disagreed with visible items.** `list_tags_with_counts` used
   `COUNT(it.tag_id)` over a `LEFT JOIN item_tags`, counting *every* link
   including orphans, while `list_tagged_items` JOINs the real tables and filters
   orphans out. So a deleted-but-not-cleaned note tag showed count = 1 with zero
   visible items.

## Change

- **`delete_note`** now deletes the note's `item_tags` (`item_type = 'note' AND
  item_id = verse_id`) before deleting the `user_notes` row, mirroring
  `delete_bookmark`.
- **`list_tags_with_counts`** now counts only links whose underlying item still
  exists (correlated `EXISTS` against `bookmarks` / `user_notes`), so the count
  always agrees with `list_tagged_items` regardless of how an orphan arose
  (defense in depth, not just relying on the delete-path fix).

## Scope

- This packet covers the **tag-count integrity** half of EP-014 (the clearly
  backend-testable, safe part). The **stale Theology/workspace link** half
  ("cleanup or 'source missing' rendering" for `theology_links` whose
  `target_id` points at a deleted council session or study item) is **deferred**
  as a follow-up: it needs a UX decision (auto-cleanup risks discarding the
  user's link title/payload, so "source missing" rendering may be preferable),
  and touches the frontend. Tracked for a later packet.

## Testing

- **New** `delete_note_clears_its_item_tags`: tag a note, delete it, assert no
  `'note'` `item_tags` remain and the tag vocabulary is untouched.
- **New** `list_tags_with_counts_ignores_orphaned_note_links`: orphan a note tag
  by deleting the `user_notes` row directly, assert the tag count is 0 and equals
  `list_tagged_items` length.
- Existing `list_tags_with_counts_counts_browsable_items`,
  `delete_bookmark_clears_its_item_tags`, and the import/remap tag tests still
  pass. Both new tests confirmed RED before the fix.
- `cargo test` 97/97; full `npm run check` green; `npm run test:e2e:build`.
