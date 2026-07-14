# Bible AI deep review and implementation report

- Review date: 2026-07-13
- Scope: product thesis, repository architecture, corpus, Council, safety,
  privacy, accessibility, supply chain, release operations, documentation, and
  enhancement priorities
- Engineering status: implemented and verified
- Public-release status (updated 2026-07-14): real-provider machine gate passes;
  blocked by named human evidence gates

## Executive verdict

Bible AI has a coherent and differentiated product thesis: a local-first Bible
study workbench that helps a user assemble an auditable Study Packet without
presenting AI as a pastor, theological authority, counselor, or source of
Scripture. Its strongest product assets are the local research record, visible
evidence trail, user-authored theology, exportability, and provider choice.

The codebase already implemented much of that thesis, but the pre-review trust
story was stronger in documentation and UI language than in several underlying
contracts. The most serious examples were edition references being treated as
globally identical despite WLC versification differences, citation-free Council
output receiving a numeric citation score, model-authored quotations being
displayed as Scripture, a stale real-provider fixture passing an obsolete
contract, US-only crisis resources, and release provenance that depended on
mutable or locally cached artifacts without a machine-readable lock.

Those engineering defects are now remediated and covered by automated gates.
The application builds, all automated suites pass, and the release gate fails
closed on the evidence that only real providers and named humans can supply.
That last distinction matters: engineering-complete does not mean legally,
pastorally, accessibly, or operationally approved for public distribution.

## Reconstructed initial concept and aims

The repository's README, master plan, Study Packet contract, architecture,
learning plans, and historical reviews consistently converge on these aims:

1. **Study, not replacement.** AI assists research and judgment; the user reads
   the evidence and records a conclusion.
2. **Local-first ownership.** Scripture, notes, workspaces, theology, history,
   and backups remain useful without a hosted account.
3. **Auditability.** A Council result exposes provider status, retrieved verses,
   supporting and challenging evidence, dissent, confidence rationale, and raw
   source data.
4. **Portable output.** Study Packet v1 is the north-star artifact: a durable
   bundle of passage, question, evidence, reasoning, judgment, sources, and
   attribution.
5. **Plural comparison without false authority.** Multiple provider voices can
   compare interpretations, but provider count is not proof of independence or
   truth.
6. **Rights-aware openness.** Public-domain and open-license sources are favored;
   source identity and obligations remain visible.
7. **Narrow beta positioning.** The first audience is serious, technically
   tolerant learners—not children, mass-market devotional users, or people
   seeking pastoral or crisis care.

The review confirms that this remains the right strategic center. Features that
do not make the Study Packet more trustworthy, portable, safe, accessible, or
releasable should not displace the remaining release evidence work.

## Review method

The review combined:

- repository-wide code, schema, script, fixture, documentation, and dependency
  inspection;
- direct queries against the built release corpus;
- clean builds, unit tests, sidecar contract tests, adversarial quality cases,
  dependency audits, SBOM generation, and real Tauri WebView E2E tests;
- comparison of runtime behavior with the canonical architecture, release,
  safety, data-source, and Study Packet claims;
- current primary-source research for Tauri security boundaries, Vite 8
  migration/support, CycloneDX, RustSec advisories, PDF generation, and emergency
  resources.

Primary external references used for decisions:

