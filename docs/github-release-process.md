# GitHub Release Process

## Purpose

GitHub Releases is the primary binary distribution channel for Bible AI. The
release process preserves one critical property: the installer a person tests
is the installer that is published. A public workflow must never rebuild an
artifact after its clean-profile evidence was recorded.

The repository therefore uses two manually dispatched workflows:

1. `Build immutable release candidate` builds Windows installers and,
   optionally, a signed/notarized Apple Silicon DMG. It creates a private draft
   prerelease whose candidate tag is bound to the exact source commit.
2. `Promote verified public release` downloads those same files, verifies their
   manifests and human evidence, reruns the public-release gates, and publishes
   them without rebuilding.

Neither workflow runs automatically from a source push or a tag. A public
release is a deliberate owner action.

## Repository Protection

Create a GitHub Actions environment named `public-release` and configure the
repository owner (or another trusted maintainer) as a required reviewer. Do not
place build credentials in that environment unless they are needed by the
promotion job; Apple credentials are used only by the private candidate build.

Recommended environment settings:

- required reviewer: at least one project maintainer;
- prevent self-review when a second maintainer is available;
- deployment branches: `main` only;
- no bypass for administrators during normal releases.

The promotion workflow also checks that it was dispatched from `main`, the
candidate is still a private draft prerelease, the version tag matches
`tauri.conf.json`, and the destination release does not already exist.

## Apple Secrets

To include a public DMG, configure these GitHub Actions repository secrets:

- `APPLE_CERTIFICATE`: base64-encoded Developer ID Application `.p12`;
- `APPLE_CERTIFICATE_PASSWORD`: password used when exporting the `.p12`;
- `KEYCHAIN_PASSWORD`: strong temporary CI keychain password;
- `APPLE_ID`: Apple account email used for notarization;
- `APPLE_PASSWORD`: Apple app-specific password;
- `APPLE_TEAM_ID`: Apple Developer team identifier.

The candidate workflow imports the certificate into a temporary keychain.
Tauri signs, submits for notarization, and staples the app/DMG. The workflow then
independently runs `codesign`, `spctl`, and `stapler validate`. Missing secrets
or any failed check stops the candidate.

The first public DMG is Apple Silicon only. Intel or Universal builds must not
be claimed until a separate target matrix and clean Intel test have been added.

## Windows Signing

The candidate records Authenticode status for both NSIS and MSI files. The
promotion workflow rejects an unsigned installer unless its manual
`acknowledge_unsigned_windows` input is selected. When selected, the generated
release notes include an explicit Unknown Publisher and SmartScreen warning.

Acquire and configure a Windows code-signing identity before removing that
warning or describing the Windows installer as signed.

## Step 1: Stage The Corpus Privately

The generated `data/corpus.sqlite` is too large for Git and is never committed.
After content/source review permits release staging, upload the verified file
to a temporary **draft** GitHub Release and record its checksum:

```powershell
$hash = (Get-FileHash -Algorithm SHA256 data\corpus.sqlite).Hash.ToLowerInvariant()
gh release create corpus-v0.1.0-staging --draft --target main --title "Private corpus staging v0.1.0" data\corpus.sqlite
$hash
```

Do not publish the corpus staging release. Both build jobs download
`corpus.sqlite` from this private release and reject it unless its SHA-256 is
exactly the supplied digest.

## Step 2: Build An Immutable Candidate

From GitHub Actions, dispatch `Build immutable release candidate` on `main`.
For the first attempt use:

- `candidate_tag`: `v0.1.0-rc.1`;
- `corpus_release_tag`: the private corpus staging tag;
- `corpus_sha256`: the lowercase digest printed above;
- `include_macos`: `false` for Windows-only, or `true` when all Apple secrets
  are configured.

Candidate tags are immutable. If a build or QA lap must be repeated, increment
the suffix (`rc.2`, `rc.3`, and so on). Do not overwrite an earlier candidate.

