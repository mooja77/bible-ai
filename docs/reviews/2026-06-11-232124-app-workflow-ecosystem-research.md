# Bible AI workflow and ecosystem research addendum

Timestamp: 2026-06-11 23:21:24 +01:00

Filename timestamp: 2026-06-11-232124

Related reports:

- `docs/reviews/2026-06-11-230419-app-market-tech-research.md`
- `docs/reviews/2026-06-11-231437-app-expanded-research-addendum.md`

Scope: third external research loop, focused on workflow ecosystems rather than only direct Bible-app competitors. This pass covers open Bible software, personal knowledge management, teaching and sermon workflows, data portability, pricing signals, distribution, and a refined next-plan for the current app.

## Executive update

The earlier conclusion still holds: Bible AI should be a local-first, auditable Bible study workbench rather than a devotional habit app or generic Bible chatbot.

This loop sharpens the next strategic move:

> Bible AI should become the best bridge between Scripture study, AI-audited interpretation, and portable teaching/research outputs.

The app already has many of the required internal primitives: workspaces, Markdown/HTML/PDF export, Theology mode, Council judgment, research trail, resource provenance, and backup/restore. The missing product layer is a clear workflow package:

- Choose a source set.
- Ask or research a question.
- Compare views with auditable evidence.
- Record human judgment.
- Export a portable study packet for Obsidian, teaching, small group, sermon prep, archive, or review.

## Recursive loop log

### Loop 0 - Re-read prior findings

Previous docs correctly identified the core wedge: local-first, source-audited, multi-voice Council, open-resource path, strong release evidence, and AI evaluation.

Gap found: the plan was still mostly app-internal. It did not fully account for how serious users already organize research and teaching outside Bible software.

Self-improvement: add workflow interoperability as a first-class strategy, not an afterthought.

### Loop 1 - Open/free Bible software ecosystem

This pass added the broader non-premium Bible software lane: theWord, MySword, AndBible, Xiphos, Bible Analyzer, Catena, PocketBible, and similar module-driven tools.

Finding: the free/open Bible software ecosystem competes on module breadth, offline access, customization, and user control. This is closer to Bible AI's audience than YouVersion-style devotional apps.

Self-improvement: resource packs, source manifests, module/import policy, and offline trust are not "advanced settings." They are core positioning.

### Loop 2 - Research notebook and PKM workflows

Obsidian, Zotero, NotebookLM, LiquidText, Pandoc, CommonMark, CSL, and citation workflows shape expectations for serious study.

Finding: users who do research already expect portable notes, backlinks, citations, source lists, and export formats. Bible AI's Markdown exports are the right direction, but they should become structured enough for external tools.

Self-improvement: define an "interoperable study packet" format before adding more export buttons.

### Loop 3 - Church, teaching, and sermon workflows

Logos Sermon Builder, Sermonary, Planning Center, Proclaim, and similar tools show that pastors and teachers do not only need answers. They need outlines, manuscripts, discussion questions, handouts, slides, service planning handoff, and reuse.

Finding: Bible AI should not build church scheduling or presentation software, but it can export better preparation artifacts.

Self-improvement: add teaching/sermon packet outputs as a market-backed extension of existing workspace export.

### Loop 4 - Pricing and distribution signals

Premium Bible software and devotional apps show that users pay for content, sync, convenience, AI, and polished workflows. Free Bible software shows that module ecosystems and local control are also powerful.

Finding: Bible AI's initial pricing/distribution should not depend on paid content subscriptions. Its early trust story should be local build, open corpus, transparent AI setup, and optional managed gateway or support later.

Self-improvement: keep monetization separate from source trust and provider ownership.

## Expanded competitor and workflow map

| Product/tool | Lane | What it teaches Bible AI |
|---|---|---|
| theWord | Free desktop Bible software | Free/offline desktop users value module libraries, parallel views, searches, notes, and low friction. |
| MySword | Android Bible study | Mobile study users value offline modules, commentaries, dictionaries, journals, and customization. |
| AndBible | Open-source Android Bible study | Open-source users value SWORD modules, offline study, flexible workspaces, search, dictionaries, and data ownership. |
| Xiphos | Open-source SWORD desktop | SWORD-style module ecosystems remain important for serious users who want control. |
| Bible Analyzer | Free desktop Bible software | Free tools compete on dictionaries, commentaries, statistics, search, and library management. |
| Catena Bible | Patristic commentary reader | Historical commentary and church-father source browsing can be a differentiated resource pack. |
| PocketBible | Cross-platform paid Bible app | Cross-device purchased libraries and note sync are expected in paid study apps. |
| Obsidian | Local-first PKM | Markdown vaults, backlinks, graph thinking, and local files are strong models for Bible AI exports. |
| Zotero | Research/citation manager | Source collection, notes, citation export, and bibliography discipline matter for serious study. |
| NotebookLM | Source-grounded AI notebook | Source-grounded summaries and Q&A are becoming mainstream; Bible AI must differentiate through local source control and theological dissent. |
| LiquidText | Document research workspace | Visual source excerpts, annotations, and synthesis spaces are useful analogs for resource excerpts and Council evidence. |
| Logos Sermon Builder | Sermon/teaching workflow | Study output should become outline, manuscript, handout, and lesson assets. |
| Sermonary | Sermon writing workflow | Sermon-specific writing surfaces have value, but Bible AI should export into that lane rather than own it immediately. |
| Planning Center / Proclaim | Church presentation/service workflow | Bible AI should not build scheduling or presentation control; it should export clean handoff artifacts. |

