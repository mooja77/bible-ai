# Data Sources and Licenses

This document records the corpus and module data sources used by the current app. It is based on the ingestion scripts and schema in this repository.

Source decision classes and the full rights bill of materials live in [`content-bom.md`](content-bom.md).

## Policy

- Ship only public-domain or permissively licensed corpus data by default.
- Keep modern copyrighted Bible translations out of the bundled corpus unless explicit distribution rights are obtained.
- Store source and license metadata in SQLite where the schema supports it.
- Keep `data/corpus.sqlite` read-only at runtime.
- Keep user-installed modules in `user.sqlite` with module-level `source` and `license` metadata.

This document is an engineering record, not legal advice.

## Bundled Corpus Tables

The read-only corpus uses:

- `translations`: edition metadata.
- `translation_text`: verse text by translation and `verse_id`.
- `translation_text_fts`: FTS5 index over verse text.
- `word_tokens`: word-level tags where available.
- `strongs`: Strong's dictionary entries.
- `cross_refs`: cross-reference links.
- `verse_embeddings`: local semantic search embeddings.

The schema is defined in `data/schema.sql`.

## Translation and Original-Language Sources

| Code | Name | Kind | Language | License in Ingest | Source |
|---|---|---|---|---|---|
| `KJV` | King James Version | translation | English | Public Domain | `thiagobodruk/bible`, cached as `data/sources/en_kjv.json` |
| `ASV` | American Standard Version | translation | English | Public Domain | `scrollmapper/bible_databases`, cached as `data/sources/ASV.json` |
| `WEB` | World English Bible | translation | English | Public Domain | `eBible.org` ENGWEBP USFM, cached as `data/sources/engwebp_usfm.zip` |
| `YLT` | Young's Literal Translation | translation | English | Public Domain | `scrollmapper/bible_databases`, cached as `data/sources/YLT.json` |
| `WLC` | Westminster Leningrad Codex | original | Hebrew | Public Domain in current ingest metadata | `scrollmapper/bible_databases`, cached as `data/sources/WLC.json` |
| `TR` | Textus Receptus | original | Greek | Public Domain | `scrollmapper/bible_databases`, cached as `data/sources/TR.json` |

Notes:

- WEB is now bundled from the public-domain Protestant edition. Its source omits or footnotes some verses that appear in KJV/TR traditions; missing rows should be treated as translation-specific absence rather than corpus failure.
- Douay-Rheims remains deferred. The source is public domain, but direct import would misalign citations because the available DRC JSON uses Vulgate/deuterocanonical versification in places where the app currently uses a 66-book Protestant reference model.
- The UI translation picker reads actual rows from `translations`, not this document.
- Any new translation import must add or update a script under `scripts/`, set `source_url`, and store license metadata through `upsert_translation`.

## Word-Level and Lexicon Sources

| Data | Target Table | License in Ingest | Source | Notes |
|---|---|---|---|---|
| Hebrew morphology and Strong's tags | `word_tokens` for `WLC` | CC-BY 4.0 | `openscriptures/morphhb` | OSIS XML files cached under `data/sources/morphhb/`. |
| Strong's Greek dictionary | `strongs` | CC-BY-SA in ingest comments, derived from public-domain Strong's | `openscriptures/strongs` | Cached as `data/sources/strongs-greek-dictionary.js`. |
| Strong's Hebrew dictionary | `strongs` | CC-BY-SA in ingest comments, derived from public-domain Strong's | `openscriptures/strongs` | Cached as `data/sources/strongs-hebrew-dictionary.js`. |

The app treats Strong's and morphology data as study metadata. It does not modify the source lexicon text at runtime.

## Cross-References

| Data | Target Table | License in Ingest | Source | Notes |
|---|---|---|---|---|
| Cross-reference links | `cross_refs` | CC-BY | `https://a.openbible.info/data/cross-references.zip` | Cached as `data/sources/cross_references.txt`; stored with source `openbible`. |

Cross-reference rows use:

- `from_verse_id`
- `to_verse_id`
- `source`
- `weight`

For range targets, the current ingest collapses to the anchor/start verse so the reader can show context naturally.

## Semantic Embeddings

Embeddings are generated locally from bundled corpus text.

Target table:

- `verse_embeddings`

Stored metadata:

- `translation_code`
- `verse_id`
- `model`
- `dim`
- raw little-endian `f32` embedding blob

Each complete set also has an `embedding_builds` identity record containing
the exact Ollama model digest and version, generator version, Python/platform
identity, row count, and an ordered aggregate SHA-256 over verse ids,
dimensions, and vector blobs. Resumable builds refuse to mix a different
model digest or platform. `--rebuild` is the strict recovery path;
`--adopt-existing` exists only for a one-time, explicitly reviewed legacy
corpus migration.

