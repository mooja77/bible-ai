# Open Resource Ingestion Plan

## Purpose

Add more open resources while preserving user trust, legal clarity, provenance, attribution, and offline usability.

## Source Admission Rules

Before importing a source, complete a source review record:

- Source title.
- Source URL.
- Maintainer/publisher.
- License.
- Attribution text.
- Version/date.
- Redistribution permission.
- Modification rules.
- Share-alike requirements.
- Trademark restrictions.
- Import format.
- Versification/reference compatibility.
- Known data quality risks.

If license terms are unclear, defer the source.

## Resource Manifest Format

Each import should include a manifest:

```json
{
  "slug": "source-slug",
  "title": "Source Title",
  "source_url": "https://example.org/source",
  "license": "Public Domain",
  "attribution": "Attribution text shown in Settings and exports.",
  "version": "2026-05-05",
  "collections": [
    {
      "slug": "collection-slug",
      "title": "Collection Title",
      "kind": "commentary"
    }
  ]
}
```

## Candidate Sources

## World English Bible Family

Status: high-priority candidate.

Rationale:

- WEB is public domain according to eBible copyright pages.
- Existing app already includes WEB corpus work.
- Need preserve edition identity and trademark-sensitive naming.

Tasks:

- Verify exact edition.
- Store source date and source URL.
- Add attribution note in Settings and exports.
- Avoid presenting altered text as an official WEB edition.

## Open.Bible Translations

Status: candidate after license review per translation.

Rationale:

- Open.Bible lists translations under Creative Commons licenses.
- Useful for multilingual expansion.

Risks:

- CC BY and CC BY-SA attribution/share-alike rules vary by source.
- Some translations may not fit app redistribution goals.

Tasks:

- Review each translation independently.
- Add attribution export appendix.
- Defer share-alike sources if public distribution implications are not accepted.

## Sefaria Public-Domain And Free-License Texts

Status: candidate for Jewish textual resources and links after careful filtering.

Rationale:

- Sefaria provides a large open Jewish text library with public-domain and free-license texts.
- API and data are available for reuse, with trademark restrictions around the Sefaria name/logo.

Risks:

- Text-level licenses vary.
- Bulk API scraping is discouraged; data dumps should be preferred where available.
- Name/logo usage must follow Sefaria terms.

Tasks:

- Import only texts with compatible licenses.
- Store original text license per entry or collection.
- Do not use Sefaria branding beyond required attribution.
- Prefer official data exports over API scraping.

## Cross-Reference Datasets

Status: candidate if attribution/share-alike requirements are acceptable.

Rationale:

- Cross-reference mappings improve research trails and theology topic linking.

Risks:

- Some datasets are CC BY-SA 4.0, affecting redistribution/export obligations.
- Must distinguish mapping license from Bible text license.

Tasks:

- Add source-specific attribution.
- Include share-alike notice in exports when linked data appears.
- Keep mapping data separate from Bible text.

## Public-Domain Historical Theology

Status: candidate after source edition audit.

Candidate categories:

- Creeds and confessions.
- Early Church Fathers in public-domain editions.
- Augustine, Aquinas, Luther, Calvin, Wesley public-domain editions.
- Public-domain church history and theological dictionaries.

Risks:

- Modern introductions, translations, footnotes, and editorial apparatus may be copyrighted.
- OCR quality can be poor.

Tasks:

- Import only clean public-domain text or compatible open-license editions.
- Store edition metadata.
- Keep paragraph/chapter references stable.
- Add OCR/source QA fixtures.

The source assessment gate treats `ocr_quality: "poor"` and
`ocr_quality: "unverified"` as blockers for accepted imports. A poor-OCR
fixture verifies scanned text must be deferred or rejected until it has been
proofread and references are stable.

## Import Pipeline

Scripts:

```text
scripts/resources/
  assess-source.mjs
  import-resource-jsonl.mjs
  import-sefaria-dump.mjs
  import-public-domain-text.mjs
  verify-resource-attribution.mjs
```

Implemented baseline scripts:

- `app/scripts/resources/assess-source.mjs`
- `app/scripts/resources/validate-resource-manifest.mjs`
- `app/scripts/resources/verify-resource-attribution.mjs`
- `app/scripts/resources/import-public-domain-text.mjs`
- `app/scripts/resources/import-sefaria-dump.mjs`
- `app/scripts/resources/import-resource-jsonl.mjs`

`assess-source.mjs` validates a machine-readable source review before import.
Accepted sources must have clear license terms, redistribution permission, usable
attribution text, and compatible manifest metadata. If license clarity is
`unclear`, the source must be deferred or rejected.

The JSONL importer emits a Bible AI user-data JSON payload containing
`resource_sources`, `resource_collections`, and `resource_entries`; import that
payload from Settings > Backup/Restore using the normal user-data import flow.
Generated source metadata includes `source_status`, defaulting to
`user-imported`, so Settings can distinguish user-imported resources from
bundled fixtures and deferred candidates.

Resource JSONL entries may include top-level `related_scripture_refs`,
`citation_note`, and `entry_attribution` fields. The importer normalizes those
fields into `resource_entries.payload_json` so Resources, Theology links, and
exports can preserve cross-reference mappings and source-specific attribution
without changing the core resource table shape.

The Resources detail UI can also hand a selected entry to Council as an
editable prompt. The prompt includes the resource title/source, citation, related
Scripture references, and a bounded excerpt so the user can ask Council to test
the resource's claims rather than accepting them as evidence by default.

The public-domain text normalizer converts audited plain text or Markdown into
resource JSONL before import. It supports heading-based, paragraph-based, and
single-entry modes so stable references can be assigned before the generic JSONL
import step.

The Sefaria-style dump normalizer converts already-audited local dump JSON into
resource JSONL before the generic import step. It requires
`manifest.metadata.sefaria_license_review: true` because licenses and reuse
terms vary by text; it does not fetch from Sefaria APIs or bulk-scrape content.

Fixture command:

```bash
cd app
npm run resources:assess:fixture
npm run resources:assess:test
npm run resources:text:fixture
npm run resources:sefaria:fixture
npm run resources:fixture
```

Pipeline steps:

1. Source assessment.
2. Normalize input into JSONL.
3. Validate manifest.
4. Load into `resource_sources`, `resource_collections`, `resource_entries`.
5. Rebuild the resource FTS index after JSON import.
6. Generate attribution report.
7. Add fixture search tests.

The fixture workflow now runs `scripts/resources/test-resource-fixtures.mjs`
after generating public-domain text and Sefaria-style imports. The verifier
checks that generated resource fixtures retain searchable terms, source
license/attribution, non-empty bodies, and parseable payload metadata.

## QA Requirements

- Verify source appears in Settings > Data Sources.
- Verify source review, redistribution, and share-alike metadata appear in
  Settings > Data Sources before users link or export excerpts.
- Verify search returns expected entries.
- Verify entry detail shows attribution/license.
- Verify workspace export includes attribution for linked entries.
- Verify workspace and theology exports include attribution and share-alike
  requirements when source metadata declares them.
- Verify resource-to-Council handoff drafts an editable question with citation
  and related Scripture context.
- Verify JSON backup export preserves source metadata and user links without
  duplicating imported resource entry bodies unless a future full-library export
  mode is explicitly requested.