The Windows job runs the full source/trust suite, builds NSIS and MSI, performs
isolated app and exact-installer smoke checks, generates SBOMs/manifests, and
records Authenticode status. The optional macOS job builds on Apple Silicon,
signs, notarizes, staples, and verifies the DMG. Successful jobs create a
private draft prerelease containing the exact candidate files.

## Step 3: Complete Exact-Artifact Human Review

Download the installers from the private candidate draft. Complete every review
against those exact files; do not use a locally rebuilt substitute.

Required candidate assets before promotion:

- `manual-release-gates.json`;
- `content-review.json`;
- `council-confidence-review.json`;
- `macos-manual-release-gates.json` when publishing a DMG.

Generate the Windows/content/confidence templates with the existing commands in
`docs/ship-readiness.md`. On a Mac, download the candidate DMG and generate its
hash-bound template from `app/`:

```bash
npm run qa:macos-gates:template -- --dmg "/path/to/Bible AI_0.1.0_aarch64.dmg"
```

Perform every named clean-profile, provider, Keychain, backup/restore,
accessibility, safety, and Gatekeeper check. A reviewer changes a boolean to
`true` only after that exact check passed. Validate the completed macOS record:

```bash
mkdir -p installers
cp "/path/to/Bible AI_0.1.0_aarch64.dmg" installers/
npm run qa:macos-gates:verify
```

Upload the completed records to the private candidate draft:

```powershell
gh release upload v0.1.0-rc.1 `
  app\release\manual-release-gates.json `
  app\release\content-review.json `
  app\release\council-confidence-review.json `
  app\release\macos-manual-release-gates.json
```

The evidence records may contain reviewer names and machine/profile labels. Keep
the candidate release private and do not put secrets, provider keys, personal
study content, or sensitive local paths in notes.

## Step 4: Promote The Exact Candidate

Dispatch `Promote verified public release` on `main` with:

- the immutable candidate tag;
- `public_tag` matching the app version exactly (`v0.1.0`);
- the same private corpus tag and SHA-256;
- `include_macos` matching the candidate;
- unsigned Windows acknowledgement only when intentionally shipping an
  unsigned beta;
- `prerelease: true` for the initial beta.

The protected job pauses for the `public-release` environment reviewer. After
approval it:

1. resolves the candidate tag to its full source commit;
2. downloads the candidate files and human evidence;
3. downloads and verifies the corpus and every locked source snapshot;
4. runs the complete public-release verifier;
5. compares NSIS, MSI, and DMG byte counts and SHA-256 values with their
   source-bound manifests;
6. verifies the manual evidence against those exact installers;
7. rechecks Developer ID, notarization, stapling, and Gatekeeper for a DMG;
8. creates `SHA256SUMS.txt` and stages only public-safe artifacts;
9. creates the GitHub Release without rebuilding any binary.

Any mismatch fails closed. The workflow does not overwrite an existing public
tag or Release.

## Step 5: Post-Publication Check

From a signed-out browser session:

1. open the GitHub Releases page;
2. confirm the release is visible and correctly marked as a prerelease;
3. download each platform installer and `SHA256SUMS.txt`;
4. verify the published hashes;
5. repeat a clean download/install/launch smoke on Windows and macOS;
6. confirm the README and install guides point to the correct release status;
7. delete the private corpus staging release only after rollback evidence is
   safely retained elsewhere.

If the public check finds a blocking defect, mark the Release as a draft or
remove the affected asset, document the issue, and create a new candidate. Do
not silently replace a published binary under the same filename or tag.

## Public Assets

The public Release contains only:

- NSIS `.exe` and MSI `.msi` installers;
- signed/notarized `.dmg` when macOS is included;
- source-bound Windows and macOS manifests/summaries;
- npm and Cargo CycloneDX SBOMs;
- platform signing-status records;
- `SHA256SUMS.txt`.

Human evidence and the standalone corpus remain on private draft releases. No
provider credentials, local study data, raw logs, or developer paths are public
release assets.