Current implementation stores vectors in SQLite as BLOBs and uses Rust cosine scan. It does not require the `sqlite-vec` extension at runtime.

## User-Installed Modules

Modules are not part of the read-only corpus. They are stored in `user.sqlite`:

- `modules`
- `module_entries`

Each module has:

- `slug`
- `title`
- `kind`
- `source`
- `license`
- `version`

The JSONL importer requires a manifest line with source/license metadata. Re-importing the same slug updates metadata and replaces entries for that module.

Supported entry key types:

- `verse_id`
- `verse_range`
- `strongs`
- `topic`

## Source Cache

Downloaded source artifacts are cached under `data/sources/`.

Two exact inputs are intentionally tracked in the repository:
`engwebp_usfm.zip` and `cross_references.txt`. Their official download URLs are
mutable and no immutable upstream revision was available for the corpus already
under review. The committed blobs are therefore the reproducible source of
record, while `source_url` preserves provenance. The fetcher refuses to replace
either blob automatically if it is missing or altered. All other fetchable
inputs use commit-pinned upstream URLs or a commit-pinned file set.

Current cache includes:

- `en_kjv.json`
- `ASV.json`
- `engwebp_usfm.zip`
- `YLT.json`
- `WLC.json`
- `TR.json`
- `DRC.json` (cached for Phase 13 assessment, not currently bundled)
- `cross_references.txt`
- `strongs-greek-dictionary.js`
- `strongs-hebrew-dictionary.js`
- `morphhb/*.xml`

The cache allows repeated corpus rebuilds without re-downloading every source.

## Ingestion Scripts

Current scripts:

- `scripts/fetch_corpus_sources.py`
- `scripts/build_corpus.py`
- `scripts/ingest_kjv.py`
- `scripts/ingest_asv.py`
- `scripts/ingest_web.py`
- `scripts/ingest_drc.py` (assessment only; does not write corpus rows)
- `scripts/ingest_ylt.py`
- `scripts/ingest_wlc.py`
- `scripts/ingest_tr.py`
- `scripts/ingest_morphhb.py`
- `scripts/ingest_tsk.py`
- `scripts/ingest_strongs.py`
- `scripts/embed_corpus.py`
- `scripts/verify_corpus_lock.py`
- `scripts/verify_corpus.py`

Shared helpers:

- `scripts/_lib.py`

Expected ingestion behavior:

- Idempotent for the source it owns.
- Preserve unrelated translations/modules.
- Update FTS after translation text changes.
- Store source/license metadata when the target table supports it.
- Avoid writing user data into `corpus.sqlite`.

For a release corpus, use the resumable orchestrator rather than invoking the
individual ingestion scripts. It fetches locked inputs into quarantine,
verifies every checksum before parsing, builds into a separate database,
records embedding provenance, runs corpus invariants, and atomically promotes
only the verified result:

```powershell
python scripts/build_corpus.py
```

Use `--offline` to prohibit network access, `--plan` to audit the step graph,
and `--restart` only when intentionally discarding the orchestrator's own
temporary database and checkpoint file. See [`corpus-build.md`](corpus-build.md).

## Distribution Checklist

Before bundling a new source:

- Confirm the source license allows redistribution in a desktop app.
- Add source URL and license metadata to the relevant ingest script.
- Cache the source artifact under `data/sources/`. If upstream cannot provide an
  immutable versioned URL, commit the reviewed exact blob and set
  `fetch_policy` to `repository_snapshot`.
- Add or update its exact version, URL, byte count, SHA-256, license, and
  attribution in `data/corpus-lock.json`.
- Rebuild `data/corpus.sqlite`.
- Run `python scripts/verify_corpus_lock.py` and
  `python scripts/verify_corpus.py`.
- Verify `list_translations` exposes the expected metadata in the app.
- Obtain named content-review approval for every intended distribution
  territory; an automated checksum is not a legal determination.
- Update this document.
- Run:

```powershell
cd app
npm run check:full
npm run release:build
```

## Deferred Sources

Deferred until licensing and UX are explicit:

- Modern copyrighted Bible translations.
- Manuscript images.
- Douay-Rheims full import until a DRC/deuterocanon-specific versification map,
  canonical identity rules, navigation UX, and rights review are approved.
- LXX and apocrypha/deuterocanonical corpora.
- Server-hosted paid data feeds.

## Open Resource Library Extension

The source admission and import plan for commentaries, historical theology, open translations, and other study resources is in [`open-resource-ingestion-plan.md`](open-resource-ingestion-plan.md).

Every new resource import must include:

- Source URL.
- License.
- Attribution text.
- Version/date.
- Redistribution assessment.
- Export attribution rules.
- Fixture search coverage.
