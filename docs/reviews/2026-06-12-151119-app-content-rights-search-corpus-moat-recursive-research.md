# Bible AI content rights, corpus moat, and search architecture recursive research

Generated: 2026-06-12 15:11:19 +01:00

Filename timestamp: 2026-06-12-151119

Scope: additional recursive research pass on tools, competitors, the Bible software/content market, Scripture data rights, open-resource strategy, search/indexing technology, and roadmap implications for the current app.

This is not legal advice. It is a product, engineering, and release-risk synthesis that should be reviewed before public distribution decisions.

## Executive update

The next strategic moat is not "more AI." It is a rights-aware content operating system.

Bible AI already has a coherent local stack:

- Bundled public-domain/permissive corpus policy in `docs/data-sources.md`.
- Public-domain and open-resource intake policy in `docs/open-resource-ingestion-plan.md`.
- Corpus expansion guardrails in `docs/phase-13-corpus-roadmap.md`.
- `translations`, `translation_text`, `translation_text_fts`, `word_tokens`, `cross_refs`, `strongs`, and `verse_embeddings` in `data/schema.sql`.
- `resource_sources`, `resource_collections`, `resource_entries`, and `resource_entries_fts` for user-installed resources.
- Resource source assessment scripts that block unknown licenses, unclear accepted licenses, unusable source quality, and poor or unverified OCR.
- SQLite FTS5 plus local embedding BLOBs, avoiding a vector-service dependency for v0.1.

The gap is that these primitives are not yet promoted into a complete content-rights strategy:

1. Every source needs a decision class: bundled, user-imported, online API only, partner-licensed, deferred, or blocked.
2. Every source needs export and AI-use rules, not just a license label.
3. Every source needs language, script, canon scope, versification, edition, checksum, update cadence, and attribution metadata.
4. Search/indexing needs scale thresholds, so the app does not add Tantivy, sqlite-vec, or Qdrant before there is evidence.
5. Competitor catalog depth should be treated as a rights and workflow problem, not a feature checklist.

New thesis:

> Bible AI should win early by making open and user-owned sources feel trustworthy, inspectable, and exportable. It should not try to win by matching licensed catalog size before beta.

## Recursive pass log

### Pass 1: Local corpus and source pipeline scan

Local files reviewed:

- `docs/data-sources.md`
- `docs/open-resource-ingestion-plan.md`
- `docs/phase-13-corpus-roadmap.md`
- `data/schema.sql`
- `app/scripts/resources/assess-source.mjs`
- `app/scripts/resources/validate-resource-manifest.mjs`
- `app/scripts/resources/test-resource-fixtures.mjs`
- `app/src-tauri/src/user_db.rs`
- recent research reports under `docs/reviews/`

Current strengths:

- The app explicitly avoids bundling modern copyrighted translations without rights.
- Existing bundled corpus is limited to public-domain or permissively licensed sources.
- WEB import is already tied to eBible USFM.
- Resource import requires manifest metadata and source review.
- Sefaria-style import is intentionally local-dump based and requires explicit license review.
- Poor OCR is already treated as a blocker in the source assessment path.
- Resource export paths already preserve attribution and share-alike metadata in important flows.
- Resource FTS is rebuilt after import.

Current gaps:

- No central `content-bom` exists for all bundled and user-importable content.
- No normalized rights class exists beyond free-text license/metadata fields.
- No explicit `ai_use_allowed`, `local_storage_allowed`, `export_excerpt_allowed`, or `commercial_use_allowed` field exists in the standard manifest.
- No checksum/update-cadence requirement is enforced for user-imported resources.
- No source decision matrix exists for API.Bible, DBL, YouVersion Platform, Open.Bible, Sefaria, CrossWire/SWORD, OSIS, USFM/USX, or public-domain historical theology.
- No search/indexing upgrade threshold exists for moving from SQLite FTS5 and raw embedding scans to sqlite-vec, Tantivy, Qdrant Edge, or a separate vector service.

Self-improvement from this pass:

Earlier research correctly said "rights-first." This pass makes that operational: rights-first means a structured source decision model, not a paragraph in a roadmap.

### Pass 2: Bible text standards and rights landscape

