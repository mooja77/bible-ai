# Content Bill of Materials (BOM)

Status: DRAFT (for review)
Date: 2026-06-13

This document is the authoritative inventory of every content source the app
ships or admits, with the rights metadata needed to trust it. It implements
EP-003 (Content BOM) and Milestone 6 (content rights, source provenance, and
corpus plan). It complements `data-sources.md` (the engineering record of the
current corpus) and `open-resource-ingestion-plan.md` (the admission pipeline
for new resources).

This document is an engineering and rights-tracking record, not legal advice.

Several cells below are filled from ingest-script metadata and common knowledge
about these public-domain sources, not from a fresh legal review. Every such
cell is marked `TODO confirm`. A human must verify all `TODO confirm` cells,
especially license, redistribution, and share-alike, before this DRAFT is
accepted and before any public release relies on it.

## Source Decision Classes

Every source is assigned exactly one decision class. The class drives what the
app may do with the source and what it must show the user.

- `bundled_redistributable`
  - The source ships inside `data/corpus.sqlite` (or another bundled artifact).
  - Requires a confirmed license that allows redistribution in a desktop app.
  - Product implications: usable offline by default; appears in Settings > Data
    Sources; attribution must be carried into exports where the license
    requires it; share-alike obligations, if any, must be surfaced in exports.

- `user_imported_local`
  - The user imports the source locally into `user.sqlite` (modules) or the
    resource tables; it is never bundled by us.
  - Product implications: stays on the user's machine; must carry accepted
    source metadata (license, attribution, redistribution) or it is quarantined
    or rejected; the rights burden for redistribution sits with the user, not
    with the shipped product.

- `online_api_only`
  - The source is reached over the network at runtime and never persisted to
    the bundled corpus.
  - Product implications: not available offline; subject to provider terms and
    rate limits; must be clearly labeled as online; no redistribution of fetched
    content beyond what the provider permits.

- `partner_licensed`
  - The source is used under a specific negotiated or named license agreement
    (for example, a modern copyrighted translation with explicit rights).
  - Product implications: ships only within the bounds of the agreement; export
    and AI/RAG use limited to what the agreement allows; agreement reference
    recorded in the BOM.

- `deferred_rights_unclear`
  - The source is interesting but its license, versification, or canon fit is
    not yet resolved.
  - Product implications: must not ship; may be cached for assessment only (for
    example `DRC.json`); tracked here so it cannot silently slip into a release.

- `blocked`
  - The source must not be used (incompatible license, poor or unverified OCR,
    trademark conflict, or an explicit decision to exclude).
  - Product implications: never bundled, never imported as accepted; an import
    attempt is rejected; recorded here so the decision is auditable.

## Content BOM Fields

Each BOM entry records these fields. Where a field does not apply to a source,
mark it `n/a` rather than leaving it blank.

- `source_id`: stable identifier for the source (for example `KJV`, `morphhb`).
- `title`: human-readable name of the source/edition.
- `version`: version string or source date.
- `source_url`: canonical upstream URL the artifact was obtained from.
- `maintainer`: publisher or maintainer responsible for the source.
- `license`: license name (for example Public Domain, CC-BY 4.0, CC-BY-SA 4.0).
- `attribution`: required attribution text, or note that none is required.
- `redistribution`: whether redistribution in a bundled desktop app is allowed.
- `modification`: whether modification is allowed and under what naming rules
  (avoid presenting altered text as an official edition).
- `share_alike`: whether a share-alike obligation applies to derived/linked data.
- `export_rules`: what attribution or notice must appear in user exports.
- `ai_rag_rules`: whether the source may be used as AI/RAG evidence and any
  limits (for example treat as study metadata, not as authoritative text).
- `language`: primary language of the content.
- `script`: writing system (Latin, Hebrew, Greek).
- `canon_scope`: which canon/books are covered (66-book Protestant, OT-only,
  NT-only, lexicon, mapping data).
- `versification`: the versification model the source aligns to.
- `checksum`: checksum of the cached artifact for integrity verification.
- `import_script`: the script that ingests this source.
- `ocr_quality`: OCR/source-quality state (`clean`, `proofread`, `unverified`,
  `poor`); `poor` and `unverified` block accepted imports.
- `release_status`: release inclusion status (`bundled`, `deferred`, `blocked`,
  `online_only`, `user_imported`).

## Bundled Source BOM Table

These are the sources currently bundled per `data-sources.md`. Real values are
taken from `data-sources.md` and the ingest scripts. Cells that need a human
rights check or a not-yet-recorded value are marked `TODO confirm`.

