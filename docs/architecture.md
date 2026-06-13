# Bible AI — Architecture

> Modern e-Sword alternative with a multi-agent "council" that weights disputed theological points using the full context of scripture.

## Product shape

- **Form factor:** desktop app (Tauri), cross-platform (Windows first)
- **Offline-first:** all Bible text, search, cross-references work with no internet
- **Online-when-needed:** council calls (disputed-point analysis) reach the cloud
- **MVP (v0.1):** vertical slice — one disputed topic (e.g. "women in church leadership") end-to-end through the council over a pre-loaded set of public-domain translations

## Tech stack

| Layer | Choice | Why |
|---|---|---|
| Shell | **Tauri 2** | Small binary, Rust backend, web frontend, good offline story |
| Frontend | **React + TypeScript + Tailwind** | Standard, fast iteration |
| Local DB | **SQLite** (via `tauri-plugin-sql` / `rusqlite`) | Ships in-binary, handles Bible text + user notes |
| Vector store | **f32 BLOBs in SQLite + Rust cosine scan** | Embeddings live in the same SQLite file, scanned linearly in Rust; no extension or separate service. `sqlite-vec` is a deferred, measurement-gated option |
| Local model host | **Ollama** (external) | Simple HTTP API, easy model swap, handles embeddings + small LLMs |
| Ingestion scripts | **Python** | Heavy text processing, one-time work, output SQLite files |
| Council APIs | Claude, OpenAI, Gemini, DeepSeek/others | Routed through a single provider-abstracted client |

## Data layer

### Corpus (ingested once, shipped as SQLite)

Current bundled sources are documented in [`data-sources.md`](data-sources.md). The shipped corpus is public-domain or permissively licensed:

- **English translations:** KJV, ASV, WEB, YLT
- **Hebrew OT:** WLC
- **Greek NT:** Textus Receptus
- **Cross-references:** openbible.info cross-reference dataset
- **Lexicons/tags:** Open Scriptures Strong's dictionaries and MorphHB tags
- **Deferred:** Douay-Rheims full import, LXX, apocrypha/deuterocanon, and manuscript images until alternate versification and licensing/source QA are explicitly added.

### Schema sketch

```sql
-- Canonical reference space (independent of translation)
CREATE TABLE verses (
  id INTEGER PRIMARY KEY,          -- e.g. 1001001 = Gen 1:1
  book_id INTEGER, chapter INTEGER, verse INTEGER,
  UNIQUE(book_id, chapter, verse)
);

-- Translation text lives here, joined by verse_id
CREATE TABLE translation_text (
  translation_code TEXT,           -- 'KJV', 'ASV', 'YLT', 'WLC', 'TR', ...
  verse_id INTEGER REFERENCES verses(id),
  text TEXT,
  PRIMARY KEY(translation_code, verse_id)
);

-- Strong's numbers per word (where available)
CREATE TABLE word_tokens (
  id INTEGER PRIMARY KEY,
  translation_code TEXT,
  verse_id INTEGER,
  position INTEGER,
  surface TEXT,                    -- the printed word
  lemma TEXT,
  strongs TEXT,                    -- 'G3056', 'H430', ...
  morph TEXT
);

CREATE TABLE cross_refs (
  from_verse_id INTEGER,
  to_verse_id INTEGER,
  source TEXT                      -- 'TSK'
);

-- Semantic search: embeddings are stored as little-endian f32 BLOBs and
-- scanned with a linear cosine similarity in Rust (no sqlite-vec dependency).
-- sqlite-vec remains a deferred, measurement-gated future optimization.
CREATE TABLE verse_embeddings (
  translation_code TEXT NOT NULL,
  verse_id INTEGER NOT NULL,
  model TEXT NOT NULL,               -- 'nomic-embed-text', 'bge-large-en-v1.5'
  dim INTEGER NOT NULL,              -- embedding dimension
  embedding BLOB NOT NULL,           -- dim * 4 bytes, little-endian f32
  PRIMARY KEY (translation_code, verse_id, model)
);

-- User layer (separate file so the corpus can ship read-only)
CREATE TABLE notes (...);
CREATE TABLE highlights (...);
CREATE TABLE council_sessions (...);
```

## Model routing

Every task gets classified by difficulty. Default to the cheapest tier that can handle it.

| Task | Tier | Model |
|---|---|---|
| Text embedding | Local | `nomic-embed-text` or `bge-large-en-v1.5` (Ollama) |
| Verse reference extraction from prose | Local | Llama 3.1 8B / Qwen 2.5 7B |
| Query routing & intent classification | Local | Same small model |
| Retrieval re-ranking | Local | Same small model |
| Cross-reference suggestion | Local | Small model + retrieval |
| Passage summary | Local | Small model |
| **Council debate** | **Frontier** | Claude Opus + GPT + Gemini + others |
| **Council synthesis** | **Frontier** | Claude Opus (orchestrator) |
| **Original-language exegesis** | **Frontier** | Claude Opus (needs strong reasoning over Greek/Hebrew) |

## The Council

A protocol, not a single prompt. Runs when the user asks a disputed-point question.

### Flow