Standards and platforms checked:

- Paratext/UBS USFM documentation.
- CrossWire OSIS documentation.
- CrossWire SWORD module-making documentation.
- API.Bible documentation and licensing pages.
- Digital Bible Library.
- YouVersion Platform developer docs.
- eBible WEB copyright page.
- Open.Bible resources.
- Sefaria copyright/data-use docs.
- Open Scriptures MorphHB license.
- OpenBible.info cross-reference data.
- Creative Commons license summaries.
- SPDX license list.
- CycloneDX license-compliance model.

Findings:

| Area | Finding | Bible AI implication |
| --- | --- | --- |
| USFM/USX | USFM is widely used for Scripture markup; API.Bible states it uses USX, derived from USFM, and aligns with DBL and major Bible organizations. | Make USFM/USX the primary Bible import normalization lane. Preserve footnotes, headings, paragraphs, and section structure where possible. |
| OSIS | OSIS is an XML standard for Bibles and biblical research texts. | Treat OSIS as an interchange format, especially for existing open Bible files and research texts. |
| SWORD | SWORD modules are binary files plus `.conf` metadata and may be OSIS/ThML/GBF sourced. | Treat SWORD as an ecosystem integration, not a quick parser. Prefer importing source OSIS/USFM/text where rights permit. |
| WEB/eBible | WEB is public domain, but the "World English Bible" name is trademark-sensitive if the text is changed. | Keep exact edition identity, source date, and "do not rename modified text as WEB" rule in metadata. |
| API.Bible | Provides a licensed API path for open-access and copyrighted translations; some Bibles require standard or unique licenses. | Use as an online/permissioned lane later, not as a bundled-content shortcut. |
| DBL | DBL is a Scripture asset and license management platform with text/audio/video/print/braille content in many languages. | Treat DBL as a rights-holder and partner workflow, not a beta dependency. |
| YouVersion Platform | Provides developer APIs/SDKs after app registration, app key use, and accepted license agreements. | Strong future API lane, but not aligned with offline bundled storage until terms explicitly allow it. |
| Open.Bible | Open resources are under varied Creative Commons license types. | Good candidate queue, but each source must be reviewed independently for BY, BY-SA, NC, ND, export, and AI-use constraints. |
| Sefaria | Each text/version/language can have its own license; unverified texts are not safe to assume. | Current local-dump plus explicit review approach is right. |
| Open Scriptures MorphHB | WLC base text is public domain, lemma/morphology data is CC BY 4.0. | Keep attribution precise and separate base text from morphology layer. |
| OpenBible.info cross references | Cross-reference data draws from public-domain sources and is generally CC BY unless otherwise indicated; ESV quotations are separate. | Keep mapping license separate from any Scripture quotation license. |
| Creative Commons | BY-SA allows commercial reuse but requires attribution and same-license terms for adapted material; NC blocks commercial use. | Do not treat all CC sources as equal. Export rules matter. |
| SPDX/CycloneDX | SPDX normalizes license identifiers; CycloneDX supports license-compliance metadata. | Add content-license identifiers and a content BOM separate from the software SBOM. |

Self-improvement from this pass:

The app should stop using "open" as a single bucket. Use precise rights classes, because public domain, CC BY, CC BY-SA, CC BY-NC, unverified, permissioned API, and direct publisher license have different product implications.

### Pass 3: Competitor content moat pass

Competitor content strategies:

