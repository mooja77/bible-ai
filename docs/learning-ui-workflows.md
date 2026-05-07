# Learning And Theology UI Workflows

## Navigation Changes

Add a top-level `Theology` mode.

Sidebar order:

1. Reader
2. Council
3. Theology
4. Work
5. Settings

The existing automated guide should gain a Theology step once Theology mode exists.

## Council: Human Judgment Workflow

Before submit:

- Show optional "My starting view" field under the question box.
- Label it clearly as private user judgment.
- Store it only if the user submits or explicitly saves a draft.

After result:

- Add a `My Judgment` section after evidence/rationale but before raw source drawer.
- Fields:
  - Personal conclusion.
  - Confidence slider.
  - What persuaded me.
  - What remains unclear.
  - What changed from my starting view.
  - Follow-up questions.
- Position rows:
  - User rating: persuasive, weak, unclear, needs study, disagree.
  - Optional user weight.
  - Notes on evidence and weaknesses.

Interaction rules:

- Never auto-fill the user's conclusion.
- AI may suggest follow-up questions, but user-authored fields must remain visually distinct.
- Exports label AI and user sections separately.

The implemented Council judgment panel shows AI-suggested follow-up questions
derived from visible unresolved tensions, weakest links, and "what would change
this" fields. Users must explicitly add a suggested question to their own open
questions before it becomes part of the saved judgment.

## Council: Research Trail Workflow

Add a timeline view:

1. Question received.
2. Retrieval filters used.
3. Evidence retrieved.
4. Evidence classified.
5. Voices ran.
6. Positions clustered.
7. Synthesis produced.
8. User judgment added.

Each event opens details:

- Inputs.
- Source rows.
- Provider/voice status.
- Links to evidence audit and source drawer.

## Argument Map Workflow

Each Council position gets a `Map` tab.

Map sections:

- Main claim.
- Supporting evidence.
- Challenging evidence.
- Interpretive assumptions.
- Weakest link.
- What would change this conclusion.
- User annotations.

Comparison view:

- Show two positions side by side.
- Highlight different interpretive moves.
- Show which passages both sides use differently.

## Theology Mode Workflow

## Theology Home

Layout:

- Left topic list grouped by doctrine category.
- Center selected topic summary.
- Right "My Theology" progress panel.

Topic cards show:

- Title.
- User conclusion status: not started, studying, drafted, settled for now.
- Linked passages count.
- Linked Council sessions count.
- Open questions count.

The implemented topic list shows status plus passage/Council counts. The progress panel summarizes started, drafted, settled, passage, resource, Council, and open-question totals across "My Theology".

## Theology Topic Detail

Sections:

- Overview.
- Key questions.
- Major positions.
- Key passages.
- Linked Council sessions.
- Linked resources.
- My conclusion.
- Open questions.
- Doctrine links and tensions.

The implemented topic detail view includes generated key study questions based
on the topic's evidence, positions, doctrine links, subtopics, and conclusion.
Each prompt can be added to the user-authored open questions field with one
click, keeping prompts as study scaffolding rather than app-authored answers.

The implemented linked-evidence area groups saved links into Key passages,
Linked resources, Linked Council sessions, Workspace evidence, and Notes and
argument maps. Each row keeps the source kind, target id, and a short payload
preview visible so the topic reads as a study dossier rather than an undifferentiated
list of saved links.

Primary actions:

- Add passage.
- Add resource.
- Add Council session.
- Ask Council about this topic.
- Export topic.
- Create a custom topic.
- Edit the selected topic title and summary.

## Dynamic Systematic Theology Export

Export options:

- Current topic.
- Topic and subtopics.
- Full "My Theology".

The implementation supports current-topic export, topic-plus-subtopics export,
and full "My Theology" export. Nested topic management is implemented through
parent-topic selectors in topic creation/editing, a selected-topic subtopic
panel, and topic-plus-subtopics Markdown/PDF export actions.

Doctrine links and tensions are implemented as structured topic relations. Users can mark another doctrine topic as a dependency, support, or tension and add a user-authored note explaining the relationship.
The topic detail view also renders a lightweight doctrine map showing the
current topic, its relation lanes, and subtopics so dependencies and tensions
can be scanned visually without a heavy graph dependency.

Export sections:

- Topic status, timestamps, and linked-evidence counts.
- User-authored conclusion.
- Confidence and unresolved questions.
- Key evidence.
- Major positions considered.
- AI-assisted Council sessions.
- Source/resource attribution.
- Change history if available.

