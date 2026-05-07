# Learning And Theology Technical Implementation

## Current Architecture Fit

The work builds on the existing local-first architecture:

- React/TypeScript frontend in `app/src`.
- Tauri Rust IPC commands in `app/src-tauri/src/lib.rs`.
- User data in `user.sqlite` managed by `app/src-tauri/src/user_db.rs`.
- Read-only corpus in `corpus.sqlite`.
- Council/provider orchestration in `app/sidecar`.
- Workspace export renderers in `app/src/features/workspaces`.

No cloud account or collaboration service is required for the first implementation. Managed Gateway remains optional for deployments that want hosted provider routing.

## New Frontend Modules

```text
app/src/features/judgment/
  JudgmentPanel.tsx
  PositionJudgmentControls.tsx
  judgmentExport.ts

app/src/features/research/
  ResearchTrail.tsx
  EvidenceDecisionList.tsx
  ArgumentMap.tsx
  argumentMapFallback.ts

app/src/features/theology/
  TheologyPanel.tsx
  TheologyTopicList.tsx
  TheologyTopicDetail.tsx
  TheologyPositionList.tsx
  TheologyLinkPicker.tsx
  TheologyExportPreview.tsx
  theologyMarkdown.ts

app/src/features/resources/
  ResourceBrowser.tsx
  ResourceSearch.tsx
  ResourceCitation.tsx
  ResourceAttributionPanel.tsx
```

## New Rust Commands

Human judgment:

- `get_council_judgment(session_id)`
- `upsert_council_judgment(session_id, judgment)`
- `delete_council_judgment(session_id)`
- `list_judgments_for_workspace(workspace_id)`

Research and argument annotations:

- `upsert_argument_annotation(session_id, node_id, annotation)`
- `list_argument_annotations(session_id)`
- `delete_argument_annotation(id)`

Theology:

- `list_theology_topics()`
- `get_theology_topic(id)`
- `create_theology_topic(title, summary?, parent_id?)`
- `update_theology_topic(topic)`
- `list_theology_positions(topic_id)`
- `upsert_theology_position(position)`
- `upsert_theology_conclusion(conclusion)`
- `create_theology_link(link)`
- `delete_theology_link(id)`
- `export_theology_markdown(topic_id?, include_subtopics?)`

Implemented topic commands expose custom topic creation and topic-detail edits in the Theology UI. Slugs are generated from the title and de-duplicated locally so user-created topics can sit beside the seeded systematic theology outline.

Resources:

- `list_resource_sources()`
- `list_resource_collections(source_id?)`
- `search_resources(query, source_id?, collection_kind?, license?, topic_id?, limit?)`
- `get_resource_entry(id)`

Resource-to-workspace linking composes `get_resource_entry` with the existing workspace item commands. Resource-to-Theology linking composes `get_resource_entry` with `create_theology_link` so the saved link carries source, license, attribution, and excerpt payloads. Implemented resource search accepts optional collection-kind, license, and Theology-topic filters. Search results include collection kind so the Resources UI can show and filter source, kind, license, and already-linked doctrine context before the user links or exports an entry.

## Sidecar Changes

Update provider prompts so Council output includes:

- `research_trail`: ordered visible events.
- `position.argument_map`: claim, support nodes, challenge nodes, assumption nodes, weakness nodes.
- `position.weakest_link`.
- `position.what_would_change_this`.
- `position.interpretive_moves`: structured tags and explanations.

The sidecar must keep these fields user-visible and concise. It should not expose hidden chain-of-thought. It should expose inspectable reasoning summaries, citations, assumptions, and limitations.

## TypeScript Contracts

Add types in `app/src/lib/bible.ts`:

- `CouncilJudgment`
- `PositionJudgment`
- `ResearchTrailEvent`
- `ArgumentMap`
- `ArgumentMapNode`
- `ArgumentAnnotation`
- `TheologyTopic`
- `TheologyPosition`
- `TheologyConclusion`
- `TheologyLink`
- `ResourceSource`
- `ResourceCollection`
- `ResourceEntry`
- `ResourceCitation`

Council response types should accept missing fields for backward compatibility with saved sessions.

## Export Integration

Workspace exports should include:

- User judgment summary for saved Council results.
- Before/after judgment fields.
- Position-level user ratings.
- Argument maps and annotations.
- Theology topic links.
- Resource excerpts with citations and license attribution.

Workspaces refresh saved Council items with `list_judgments_for_workspace`
before preview/export, so Markdown, HTML, and PDF exports use the current
persisted human judgment rather than only the judgment snapshot saved when the
Council item was first added.

Theology exports should include:

- Topic outline.
- Major positions.
- Key passages.
- Linked Council sessions.
- Linked resource excerpts.
- User conclusion and confidence.
- Open questions.
- Full source attribution appendix.

The Theology screen exposes current-topic export, topic-plus-subtopics export, and full "My Theology" Markdown/PDF export actions. Guided study export includes all saved template sessions for each exported topic, including generated study review cards so exported theology notes retain the learner-facing review workflow.

Theology exports preserve the same evidence grouping used in the topic detail UI:
key passages, linked resources, linked Council sessions, workspace evidence, and
notes/argument maps. Export rows include kind labels, target ids, and short
payload previews where available so the exported document remains inspectable
without reopening the app.

Workspace Markdown exports promote guided-study focus questions as structured
metadata before the saved study body and review cards, so a guided study remains
understandable after it is moved into a workspace or shared outside the app.

## Migration Strategy

- Increment `USER_SCHEMA_VERSION` for every user schema change.
- Add idempotent migrations in `user_db.rs`.
- Mirror schema in `data/schema.sql`.
- Keep existing workspace and Council session payloads readable.
- Build fallbacks for missing research trail and argument map fields.

## Acceptance Criteria

- Users can complete a Council workflow and save their own judgment without relying on AI conclusion text.
- Users can create a theology topic, link evidence, write a conclusion, and export it.
- Imported resources can be searched and linked with visible attribution.
- All new persistent data is included in backup/restore.
- E2E tests pass without network access in mock mode.
