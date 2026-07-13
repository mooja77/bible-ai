# Bible AI trust remediation programme

- Date: 2026-07-13
- Owner: project maintainer
- Status: engineering implementation and follow-through complete; named human gates pending
- Release rule: public distribution remains blocked until every automated gate
  is green and every named human gate has signed evidence.

## Product decision

Bible AI is a local-first Bible study workbench that produces auditable Study
Packets. It is not a pastor, theological authority, crisis service, or a system
that measures doctrinal truth as a probability. Council weights are comparative
support judgments over the evidence actually retrieved for a run.

The immediate product objective is trustworthiness, not feature breadth.

## Non-negotiable invariants

1. An edition's local reference is never silently treated as another edition's
   reference. Alternate versification must be represented and mapped explicitly.
2. A Council answer with no citations is unverifiable, not grounded.
3. Model-produced quotations are not authoritative. Displayed Scripture text is
   resolved from the local corpus by reference identity.
4. A real-provider release fixture must exercise the same pipeline shipped in
   the application and record every expected trust stage.
5. Sensitive prompts are routed locally before retrieval, persistence, or model
   calls. Emergency resources are locale-aware and human-reviewed.
6. Every bundled content artifact is pinned by source, version, checksum,
   licence, attribution, and expected record counts.
7. Automated checks never substitute for legal, pastoral, accessibility,
   signing, or clean-machine human attestations.

## Workstreams and acceptance criteria

### R1. Corpus identity and versification

- Add explicit versification-scheme and edition-reference mapping tables.
- Preserve edition-local references while exposing a canonical comparison
  anchor where a reviewed mapping exists.
- Prevent non-existent references from entering user data or Council evidence.
- Remove unreferenced verse rows during a clean corpus build.
- Add corpus invariants for orphan rows, duplicate local references, mapping
  targets, translation counts, FTS parity, and embedding coverage.
- Treat WLC/TR as textual editions, not individual manuscript witnesses.

Acceptance: the Psalm-title and Joel chapter-boundary fixtures map explicitly;
the corpus verifier reports zero unexplained orphan verses; and reference input
is checked against actual text for the selected edition.

### R2. Council evidence and evaluation

- Zero-citation positions/runs are marked unverifiable.
- Verify cited quotations against corpus text and expose mismatches.
- Rename empirical overclaims: "independence" becomes evidence-route diversity;
  "calibrated confidence" becomes confidence adjustment until labelled
  calibration exists.
- Replace provider-count-only real QA with a current-pipeline contract gate.
- Add adversarial quality cases for missing primary passages, prompt injection,
  empty citations, quotation mismatch, and degraded retrieval.
- Do not describe bounded retrieval as the entire context of Scripture.

Acceptance: every current real fixture contains the expected stage contract;
unverifiable output cannot receive a high trust band; and release QA fails when
primary evidence or stage metadata is missing.

### R3. Safety and localization

- Cover the full sensitive-topic policy taxonomy, including indirect phrasing.
- Select crisis resources from an explicit locale, with a safe international
  fallback.
- Add fixture-driven release checks for each category.
- Require professional/pastoral sign-off on wording and resources.

Acceptance: all taxonomy fixtures short-circuit before Council; ordinary study
questions remain usable; and unsigned safety wording blocks public release.

### R4. Provenance and supply chain

- Add a machine-readable corpus lockfile and automated validator.
- Reject unresolved licence/BOM fields in public-release mode.
- Generate an SBOM and run npm/Rust advisory checks in CI.
- Build and verify the corpus from pinned inputs.

Acceptance: CI can reproduce and validate all corpus inputs without relying on
mutable "latest" downloads, and public-release verification consumes the
provenance and SBOM gates.

### R5. Lifecycle, accessibility, and maintainability

- Propagate Council cancellation to provider work where supported; restart the
  sidecar on an uncooperative cancellation boundary.
- Add automated accessibility scans and retain manual real-WebView checks.
- Split high-risk monoliths at service boundaries and lazy-load non-reader UI.
- Keep schema documentation and packaging metadata generated or verified.

Acceptance: cancelled work cannot persist as a normal completed current run;
the initial Reader bundle is code-split; schema drift is test-detectable; and
manual accessibility evidence remains a mandatory release artifact.

## Gate ownership

| Gate | Automated owner | Required human owner |
|---|---|---|
| Corpus identity/provenance | corpus verifier + CI | content/licensing reviewer |
| Council quality | fixture runner + real-QA verifier | theological reviewers |
| Safety | sensitive fixture runner | pastoral/crisis professional |
| Accessibility | E2E + axe | keyboard and screen-reader tester |
| Distribution | manifest/archive verifiers | signing/release operator |
| Privacy/credentials | leak scanners + clean-profile collector | clean-machine operator |

## Definition of public-release ready

Public release is allowed only when:

1. `npm run check` and desktop E2E pass on CI.
2. Corpus, BOM, real-Council, sensitive-topic, SBOM, dependency and packet-leak
   gates pass.
3. The manual release evidence file names the operator, environment, artifacts,
   hashes, accessibility result, safety reviewer, and content reviewer.
4. There are no unaccepted P0/P1 trust failures.

## Implementation ledger — 2026-07-13

The engineering programme above is implemented and enforced in code:

- R1: explicit versification schemes and edition mappings are in schema v14;
  the WLC boundary defect is repaired; corpus identity, FTS, mapping, row-count,
  and embedding checks pass against the release corpus.
- R2: citation-free output is unverifiable, displayed quotations are hydrated
  from corpus rows, adversarial fixtures cover missing/hostile evidence, the
  real-provider verifier requires every trust stage, and Council cancellation
  terminates uncooperative sidecar work.
- R3: the full sensitive-topic taxonomy has direct and indirect fixtures;
  routing happens locally; locale-specific candidate resources are covered by
  tests and remain explicitly pending human safety review.
- R4: all corpus inputs are checksum-locked; CI runs trust contracts, npm and
  Rust audits, strict linting, and SBOM generation; the public release gate
  repeats the full local corpus and supply-chain checks.
- R5: route-level code splitting, automated serious/critical axe checks, schema
  mirror verification, and expanded keyboard/screen-reader/zoom evidence gates
  are present.

Verified engineering baseline on 2026-07-13: 155 sidecar tests, 124 Rust tests,
77 desktop WebView E2E tests, canonical adversarial quality cases, zero npm audit
vulnerabilities in both Node workspaces, zero Cargo-audit vulnerabilities,
155,556 embeddings with exact build identities, 155,557 edition mappings, and
all 11 locked corpus artifacts validated. The Windows E2E run used exact-matched
Microsoft-signed EdgeDriver/WebView2 150.0.4078.65. Cargo audit also reports 19
non-blocking upstream maintenance or
unsoundness warnings; these remain monitored supply-chain debt rather than
being silently ignored.

The project is deliberately **not yet public-release approved**. A named person
must still provide current evidence for content/licensing rights, pastoral or
crisis wording and localized resources, keyboard/screen-reader/200% zoom use,
clean-profile credential behavior, real-provider Council runs through the
current pipeline, signing/notarization, and installed-build smoke tests. The
release scripts fail closed until those artifacts exist and pass.

Follow-through also added the resumable lock-verified atomic corpus builder,
versioned locale safety registry, labelled confidence-adjustment review packet,
canonical quality-case schema enforcement, explicit accessible-export
preference, provider request cancellation, and native Windows/macOS platform
smoke workflows. These reduce engineering ambiguity; they do not replace any
of the named approvals above.
