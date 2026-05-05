-- Bible AI — canonical corpus schema
-- Two databases: corpus.sqlite (ships read-only with the app) and user.sqlite (per-user runtime).
-- This file defines both; ingestion tooling picks the right section.

-- ============================================================================
-- CORPUS (read-only, built by ingestion scripts, shipped with the app)
-- ============================================================================

-- Canonical book list. ids are stable across all translations and used in
-- composite verse ids (verse_id = book_id * 1_000_000 + chapter * 1000 + verse).
CREATE TABLE IF NOT EXISTS books (
  id INTEGER PRIMARY KEY,           -- 1 = Genesis, 40 = Matthew, etc.
  osis_code TEXT UNIQUE NOT NULL,   -- 'Gen', 'Exod', 'Matt', ... (OSIS standard)
  name TEXT NOT NULL,               -- 'Genesis'
  testament TEXT NOT NULL CHECK (testament IN ('OT', 'NT', 'DC')),
  chapter_count INTEGER NOT NULL,
  canonical_order INTEGER NOT NULL UNIQUE
);

-- Canonical verse reference space, independent of any translation.
-- Every translation's text joins to this.
CREATE TABLE IF NOT EXISTS verses (
  id INTEGER PRIMARY KEY,           -- book_id*1_000_000 + chapter*1000 + verse
  book_id INTEGER NOT NULL REFERENCES books(id),
  chapter INTEGER NOT NULL,
  verse INTEGER NOT NULL,
  UNIQUE(book_id, chapter, verse)
);

CREATE INDEX IF NOT EXISTS idx_verses_book_chapter
  ON verses(book_id, chapter, verse);

-- Translations / editions we ship.
CREATE TABLE IF NOT EXISTS translations (
  code TEXT PRIMARY KEY,            -- 'KJV', 'ASV', 'WEB', 'SBLGNT', 'WLC', 'LXX'
  name TEXT NOT NULL,               -- 'King James Version'
  language TEXT NOT NULL,           -- 'en', 'grc', 'hbo'
  year INTEGER,                     -- publication year
  license TEXT NOT NULL,            -- 'Public Domain', 'CC-BY-SA-4.0', ...
  source_url TEXT,                  -- where it was ingested from
  kind TEXT NOT NULL CHECK (kind IN ('translation', 'original', 'manuscript'))
);

-- The actual text, one row per verse per translation.
CREATE TABLE IF NOT EXISTS translation_text (
  translation_code TEXT NOT NULL REFERENCES translations(code),
  verse_id INTEGER NOT NULL REFERENCES verses(id),
  text TEXT NOT NULL,
  PRIMARY KEY (translation_code, verse_id)
);

CREATE INDEX IF NOT EXISTS idx_translation_text_verse
  ON translation_text(verse_id);

-- Full-text search over all translations at once.
-- Queries can filter by translation_code in a WHERE clause.
CREATE VIRTUAL TABLE IF NOT EXISTS translation_text_fts USING fts5(
  translation_code UNINDEXED,
  verse_id UNINDEXED,
  text,
  tokenize = 'porter unicode61'
);

