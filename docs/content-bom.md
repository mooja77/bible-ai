# Content Bill of Materials (BOM)

Status: TECHNICALLY LOCKED — human rights approval pending
Date: 2026-07-13

This document is the authoritative inventory of every content source the app
ships or admits, with the rights metadata needed to trust it. It implements
EP-003 (Content BOM) and Milestone 6 (content rights, source provenance, and
corpus plan). It complements `data-sources.md` (the engineering record of the
current corpus) and `open-resource-ingestion-plan.md` (the admission pipeline
for new resources).

This document is an engineering and rights-tracking record, not legal advice.
The public evidence and unresolved decisions for the exact locked artifacts are
collected in [`reviews/content-rights-evidence-dossier.md`](reviews/content-rights-evidence-dossier.md).

Artifact versions and checksums below are enforced by `data/corpus-lock.json`.
Rights assertions are not treated as approved merely because the bytes are
locked: a named human reviewer must complete the separate content-review gate
before public release.

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
| KJV | King James Version | thiagobodruk/bible@49a869c | pinned raw GitHub artifact (`data/sources/en_kjv.json`) | thiagobodruk (upstream compiler) | Underlying KJV public domain outside UK per eBible; pinned repository states CC BY-NC 2.0 BR; UK Letters Patent and repository-term review pending | pending human approval | Yes; do not present altered text as KJV | unresolved | English | Latin | 66-book Protestant | eng-kjv | cb31a8aec26786c967e8cd52c325bbbca82a34d4e6c0aec2d2901166f2dec483 | scripts/ingest_kjv.py | clean | bundled |
| ASV | American Standard Version | scrollmapper/bible_databases@ba07bc9 | pinned raw GitHub artifact (`data/sources/ASV.json`) | scrollmapper (upstream compiler) | Public Domain | pending human approval | Yes; do not present altered text as ASV | No | English | Latin | 66-book Protestant | eng-kjv | 61f53a4dd0ae412f7c925ec7113bc02c6de44d0402b94d0cee264bcd69417ea8 | scripts/ingest_asv.py | clean | bundled |
| WEB | World English Bible (ENGWEBP Protestant edition) | cached 2026-05-02 | eBible.org ENGWEBP USFM (`data/sources/engwebp_usfm.zip`) | eBible.org | Public Domain; WEB naming is trademark-sensitive | pending human approval | Preserve edition bytes and identity | No | English | Latin | 66-book Protestant | eng-kjv; edition omissions retained | 2c77e11f0d26863f7f4a507b40c58651d55399e6d760223b3550908331bc994f | scripts/ingest_web.py | clean | bundled |
| YLT | Young's Literal Translation | scrollmapper/bible_databases@ba07bc9 | pinned raw GitHub artifact (`data/sources/YLT.json`) | scrollmapper (upstream compiler) | Public Domain | pending human approval | Yes; do not present altered text as YLT | No | English | Latin | 66-book Protestant | eng-kjv | 853fb222c1a32f3f864c4aaed4c68082ec23d0c450135206e7c5c5f014166888 | scripts/ingest_ylt.py | clean | bundled |
| WLC | Westminster Leningrad Codex | scrollmapper/bible_databases@ba07bc9 | pinned raw GitHub artifact (`data/sources/WLC.json`) | scrollmapper (upstream compiler) | Public Domain text (approval pending) | pending human approval | Limited; original text | pending human approval | Hebrew | Hebrew | OT-only (Hebrew Bible) | hebrew-wlc mapped to eng-kjv | ac61c4bb978bc17226e4fff8c97aa3634301c9b46bd0a4b859d47095cac3b597 | scripts/ingest_wlc.py | clean | bundled |
| TR | Textus Receptus | scrollmapper/bible_databases@ba07bc9 | pinned raw GitHub artifact (`data/sources/TR.json`) | scrollmapper (upstream compiler) | Public Domain | pending human approval | Limited; original text | No | Greek | Greek | NT-only | greek-tr mapped to eng-kjv | 3ee63c508133c65eb2900bef04ed3d5a83137eec4d1b1867cb4a605f2339fb2e | scripts/ingest_tr.py | clean | bundled |

AI/RAG rules for the rows above: usable as Bible text evidence within the
app's 66-book reference model. Export rules: carry public-domain status; no
mandatory attribution text known, but preserve edition identity and avoid
presenting altered text as an official edition. All `TODO confirm` on these
two rules pending review.

### Word-level, lexicon, cross-reference, and embedding sources

| source_id | title | version | source_url | maintainer | license | redistribution | share_alike | ai_rag_rules | language | script | canon_scope | import_script | checksum | ocr_quality | release_status |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| morphhb | OpenScriptures Hebrew morphology and Strong's tags (`word_tokens` for WLC) | openscriptures/morphhb@3d15126 | pinned GitHub XML set (`data/sources/morphhb/*.xml`) | OpenScriptures | WLC text Public Domain; morphology/lemma CC BY 4.0 (approval pending) | pending human approval | No | Study metadata; not modified at runtime | Hebrew | Hebrew | OT-only word tagging | scripts/ingest_morphhb.py | c1b448b47e2a09d7edbf35d845e27be0e9022de7587b73df7745e22e12b66c5c aggregate | clean | bundled |
| strongs-greek | Strong's Greek dictionary | openscriptures/strongs@0acd2f2 | pinned raw GitHub artifact (`data/sources/strongs-greek-dictionary.js`) | OpenScriptures | File header says CC-BY-SA, version unspecified | pending human approval | Yes (exact obligations pending) | Study metadata; derived/export obligations pending | Greek/English | Greek/Latin | Lexicon | scripts/ingest_strongs.py | 7624ee738ae47e80f1a352223e28a26d011c9cd4898822cee52f47a010c04efd | clean | bundled |
| strongs-hebrew | Strong's Hebrew dictionary | openscriptures/strongs@0acd2f2 | pinned raw GitHub artifact (`data/sources/strongs-hebrew-dictionary.js`) | OpenScriptures | File header says CC-BY-SA, version unspecified | pending human approval | Yes (exact obligations pending) | Study metadata; derived/export obligations pending | Hebrew/English | Hebrew/Latin | Lexicon | scripts/ingest_strongs.py | 5ce6aeed551c709f49bcfa341cadf2f34bc7599b85d9de9e6ac2ecbf60fc3739 | clean | bundled |
| openbible-xrefs | OpenBible.info cross-references (`cross_refs`, source `openbible`) | cached 2026-05-02 | https://a.openbible.info/data/cross-references.zip (`data/sources/cross_references.txt`) | OpenBible.info | CC BY 4.0 | allowed with attribution and modification marking; named approval pending | No | Local retrieval and reader context; exports retain source attribution | English | n/a | Cross-reference mapping (66-book) | scripts/ingest_tsk.py | 533e055792af278032f87ab8e4cce6c1b3899f776cea1c711cfd290c2052b4b2 | n/a | bundled |
| verse-embeddings | Local semantic search embeddings (`verse_embeddings`) | nomic-embed-text / 768 dimensions | Generated locally from bundled corpus text | This app (derived) | Derived from bundled corpus; follows source license | n/a (not distributed as text) | Inherits source obligations | Local search index only | n/a | n/a | Derived from bundled translations | scripts/embed_corpus.py | row coverage enforced by scripts/verify_corpus.py | n/a | bundled |

Export rules for CC-BY / CC-BY-SA rows (morphhb, Strong's, cross-references):
exports that surface this data must carry the applicable attribution. The
Strong's share-alike scope and exact license version are not yet resolved, so
no public export or release may rely on this provisional rule for Strong's data.

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
