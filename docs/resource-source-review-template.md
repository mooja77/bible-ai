# Resource Source Review Template

Use this before importing any open resource.

- Source title:
- Source URL:
- Maintainer/publisher:
- License:
- License clarity: clear / unclear
- Attribution text:
- Version/date:
- Redistribution permission:
- Modification rules:
- Share-alike requirements:
- Trademark restrictions:
- Import format:
- Versification/reference compatibility:
- Known data quality risks:
- Source quality: usable / risky / unusable
- Decision: accept / defer / reject

If license or redistribution terms are unclear, defer the source.

Machine-readable reviews can use the same fields in JSON and be checked with:

```bash
cd app
node scripts/resources/assess-source.mjs source-review.json manifest.json
```
