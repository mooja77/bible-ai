# Study Packet v1 Contract

Status: DRAFT (for review)
Date: 2026-06-13
Owner packet: EP-001 (see `docs/development-implementation-plan.md`)

This document is the canonical contract for Study Packet v1, the north-star
artifact of Bible AI. It defines what a packet contains, how its files are laid
out, what metadata it must carry, how Scripture, source, AI, and user content
are labeled, and what data must never appear in an export.

This is a documentation-only contract. It does not change code. It describes a
TARGET. The current app exports a single Markdown, HTML, or PDF file, not the
multi-file folder defined here. See "Current state vs contract" for the gap and
the execution packets that close it.

This document is an engineering and product record, not legal advice.

## Purpose

A Study Packet is a portable, auditable Bible study artifact created from a
clean install. It exists so that a serious-study user can:

- Keep a durable record of a study that is useful outside the app.
- Audit how a conclusion was reached, including evidence and AI reasoning.
- Separate Scripture, third-party source material, AI-authored text, and their
  own conclusions without ambiguity.
- Share a study or a bug report without leaking private credentials, local
  paths, or machine identifiers.
- Reproduce or re-run a study later using the recorded metadata.

The governing rule from the implementation plan applies:

> If a task does not make Study Packet v1 more trustworthy, portable, safe,
> testable, accessible, or releasable, it is not P0.

## User Stories

- As a Bible student, I export a study of a hard passage and later reopen it in
  a plain Markdown editor and understand it without the app.
- As a small-group leader, I export a teaching packet and hand the Markdown to
  a co-leader who has never installed Bible AI.
- As an Obsidian user, I drop a packet folder into my vault and the files link
  to each other and render cleanly.
- As a careful reader, I open `evidence.md` and `council.md` and can tell which
  sentences are Scripture, which are from a third-party resource, which are AI
  output, and which are my own.
- As a beta tester, I attach a packet to an issue and trust that it contains no
  API keys, gateway tokens, local paths, or machine identifiers.
- As an auditor, I read `manifest.json` and know the app version, corpus
  version, provider and model, retrieval mode and any fallback, and the
  embedding model and dimensions used.

## Packet Folder Layout

A Study Packet v1 export is a folder. The folder name should be derived from the
study title and an export timestamp. The folder contains these files:

```
<packet-folder>/
  README.md
  passage.md
  question.md
  evidence.md
  council.md
  judgment.md
  sources.md
  manifest.json
  bibliography.csl.json   (optional, when citation-grade metadata exists)
  references.bib          (optional, when citation-grade metadata exists)
```

All `.md` files must open cleanly in normal Markdown editors and in Obsidian.
Cross-file links between packet files should use relative paths so the folder is
self-contained and portable.

### Required Files

- `README.md`
  - Title of the study.
  - Passage reference.
  - Created and exported timestamps (ISO 8601, UTC).
  - App version and corpus version.
  - Provider and model summary for any AI content.
  - A short table of contents linking to the other packet files.

- `passage.md`
  - Scripture text for the passage.
  - Translation metadata (code, name, license class).
  - Notes on omitted or missing verses where relevant (for example, verses with
    no text in a translation).
  - Labeled as Scripture content (see "Content Labels").

- `question.md`
  - The user question.
  - Optional starting view or mode.
  - Scope, filters, and assumptions (translation, book or testament scope,
    evidence limits, cross-reference inclusion).
  - Labeled as user-authored content.

- `evidence.md`
  - Retrieved evidence.
  - Used evidence (cited by Council positions).
  - Ignored or unused evidence where it can be distinguished.
  - Source metadata per evidence item.
  - Retrieval mode and any fallback reason.
  - Scores where available (semantic, keyword, cross-reference weight).
  - Evidence quotes are Scripture content; surrounding notes are AI-authored
    or system-authored and must be labeled as such.

- `council.md`
  - Positions and per-voice analysis.
  - Synthesis.
  - Dissent notes.
  - Confidence rationale.
  - Unresolved tensions.
  - Weakest links.
  - "What would change this."
  - Labeled as AI-authored content, except quoted Scripture, which is labeled as
    Scripture.

- `judgment.md`
  - User-authored conclusion.
  - Personal confidence.
  - Changed view note (before and after).
  - Open questions.
  - Free notes.
  - Per-position user ratings.
  - Labeled as user-authored content.

- `sources.md`
  - Source rights and attribution.
  - License notes.
  - Resource provenance.
  - Source decision classes (see `docs/content-bom.md` once it exists, EP-003).
  - Share-alike requirements where they apply.
  - Labeled as source-authored content and metadata.

- `manifest.json`
  - Stable, machine-readable metadata. Schema defined below.

### Optional Files

- `bibliography.csl.json` or `references.bib`
  - Citation-grade metadata for resources, emitted only when that metadata
    exists. These are convenience exports for reference managers and must follow
    the same forbidden-data rules.

- Obsidian-friendly links and folder layout are allowed and encouraged, as long
  as they do not break plain Markdown rendering.

## manifest.json Field Schema

