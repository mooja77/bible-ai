# Contributing

Thanks for considering a contribution to Bible AI.

## Development

1. Fork the repository.
2. Create a feature branch.
3. Install dependencies:

```bash
cd app
npm install
```

4. Run checks before opening a pull request:

```bash
npm run check
```

For workflows that touch the UI, exports, SQLite persistence, Council results, or release packaging, add or update focused tests and documentation.

## Data And Licensing

Do not add new Bible translations, commentaries, lexicons, or source datasets unless their redistribution terms are clear and documented.

Every new resource should include:

- Source URL
- License
- Attribution text
- Version/date
- Redistribution assessment
- Export attribution behavior

Use [`docs/resource-source-review-template.md`](docs/resource-source-review-template.md) for source review.

## Secrets

Never commit:

- `.env` files
- Provider API keys
- OAuth tokens
- Local `user.sqlite`
- Generated release evidence containing personal data
- Installer artifacts or build outputs

Provider credentials should stay in the operating-system credential vault or local development environment.