| Product | Content strategy | Search/AI signal | Bible AI implication |
| --- | --- | --- | --- |
| Logos | Paid/owned and unowned resource library, subscriptions, AI-assisted Smart Search, summaries, citations, and purchase previews. | Smart Search can search Bible, all resources, owned books, and unowned resources with synopsis and footnotes. | Do not summarize unowned resources unless rights allow it. Compete on local auditability and explicit source sets. |
| Accordance | Serious desktop study suite with a large paid library, original-language strength, tutorials, and pastor/academic positioning. | Emphasizes speed, flexibility, Bible-centered study, and deep original-language workflows. | Bible AI should not underplay original-language and morphology UX. |
| Olive Tree | Offline-friendly app/resource library with BibleReader and resource guide style workflows. | Over 20 English Bible translations and 1,300+ PC resources are marketed for desktop. | Offline access plus resource packs are expected in serious study apps. |
| Bible Gateway Plus | Web subscription with study/reference resources alongside Bible text. | Browser-first premium resource lane. | Bible AI's exportable local workspace should be clearer than web-only subscription study. |
| Blue Letter Bible | Free study tools, commentaries, lexicons, interlinear, dictionaries, and cross-reference workflows. | Strong free benchmark for lexical/reference breadth. | Bible AI must make synthesis and provenance better, not merely duplicate reference links. |
| YouVersion | Massive Bible habit platform and now developer platform. | API/SDK access may become a major content distribution route. | Not an early competitor for desktop research, but a major rights/access ecosystem to monitor. |

Content-market conclusion:

Library depth is a rights moat. AI search becomes much more valuable when it sits on top of a lawful, well-indexed, trusted library. For Bible AI, the early moat should be:

- source transparency,
- local-first ownership,
- auditable Council reasoning,
- open-resource imports,
- exportable Study Packets,
- explicit license/attribution handling,
- reviewable retrieval traces.

Self-improvement from this pass:

The product should avoid saying "we have Logos-style AI search" unless it has Logos-style rights to the searched content. Better claim: "search and synthesize sources you own, sources we can ship, and sources you explicitly import."

### Pass 4: Search and indexing technology pass

Current app architecture:

- Corpus keyword search: SQLite FTS5.
- Resource keyword search: SQLite FTS5 external-content table over `resource_entries`.
- Semantic search: local embeddings stored as raw little-endian `f32` BLOBs in SQLite.
- Ranking: current resource FTS orders by `bm25(resource_entries_fts)` in Rust query code.
- Vector search: Rust cosine scan over embedding rows, without sqlite-vec at runtime.

External tech checked:

- SQLite FTS5 official docs.
- sqlite-vec docs.
- Tantivy docs.
- Qdrant docs, including Qdrant Edge and hybrid search topics.

Decision: keep SQLite FTS5 plus raw embedding scan for v0.1.

Reasons:

- The corpus is still modest enough for local-first SQLite.
- The current schema intentionally avoids a bundled vector extension.
- SQLite FTS5 is already embedded, simple, and compatible with the app's backup/restore story.
- Raw embedding scans avoid extension-loading and packaging complexity.
- The bottleneck is retrieval quality evaluation, not search infrastructure.

Upgrade thresholds:

| Candidate | Add only if | Reason to defer now |
| --- | --- | --- |
| sqlite-vec | Semantic search p95 exceeds 500ms on target hardware, or vector rows exceed roughly 250k, or multiple resource libraries need vector search. | Adds extension packaging and a pre-v1 dependency; current raw scan is simpler. |
| Tantivy | Resource search grows beyond SQLite FTS ergonomics: large multi-field documents, stemming/language-specific analyzers, facets, fast snippets, large commentary libraries, or heavy ranking tuning. | Adds separate index lifecycle and rebuild complexity. |
| Qdrant Edge | Local vector scale becomes large enough for embedded ANN and hybrid retrieval beyond SQLite. | New dependency and storage model; likely later than sqlite-vec/Tantivy. |
| Qdrant service | Managed gateway or hosted sync/search becomes a product line. | Conflicts with default local-first/offline posture. |
| Cloud search | Licensed/API content must be searched online under provider terms. | Requires privacy, retention, and rights docs. |

Immediate search improvements without infrastructure swap:

1. Add a retrieval eval fixture set for common Bible questions, disputed topics, lexical questions, and sparse-evidence questions.
2. Add resource FTS integrity checks after import using SQLite's FTS5 `integrity-check` command.
3. Track p50/p95 search latency for keyword, semantic, hybrid, and resource searches in dev QA logs.
4. Add source-type filters: Scripture, original language, cross references, commentary, creed/confession, lexicon, topic.
5. Add canon/versification filters before importing deuterocanonical or alternate-versification texts.
6. Add language/script/direction fields to search result metadata.
7. Add "why this matched" details for semantic results, not only keyword snippets.

Self-improvement from this pass:

