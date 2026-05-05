# Phase 13 Corpus Roadmap

Phase 13 should handle corpus expansion separately from Council transparency work.

## Candidate Additions

- World English Bible: completed for the 66-book Protestant edition from eBible USFM.
- Douay-Rheims: public-domain candidate, but direct import is blocked by Vulgate/deuterocanonical versification; Phase 13 needs alternate versification support before enabling it.
- Septuagint: defer to Phase 13 because versification, book order, and source provenance differ from the current Protestant canon data.
- Apocrypha/deuterocanon: defer to Phase 13 with explicit UI labeling, search filters, and source attribution.

## Acceptance Criteria

1. Source URL, license, checksum, and conversion script are documented.
2. Book/chapter/verse counts are validated before import.
3. Deuterocanonical books are labeled distinctly in reader, search, and Settings.
4. Data Sources screen lists license and source metadata.
5. E2E verifies the new corpus appears in reader, search, export, and backup/restore.
6. Alternate versification is explicit where citations do not align with the current 66-book reference model.
