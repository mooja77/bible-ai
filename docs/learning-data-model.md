# Learning And Theology Data Model

## Schema Principles

- User-authored data and AI-generated data must remain distinguishable.
- Resource provenance and license metadata must be stored with imported resources.
- Link tables should allow the same passage, resource, Council result, or note to appear in multiple theology topics.
- JSON payloads are acceptable for evolving UI structures, but durable identifiers and link targets need typed columns.

## Council Human Judgment

```sql
CREATE TABLE council_judgments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  council_session_id INTEGER NOT NULL,
  before_judgment TEXT,
  after_judgment TEXT,
  personal_conclusion TEXT,
  confidence INTEGER CHECK (confidence BETWEEN 0 AND 100),
  changed_mind_note TEXT,
  open_questions TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(council_session_id)
);

CREATE TABLE council_position_judgments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  council_judgment_id INTEGER NOT NULL REFERENCES council_judgments(id) ON DELETE CASCADE,
  position_label TEXT NOT NULL,
  user_rating TEXT NOT NULL CHECK (user_rating IN (
    'persuasive',
    'weak',
    'unclear',
    'needs_study',
    'disagree'
  )),
  user_weight REAL,
  persuasive_evidence TEXT,
  weak_points TEXT,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(council_judgment_id, position_label)
);
```

## Research Trail And Argument Annotations

```sql
CREATE TABLE argument_annotations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  council_session_id INTEGER NOT NULL,
  node_id TEXT NOT NULL,
  annotation TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

Argument maps remain inside Council response JSON initially. User annotations are separate so regenerated maps do not overwrite user work.

## Theology Topics

```sql
CREATE TABLE theology_topics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  parent_id INTEGER REFERENCES theology_topics(id) ON DELETE SET NULL,
  summary TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE theology_positions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  topic_id INTEGER NOT NULL REFERENCES theology_topics(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  tradition_family TEXT,
  summary TEXT,
  strengths TEXT,
  weaknesses TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE theology_conclusions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  topic_id INTEGER NOT NULL REFERENCES theology_topics(id) ON DELETE CASCADE,
  conclusion TEXT,
  confidence INTEGER CHECK (confidence BETWEEN 0 AND 100),
  unresolved_questions TEXT,
  changed_over_time TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(topic_id)
);
```

## Theology Links

```sql
CREATE TABLE theology_links (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  topic_id INTEGER NOT NULL REFERENCES theology_topics(id) ON DELETE CASCADE,
  link_kind TEXT NOT NULL CHECK (link_kind IN (
    'verse',
    'verse_range',
    'workspace_item',
    'council_session',
    'resource_entry',
    'note',
    'argument_map'
  )),
  target_id INTEGER,
  title TEXT,
  payload_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_theology_links_topic_kind
  ON theology_links(topic_id, link_kind);
```

## Guided Study Sessions

```sql
CREATE TABLE guided_study_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  topic_id INTEGER NOT NULL REFERENCES theology_topics(id) ON DELETE CASCADE,
  template_slug TEXT NOT NULL,
  focus_question TEXT,
  before_response TEXT,
  after_response TEXT,
  critique TEXT,
  review_cards_json TEXT NOT NULL DEFAULT '[]',
  completed_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(topic_id, template_slug)
);
```

`focus_question` stores the user-visible question that begins the guided study.
Generated study prompts can populate it, but the field remains editable before
the user saves or completes the session.

## Resource Sources And Entries

```sql
CREATE TABLE resource_sources (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  source_url TEXT,
  license TEXT NOT NULL,
  attribution TEXT NOT NULL,
  version TEXT,
  imported_at TEXT NOT NULL DEFAULT (datetime('now')),
  metadata_json TEXT NOT NULL DEFAULT '{}'
);

CREATE TABLE resource_collections (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_id INTEGER NOT NULL REFERENCES resource_sources(id) ON DELETE CASCADE,
  slug TEXT NOT NULL,
  title TEXT NOT NULL,
  kind TEXT NOT NULL,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  UNIQUE(source_id, slug)
);

CREATE TABLE resource_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  collection_id INTEGER NOT NULL REFERENCES resource_collections(id) ON DELETE CASCADE,
  ref TEXT,
  title TEXT,
  body TEXT NOT NULL,
  search_text TEXT NOT NULL,
  payload_json TEXT NOT NULL DEFAULT '{}'
);

CREATE VIRTUAL TABLE resource_entries_fts
USING fts5(title, search_text, content='resource_entries', content_rowid='id');
```

## Backup And Export Additions

Add these tables to JSON export/import:

- `council_judgments`
- `council_position_judgments`
- `argument_annotations`
- `theology_topics`
- `theology_positions`
- `theology_conclusions`
- `theology_links`
- `guided_study_sessions`

Do not export imported resource entry bodies by default unless the export is explicitly a full-library export. Normal user backups export source manifests, collection metadata, user links, and workspace/theology excerpts, not duplicate large imported corpora.