Do not add search tech because competitors have bigger libraries. Add search tech only when the content scale and eval results prove the current stack is insufficient.

### Pass 5: Global language and corpus expansion pass

Wycliffe UK reports June 2026 Bible translation statistics with 7,393 world languages, 801 full Bibles, 1,835 New Testaments, 1,516 portions, and 3,241 languages with no Scripture yet. ProgressBible also frames Scripture-language data as complex, collaborative, and operational.

Implication:

- Multilingual Bible access is huge, but it is not a private-beta content target.
- English-first beta is still correct.
- The metadata system should be ready for language, script, direction, canon, and versification now, so multilingual expansion does not require a schema rethink later.

Decision:

- Keep Phase 13 corpus expansion separate from v0.1 beta.
- Add metadata requirements now.
- Do not import multilingual sources without UI support for script direction, font fallback, sorting, search analyzers, canon/versification differences, and attribution.

Self-improvement from this pass:

The right near-term investment is not multilingual breadth; it is metadata discipline that makes multilingual breadth possible later.

## Proposed source decision classes

Add a normalized decision class to source reviews and manifests. This can live in `metadata_json` first, then become schema columns when stable.

| Class | Meaning | Allowed product use |
| --- | --- | --- |
| `bundled_public_domain` | Public-domain source approved for app distribution. | Bundle, index, export excerpts, use in Council, include in release content BOM. |
| `bundled_open_license` | Open-license source approved for app distribution with obligations. | Bundle only if attribution/share-alike/export rules are implemented. |
| `user_imported_open_license` | User can import locally, but app does not ship it. | Local index and use in Study Packets with attribution/export warnings. |
| `user_imported_private` | User-owned/private notes or documents. | Local-only, never bundled, never uploaded without explicit user action. |
| `online_permissioned_api` | API access under platform/provider terms. | Online-only unless terms explicitly allow caching/offline storage. |
| `partner_license` | Direct permission from publisher/rightsholder. | Use exactly as the agreement permits; needs separate license record. |
| `deferred_rights_unclear` | License or permissions are unclear. | Do not import, bundle, or index for release. |
| `blocked` | License or quality constraints conflict with app use. | Do not import; document reason. |

## Manifest fields to add

Extend resource/source manifests with:

```json
{
  "rights_class": "bundled_public_domain",
  "license_id": "CC-BY-4.0",
  "license_url": "https://creativecommons.org/licenses/by/4.0/",
  "copyright_holder": "",
  "content_distributor": "",
  "source_format": "USFM | USX | OSIS | SWORD | JSONL | Markdown | Plain Text | API",
  "language": "en",
  "script": "Latn",
  "direction": "ltr",
  "canon_scope": "protestant_66 | catholic_73 | orthodox | tanakh | custom",
  "versification": "KJV | Vulgate | Hebrew | custom",
  "edition_id": "",
  "source_date": "",
  "checksum_sha256": "",
  "redistribution_allowed": true,
  "commercial_use_allowed": true,
  "local_storage_allowed": true,
  "offline_use_allowed": true,
  "ai_use_allowed": true,
  "export_excerpt_allowed": true,
  "derivative_allowed": true,
  "share_alike_required": false,
  "trademark_restrictions": "",
  "quote_limits": "",
  "attribution_required": true,
  "attribution_text": "",
  "reviewed_by": "",
  "reviewed_at": "2026-06-12",
  "review_expires_at": "",
  "decision_notes": ""
}
```

Important: `license_id` should use SPDX identifiers where possible, but content licenses and custom publisher agreements may also need `license_url` and free-text terms.

## Content BOM proposal

Add:

`docs/content-bill-of-materials.md`

Purpose:

- One release-facing inventory for bundled corpus, bundled resources, source caches, generated indexes, and license obligations.
- Separate from a software SBOM, but compatible with SPDX/CycloneDX style identifiers.

Minimum fields:

- component id,
- title,
- kind,
- source URL,
- source format,
- source date,
- checksum,
- rights class,
- license id/name,
- attribution,
- export rules,
- AI-use rules,
- language/script/direction,
- canon scope,
- versification,
- bundled path,
- generated tables/indexes,
- update cadence,
- reviewer,
- last reviewed date.