-- Word-level tokens for original-language and Strong's-tagged translations.
-- Populated only for translations where this data exists (SBLGNT, WLC, KJV w/ Strong's).
CREATE TABLE IF NOT EXISTS word_tokens (
  id INTEGER PRIMARY KEY,
  translation_code TEXT NOT NULL REFERENCES translations(code),
  verse_id INTEGER NOT NULL REFERENCES verses(id),
  position INTEGER NOT NULL,        -- 1-based word position in the verse
  surface TEXT NOT NULL,            -- the printed word form
  lemma TEXT,                       -- dictionary form
  strongs TEXT,                     -- 'G3056', 'H430'
  morph TEXT,                       -- morphological tag (Robinson, OSHM, etc.)
  UNIQUE (translation_code, verse_id, position)
);

CREATE INDEX IF NOT EXISTS idx_word_tokens_strongs
  ON word_tokens(strongs) WHERE strongs IS NOT NULL;

-- Cross-references (e.g. TSK — Treasury of Scripture Knowledge).
CREATE TABLE IF NOT EXISTS cross_refs (
  from_verse_id INTEGER NOT NULL REFERENCES verses(id),
  to_verse_id INTEGER NOT NULL REFERENCES verses(id),
  source TEXT NOT NULL,             -- 'TSK', 'OpenBible', ...
  weight REAL,                      -- optional relevance weight
  PRIMARY KEY (from_verse_id, to_verse_id, source)
);

CREATE INDEX IF NOT EXISTS idx_cross_refs_to
  ON cross_refs(to_verse_id);

-- Strong's dictionary entries (lemma, transliteration, gloss, definition).
CREATE TABLE IF NOT EXISTS strongs (
  code TEXT PRIMARY KEY,            -- 'G3056'
  lemma TEXT NOT NULL,              -- original-language form
  translit TEXT,                    -- 'logos'
  pron TEXT,                        -- pronunciation
  gloss TEXT,                       -- short English gloss
  definition TEXT                   -- long-form definition
);

-- Vector embeddings for semantic search. Stored as raw little-endian f32 BLOBs
-- rather than in a vec0 virtual table so we don't need the sqlite-vec extension
-- bundled. Linear cosine scan against ~31k rows is fast enough in Rust (~100ms)
-- for v0.1 — we can swap in sqlite-vec later without schema change if needed.
CREATE TABLE IF NOT EXISTS verse_embeddings (
  translation_code TEXT NOT NULL REFERENCES translations(code),
  verse_id INTEGER NOT NULL REFERENCES verses(id),
  model TEXT NOT NULL,              -- 'nomic-embed-text', 'bge-large-en-v1.5', ...
  dim INTEGER NOT NULL,             -- embedding dimension
  embedding BLOB NOT NULL,          -- dim * 4 bytes, little-endian f32
  PRIMARY KEY (translation_code, verse_id, model)
);

CREATE INDEX IF NOT EXISTS idx_verse_embeddings_model
  ON verse_embeddings(model, translation_code);

-- ============================================================================
-- USER DATA (read-write, created at first app launch, stored per-user)
-- ============================================================================

CREATE TABLE IF NOT EXISTS user_notes (
  verse_id INTEGER PRIMARY KEY,     -- no FK across attached dbs; app enforces
  body TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS user_highlights (
  verse_id INTEGER PRIMARY KEY,
  color TEXT NOT NULL,              -- '#ffd', named preset, etc.
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- A council session = one disputed-point question and everything that flowed
-- from it. Full response JSON is preserved so the user can re-inspect reasoning.
CREATE TABLE IF NOT EXISTS council_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  question TEXT NOT NULL,
  topic_tag TEXT,                   -- optional category, e.g. 'ecclesiology'
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'running', 'complete', 'failed')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  completed_at TEXT,
  retrieval_mode TEXT,
  retrieval_options_json TEXT,
  retrieved_evidence_json TEXT,
  response_json TEXT                -- full CouncilResponse JSON
);

CREATE INDEX IF NOT EXISTS idx_council_sessions_created
  ON council_sessions(created_at DESC);

-- App preferences and locally stored provider keys. Runtime migrations use
-- PRAGMA user_version in user.sqlite; this schema mirrors the current v7 shape.
CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS study_workspaces (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  description TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  archived_at TEXT
);

CREATE TABLE IF NOT EXISTS study_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  workspace_id INTEGER NOT NULL REFERENCES study_workspaces(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN (
    'verse',
    'verse_range',
    'note',
    'search_hit',
    'search',
    'council_session',
    'council_result',
    'explanation',
    'module_entry',
    'freeform'
  )),
  title TEXT,
  payload_json TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_study_items_workspace_order
  ON study_items(workspace_id, sort_order, id);

CREATE TABLE IF NOT EXISTS bookmarks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  verse_id INTEGER NOT NULL,
  end_verse_id INTEGER,
  label TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(verse_id, end_verse_id)
);

CREATE TABLE IF NOT EXISTS reading_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  book_id INTEGER NOT NULL,
  chapter INTEGER NOT NULL,
  translation_codes TEXT NOT NULL,
  visited_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_reading_history_visited
  ON reading_history(visited_at DESC);

CREATE TABLE IF NOT EXISTS saved_searches (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  query TEXT NOT NULL,
  translation_code TEXT,
  testament TEXT CHECK (testament IS NULL OR testament IN ('OT', 'NT', 'DC')),
  book_id INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_saved_searches_updated
  ON saved_searches(updated_at DESC);

CREATE TABLE IF NOT EXISTS user_range_highlights (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  start_verse_id INTEGER NOT NULL,
  end_verse_id INTEGER NOT NULL,
  color TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  CHECK (start_verse_id <= end_verse_id)
);

CREATE TABLE IF NOT EXISTS user_range_notes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  start_verse_id INTEGER NOT NULL,
  end_verse_id INTEGER NOT NULL,
  body TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  CHECK (start_verse_id <= end_verse_id)
);

CREATE TABLE IF NOT EXISTS modules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('commentary', 'lexicon', 'dictionary', 'map', 'timeline')),
  source TEXT,
  license TEXT,
  version TEXT,
  installed_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS module_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  module_id INTEGER NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
  key_type TEXT NOT NULL CHECK (key_type IN ('verse', 'verse_range', 'strongs', 'topic')),
  key_value TEXT NOT NULL,
  title TEXT,
  body TEXT NOT NULL,
  metadata_json TEXT
);

CREATE INDEX IF NOT EXISTS idx_module_entries_key
  ON module_entries(key_type, key_value);
