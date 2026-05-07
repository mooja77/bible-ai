# Learning And Theology Testing And Release Plan

## Test Strategy

Use E2E tests for workflows crossing React, Rust, SQLite, sidecar, export, and restore boundaries. Use script-level verification for resource import and attribution.

## Phase 14 Tests: Human Judgment

E2E:

- Add starting judgment before Council submit.
- Run mock Council.
- Add position ratings and personal conclusion.
- Save and restore Council session.
- Add result to workspace.
- Export workspace and verify AI/user sections are distinct.

Data tests:

- Backup includes judgment rows.
- Restore preserves judgment rows.
- Deleting a Council session cleans up judgments and argument annotations so no orphaned learning rows remain.

## Phase 15 Tests: Research Trail

E2E:

- Mock Council result renders timeline.
- Evidence decision list shows used, supporting, conflicting, ignored.
- Weakest link and "what would change this" render for each position.
- Legacy Council result without research trail uses fallback UI.

## Phase 16 Tests: Argument Maps

E2E:

- Argument map renders claim/support/challenge/assumption/weakness groups.
- User can annotate a node.
- Annotation persists after restore.
- Argument map exports to workspace Markdown.

## Phase 17 Tests: Theology Mode

E2E:

- Open Theology mode.
- Verify the Theology progress panel renders topic status and evidence totals.
- Create or open a topic.
- Create a subtopic and verify it appears under its parent.
- Add a doctrine relation/tension note between two topics.
- Add passage link.
- Add verse-range link from Reader.
- Add Council session link.
- Add resource link.
- Add user conclusion and confidence.
- Export topic.
- Export topic plus subtopics.
- Export full "My Theology".

Backup/restore:

- Theology topics, links, positions, and conclusions survive JSON backup.
- Guided study focus questions, before/after reflections, critiques, and review
  cards survive JSON backup/restore.

## Phase 18 Tests: Open Resources

Script tests:

- Source assessment rejects accepted imports with unclear licensing or missing redistribution permission.
- Resource manifest validates.
- Public-domain text normalizer emits fixture JSONL from audited Markdown/plain text before import.
- Sefaria-style dump normalizer emits fixture JSONL only when the manifest has an explicit text-level license review.
- Import script rejects missing license/attribution.
- FTS index is rebuilt after JSON import, and imported entries are searchable through the Resources UI.
- Attribution report contains every imported source.

E2E:

- Settings shows imported source.
- Resource search returns fixture entry.
- Resource source, kind, license, and linked-Theology-topic filters preserve fixture search results.
- Resource workspace exports include attribution and share-alike requirements
  when a linked source declares redistribution obligations.
- Resource detail shows license/attribution.
- Resource entry links to workspace and theology topic.
- Exports include attribution appendix.

## Phase 19 Tests: Guided Learning

E2E:

- Study template prompts user for initial judgment before AI output.
- User can switch guided study templates and persist a non-default template.
- Completed guided study can save to workspace and theology topic.
- "I disagree with AI" correction saves user critique.
- Review cards show user-authored conclusions and linked passages.
- Study-review drill hides answers until requested and labels itself as a study aid, not a doctrine answer.

## Release Gates

Before marking the learning/theology arc complete:

- `npm run check`
- `npm run check:full`
- `npm run tauri -- build`
- `npm run release:check`
- Manual review of Theology mode on a clean profile.
- Manual export review for attribution and user/AI separation.
- Source license review for every imported resource.
- No provider key, gateway token, local path, or environment data appears in
  exports. Workspace Markdown/HTML/PDF export rendering and Theology markdown
  export rendering apply final sanitizers for secret-looking values and local
  filesystem paths, with E2E coverage on Workspace Markdown preview and Rust
  coverage on Theology export fixtures.

## Manual QA Checklist

- First-run guide explains AI-assistant posture.
- Council encourages user judgment before and after AI.
- User can disagree with AI without friction.
- Theology mode distinguishes user conclusions from AI summaries.
- Resource entries show source and license before export.
- Exports are readable without the app.
- Backup/restore preserves user-authored learning data.