Release rule:

- A public release cannot include a content source that is missing from the content BOM.
- A Study Packet export must be able to derive attribution from the same metadata.
- If a source has share-alike or noncommercial constraints, export UI must surface that before export.

## Updated content roadmap

### P0: beta readiness

1. Create `docs/content-bill-of-materials.md`.
2. Create `docs/source-expansion-strategy.md`.
3. Extend `docs/open-resource-ingestion-plan.md` with rights classes and AI-use/export fields.
4. Extend resource manifest validation to warn or fail when rights class, language, script, canon scope, versification, checksum, or AI/export rules are missing.
5. Add an FTS integrity check after resource import and backup restore.
6. Add a source-review fixture for a CC BY-SA source and one for a blocked NC/unclear source.
7. Add WEB edition/trademark note to content BOM.
8. Add a public-release gate: every bundled content component must have source URL, license, checksum, rights class, and attribution.

### P1: content depth without licensing debt

1. Build a USFM/USX normalization design doc.
2. Add a small public-domain historical theology pack as an optional user-import fixture.
3. Add Open.Bible candidate review records, one source at a time.
4. Add unfoldingWord candidate review records, but handle CC BY-SA obligations explicitly.
5. Add Sefaria public-domain/CC candidate reviews only where per-version license metadata is clear.
6. Build retrieval eval fixtures around content types: Scripture, commentary, creed/confession, lexicon, cross-reference, and user note.
7. Add UI filters for source type/license/canon before adding many new resources.

### P2: partner/API exploration

1. Evaluate API.Bible for online modern-translation access.
2. Evaluate YouVersion Platform for online Scripture retrieval after license agreements are understood.
3. Evaluate DBL membership/organization path only if a real distribution partnership goal emerges.
4. Prototype an online-only source lane with explicit privacy, caching, quota, and export limits.
5. Decide whether licensed API content can participate in Council prompts, summaries, and Study Packet exports under provider terms.

### P3: heavy search/indexing

1. Benchmark current SQLite FTS5 and raw vector scan on a large synthetic resource library.
2. Add sqlite-vec only if vector scale proves it is needed.
3. Add Tantivy only if commentary/resource search needs analyzers, facets, or large-document ranking beyond SQLite FTS5.
4. Consider Qdrant Edge only for local ANN/hybrid retrieval at larger scale.
5. Consider Qdrant service only as part of a managed gateway or hosted search product.

## Risks to track

| Risk | Why it matters | Mitigation |
| --- | --- | --- |
| License debt | A single unclear source can block public release or exports. | Content BOM, rights classes, source review gates. |
| API terms conflict with offline/local claims | Modern translations often come through online permissioned APIs. | Keep API content in a separate online lane. |
| Share-alike/export obligations get lost | Study Packets can redistribute excerpts and synthesized work. | Export attribution and license notices from source metadata. |
| Theological skew from available open content | Open/public-domain sources may overrepresent certain traditions, eras, or English perspectives. | Label source tradition/lens, add dissent rubric, diversify deliberately. |
| Alternate versification breaks citations | Douay-Rheims, Septuagint, deuterocanon, and Jewish texts do not always align with current Protestant 66-book IDs. | Add canon/versification metadata and UI filters before import. |
| Search infrastructure churn | New search tools add packaging and index lifecycle complexity. | Use thresholds and evals before adding infrastructure. |
| Imported content prompt injection | Resource text can contain instructions that should not control the model. | Treat source text as evidence, not instruction; add malicious resource fixtures. |
| OCR/source quality | Bad source text creates bad retrieval and bad AI outputs. | Keep poor/unverified OCR as blockers; add OCR fixture coverage. |

## Updated decision register