`manifest.json` is the authoritative machine-readable record. It is the file an
auditor or tool reads first. All fields are required unless marked optional. Use
`null` for a value that is genuinely unknown, and a descriptive string for a
value that is known to be absent or not applicable.

```json
{
  "schema": "bible-ai/study-packet",
  "schema_version": "1.0",
  "packet_id": "stable-unique-id-for-this-export",
  "title": "Study title",
  "passage": "Romans 9:1-29",
  "created_at": "2026-06-13T00:00:00Z",
  "exported_at": "2026-06-13T00:00:00Z",
  "app_version": "0.1.0",
  "corpus_version": "corpus-build-or-hash",
  "ai": {
    "providers": [
      { "name": "anthropic", "display_name": "Claude", "model": "claude-..." }
    ],
    "synthesis_mode": "consensus",
    "synthesis_voice": null
  },
  "retrieval": {
    "mode": "hybrid",
    "requested_strategy": "semantic",
    "fallback": true,
    "fallback_reason": "semantic embeddings unavailable; used keyword + hybrid",
    "include_cross_refs": true,
    "evidence_count": 24,
    "evidence_limit": 40
  },
  "embedding": {
    "used": true,
    "model": "embedding-model-id",
    "dimensions": 384
  },
  "translations": [
    { "code": "WEB", "name": "World English Bible", "rights": "public_domain" }
  ],
  "sources": [
    {
      "id": "resource-id-or-slug",
      "title": "Resource title",
      "license": "CC-BY-SA-4.0",
      "decision_class": "bundled_redistributable",
      "attribution": "required attribution text",
      "share_alike": true
    }
  ],
  "content_labels": ["scripture", "source", "ai", "user"],
  "files": [
    "README.md",
    "passage.md",
    "question.md",
    "evidence.md",
    "council.md",
    "judgment.md",
    "sources.md"
  ]
}
```

Field notes:

- `schema` and `schema_version` let tools detect the format and version. Bump
  `schema_version` on any breaking change to this contract.
- `packet_id` is a stable identifier for this exported packet. It must not be a
  machine identifier or user identifier.
- `created_at` is when the study was created; `exported_at` is when this packet
  was written.
- `app_version` and `corpus_version` are required for reproducibility and audit.
- `ai.providers` lists each provider that contributed, with display name and
  model. `synthesis_mode` and `synthesis_voice` mirror the Council response so
  the reader knows whether output is a consensus, a single voice, or a failed
  synthesis.
- `retrieval.mode` is the actual retrieval mode used. `requested_strategy` is
  what the user asked for. `fallback` and `fallback_reason` are required when the
  actual mode differs from the request, including when semantic retrieval
  degraded.
- `embedding.used` records whether semantic search contributed. When `true`,
  `model` and `dimensions` are required.
- `translations` and `sources` carry rights metadata. `decision_class` ties to
  the content BOM (EP-003).
- `content_labels` enumerates the label vocabulary used in the Markdown files.

## Required Metadata Summary

Every packet must preserve enough metadata to reproduce or audit the study:

- App version.
- Corpus version.
- Provider and model for any AI content.
- Retrieval mode, including the requested strategy and the actual mode used.
- Fallback indicator and fallback reason whenever retrieval degraded.
- Embedding model and dimensions whenever semantic search contributed.
- Source rights, attribution, license notes, and source decision classes.

These appear in `manifest.json` (machine-readable) and are summarized in human
form in `README.md`, `evidence.md`, and `sources.md`.

## Content Labels

A packet must label content by authorship so a reader can never confuse
Scripture, third-party source text, AI output, and user conclusions. Four
labels are used. Each labeled block in a Markdown file should carry an explicit
heading or inline marker drawn from this vocabulary:

- Scripture: verse text from a bundled translation or original-language source.
  Always paired with translation or source metadata.
- Source: text or claims from a third-party resource (commentary, lexicon, or
  imported excerpt). Always paired with attribution and license notes.
- AI: text authored by a Council voice, synthesis, or any generated explanation.
  Always paired with provider and model attribution.
- User: text authored by the person doing the study (question, judgment, notes,
  ratings).

Rules:

- AI-authored, source-authored, and user-authored sections must be labeled
  separately. They must not be merged into one undifferentiated block.
- Quoted Scripture inside an AI or source section is still labeled as Scripture
  at the quote level.
- A reader who has never used the app must be able to tell, for any sentence,
  which of the four classes it belongs to.

## Forbidden Data

A packet must never contain:

- Provider API keys (Google, OpenAI, Anthropic).
- Managed gateway tokens.
- Local filesystem paths and build paths.
- Environment variables.
- Machine identifiers.

The export pipeline must redact or omit these before writing any file. A packet
must be safe to attach to a public issue or share with a collaborator.

### What the code already redacts

The current single-file exporter in
`app/src/features/workspaces/workspaceMarkdown.ts` already applies redaction
that Study Packet v1 inherits and must not regress:

