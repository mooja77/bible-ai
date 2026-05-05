# Privacy And Distribution

## Current Privacy Posture

Bible AI is currently treated as a personal-use local app.

- Provider keys are stored in the operating system credential vault and are intended to belong to the user, not the app distributor.
- JSON backups exclude provider API keys.
- User notes, workspaces, bookmarks, highlights, and Council sessions are stored in local SQLite.
- Backup and export files are created only when the user requests them.
- Provider calls send the user's Council question and retrieved evidence to the configured provider.

The Settings screen now includes a `License & Attribution` section that exposes bundled source attribution, license posture, local-data behavior, provider-call behavior, and export leak checks in the app itself.

## Export Review Rule

Exports and source drawers must not include:

- provider API keys
- local app data paths
- installer build paths
- raw environment variables
- unrelated machine identifiers

## Public Release Requirements

Before public distribution:

1. Complete clean-profile Windows install QA.
2. Run multi-provider non-mock Council QA with at least two configured providers.
3. Verify OS credential vault migration on a clean profile and an upgraded profile with legacy SQLite keys.
4. Publish release notes and artifact checksums.