The implemented Theology export now includes topic status, created/updated
timestamps, conclusion update timestamps, linked-evidence counts, open-question
counts, explicit change-history notes, and guided-study completion/update timing
so the Markdown/PDF output can be reviewed as a developing learning record.
It also includes generated key study questions as study scaffolding before the
user's conclusion and open questions.
It also preserves grouped evidence sections for key passages, resources, Council
sessions, workspace evidence, and notes/argument maps, including short payload
previews where available.
Doctrine map exports include the current topic and relation summaries so the
visual relationship model remains readable in Markdown/PDF.

## Open Resources Workflow

Settings > Data Sources:

- Show imported sources.
- Show license, version, source URL, attribution, import date.
- Show whether source is bundled, user-imported, or deferred.

The implemented Data Sources screen labels bundled translations and resources,
user-imported resource manifests, and deferred candidate sources with visible
status badges.
Open resource sources also surface review notes, redistribution notes, and
share-alike requirements from source metadata so users can inspect source
obligations before linking or exporting excerpts.

Resources browser:

- Search by text, title, author/source, reference, topic.
- Filter by license/source/kind.
- Open entry detail.
- Add excerpt to workspace.
- Link entry to theology topic.
- Draft a Council question from the selected resource excerpt.

Entry detail:

- Body text.
- Citation.
- Source and license.
- Related Scripture references where available.
- Link/add buttons.
- Ask Council button that turns the visible excerpt, citation, source, and
  related Scripture refs into an editable Council question.

The implemented detail panel shows a citation block built from entry title,
reference, collection, and source. If resource payload metadata includes
`related_scripture_refs` or `scripture_refs`, those references render as visible
chips and are carried into Theology/workspace link payloads.

The implemented Council handoff does not silently treat resource text as
Scripture evidence. It drafts a question asking the user to test the resource's
claims against Scripture, then opens Council with the question still editable.

Reader verse detail panels also include a direct Theology-topic picker so a passage can be linked without manually re-entering the citation.

Reader selected-range action bars include the same Theology-topic link action for multi-verse evidence.

Search results include selected-result Theology linking with a topic picker, so
users can promote discovered passages directly into a doctrine topic without
first saving them to a workspace.

Workspace items include the same Theology-topic picker and link action. This
lets saved notes, passages, searches, explanations, resource excerpts, and
Council results become doctrine-topic evidence after the user has organized
them in a workspace.

## Guided Learning Workflow

Add guided study templates:

- Study a passage.
- Compare theological positions.
- Build a doctrine topic.
- Review my theology.

The implemented runner exposes these templates from a selector and persists each template as a separate guided study session for the selected doctrine topic.

The runner includes an editable "Guided study question" field before the
before/after/critique responses. Generated key study questions can populate this
field with one click, but the user can revise it before saving the study.
When Council is available, the runner also exposes an "Ask Council" action that
opens Council with the guided-study question as an editable prompt for testing
the issue against Scripture.

Each template should ask the user to write a short answer before AI analysis appears.

Completed guided studies regenerate visible review cards from user-authored
conclusions, linked passages, major positions/terms, before/after reflection,
and the user's critique. These cards are shown in the runner and are included
when the guided study is added to a workspace.
Workspace Markdown export renders the guided-study focus question as an
explicit metadata field before the study body and review cards.

The runner includes a study-review drill for saved cards. Answers are hidden
until the user reveals them, and the drill is explicitly labeled as a study aid
rather than a doctrine answer.
The topic detail view includes a guided study history panel for every saved
template on that topic, showing draft/completed state, reflection previews, and
review-card counts. Selecting a history row opens that template in the runner.

Theology Markdown/PDF exports include the generated study review cards under
each completed guided session so the exported material remains usable for
review without reopening the app.

For example, "Compare theological positions":

1. State the question.
2. Write initial view.
3. Retrieve passages.
4. Ask Council.
5. Compare positions.
6. Record judgment.
7. Save to Theology topic.

## Empty And Error States

Theology empty state:

- "Choose a topic or create one."
- Actions: create topic, open guide, import resources.

The implemented Theology fallback keeps the create-topic form visible and adds
empty-state actions for opening the guided tour at the Theology step and moving
to Resources for import/search work.

Resource empty state:

- "No resources imported yet."
- Actions: open Data Sources, read resource import docs.

The implemented Resources empty state distinguishes no imported resources from
no matching results, offers a Clear filters action when filters/search are
active, opens Settings > Data Sources, and exposes the import-plan docs path.

Council judgment empty state:

- "Add your own judgment before exporting this study."
- Actions: write conclusion, mark needs study.

The implemented Council judgment panel includes a `Mark needs study` action that
sets position ratings to `needs study`, lowers confidence, and adds an open
question prompt while leaving every field editable before saving.