## Product implications

### 1. Source sets should become visible workflow objects

Current research has repeatedly shown the same issue: answer quality and legal safety depend on the source set. Bible AI should make source sets explicit.

Recommended source-set examples:

- Default bundled Scripture: KJV, ASV, WEB, YLT, WLC, TR, Strong's, cross references.
- Original language study: WLC/TR plus morphology, lexicon, occurrences, MACULA/STEP candidates later.
- Open historical theology: public-domain creeds, confessions, commentaries, dictionaries.
- User-imported library: reviewed local resources.
- Connected licensed library: API.Bible/Bible Brain or future licensed provider.
- Quarantined library: unreviewed imports not eligible for Council evidence until accepted.

This should surface in the Council form, resource browser, export appendix, and Settings data-source screen.

### 2. Study packet export is the right next workflow layer

The app already supports Markdown/HTML/PDF exports. The next move should make exports more structured and reusable.

Recommended study packet sections:

1. Title and purpose.
2. Passage range/source set.
3. User question.
4. Key passages.
5. Retrieved evidence table.
6. Council short answer.
7. Major positions and disagreement.
8. User judgment and confidence.
9. Follow-up questions.
10. Resource excerpts with attribution.
11. Source/license appendix.
12. Provider/model manifest.
13. Export metadata and app version.

Recommended export variants:

- `study-packet.md`: CommonMark-compatible core.
- `study-packet.html`: portable human-readable copy.
- `study-packet.pdf`: share/archive copy.
- `study-packet.json`: machine-readable app backup/interchange for re-import.
- `obsidian/`: optional folder export with one note per passage/topic/session and wiki-style links.
- `citations.bib` or `references.csl.json`: later bibliography integration where source metadata supports it.

### 3. Teaching packet should be a distinct product output

Pastors, teachers, and small-group leaders need prepared outputs, not only research archives.

Recommended teaching packet sections:

- Big idea.
- Passage summary.
- Outline.
- Key terms.
- Discussion questions.
- Interpretive cautions.
- View comparison.
- Handout text.
- Suggested readings/resources.
- Leader notes.
- Source appendix.

The AI may draft these, but the UI should require a user review state before export: `draft`, `reviewed`, or `user-approved`.

### 4. External-tool interoperability beats sync for now

Local-first sync systems such as Automerge, Yjs, and Replicache are relevant later, but not immediate. Sync would complicate SQLite migrations, provider settings, backups, credentials, and conflict handling.

Near-term interoperability should be file-based:

- Markdown folders.
- JSON study packets.
- HTML/PDF outputs.
- Stable source IDs.
- Deterministic filenames.
- Backlinks and Bible reference anchors.

This gives Obsidian/Zotero/teaching users value before account sync exists.

### 5. AI evals should include workflow outputs, not just answers

The Council evaluation plan should test exported packets too.

Add eval checks for:

- Export includes source appendix.
- Teaching packet does not hide disagreement.
- AI-generated content and user-authored judgment are labeled separately.
- No local paths, provider secrets, or private source metadata leaks.
- Quarantined/unreviewed sources are not promoted as authoritative.
- Share-alike and attribution notices appear when required.

## Pricing and distribution research implications

Observed patterns:

- Logos uses paid subscription tiers and paid libraries.
- Accordance and Olive Tree monetize through software/packages/resources.
- Rebind-style AI study products can charge subscription prices around AI-plus-content.
- Dwell and devotional/audio apps monetize habit/content libraries through monthly or yearly subscriptions.
- Free/open Bible tools depend on community modules, donations, or paid optional resources.

Recommendation:

- Do not make v0.1 feel like another subscription chatbot.
- Keep personal/offline use credible and low-friction.
- If monetization is needed, separate it into:
  - optional managed gateway
  - optional support/builds
  - optional curated resource packs
  - optional licensed-content integrations
- Never bundle hidden provider keys or undisclosed remote routing.

Distribution recommendation:

- Private/test builds can remain unsigned if clearly labeled.
- Public Windows builds should move toward code signing to reduce install distrust.
- Public update channels should use Tauri's signed updater only after release gates, SBOM, tree hashes, and clean-profile QA are reliable.
- macOS should remain a separate lane until built, signed, notarized, and QAed on macOS.

## Concrete roadmap delta from this loop

### Immediate additions to the plan

1. Add `Study Packet v1` as a first-class release feature.

- Define Markdown, HTML, PDF, and JSON output contract.
- Include source sets, Council manifest, user judgment, resource attribution, and export metadata.
- Add fixture export tests.