| Decision | Status | Rationale |
| --- | --- | --- |
| Keep local bundled corpus public-domain/permissive by default. | Adopt | Aligns with local-first trust and release simplicity. |
| Add content BOM before more bundled sources. | Adopt | Prevents licensing and attribution drift. |
| Use rights classes, not free-text license labels alone. | Adopt | Product behavior depends on storage/export/AI rights, not only license name. |
| Treat API.Bible, DBL, and YouVersion Platform as online permissioned lanes. | Adopt | They solve access/licensing, not offline bundling by default. |
| Keep SQLite FTS5 and raw embedding scans for v0.1. | Adopt | Current bottleneck is retrieval quality, not infrastructure. |
| Defer sqlite-vec/Tantivy/Qdrant until thresholds are met. | Adopt | Avoids premature packaging and index lifecycle complexity. |
| Make USFM/USX the primary Bible import target, OSIS secondary, SWORD later. | Adopt | Matches current WEB import and broader Bible-data ecosystem. |
| Require canon/versification metadata before deuterocanon/LXX/Douay-Rheims. | Adopt | Prevents citation confusion and UI mismatch. |
| Do not summarize or expose unowned/licensed content unless rights allow it. | Adopt | Avoids competitor-style features without competitor-style rights. |

## Stable docs to promote next

The repeated timestamped research now points to a small set of stable docs that should absorb decisions:

1. `docs/source-expansion-strategy.md`
2. `docs/content-bill-of-materials.md`
3. `docs/content-rights-classes.md`
4. `docs/usfm-usx-normalization-plan.md`
5. `docs/search-indexing-scale-plan.md`
6. `docs/retrieval-eval-fixtures.md`
7. Updates to `docs/open-resource-ingestion-plan.md`
8. Updates to `docs/data-sources.md`
9. Updates to `docs/phase-13-corpus-roadmap.md`

This should happen before another large batch of candidate content imports.

## Source notes

Web sources checked on 2026-06-12:

- Paratext USFM: https://paratext.org/usfm/
- USFM 3 docs: https://ubsicap.github.io/usfm/
- CrossWire OSIS: https://crosswire.org/osis/
- CrossWire SWORD module making: https://www.crosswire.org/sword/develop/swordmodule/
- eBible WEB copyright: https://ebible.org/engwebp/copyright.htm
- API.Bible docs: https://docs.api.bible/
- API.Bible bibles/licensing: https://api.bible/bibles
- Digital Bible Library: https://library.bible/
- YouVersion Platform API usage: https://developers.youversion.com/api-usage
- Open.Bible resources: https://www.open.bible/resources
- Sefaria copyright and data use: https://developers.sefaria.org/docs/usage-of-our-name-and-logo
- Open Scriptures MorphHB license: https://github.com/openscriptures/morphhb/blob/master/LICENSE.md
- OpenBible.info cross references: https://www.openbible.info/labs/cross-references/
- Creative Commons BY-SA 4.0: https://creativecommons.org/licenses/by-sa/4.0/deed.en
- Creative Commons BY-NC 4.0: https://creativecommons.org/licenses/by-nc/4.0/deed.en
- SPDX License List: https://spdx.org/licenses/
- CycloneDX license compliance: https://cyclonedx.org/use-cases/open-source-licensing/
- SQLite FTS5: https://sqlite.org/fts5.html
- sqlite-vec: https://alexgarcia.xyz/sqlite-vec/
- Tantivy docs: https://docs.rs/tantivy/
- Qdrant docs: https://qdrant.tech/documentation/
- Logos Smart Search: https://support.logos.com/hc/en-us/articles/23526184005261-Find-Answers-Faster-with-Smart-Search
- Accordance: https://www.accordancebible.com/
- Olive Tree PC: https://www.olivetree.com/pc/
- Blue Letter Bible: https://www.blueletterbible.org/
- Bible Gateway Plus: https://www.biblegateway.com/plus/
- Wycliffe UK Bible translation statistics: https://wycliffe.org.uk/statistics/
- ProgressBible: https://progress.bible/

Local repo anchors checked on 2026-06-12:

- `docs/data-sources.md`
- `docs/open-resource-ingestion-plan.md`
- `docs/phase-13-corpus-roadmap.md`
- `data/schema.sql`
- `app/scripts/resources/assess-source.mjs`
- `app/scripts/resources/validate-resource-manifest.mjs`
- `app/scripts/resources/test-resource-fixtures.mjs`
- `app/src-tauri/src/user_db.rs`
- `app/package.json`
- `app/src-tauri/Cargo.toml`