- [Tauri Content Security Policy](https://v2.tauri.app/security/csp/)
- [Tauri capabilities and security boundaries](https://v2.tauri.app/security/capabilities/)
- [Vite 8 migration guide](https://vite.dev/guide/migration)
- [Vite supported releases](https://vite.dev/releases)
- [CycloneDX SBOM introduction](https://cyclonedx.org/guides/sbom/introduction/)
- [RustSec advisory database](https://rustsec.org/advisories/)
- [krilla PDF architecture and testing](https://github.com/LaurenzV/krilla)
- [HSE urgent mental-health help](https://www2.hse.ie/mental-health/services-support/get-urgent-help/)
- [NHS urgent mental-health support](https://www.nhs.uk/every-mind-matters/urgent-support/)
- [988 Lifeline contact guidance](https://988lifeline.org/contact-us/)

## Architecture as implemented

| Boundary | Current implementation | Trust responsibility |
| --- | --- | --- |
| Desktop UI | React 19, TypeScript, Tailwind, Vite 8 | Accessible interaction, honest labels, visible evidence and errors |
| Desktop core | Tauri 2.11 / Rust | IPC validation, filesystem boundaries, corpus/user DB access, local safety routing |
| Corpus | Read-only SQLite resource | Edition identity, text, mappings, search, morphology, provenance |
| User data | Per-profile `user.sqlite` | Notes, workspaces, theology, settings, history, imports, backups |
| Credentials | OS credential vault | Provider and gateway secrets; excluded from ordinary exports |
| AI orchestration | Bundled Node sidecar | Provider calls, scoping, voices, synthesis, grounding stages, failures |
| Local semantics | SQLite embedding BLOBs + Rust cosine search | Search/retrieval ranking; explicit fallback when query embedding is unavailable |
| Distribution | Tauri packaging + release scripts | Hashes, manifests, SBOMs, installer smoke, human evidence |

The main architectural concern is no longer an incorrect boundary but
maintainability inside boundaries: `src-tauri/src/lib.rs` remains about 4,700
lines and `user_db.rs` about 8,900 lines. Route-level frontend splitting has
reduced initial bundle pressure, but the Rust command and persistence surfaces
should be decomposed after the release-evidence work.

## Findings and implemented corrections

### P0 — corpus identity and evidence integrity

| Finding | Why it mattered | Implemented correction | Verification |
| --- | --- | --- | --- |
| WLC local references were treated as KJV-identical | Joel and Psalm boundaries could return or cite the wrong canonical verse | Added versification schemes, translation assignments, explicit edition mappings, OpenScriptures VerseMap ingestion, and mapping-aware reads | WLC boundary fixtures, mapping FK checks, and full corpus verifier pass |
| Stale WLC rows left orphan verse identities | Search and joins could expose identities no edition actually supplied | Reingested WLC and added safe orphan pruning | Zero unexplained orphans; 31,310 canonical verse rows |
| Citation-free Council output received a normal accuracy value | A user could read “grounded” where nothing was verifiable | Citation accuracy is nullable; no citations means `unverifiable` and a hard floor failure | Sidecar unit and adversarial fixture pass |
| Model-produced Scripture quotations were displayed directly | A fabricated or altered quote could appear authoritative | Quotes, references, and translation labels are hydrated from retrieved corpus rows; mismatches hard-fail | Quote-mismatch tests and current real-QA contract |
| Positions could omit in-corpus evidence | A polished position could survive on unsupported prose | Every position must cite retrieved evidence; named primary passages must be retrieved | Grounding and primary-passage omission fixtures pass |
| Jump navigation trusted syntactic parsing alone | A valid-looking reference absent from the selected edition could be stored or opened | Navigation validates the range against selected-edition text first | Rust/E2E Reader coverage passes |

### P0 — safety, governance, and release honesty

| Finding | Why it mattered | Implemented correction | Residual requirement |
| --- | --- | --- | --- |
| Sensitive routing covered only a subset of policy language | Indirect crisis, abuse, coercion, or high-stakes prompts could reach AI providers | Full ten-category local classifier plus direct/indirect fixture set | Named professional/pastoral review |
| Crisis copy assumed a US 988 context | Incorrect numbers can be harmful outside the US | Candidate resources for `en-IE`, `en-GB`, and `en-US`; unknown locales use no country-specific number | Review wording, translations, and territories before distribution |
| Old real-provider QA only proved providers returned prose | It did not prove the current trust pipeline ran | Verifier now requires grounding, scope, judge, route-diversity, soft confidence layer, kill test, persisted evidence, quote hydration, and primary passages | Current 20-case Granite + Claude fixture passes; named human confidence review remains |
| Content rights existed mainly as prose/TODOs | Checksums cannot determine redistribution rights | Machine-readable corpus lock plus named-review template and public gate | Qualified reviewer must approve every source and territory |
| Automated checks could be mistaken for human approval | Safety, accessibility, signing, and legal work might be silently skipped | Manual gate schema now requires keyboard, screen reader, 200% zoom, localized safety, content review, clean profile, and operator identity | Humans must perform and sign, never prefill |

### P1 — supply chain, lifecycle, and accessibility

| Finding | Implemented correction | Result |
| --- | --- | --- |
| Mutable/latest corpus downloads and incomplete provenance | Pinned Git commits or checksum-locked artifacts with versions, bytes, licenses, attribution, expected rows, and validators | All 11 artifacts pass full validation |
| `printpdf` pulled a high-severity affected `lopdf` range | Replaced it with `krilla`/`pdf-writer`, retained embedded DejaVu Unicode and pagination tests | Affected parser removed; PDF tests pass |
| Tauri chain used affected `quick-xml` | Updated Tauri/plist resolution to `plist 1.10` and `quick-xml 0.41` | Cargo audit reports zero vulnerabilities |
| Frontend dependencies contained high audit findings | Migrated to supported Vite 8/plugin versions, aligned Tauri JS/Rust 2.11 lines, and locked patched transitive packages | Both npm audits report zero vulnerabilities |
| Cancel changed UI state but did not guarantee provider work stopped | Added cancellation epoch, Tauri cancel command, sidecar kill/drop, and clean respawn boundary | Cancellation unit and WebView timeout/retry tests pass |
| Schema mirrors could drift | Added runtime/mirror schema version verification and moved fixtures to v14 | Schema sync gate passes |
| No automated accessibility scanner | Added axe WCAG A/AA serious/critical scans to real Tauri E2E | Reader and Council axe checks pass |
| Initial frontend bundle carried all major modes | Added route-level lazy loading for Council, Settings, Theology, Resources, and Workspaces | Reader shell is split from feature chunks |
| No standard release software inventory | Added CycloneDX npm and Cargo SBOM generation/validation and packaging | Current SBOMs contain 553 npm and 475 Cargo components |

### Terminology corrections

Several labels implied a stronger empirical claim than the system could support.
The UI and current documentation now use:

- “provider voices” rather than “independent voices”;
- “cross-family judge/check” rather than implying independent adjudication;
- “evidence-route diversity” rather than statistical independence;
- “confidence adjustment” rather than calibrated probability.

Historical review documents retain their original wording as an audit trail.

## Corpus ground truth after remediation

- Canonical comparison verse identities: 31,310
- Edition mappings: 155,557
- Stored embeddings: 155,556
- KJV rows: 31,100
- ASV rows: 31,086
- WEB rows: 31,098
- YLT rows: 31,102
- WLC rows: 23,213
- TR rows: 7,957
- Locked source artifacts: 11
- Lock and corpus verifier failures: 0

The one-row mapping/embedding difference is an intentionally textless mapped
heading, not missing text coverage. WEB semantic coverage is complete; its E2E
test now accepts either a true meaning result when Ollama can embed the query or
an explicit Ollama fallback, and rejects the obsolete “WEB has no index” claim.

## Verification record

Passed on the review machine:

- `npm run check:trust`
  - schema v14 mirror check;
  - 11-entry lock metadata check;
  - four canonical quality cases;
  - three corpus-backed retrieval/weakness helper tests;
  - 156 sidecar tests.
- `npm run check`
  - TypeScript and Vite 8 production build;
  - Rust format/check/test/strict Clippy;
  - script syntax, resource fixtures, leak checks, and quality checks.
- Rust: 125 tests, including installed-corpus drift diagnostics,
  Unicode/multipage PDF, versification-aware queries,
  safety taxonomy, locale fallback, cancellation, imports, backups, and secrets.
- Tauri WebView: 77 E2E tests in a disposable profile.
- EdgeDriver/WebView2: exact-matched Microsoft-signed version 150.0.4078.65.
- Accessibility: axe serious/critical WCAG A/AA scan, focus, keyboard, contrast,
  and maximum text scaling all pass automated checks.
- Provenance: full corpus lock and corpus integrity verifiers pass.
- Supply chain: zero npm vulnerabilities in app and sidecar; zero Cargo-audit
  vulnerabilities; SBOM validation passes.

Cargo audit reports 19 allowed upstream warnings, primarily Tauri's
target-specific GTK3 ecosystem plus maintenance notices in text-shaping
dependencies. These are recorded debt. They must be reviewed on dependency
updates and must not be described as a completely advisory-free graph.

## Current fail-closed release evidence

The Council machine gate is green: `tests/fixtures/council-real-results.json`
contains 20 current-pipeline Granite/Ollama + Claude Code results, both providers
succeeded 20/20, grounding is verified 20/20, and there are zero request errors,
run warnings, or output-level weakness flags. The run also exposed and fixed
missing James 2/Romans 4 and Sermon-on-the-Mount evidence seeds plus a quote-
hydration ordering defect. `npm run qa:real-council:verify` passes.

The public gate remains intentionally red for three human evidence categories:

1. `release/council-confidence-review.json` is SHA-bound to the current fixture
   but has no named 20-case theological-confidence labels.
2. `release/content-review.json` is a blank identity-bound template and does not
   contain a named completed rights decision for the intended territories and
   channels.
3. `release/manual-release-gates.json` lacks clean-profile, credential-vault,
   keyboard, screen-reader, 200% zoom, sensitive-wording, and localized-resource
   attestations.

The follow-through run also fixed progress-event handling in the Python harness,
bounded Ollama context/memory and structured-output retries, made long runs
resumable without reusing untrusted results, balanced multiple explicit passage
ranges, corrected numbered-book alias matching, and added topical coverage for
John 6, assurance, James 2/Romans 4, and the Sermon on the Mount.

Manual accessibility, safety wording, clean-profile credentials, installer
hashes, signing/notarization, installed smoke, and target-territory approval also
remain mandatory. See `docs/ship-readiness.md` for the exact sequence.

## P1 follow-through status

1. **Reproducible embedding identity — implemented.** The database and lock
   record exact Ollama model digest, Ollama/generator versions, platform data,
   dimensions, counts, and aggregate per-edition embedding hashes. Resume
   refuses identity drift.
2. **Corpus build orchestrator — implemented.** One resumable command fetches
   locked artifacts, verifies before parse, builds in isolation, checkpoints
   exact inputs, runs full invariants, and atomically promotes only a verified
   corpus.
3. **Rust decomposition — started at the highest-risk boundary.** Safety routing
   and the locale registry moved from the command monolith into `safety.rs`.
   Wider reader/Council/export/database extraction remains maintainability debt
   and should proceed incrementally behind existing IPC tests.
4. **PDF accessibility and bidi — explicit safe fallback implemented.** The UI
   now prefers HTML or Markdown for accessible sharing and labels PDF as an
   untagged visual archive with limited Hebrew bidi behavior. PDF/UA remains a
   future enhancement, never a current claim.
5. **Empirical Council agreement review — tooling implemented; human evidence
   pending.** A SHA-bound 20-case template and fail-closed verifier now measure
   exact/adjacent agreement, overstatement, severe overstatement, and blocking
   reviewer findings. Live payloads state `empirically_calibrated: false`.
6. **Expanded locale registry — implemented, approval pending.** Versioned
   `en-IE`, `en-GB`, `en-US`, and international fallback records include owner
   role, jurisdiction, official sources, review fields, dates, and expiry.
7. **Cross-platform release CI — implemented, hosted evidence pending.** Windows
   CI builds a checksum-locked E2E corpus, installs exact Microsoft-signed
   EdgeDriver, and runs the WebView suite. macOS CI creates an ad-hoc `.app` and
   verifies bundled resources. Developer ID signing/notarization remains a
   protected-credential and human release gate.

### P2 — scale and product depth

- Replace brute-force cosine scans with a benchmarked local ANN index only when
  corpus size or latency data justifies the added native dependency.
- Add DRC/LXX/deuterocanon only with edition-specific canon and versification,
  navigation, rights, and attribution—not by coercing them into the 66-book map.
- **Installed corpus diagnostics — implemented.** Settings reports the exact
  running artifact's canonical verses, edition mappings, FTS rows, semantic
  embeddings, per-edition coverage, embedding model, and full model digest.
  It labels this as a lightweight runtime inventory; source-lock checksums and
  full SQLite integrity remain build/release gates rather than an interactive
  startup claim.
- Add privacy-preserving, opt-in operational diagnostics only after a written
  data-minimization and retention decision.
- Evaluate signed update channels after code-signing ownership and rollback
  operations are established.

### Explicit non-goals for the current product

- AI pastor, counselor, crisis service, or spiritual authority;
- public theological answer marketplace or social feed;
- youth/school deployment without a separate safeguarding programme;
- copyrighted translation library without contracts;
- cloud sync or mobile parity before the local Study Packet workflow is proven;
- claims that multiple providers constitute independent evidence of truth.

## Operating process established by this review

For every corpus change:

1. pin source identity and checksum;
2. record license and attribution;
3. ingest into a temporary/review corpus;
4. run lock, row, mapping, FTS, text, and embedding gates;
5. obtain named rights review before distribution.

For every Council change:

1. add or update a deterministic unit/quality fixture;
2. prove corpus-only quote hydration and primary-passage coverage;
3. run mock E2E;
4. regenerate real-provider evidence when the stage contract changes;
5. never grandfather a fixture from an older contract.

For every public release:

1. run the automated build, trust, corpus, audit, SBOM, and WebView suites;
2. generate current real-provider evidence;
3. collect named content, safety, accessibility, clean-profile, credential,
   signing, and installed-smoke evidence against exact artifact hashes;
4. run the fail-closed public release gate;
5. publish only the verified artifacts and their checksums.

## Final assessment

The project should continue. Its product thesis is stronger than a generic Bible
chatbot because it makes the durable research artifact—not the AI answer—the
center of value. The implementation now better matches that thesis. The next
milestone is not another feature wave; it is completing the real-provider and
human evidence packet, then conducting a small direct-invite beta with the
release gate still intact.