2. Add `Source Set v1`.

- Let a Council run record the exact source set used.
- Show source set in result header and export appendix.
- Prevent quarantined sources from being used as Council evidence by default.

3. Add `Teaching Packet draft`.

- Generate outline, questions, handout, cautions, and source appendix from a workspace.
- Require user-reviewed state before presenting it as shareable.

4. Add `Obsidian-friendly export`.

- Folder export with Markdown files, stable slugs, Bible reference backlinks, and source appendix.
- No plugin dependency required.

5. Add `Interoperability tests`.

- Open exported Markdown as plain text.
- Verify stable filenames and anchors.
- Verify JSON packet re-import or at least schema validation.

### Defer

- Account sync.
- Mobile companion.
- Presentation control.
- Church service planning.
- Full citation manager.
- Paid licensed library marketplace.
- AI voice/audio/devotional habit loops.

## Documentation plan after this loop

The previous addendum recommended `product-positioning`, `competitive-landscape`, `source-provenance-policy`, `council-evaluation-plan`, and `release-security-checklist`. This loop adds two more docs:

- `docs/study-packet-format.md`
  - Markdown/HTML/PDF/JSON schema.
  - Obsidian export layout.
  - source appendix rules.
  - AI/user label rules.
  - import/re-import expectations.

- `docs/source-set-workflows.md`
  - source set classes.
  - Council source selection.
  - resource import/dry-run.
  - quarantine flow.
  - export disclosure.

Recommended order:

1. `docs/source-provenance-policy.md`
2. `docs/source-set-workflows.md`
3. `docs/study-packet-format.md`
4. `docs/council-evaluation-plan.md`
5. `docs/release-security-checklist.md`
6. `docs/product-positioning.md`
7. `docs/competitive-landscape.md`

Reasoning: source provenance and source sets are the foundation for study packets and Council evals. Product positioning and competitive landscape should be stable once those mechanics are named.

## Updated strategic one-liner

Bible AI is a local-first Bible study workbench that turns Scripture, open resources, and multi-voice AI into auditable study packets while preserving source provenance, theological disagreement, and user judgment.

## Updated target segments

Primary:

- Serious lay readers who want source-grounded answers.
- Small-group leaders who need discussion-ready studies.
- Pastors/teachers who want a lightweight prep companion without buying into a full premium library stack.
- Privacy-conscious users who want local data and user-owned AI routing.
- Open Bible software users who value offline modules and source control.

Secondary:

- Seminary students and researchers who already use Obsidian/Zotero.
- Users preparing personal systematic theology notes.
- Churches that need transparent study packets rather than another presentation platform.

Not primary:

- Daily devotional habit users.
- Audio-first Bible listeners.
- Prayer/meditation app users.
- Users who only want one instant AI answer.

## Key risks newly emphasized

| Risk | Severity | Mitigation |
|---|---:|---|
| Export bloat makes packets unreadable | Medium | Provide summary, full, and machine-readable variants. |
| Obsidian/export work distracts from release gates | Medium | Define format now, implement only after public trust blockers. |
| Teaching packet output looks like AI-authored doctrine | High | Require user review labels and keep AI/user sections distinct. |
| Source-set UI becomes too complex | High | Provide simple defaults and advanced disclosure. |
| Sync becomes tempting too early | Medium | Commit to file-based interoperability first. |
| Premium content expectations exceed open corpus | High | Be explicit about bundled, imported, connected, and unavailable sources. |

## Sources from this loop

- theWord Bible Software: https://www.theword.net/
- MySword: https://www.mysword.info/
- AndBible: https://andbible.org/
- Xiphos: https://xiphos.org/
- Bible Analyzer: https://www.bibleanalyzer.com/
- Catena Bible: https://catenabible.com/
- PocketBible / Laridian: https://www.laridian.com/content/pocketbible.asp
- Obsidian: https://obsidian.md/
- Zotero: https://www.zotero.org/
- Google NotebookLM: https://notebooklm.google/
- LiquidText: https://www.liquidtext.net/
- Logos Sermon Builder: https://support.logos.com/hc/en-us/articles/360016745111-Sermon-Builder
- Sermonary: https://sermonary.com/
- Planning Center Services: https://www.planningcenter.com/services
- Proclaim: https://proclaim.logos.com/
- Logos subscription pricing: https://www.logos.com/configure/subscriptions
- Accordance store: https://accordancebible.com/store/
- Dwell pricing: https://dwellapp.io/pricing
- Rebind Study Bible: https://classics.rebindapp.com/study-bible/
- Pandoc: https://pandoc.org/
- CommonMark: https://commonmark.org/
- Citation Style Language: https://citationstyles.org/
- CSL JSON schema: https://github.com/citation-style-language/schema
- Automerge: https://automerge.org/
- Yjs: https://docs.yjs.dev/
- Replicache: https://replicache.dev/
- Tauri updater: https://v2.tauri.app/plugin/updater/
- Tauri Windows code signing: https://v2.tauri.app/distribute/sign/windows/
