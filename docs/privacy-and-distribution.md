# Privacy And Distribution

## Current Privacy Posture

Bible AI is currently treated as a personal-use local app.

- Provider keys and managed gateway tokens are stored in the operating system credential vault and are intended to belong to the user, team, or app deployment owner.
- Legacy SQLite provider-secret rows are migrated to the credential vault, then removed with SQLite secure delete and vacuum cleanup.
- JSON backups exclude provider API keys and managed gateway tokens.
- User notes, workspaces, bookmarks, highlights, and Council sessions are stored in local SQLite.
- Backup and export files are created only when the user requests them.
- Provider calls send the user's Council question and retrieved evidence to the configured provider or managed gateway.

The Settings screen now includes a `License & Attribution` section that exposes bundled source attribution, license posture, local-data behavior, provider-call behavior, and export leak checks in the app itself.

## Export Review Rule

Exports and source drawers must not include:

- provider API keys
- managed gateway tokens
- local app data paths
- installer build paths
- raw environment variables
- unrelated machine identifiers

## Public Release Requirements

Before public distribution:

1. Complete clean-profile Windows install QA.
2. Verify OS credential vault migration on a clean profile and an upgraded profile with legacy SQLite keys.
3. Publish release notes and artifact checksums.
4. If using a managed gateway publicly, publish gateway privacy notes covering logging, retention, provider routing, and billing ownership.

Completed release prerequisite:

- Multi-provider non-mock Council QA passed on 2026-05-07 with Gemini and OpenAI contributing successful answers for all 20 fixture questions.