Decision class for every row below: `bundled_redistributable`.

### Translations and original-language texts

| source_id | title | version | source_url | maintainer | license | redistribution | modification | share_alike | language | script | canon_scope | versification | checksum | import_script | ocr_quality | release_status |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| KJV | King James Version | TODO confirm | thiagobodruk/bible (`data/sources/en_kjv.json`) | thiagobodruk (upstream compiler) | Public Domain | Yes (TODO confirm) | Yes; do not present altered text as KJV | No | English | Latin | 66-book Protestant | KJV/Protestant | TODO confirm | scripts/ingest_kjv.py | clean (TODO confirm) | bundled |
| ASV | American Standard Version | TODO confirm | scrollmapper/bible_databases (`data/sources/ASV.json`) | scrollmapper (upstream compiler) | Public Domain | Yes (TODO confirm) | Yes; do not present altered text as ASV | No | English | Latin | 66-book Protestant | Protestant | TODO confirm | scripts/ingest_asv.py | clean (TODO confirm) | bundled |
| WEB | World English Bible (ENGWEBP Protestant edition) | TODO confirm (eBible ENGWEBP date) | eBible.org ENGWEBP USFM (`data/sources/engwebp_usfm.zip`) | eBible.org | Public Domain | Yes (TODO confirm) | Yes; preserve edition identity; trademark-sensitive naming | No | English | Latin | 66-book Protestant | Protestant; omits/footnotes some KJV/TR verses | TODO confirm | scripts/ingest_web.py | clean (TODO confirm) | bundled |
| YLT | Young's Literal Translation | TODO confirm | scrollmapper/bible_databases (`data/sources/YLT.json`) | scrollmapper (upstream compiler) | Public Domain | Yes (TODO confirm) | Yes; do not present altered text as YLT | No | English | Latin | 66-book Protestant | Protestant | TODO confirm | scripts/ingest_ylt.py | clean (TODO confirm) | bundled |
| WLC | Westminster Leningrad Codex | TODO confirm | scrollmapper/bible_databases (`data/sources/WLC.json`) | scrollmapper (upstream compiler) | Public Domain in current ingest metadata (TODO confirm) | Yes (TODO confirm) | Limited; original text | No (TODO confirm) | Hebrew | Hebrew | OT-only (Hebrew Bible) | Hebrew/Masoretic | TODO confirm | scripts/ingest_wlc.py | clean (TODO confirm) | bundled |
| TR | Textus Receptus | TODO confirm | scrollmapper/bible_databases (`data/sources/TR.json`) | scrollmapper (upstream compiler) | Public Domain | Yes (TODO confirm) | Limited; original text | No | Greek | Greek | NT-only | NT/Protestant | TODO confirm | scripts/ingest_tr.py | clean (TODO confirm) | bundled |

AI/RAG rules for the rows above: usable as Bible text evidence within the
app's 66-book reference model. Export rules: carry public-domain status; no
mandatory attribution text known, but preserve edition identity and avoid
presenting altered text as an official edition. All `TODO confirm` on these
two rules pending review.

### Word-level, lexicon, cross-reference, and embedding sources

| source_id | title | version | source_url | maintainer | license | redistribution | share_alike | ai_rag_rules | language | script | canon_scope | import_script | checksum | ocr_quality | release_status |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| morphhb | OpenScriptures Hebrew morphology and Strong's tags (`word_tokens` for WLC) | TODO confirm | openscriptures/morphhb (`data/sources/morphhb/*.xml`) | OpenScriptures | CC-BY 4.0 | Yes (TODO confirm) | No | Study metadata; not modified at runtime | Hebrew | Hebrew | OT-only word tagging | scripts/ingest_morphhb.py | TODO confirm | clean (TODO confirm) | bundled |
| strongs-greek | Strong's Greek dictionary | TODO confirm | openscriptures/strongs (`data/sources/strongs-greek-dictionary.js`) | OpenScriptures | CC-BY-SA in ingest comments, derived from public-domain Strong's (TODO confirm) | Yes (TODO confirm) | Yes (TODO confirm; CC-BY-SA) | Study metadata; not modified at runtime | Greek/English | Greek/Latin | Lexicon | scripts/ingest_strongs.py | TODO confirm | clean (TODO confirm) | bundled |
| strongs-hebrew | Strong's Hebrew dictionary | TODO confirm | openscriptures/strongs (`data/sources/strongs-hebrew-dictionary.js`) | OpenScriptures | CC-BY-SA in ingest comments, derived from public-domain Strong's (TODO confirm) | Yes (TODO confirm) | Yes (TODO confirm; CC-BY-SA) | Study metadata; not modified at runtime | Hebrew/English | Hebrew/Latin | Lexicon | scripts/ingest_strongs.py | TODO confirm | clean (TODO confirm) | bundled |
| openbible-xrefs | OpenBible.info cross-references (`cross_refs`, source `openbible`) | TODO confirm | https://a.openbible.info/data/cross-references.zip (`data/sources/cross_references.txt`) | OpenBible.info | CC-BY (TODO confirm; verify exact CC variant) | Yes (TODO confirm) | TODO confirm (CC-BY vs CC-BY-SA changes export duty) | Mapping data; kept separate from Bible text | English | n/a | Cross-reference mapping (66-book) | scripts/ingest_tsk.py | TODO confirm | n/a | bundled |
| verse-embeddings | Local semantic search embeddings (`verse_embeddings`) | model/dim recorded per row (TODO confirm model id) | Generated locally from bundled corpus text | This app (derived) | Derived from bundled corpus; follows source license | n/a (not distributed as text) | Inherits source obligations | Local search index only | n/a | n/a | Derived from bundled translations | scripts/embed_corpus.py | TODO confirm | n/a | bundled |

