# Privacy And Distribution

Sensitive religious and crisis disclosures are governed by [`sensitive-topic-safety-policy.md`](sensitive-topic-safety-policy.md).

## Current Privacy Posture

Bible AI is currently treated as a personal-use local app. Any public build is
intended to be distributed free of charge for non-commercial Bible study. The
release scope excludes paid access, subscriptions, advertising, and sale of
the bundled content. A future change to that scope requires a new content-rights
review before distribution.

- Provider keys and managed gateway tokens are stored in the operating system credential vault and are intended to belong to the user, team, or app deployment owner.
- No shared provider keys are bundled, committed, or distributed with the app.
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
3. Confirm release packages contain no shared provider keys, local `.env`, local app profile database, or manual release evidence.
4. Publish release notes and artifact checksums.
5. If using a managed gateway publicly, publish gateway privacy notes covering logging, retention, provider routing, and billing ownership.

Completed release prerequisite:

- Multi-provider non-mock Council QA passed on 2026-07-14 with Claude Code
  (`sonnet`) and local Ollama (`granite4.1:8b`) contributing successful,
  grounded answers for all 20 fixture questions.
