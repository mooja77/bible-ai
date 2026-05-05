# Data Model Roadmap

This document defines proposed user-data schema additions for the feature roadmap. Runtime migrations belong in `app/src-tauri/src/user_db.rs`; this document is the planning reference.

## Migration Policy

- Increment `USER_SCHEMA_VERSION` for every schema change.
- Use idempotent `CREATE TABLE IF NOT EXISTS` and `CREATE INDEX IF NOT EXISTS`.
- For column additions, check schema state before `ALTER TABLE`.
- Keep migrations forward-only.
- Mirror the current user schema in `data/schema.sql`.
- Store flexible feature payloads as JSON only at boundaries where the shape is expected to evolve.

## Implemented User Tables

Current runtime user data includes:

- `app_settings`
- `user_notes`
- `user_highlights`
- `council_sessions`
- `study_workspaces`
- `study_items`
- `bookmarks`
- `reading_history`
- `saved_searches`
- `user_range_notes`
- `user_range_highlights`
- `modules`
- `module_entries`

## Proposed Version Map

| Version | Feature | Schema |
|---|---|---|
| 1 | Settings, notes, highlights, Council sessions | Implemented |
| 2 | Study workspaces | Implemented |
| 3 | Bookmarks and history | Implemented |
| 4 | Saved searches | Implemented |
| 5 | Council audit | Implemented on `council_sessions` |
| 6 | Range note/highlight tables | Implemented schema, commands, and reader UI |
| 7 | Modules and backup/restore | Implemented schema, module import, JSON import/export, and SQLite backup/restore |

The exact version numbers can change during implementation, but each phase should land as one coherent migration.

## Study Workspaces

```sql
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
```

Workspace item updates:

- `update_study_item(id, title, payload?)` changes the item title and can replace `payload_json` for future richer item editors.
- Updating an item also refreshes the parent workspace `updated_at` timestamp.
- Workspace lists order by `datetime(updated_at)` so imported ISO timestamps and SQLite `datetime('now')` values sort consistently.

Payload examples:

```json
{
  "kind": "verse_range",
  "translation_code": "KJV",
  "start_verse_id": 43003016,
  "end_verse_id": 43003018,
  "citation": "John 3:16-18",
  "text": "..."
}
```

```json
{
  "kind": "search_hit",
  "query": "mercy",
  "verse_id": 1001001,
  "citation": "Genesis 1:1",
  "translation_code": "KJV",
  "book_id": 1,
  "chapter": 1,
  "verse": 1,
  "text": "...",
  "snippet": "..."
}
```

```json
{
  "kind": "council_session",
  "session_id": 12,
  "question": "What does Genesis say about creation?",
  "summary": "..."
}
```

```json
{
  "kind": "note",
  "title": "Observation",
  "body": "Workspace-scoped study note text.",
  "created_from": "workspace"
}
```

## Verse Range Notes and Highlights

The current `user_notes` and `user_highlights` are keyed by one `verse_id`. For ranges, prefer new tables instead of changing those primary keys:

```sql
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
```

This avoids breaking existing single-verse note/highlight commands.

## Bookmarks and Reading History

```sql
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
```

Retention policy:

- Keep the most recent 500 reading history rows.
- Deduplicate consecutive visits to the same book/chapter/translation set.

## Saved Searches

```sql
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
```

Saved search lists order by `datetime(updated_at)`, and title updates refresh `updated_at` so renamed searches return to the top of the sidebar shortcut list.

## Council Audit Additions

Add columns to `council_sessions`:

```sql
ALTER TABLE council_sessions ADD COLUMN retrieval_options_json TEXT;
ALTER TABLE council_sessions ADD COLUMN retrieved_evidence_json TEXT;
```

Migration note: SQLite does not support `ADD COLUMN IF NOT EXISTS` in all target versions. Check `PRAGMA table_info(council_sessions)` before altering.

Stored `retrieval_options_json`:

```json
{
  "strategy": "hybrid",
  "include_cross_refs": true,
  "translation_code": "KJV",
  "book_id": null,
  "testament": null,
  "start_verse_id": null,
  "end_verse_id": null,
  "evidence_limit": 60
}
```

## Modules

```sql
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
```

Key examples:

- `verse`: `43003016`
- `verse_range`: `43003016-43003018`
- `strongs`: `G3056`
- `topic`: `atonement`

JSONL import manifest:

```json
{
  "slug": "sample-strongs-notes",
  "title": "Sample Strong's Notes",
  "kind": "lexicon",
  "source": "Local JSONL sample",
  "license": "Internal",
  "version": "1"
}
```

JSONL entry:

```json
{"key_type":"strongs","key_value":"H7225","title":"Beginning","body":"...","metadata":{"strongs":"H7225"}}
```

The importer validates module kind and entry key type. Re-importing the same slug updates module metadata and replaces that module's entries.

## Backup Export Shape

```json
{
  "app": "Bible AI",
  "export_version": 1,
  "user_schema_version": 7,
  "exported_at": "2026-04-30T00:00:00Z",
  "tables": {
    "app_settings": [],
    "user_notes": [],
    "user_highlights": [],
    "user_range_notes": [],
    "user_range_highlights": [],
    "council_sessions": [],
    "study_workspaces": [],
    "study_items": [],
    "bookmarks": [],
    "reading_history": [],
    "saved_searches": [],
    "modules": [],
    "module_entries": []
  }
}
```

Import behavior:

- `skip_existing` imports rows with their original keys and ignores primary-key or unique conflicts.
- `replace_existing` imports rows with their original keys and replaces matching primary-key rows.
- `duplicate` omits autoincrement IDs, creates new rows, and remaps `study_items.workspace_id` and `module_entries.module_id` to the duplicated parents.

## Data Integrity Notes

- `verse_id` references cannot be enforced across separate corpus/user databases unless attached in one connection. The app should validate IDs before inserting user data.
- JSON payloads should be validated at command boundaries before insert/update.
- Destructive restore must create a timestamped backup first.
- Module imports must include license metadata.