Export rules for CC-BY / CC-BY-SA rows (morphhb, Strong's, cross-references):
exports that surface this data must carry attribution, and CC-BY-SA data must
carry the share-alike notice. Confirm the exact license variant per row before
relying on these export rules.

## Deferred and Blocked Sources

| source_id | title | decision_class | reason | cached_artifact | release_status |
|---|---|---|---|---|---|
| DRC | Douay-Rheims (Challoner) | deferred_rights_unclear | Source is public domain, but available DRC JSON uses Vulgate/deuterocanonical versification that misaligns with the 66-book reference model; defer until alternate versification is implemented | `data/sources/DRC.json` (assessment only; `scripts/ingest_drc.py` does not write corpus rows) | deferred |
| modern-translations | Modern copyrighted Bible translations | deferred_rights_unclear / partner_licensed | Require explicit distribution rights or a partner license before bundling | n/a | deferred |
| lxx | Septuagint (LXX) | deferred_rights_unclear | Canon scope and edition rights not yet resolved | n/a | deferred |
| apocrypha | Apocrypha / deuterocanonical corpora | deferred_rights_unclear | Canon scope and versification support not yet implemented | n/a | deferred |
| manuscript-images | Manuscript images | deferred_rights_unclear | Image rights and UX not defined | n/a | deferred |
| paid-feeds | Server-hosted paid data feeds | online_api_only / deferred_rights_unclear | Online-only, subject to provider terms; not bundled | n/a | deferred |
| poor-ocr-* | Any source with poor or unverified OCR | blocked | `ocr_quality` of `poor` or `unverified` blocks accepted import until proofread and references are stable | n/a | blocked |

## User-Imported Sources

User-imported modules and resources are decision class `user_imported_local`.
They are not enumerated row-by-row in this document because they live on each
user's machine in `user.sqlite` and the resource tables. They are governed by:

- The JSONL/module importers, which require manifest source and license
  metadata (see `data-sources.md` and `open-resource-ingestion-plan.md`).
- The source assessment gate (`assess-source.mjs`), which rejects or defers
  sources with unclear license terms, missing redistribution permission,
  missing attribution, or `poor`/`unverified` OCR quality.

## Release Rule

This is a release gate, not a guideline.

1. A public release MUST NOT ship any content source that is missing from the
   Bundled Source BOM Table above. If a source is bundled in
   `data/corpus.sqlite` (or any other shipped artifact) and has no accepted BOM
   entry, the release fails.
2. Every bundled source MUST have auditable rights metadata: at minimum
   `license`, `redistribution`, and `attribution` must be filled with confirmed
   (non-`TODO confirm`) values before that source ships in a public release.
3. Imported resources without accepted source metadata are quarantined or
   rejected. The importer and the `assess-source.mjs` gate enforce this: a
   source with unclear license, missing redistribution permission, missing
   attribution, or `poor`/`unverified` OCR quality is not admitted as accepted.
4. Content expansion cannot silently create licensing debt: adding a source
   requires adding or updating its BOM entry (and `data-sources.md`) in the same
   change, or the release gate fails.
5. Every exported resource excerpt carries the attribution and share-alike
   notice required by its BOM entry.

## Verification

```powershell
rg -n "[^\x00-\x7F]" docs\content-bom.md
rg -n "content-bom|bundled_redistributable|source decision" docs
```