- `sanitizeExportText` (applied to the full Markdown body) redacts:
  - Key/token/secret/password/credential assignments
    (`*_API_KEY=...`, `*TOKEN=...`, `*SECRET=...`, etc.) to `[redacted secret]`.
  - The named settings keys `google_api_key`, `openai_api_key`,
    `anthropic_api_key`, and `managed_gateway_token` to `[redacted setting]`.
  - Windows-style local paths (`C:\...`) to `[redacted local path]`.
  - Unix-style local paths under `/Users`, `/home`, `/tmp`, `/var`, `/etc` to
    `[redacted local path]`.
- `sanitizeExportValue` and `isSecretExportKey` (applied to any JSON payload
  emitted into the export) replace the value of any key containing `api_key`,
  `token`, `secret`, or `password`, or named exactly `env` or `environment`,
  with `[redacted]`.

### Gaps the contract requires closing

The current redaction is good but not complete against the forbidden-data list:

- Machine identifiers are not specifically redacted today. The packet exporter
  must ensure none are emitted.
- Environment variables are only redacted when they appear as `KEY=value`
  assignments or under an `env`/`environment` JSON key; bare environment-variable
  values embedded in other text are not guaranteed to be caught.
- Local-path redaction is pattern-based and may miss network paths
  (`\\host\share`) or unusual roots.
- A release-gate leak scan over generated sample packets is required to verify
  the forbidden-data list holds in practice (EP-018 and the release evidence
  gate).

## Acceptance Cases

Study Packet v1 must support these five cases. Each names a study type and what
the packet must preserve.

1. Hard passage packet.
   - The user studies a debated or difficult passage.
   - The packet preserves multiple positions, evidence, dissent, confidence
     rationale, unresolved tensions, and the user's judgment.

2. Word study packet.
   - The user studies a Greek or Hebrew term.
   - The packet preserves occurrences, lexicon or module metadata, Strong's
     codes where present, and stated limits of the study.

3. Resource critique packet.
   - The user imports or selects a resource excerpt and asks Council to evaluate
     its claims against Scripture.
   - The packet clearly separates source claims from AI evaluation and from
     Scripture, and carries the resource's attribution and license.

4. Small-group teaching packet.
   - The user prepares a session.
   - The packet preserves the passage, observations, discussion questions,
     source cautions, and open issues.

5. Theology update packet.
   - The user links a Council result and resources into a Theology topic and
     exports the updated learning record.
   - The packet preserves the linked result, the resources, and the updated
     conclusion as a user-authored learning record.

## Current State vs Contract

This contract describes the TARGET. The app today does not yet produce the
multi-file folder above. Being honest about the gap is part of EP-001.

What exists today:

- Export is SINGLE-FILE, not a folder. The Rust commands
  `write_workspace_markdown`, `write_workspace_html`, and `write_workspace_pdf`
  in `app/src-tauri/src/lib.rs` each write one file
  (`bible-ai-workspace-<title>-<stamp>.{md,html,pdf}`) to the export directory.
  There is also `write_workspace_markdown_to_path` for a chosen path.
- The Markdown body is produced by `renderWorkspaceMarkdown` in
  `app/src/features/workspaces/workspaceMarkdown.ts`. It walks the workspace
  items (`StudyItem` kinds: verse, verse_range, note, search_hit, search,
  council_session, council_result, explanation, module_entry, freeform) and
  renders Scripture, resource entries, Council results, judgments, and
  transparency sections into one document.
- Redaction (`sanitizeExportText`, `sanitizeExportValue`, `isSecretExportKey`)
  already runs over that single file, as described in "Forbidden Data".
- Council metadata that the contract needs is largely present in the data model
  already: `CouncilResponse` carries `retrieval_mode`, `retrieval_options`,
  `retrieved_evidence`, `synthesis_mode`, `synthesis_voice`, and a `manifest`
  of `CouncilProviderInfo`. The renderer surfaces positions, dissent,
  unresolved tensions, cited and retrieved evidence, judgment, and a
  transparency appendix.

What the contract still requires (not yet built):

- Splitting the single document into the required files (`README.md`,
  `passage.md`, `question.md`, `evidence.md`, `council.md`, `judgment.md`,
  `sources.md`) and writing a packet FOLDER instead of one file. (EP-015)
- Emitting `manifest.json` with the schema above. (EP-016)
- Explicit Scripture / source / AI / user content labels on every block.
  (EP-017)
- A forbidden-data leak scan over generated sample packets, plus closing the
  redaction gaps listed above (machine identifiers, broader env-var and path
  coverage). (EP-018)
- Optional `bibliography.csl.json` / `references.bib` emission where
  citation-grade metadata exists.

Note on metadata not yet recorded: `app_version` is currently hardcoded
(`0.1.0`) in `SettingsPanel.tsx` and can drift from `package.json`; the manifest
must source it from release metadata. `corpus_version`, embedding model, and
embedding dimensions are not currently written into any export and must be
plumbed through from the corpus and retrieval layers.

## Related Documents

- `docs/development-implementation-plan.md` (EP-001 and the Study Packet gate).
- `docs/feature-roadmap.md` (links here).
- `docs/testing-and-release-plan.md` (links here).
- `docs/content-bom.md` (source decision classes, EP-003; planned).
- `docs/data-sources.md` (corpus and license metadata).
