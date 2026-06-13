# Distribution Channel Decision

Status: DRAFT (for review)
Last updated: 2026-06-13

This document records how Bible AI will be distributed across its beta lifecycle
and the release gates that must pass before each step. It implements EP-021 and
Milestone 8 (release operations and distribution) of the master plan.

These channels describe a planned sequence. Most of them are NOT active yet.
Today the app is treated as a personal-use local build (see
`docs/privacy-and-distribution.md`). Package managers, the Tauri auto-updater,
and the Microsoft Store are deferred surfaces and are not wired up.

## Goals

- Make install, update, diagnostics, and release trust boring.
- Distribute the smallest viable surface first, and widen only after the
  release process and support loops are proven.
- Never ship a channel whose trust or maintenance cost we cannot meet yet.

## Distribution Sequence

The channels are ordered. Do not skip ahead.

### 1. Private beta (current target)

- Direct installer handoff, or a GitHub pre-release marked clearly as a
  pre-release.
- Distribution is by direct invite only (Milestone 9: start with 5 to 10 users).
- Release notes must state plainly that this is an unproven beta of a faith
  AI study tool, that the AI assistant is not a pastor, counselor, or
  authority, and that installer/platform warnings are expected for an
  unsigned or newly-signed build.
- Provide artifact checksums even at this stage so testers can verify identity.

### 2. Public beta

- GitHub Releases as the primary channel.
- Each release must include:
  - SHA-256 checksums for every artifact, matching the release manifest.
  - Signed installers if code-signing certificates are available; if not,
    document the unsigned status and the platform warnings testers will see.
  - A known-issues list.
  - Rollback and downgrade notes (how to uninstall the new build and
    reinstall a prior version without losing user data).
  - Public release evidence (the manual QA gate output described below).

### 3. Package managers (later)

- WinGet and Homebrew, added only after the GitHub release process is stable
  and repeatable.
- Deferred. Not configured yet. Each manifest must point at the same signed,
  checksummed artifacts published on GitHub Releases.

### 4. Tauri auto-updater (later)

- Deferred. Enabled only after ALL of the following are mature:
  - Installer code-signing is in place.
  - Update JSON / update feed hosting is set up and owned.
  - A rollback policy exists for a bad update.
  - The support process can absorb update-related reports.
- Until then, updates are manual: the user downloads and installs a new build.

### 5. Microsoft Store (later, optional)

- Deferred. Pursued only if the discovery and trust benefits clearly outweigh
  the packaging, certification, and maintenance overhead.
- May be skipped entirely.

## P0 Release Gates

A public beta release is blocked until every gate below passes. These mirror
`docs/testing-and-release-plan.md` and `docs/privacy-and-distribution.md`.

- Clean-profile Windows install QA passes (fresh profile, no system Node in
  PATH where possible).
- Credential-vault migration evidence captured on a clean profile and on an
  upgraded profile with legacy SQLite keys.
- No bundled shared provider keys.
- No `.env`, local profile DB, manual evidence, or secrets present in any
  package.
- Release manifest hashes match the shipped artifacts.
- Manual QA evidence is tied to the current artifact hashes.
- Sidecar files are individually hashed.
- Third-party notices / SBOM are generated, or the gap is explicitly recorded
  as accepted risk.
- Support bundle redaction is verified.
- Export leak scans pass.
- Real-provider Council QA fixture passes, or the release explicitly stays
  private / mock-limited.

The combined public-release gate is expected to fail until the real-provider
fixture and the clean-profile evidence file are both present and valid. The
gate cannot be marked complete from source edits alone.

## Diagnostics And Telemetry Policy

- No hidden telemetry. The app does not phone home.
- No passive collection of Bible reading, search queries, prompts, notes,
  theology topics, or resource content.
- Support bundles are user-initiated and reviewable before they are shared.
- Crash reporting is deferred. It is considered only behind an opt-in beta
  mode, with scrubbing and SDK maturity reviewed first.

## Definition Of Done

A tester can install the app, verify artifact identity against published
checksums, understand any platform warnings, understand what provider data
movement occurs, and report problems without leaking private study content.

## Decisions A Human Must Make

- Whether to acquire a Windows (and later macOS) code-signing certificate, and
  who owns it. This unblocks signed installers and, later, the auto-updater.
- Whether GitHub Releases (and GitHub Issues) is the accepted public channel,
  or whether another host is preferred.
- Who owns and hosts the update feed before the Tauri updater is enabled.
- Whether the Microsoft Store is worth pursuing at all.

## Related Documents

- `docs/privacy-and-distribution.md`
- `docs/testing-and-release-plan.md`
- `docs/community-channel-policy.md`
- `docs/institutional-pilot-readiness.md`
- `docs/sensitive-topic-safety-policy.md` (EP-004)
