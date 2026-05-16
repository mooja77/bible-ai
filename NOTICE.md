# Notices

The Bible AI source code is licensed under the MIT License. Bundled and generated study data may have separate licenses or attribution requirements.

## Source Code

- License: MIT
- See [`LICENSE`](LICENSE).

## Corpus And Study Data

The app is designed to ship only public-domain or permissively licensed corpus data by default. Current and planned data-source records live in:

- [`docs/data-sources.md`](docs/data-sources.md)
- [`docs/open-resource-ingestion-plan.md`](docs/open-resource-ingestion-plan.md)

The generated corpus database is intentionally not committed to Git:

- `data/corpus.sqlite`
- `data/sources/`

Those files are generated or cached locally by ingestion scripts and must be reviewed against their source licenses before redistribution.

## Bundled Fonts

PDF export embeds the DejaVu Sans font so accented Latin, Greek, and Hebrew
render correctly.

- Font: DejaVu Sans (`app/src-tauri/fonts/DejaVuSans.ttf`)
- License: Bitstream Vera Fonts Copyright (permissive); DejaVu changes are
  public domain. Full text: [`app/src-tauri/fonts/DejaVuSans-LICENSE.txt`](app/src-tauri/fonts/DejaVuSans-LICENSE.txt).

## Provider Credentials

Do not commit API keys, OAuth tokens, `.env` files, local SQLite user databases, release evidence containing personal data, or generated installer artifacts.