1. **Intake** — local model classifies: is this a disputed point or a normal Q? Routes accordingly.
2. **Scoping** — local model enumerates candidate positions (e.g. for "women in leadership": complementarian, egalitarian, soft complementarian, cultural-context, etc.).
3. **Evidence gathering** — retrieval pulls all passages plausibly relevant, across all translations + cross-refs + relevant lexicon entries. Local model filters.
4. **Independent analysis (parallel)** — each council member (Claude, GPT, Gemini, +1–2 others) receives the same brief and independently:
   - lists positions it finds defensible
   - cites evidence per position
   - weights each position (must sum to 100%)
   - flags uncertainty and what would change its mind
5. **Debate round** — each member sees the others' weighted answers and may revise. One or two rounds max.
6. **Synthesis** — Claude Opus orchestrator produces the final output:
   - final weighted distribution
   - majority and minority positions (dissent is preserved, not averaged away)
   - strongest evidence per position, with verse citations
   - list of unresolved tensions
7. **Audit trail** — full transcript of every member's reasoning stored in `council_sessions` for the user to inspect.

### Design principles

- **No single-model consensus illusions** — we show dissent explicitly.
- **Weights are defended, not declared** — every percentage must cite evidence.
- **Minority positions are first-class** — a 6% position is still shown with its best evidence.
- **Citations are verifiable** — every claim links back to `verse_id`, so the user can click through.
- **Cost budget per session** — a council run has a hard cap (e.g. $0.50). Local-first triage keeps most queries out of the council entirely.

## Repo layout

```
BibleAI/
  docs/
    architecture.md           # this file
    council-protocol.md       # detailed Council prompts, flow, JSON schemas, and audit contract
    data-sources.md           # corpus, module, source-cache, and license metadata
  app/                        # Tauri app (React + TS + Tailwind, Rust shell)
    src-tauri/                # Rust: app shell, SQLite access, API proxy
    src/                      # React frontend
      components/
      features/
        reader/
        search/
        council/
  data/
    schema.sql                # canonical SQLite schema
    corpus.sqlite             # (built) shipped read-only Bible corpus
    user.sqlite               # (runtime) user notes, highlights, sessions
  scripts/                    # Python ingestion scripts
    ingest_kjv.py
    ingest_sblgnt.py
    build_cross_refs.py
    embed_corpus.py
  prompts/
    council/
      debater.md
      orchestrator.md
      scoping.md
  .env.example                # API keys (never committed)
```

## Build order (concrete)

1. **Scaffold** — Tauri + React + Tailwind project; initial SQLite file. ✅
2. **Ingest KJV** — Python script that parses a public KJV source into the `verses` + `translation_text` schema. ✅
3. **Reader UI** — book/chapter navigation, single-translation view, parallel view with multi-select translations. ✅
4. **Add more translations** — ASV + WEB + YLT ingested alongside KJV (scripts in `scripts/ingest_*.py` sharing `scripts/_lib.py`). ✅
5. **Search** — FTS5 with porter stemming, `snippet()` highlights, `/` keybinding, click-to-navigate. ✅
6. **Local model wiring** — Ollama integration for embeddings (`nomic-embed-text`), semantic retrieval implemented as linear cosine over f32 BLOBs (no sqlite-vec dep). ✅
7. **Council vertical slice** — Node sidecar (`app/sidecar/`) with provider abstraction: Claude (via Code subscription OAuth), OpenAI + Gemini (fetch-based, API key). Graceful degradation: providers with keys present run; others skip. Claude synthesises across voices. UI shows synthesis + per-voice audit trail. ✅
8. **Session persistence** — user.sqlite in the OS app-data dir stores every council run (question + full response + retrieval_mode). History list in the Council panel; click to restore without re-running. ✅
9. **Original-language** — WLC (Hebrew OT) + TR (Greek NT) are available in the reader; RTL and original-language font handling are implemented. ✅
10. **Strong's word-level tagging** — lexicon lookup, occurrence navigation, and tap-a-word UI are implemented for tagged texts. ✅
11. **Study workflow roadmap** — workspaces, ranges, export, bookmarks/history, layouts, saved searches, Council audit, explanations, modules, backup/restore, E2E, and release gates are implemented. ✅
12. **Manuscripts + extended corpora** — images, LXX, apocrypha. *(future)*

## Planning docs

The next development roadmap is split across focused documents:

- [`feature-roadmap.md`](feature-roadmap.md) - product roadmap and phase order.
- [`technical-implementation-plan.md`](technical-implementation-plan.md) - backend, frontend, command, and sidecar implementation plan.
- [`data-model-roadmap.md`](data-model-roadmap.md) - proposed user DB migrations and payload shapes.
- [`ui-workflows.md`](ui-workflows.md) - user-facing workflows and component-level UX notes.
- [`testing-and-release-plan.md`](testing-and-release-plan.md) - E2E, release, installer, and manual QA expectations.
- [`implementation-checklist.md`](implementation-checklist.md) - phase-by-phase execution checklist.
- [`council-protocol.md`](council-protocol.md) - implemented Council provider, synthesis, schema, normalization, persistence, and transparency contract.
- [`data-sources.md`](data-sources.md) - bundled corpus sources, module metadata, source cache, licensing notes, and distribution checklist.

## Open questions

- **Exact council membership** — which specific non-Claude frontier APIs do you already have keys for? That determines who's in the v0.1 council.
- **License on modern translations** — defer indefinitely or pursue later? KJV/ASV/YLT plus original-language texts are enough for the current offline-first workflow.
- **Monetization / distribution** — personal use, public release, or freemium? Affects whether we care about API key management (user-supplied vs. server-proxied).
