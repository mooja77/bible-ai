# Learning And Systematic Theology Plan

## Product Intent

Bible AI should be a study assistant that helps users learn, reason, compare evidence, and form their own judgments. It must not present AI synthesis as a replacement for human interpretation, prayerful study, pastoral accountability, or scholarly work.

The next product arc turns the app into:

- A human judgment environment where the user's reasoning is captured beside AI output.
- A transparent research workspace where retrieval, sources, assumptions, disagreements, and weak links stay inspectable.
- A dynamic systematic theology builder where doctrines, passages, positions, notes, resources, and Council sessions can be connected over time.
- An open-resource study library with clear license, attribution, source provenance, and export rules.

## Design Principles

- AI is an assistant, not an authority.
- User judgment is first-class data, not an afterthought.
- Every claim should be traceable to source material, visible reasoning, or a user-authored note.
- Dissent, uncertainty, and unresolved questions should remain visible.
- The app should reward careful reading over fast conclusion.
- Resources must be source-attributed and license-audited before import.
- Exports must preserve enough evidence and attribution for the study to stand outside the app.

## Phase Order

## Phase 14: Human Judgment Layer

Purpose: let users record their own assessment before and after reading AI analysis.

User outcomes:

- Write an initial judgment before asking the Council.
- Rate each Council position independently from AI weights.
- Record what evidence was persuasive, weak, unclear, or missing.
- Write a final personal conclusion with confidence and open questions.
- Export AI output and user judgment together.

Initial scope:

- Add user judgment data model.
- Add "My Judgment" panel to Council results.
- Save judgments against Council sessions.
- Include judgments in Workspace Markdown/HTML/PDF exports.
- Add E2E coverage for creating, editing, restoring, and exporting a judgment.

## Phase 15: Research Trail And Reasoning Audit

Purpose: expose how a result was built, from retrieval to synthesis to user judgment.

User outcomes:

- See the timeline: question, retrieval, evidence grouping, voices, synthesis, user judgment.
- Inspect why a source was used, ignored, conflicting, or missing.
- See the weakest link in each argument.
- See what new evidence would most change the conclusion.
- Save research trails into workspaces.

Initial scope:

- Extend Council responses with research-trail events.
- Add retrieval explanations for every candidate evidence row.
- Add per-position "weakest link" and "what would change this" fields.
- Render a research timeline in Council and workspace restore views.

## Phase 16: Argument Maps

Purpose: turn Council positions into inspectable argument structures.

User outcomes:

- View each position as claim, evidence, assumptions, challenges, and weaknesses.
- Compare interpretive moves across positions.
- Annotate argument-map nodes with personal notes.
- Save argument maps to workspaces and theology topics.

Initial scope:

- Add argument-map shape to Council result payloads.
- Add deterministic fallback maps for existing/legacy Council sessions.
- Render maps without a heavy graph dependency first: grouped cards and connecting bars are enough.
- Add user annotations to map nodes.

## Phase 17: Dynamic Systematic Theology

Purpose: create a living doctrinal study mode built from sources, Council sessions, user notes, and user conclusions.

User outcomes:

- Browse standard theology topics.
- Track major positions under each topic.
- Link passages, resources, Council sessions, notes, and argument maps to doctrine topics.
- Write personal conclusions and confidence levels.
- See doctrine dependencies and tensions.
- Export "My Theology" as Markdown/PDF.

Initial topic set:

- Scripture
- God
- Trinity
- Creation
- Humanity
- Sin
- Christ
- Spirit
- Salvation
- Church
- Sacraments/ordinances
- Last things
- Ethics

Initial scope:

- Add Theology top-level mode.
- Add topic dashboard and topic detail view.
- Add doctrine position records and user conclusions.
- Add links from Council, Reader, Search, Workspaces, and Resources into theology topics.
- Add doctrine map and export.

## Phase 18: Open Resource Library

Purpose: bring more open, attributable study resources into the app.

User outcomes:

- Browse imported public-domain and open-license resources.
- Search resources beside Scripture.
- Link resource excerpts to Council, Workspaces, and Theology topics.
- See license and attribution for every resource.

Initial resource candidates:

- World English Bible family where edition and trademark use are clean.
- Open.Bible Creative Commons translations where attribution/share-alike rules are compatible.
- Sefaria public-domain/free-license texts where reuse terms allow local import.
- Cross-reference datasets where attribution/share-alike requirements are acceptable.
- Open Scriptures morphology and lexical resources already aligned with current corpus direction.
- Public-domain historical theology and creeds/confessions after source audit.

Initial scope:

- Add resource manifest format.
- Add resource source registry in Settings > Data Sources.
- Add import scripts with license metadata.
- Add Resources mode or Resources tab under Theology.
- Add resource search and citation rendering.

## Phase 19: Guided Learning Workflows

Purpose: turn app features into repeatable learning exercises.

User outcomes:

- Follow a study path for a doctrine or disputed topic.
- Compare views step by step.
- Answer reflection prompts before seeing AI synthesis.
- Review saved doctrine conclusions over time.
- Quiz from user notes and saved passages without presenting quiz output as doctrine.

Initial scope:

- Add guided study templates.
- Add "before AI / after AI" prompts.
- Add review cards for passages, terms, and user-authored conclusions.
- Add "I disagree with the AI" correction workflow that saves the user's critique.

## Full Completion Criteria

- Council results always provide space for user judgment.
- Theology topics can collect passages, resources, Council sessions, argument maps, and user conclusions.
- Open resources are searchable, attributable, and exportable.
- Exports include AI output, user judgment, source citations, and license attribution.
- Onboarding explains that the app supports learning and thinking rather than replacing them.
- E2E tests cover human judgment, theology topic workflows, resource linking, resource attribution, and exports.
