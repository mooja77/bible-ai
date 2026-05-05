//! Per-user SQLite database (`user.sqlite`) kept in the OS-standard app data
//! directory. Separate from the read-only corpus so the corpus can ship
//! bundled and never needs writes at runtime.

use rusqlite::{
    params,
    types::{Value, ValueRef},
    Connection, OptionalExtension, Result as SqlResult,
};
use serde::{Deserialize, Serialize};
use std::path::Path;

const USER_SCHEMA_VERSION: i64 = 7;
const EXPORT_VERSION: i64 = 1;
const USER_TABLES: &[&str] = &[
    "app_settings",
    "user_notes",
    "user_highlights",
    "user_range_notes",
    "user_range_highlights",
    "council_sessions",
    "study_workspaces",
    "study_items",
    "bookmarks",
    "reading_history",
    "saved_searches",
    "modules",
    "module_entries",
];

/// Schema applied on open (idempotent). Kept in sync with the user section of
/// data/schema.sql but embedded here so the desktop app doesn't need the
/// schema file at runtime.
const USER_SCHEMA: &str = r#"
CREATE TABLE IF NOT EXISTS council_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  question TEXT NOT NULL,
  topic_tag TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'running', 'complete', 'failed')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  completed_at TEXT,
  retrieval_mode TEXT,
  retrieval_options_json TEXT,
  retrieved_evidence_json TEXT,
  response_json TEXT
);

CREATE INDEX IF NOT EXISTS idx_council_sessions_created
  ON council_sessions(created_at DESC);

CREATE TABLE IF NOT EXISTS user_highlights (
  verse_id INTEGER PRIMARY KEY,
  color TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS user_notes (
  verse_id INTEGER PRIMARY KEY,
  body TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

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
"#;

pub fn open(path: &Path) -> SqlResult<Connection> {
    let conn = Connection::open(path)?;
    conn.execute_batch(USER_SCHEMA)?;
    add_column_if_missing(&conn, "council_sessions", "retrieval_options_json", "TEXT")?;
    add_column_if_missing(&conn, "council_sessions", "retrieved_evidence_json", "TEXT")?;
    let version: i64 = conn.pragma_query_value(None, "user_version", |r| r.get(0))?;
    if version < USER_SCHEMA_VERSION {
        conn.pragma_update(None, "user_version", USER_SCHEMA_VERSION)?;
    }
    Ok(conn)
}

fn add_column_if_missing(
    conn: &Connection,
    table: &str,
    column: &str,
    column_type: &str,
) -> SqlResult<()> {
    let mut stmt = conn.prepare(&format!("PRAGMA table_info({table})"))?;
    let mut rows = stmt.query([])?;
    while let Some(row) = rows.next()? {
        let name: String = row.get(1)?;
        if name == column {
            return Ok(());
        }
    }
    conn.execute_batch(&format!(
        "ALTER TABLE {table} ADD COLUMN {column} {column_type}"
    ))?;
    Ok(())
}

#[derive(Serialize, Deserialize, Clone, Default)]
pub struct AppSettings {
    pub google_api_key: Option<String>,
    pub openai_api_key: Option<String>,
    pub anthropic_api_key: Option<String>,
    pub claude_model: Option<String>,
    pub openai_model: Option<String>,
    pub gemini_model: Option<String>,
    pub anthropic_model: Option<String>,
    pub ollama_host: Option<String>,
    pub retrieval_translation: Option<String>,
    pub active_translations: Option<String>,
    pub font_scale: Option<f64>,
    pub reader_layout: Option<String>,
    pub reader_density: Option<String>,
    pub sync_scroll: Option<bool>,
}

fn get_setting(conn: &Connection, key: &str) -> SqlResult<Option<String>> {
    let mut stmt = conn.prepare("SELECT value FROM app_settings WHERE key = ?")?;
    let mut rows = stmt.query_map(params![key], |r| r.get::<_, String>(0))?;
    match rows.next() {
        Some(row) => Ok(Some(row?)),
        None => Ok(None),
    }
}

fn upsert_setting(conn: &Connection, key: &str, value: Option<&str>) -> SqlResult<()> {
    match value {
        Some(v) if !v.trim().is_empty() => {
            conn.execute(
                "INSERT INTO app_settings (key, value) VALUES (?, ?)
                 ON CONFLICT(key) DO UPDATE SET
                   value = excluded.value,
                   updated_at = datetime('now')",
                params![key, v.trim()],
            )?;
        }
        _ => {
            conn.execute("DELETE FROM app_settings WHERE key = ?", params![key])?;
        }
    }
    Ok(())
}

pub fn get_app_settings(conn: &Connection) -> SqlResult<AppSettings> {
    let font_scale = get_setting(conn, "font_scale")?.and_then(|v| v.parse::<f64>().ok());
    let sync_scroll = get_setting(conn, "sync_scroll")?.map(|v| v == "true");
    Ok(AppSettings {
        google_api_key: get_setting(conn, "google_api_key")?,
        openai_api_key: get_setting(conn, "openai_api_key")?,
        anthropic_api_key: get_setting(conn, "anthropic_api_key")?,
        claude_model: get_setting(conn, "claude_model")?,
        openai_model: get_setting(conn, "openai_model")?,
        gemini_model: get_setting(conn, "gemini_model")?,
        anthropic_model: get_setting(conn, "anthropic_model")?,
        ollama_host: get_setting(conn, "ollama_host")?,
        retrieval_translation: get_setting(conn, "retrieval_translation")?,
        active_translations: get_setting(conn, "active_translations")?,
        font_scale,
        reader_layout: get_setting(conn, "reader_layout")?,
        reader_density: get_setting(conn, "reader_density")?,
        sync_scroll,
    })
}

pub fn save_app_settings(conn: &Connection, settings: &AppSettings) -> SqlResult<()> {
    delete_secret_settings(conn)?;
    upsert_setting(conn, "claude_model", settings.claude_model.as_deref())?;
    upsert_setting(conn, "openai_model", settings.openai_model.as_deref())?;
    upsert_setting(conn, "gemini_model", settings.gemini_model.as_deref())?;
    upsert_setting(conn, "anthropic_model", settings.anthropic_model.as_deref())?;
    upsert_setting(conn, "ollama_host", settings.ollama_host.as_deref())?;
    upsert_setting(
        conn,
        "retrieval_translation",
        settings.retrieval_translation.as_deref(),
    )?;
    upsert_setting(
        conn,
        "active_translations",
        settings.active_translations.as_deref(),
    )?;
    let font_scale = settings.font_scale.map(|v| v.clamp(0.8, 1.4).to_string());
    upsert_setting(conn, "font_scale", font_scale.as_deref())?;
    upsert_setting(conn, "reader_layout", settings.reader_layout.as_deref())?;
    upsert_setting(conn, "reader_density", settings.reader_density.as_deref())?;
    let sync_scroll = settings.sync_scroll.map(|v| v.to_string());
    upsert_setting(conn, "sync_scroll", sync_scroll.as_deref())?;
    Ok(())
}

pub fn delete_secret_settings(conn: &Connection) -> SqlResult<()> {
    for key in ["google_api_key", "openai_api_key", "anthropic_api_key"] {
        conn.execute("DELETE FROM app_settings WHERE key = ?", params![key])?;
    }
    Ok(())
}

// ---------- Study workspaces ----------

#[derive(Serialize, Clone)]
pub struct StudyWorkspaceSummary {
    pub id: i64,
    pub title: String,
    pub description: Option<String>,
    pub created_at: String,
    pub updated_at: String,
    pub archived_at: Option<String>,
    pub item_count: i64,
}

#[derive(Serialize, Clone)]
pub struct StudyWorkspace {
    pub id: i64,
    pub title: String,
    pub description: Option<String>,
    pub created_at: String,
    pub updated_at: String,
    pub archived_at: Option<String>,
    pub items: Vec<StudyItem>,
}

#[derive(Serialize, Clone)]
pub struct StudyItem {
    pub id: i64,
    pub workspace_id: i64,
    pub kind: String,
    pub title: Option<String>,
    pub payload: serde_json::Value,
    pub sort_order: i64,
    pub created_at: String,
    pub updated_at: String,
}

pub fn list_study_workspaces(
    conn: &Connection,
    include_archived: bool,
) -> SqlResult<Vec<StudyWorkspaceSummary>> {
    let sql = if include_archived {
        "SELECT w.id, w.title, w.description, w.created_at, w.updated_at, w.archived_at,
                COUNT(i.id) AS item_count
         FROM study_workspaces w
         LEFT JOIN study_items i ON i.workspace_id = w.id
         GROUP BY w.id
         ORDER BY datetime(w.updated_at) DESC, w.id DESC"
    } else {
        "SELECT w.id, w.title, w.description, w.created_at, w.updated_at, w.archived_at,
                COUNT(i.id) AS item_count
         FROM study_workspaces w
         LEFT JOIN study_items i ON i.workspace_id = w.id
         WHERE w.archived_at IS NULL
         GROUP BY w.id
         ORDER BY datetime(w.updated_at) DESC, w.id DESC"
    };
    let mut stmt = conn.prepare(sql)?;
    let rows = stmt.query_map([], |r| {
        Ok(StudyWorkspaceSummary {
            id: r.get(0)?,
            title: r.get(1)?,
            description: r.get(2)?,
            created_at: r.get(3)?,
            updated_at: r.get(4)?,
            archived_at: r.get(5)?,
            item_count: r.get(6)?,
        })
    })?;
    rows.collect()
}

pub fn create_study_workspace(
    conn: &Connection,
    title: &str,
    description: Option<&str>,
) -> SqlResult<i64> {
    conn.execute(
        "INSERT INTO study_workspaces (title, description) VALUES (?, ?)",
        params![title.trim(), description.map(str::trim)],
    )?;
    Ok(conn.last_insert_rowid())
}

pub fn update_study_workspace(
    conn: &Connection,
    id: i64,
    title: &str,
    description: Option<&str>,
    archived: bool,
) -> SqlResult<usize> {
    conn.execute(
        "UPDATE study_workspaces
         SET title = ?, description = ?, archived_at = CASE WHEN ? THEN COALESCE(archived_at, datetime('now')) ELSE NULL END,
             updated_at = datetime('now')
         WHERE id = ?",
        params![title.trim(), description.map(str::trim), archived, id],
    )
}

pub fn delete_study_workspace(conn: &Connection, id: i64) -> SqlResult<usize> {
    conn.execute(
        "DELETE FROM study_items WHERE workspace_id = ?",
        params![id],
    )?;
    conn.execute("DELETE FROM study_workspaces WHERE id = ?", params![id])
}

pub fn get_study_workspace(conn: &Connection, id: i64) -> SqlResult<Option<StudyWorkspace>> {
    let mut stmt = conn.prepare(
        "SELECT id, title, description, created_at, updated_at, archived_at
         FROM study_workspaces
         WHERE id = ?",
    )?;
    let mut rows = stmt.query_map(params![id], |r| {
        Ok((
            r.get::<_, i64>(0)?,
            r.get::<_, String>(1)?,
            r.get::<_, Option<String>>(2)?,
            r.get::<_, String>(3)?,
            r.get::<_, String>(4)?,
            r.get::<_, Option<String>>(5)?,
        ))
    })?;
    let Some(row) = rows.next() else {
        return Ok(None);
    };
    let (id, title, description, created_at, updated_at, archived_at) = row?;
    Ok(Some(StudyWorkspace {
        id,
        title,
        description,
        created_at,
        updated_at,
        archived_at,
        items: list_study_items(conn, id)?,
    }))
}

fn list_study_items(conn: &Connection, workspace_id: i64) -> SqlResult<Vec<StudyItem>> {
    let mut stmt = conn.prepare(
        "SELECT id, workspace_id, kind, title, payload_json, sort_order, created_at, updated_at
         FROM study_items
         WHERE workspace_id = ?
         ORDER BY sort_order, id",
    )?;
    let rows = stmt.query_map(params![workspace_id], |r| {
        let payload_json: String = r.get(4)?;
        let payload = serde_json::from_str(&payload_json).map_err(|e| {
            rusqlite::Error::FromSqlConversionFailure(4, rusqlite::types::Type::Text, Box::new(e))
        })?;
        Ok(StudyItem {
            id: r.get(0)?,
            workspace_id: r.get(1)?,
            kind: r.get(2)?,
            title: r.get(3)?,
            payload,
            sort_order: r.get(5)?,
            created_at: r.get(6)?,
            updated_at: r.get(7)?,
        })
    })?;
    rows.collect()
}

pub fn add_study_item(
    conn: &Connection,
    workspace_id: i64,
    kind: &str,
    title: Option<&str>,
    payload_json: &str,
) -> SqlResult<i64> {
    let next_order: i64 = conn.query_row(
        "SELECT COALESCE(MAX(sort_order), -1) + 1 FROM study_items WHERE workspace_id = ?",
        params![workspace_id],
        |r| r.get(0),
    )?;
    conn.execute(
        "INSERT INTO study_items (workspace_id, kind, title, payload_json, sort_order)
         VALUES (?, ?, ?, ?, ?)",
        params![
            workspace_id,
            kind,
            title.map(str::trim),
            payload_json,
            next_order
        ],
    )?;
    conn.execute(
        "UPDATE study_workspaces SET updated_at = datetime('now') WHERE id = ?",
        params![workspace_id],
    )?;
    Ok(conn.last_insert_rowid())
}

pub fn update_study_item(
    conn: &Connection,
    id: i64,
    title: Option<&str>,
    payload_json: Option<&str>,
) -> SqlResult<usize> {
    let workspace_id: i64 = conn.query_row(
        "SELECT workspace_id FROM study_items WHERE id = ?",
        params![id],
        |r| r.get(0),
    )?;
    let changed = conn.execute(
        "UPDATE study_items
         SET title = ?, payload_json = COALESCE(?, payload_json), updated_at = datetime('now')
         WHERE id = ?",
        params![title.map(str::trim), payload_json, id],
    )?;
    if changed > 0 {
        conn.execute(
            "UPDATE study_workspaces SET updated_at = datetime('now') WHERE id = ?",
            params![workspace_id],
        )?;
    }
    Ok(changed)
}

pub fn delete_study_item(conn: &Connection, id: i64) -> SqlResult<usize> {
    conn.execute("DELETE FROM study_items WHERE id = ?", params![id])
}

pub fn reorder_study_items(
    conn: &Connection,
    workspace_id: i64,
    item_ids: &[i64],
) -> SqlResult<()> {
    let existing_count: i64 = conn.query_row(
        "SELECT COUNT(*) FROM study_items WHERE workspace_id = ?",
        params![workspace_id],
        |r| r.get(0),
    )?;
    if existing_count != item_ids.len() as i64 {
        return Err(rusqlite::Error::InvalidQuery);
    }
    for (sort_order, item_id) in item_ids.iter().enumerate() {
        let changed = conn.execute(
            "UPDATE study_items
             SET sort_order = ?, updated_at = datetime('now')
             WHERE id = ? AND workspace_id = ?",
            params![sort_order as i64, item_id, workspace_id],
        )?;
        if changed != 1 {
            return Err(rusqlite::Error::InvalidQuery);
        }
    }
    conn.execute(
        "UPDATE study_workspaces SET updated_at = datetime('now') WHERE id = ?",
        params![workspace_id],
    )?;
    Ok(())
}

// ---------- Bookmarks and reading history ----------

#[derive(Serialize, Clone)]
pub struct Bookmark {
    pub id: i64,
    pub verse_id: i64,
    pub end_verse_id: Option<i64>,
    pub label: Option<String>,
    pub created_at: String,
}

#[derive(Serialize, Clone)]
pub struct ReadingHistoryItem {
    pub id: i64,
    pub book_id: i64,
    pub chapter: i64,
    pub translation_codes: String,
    pub visited_at: String,
}

pub fn list_bookmarks(conn: &Connection) -> SqlResult<Vec<Bookmark>> {
    let mut stmt = conn.prepare(
        "SELECT id, verse_id, end_verse_id, label, created_at
         FROM bookmarks
         ORDER BY datetime(created_at) DESC, id DESC",
    )?;
    let rows = stmt.query_map([], |r| {
        Ok(Bookmark {
            id: r.get(0)?,
            verse_id: r.get(1)?,
            end_verse_id: r.get(2)?,
            label: r.get(3)?,
            created_at: r.get(4)?,
        })
    })?;
    rows.collect()
}

pub fn add_bookmark(
    conn: &Connection,
    verse_id: i64,
    end_verse_id: Option<i64>,
    label: Option<&str>,
) -> SqlResult<i64> {
    conn.execute(
        "INSERT INTO bookmarks (verse_id, end_verse_id, label)
         VALUES (?, ?, ?)
         ON CONFLICT(verse_id, end_verse_id) DO UPDATE SET
           label = excluded.label,
           created_at = datetime('now')",
        params![verse_id, end_verse_id, label.map(str::trim)],
    )?;
    Ok(conn.last_insert_rowid())
}

pub fn delete_bookmark(conn: &Connection, id: i64) -> SqlResult<usize> {
    conn.execute("DELETE FROM bookmarks WHERE id = ?", params![id])
}

pub fn record_reading_location(
    conn: &Connection,
    book_id: i64,
    chapter: i64,
    translation_codes: &str,
) -> SqlResult<()> {
    let last: Option<(i64, i64, String)> = conn
        .query_row(
            "SELECT book_id, chapter, translation_codes
             FROM reading_history
             ORDER BY visited_at DESC, id DESC
             LIMIT 1",
            [],
            |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?)),
        )
        .optional()?;
    if last
        .as_ref()
        .is_some_and(|(b, c, t)| *b == book_id && *c == chapter && t == translation_codes)
    {
        return Ok(());
    }
    conn.execute(
        "INSERT INTO reading_history (book_id, chapter, translation_codes)
         VALUES (?, ?, ?)",
        params![book_id, chapter, translation_codes],
    )?;
    conn.execute(
        "DELETE FROM reading_history
         WHERE id NOT IN (SELECT id FROM reading_history ORDER BY visited_at DESC, id DESC LIMIT 500)",
        [],
    )?;
    Ok(())
}

pub fn list_reading_history(conn: &Connection, limit: i64) -> SqlResult<Vec<ReadingHistoryItem>> {
    let mut stmt = conn.prepare(
        "SELECT id, book_id, chapter, translation_codes, visited_at
         FROM reading_history
         ORDER BY visited_at DESC, id DESC
         LIMIT ?",
    )?;
    let rows = stmt.query_map(params![limit], |r| {
        Ok(ReadingHistoryItem {
            id: r.get(0)?,
            book_id: r.get(1)?,
            chapter: r.get(2)?,
            translation_codes: r.get(3)?,
            visited_at: r.get(4)?,
        })
    })?;
    rows.collect()
}

// ---------- Saved searches ----------

#[derive(Serialize, Clone)]
pub struct SavedSearch {
    pub id: i64,
    pub title: String,
    pub query: String,
    pub translation_code: Option<String>,
    pub testament: Option<String>,
    pub book_id: Option<i64>,
    pub created_at: String,
    pub updated_at: String,
}

pub fn list_saved_searches(conn: &Connection) -> SqlResult<Vec<SavedSearch>> {
    let mut stmt = conn.prepare(
        "SELECT id, title, query, translation_code, testament, book_id, created_at, updated_at
         FROM saved_searches
         ORDER BY datetime(updated_at) DESC, id DESC",
    )?;
    let rows = stmt.query_map([], |r| {
        Ok(SavedSearch {
            id: r.get(0)?,
            title: r.get(1)?,
            query: r.get(2)?,
            translation_code: r.get(3)?,
            testament: r.get(4)?,
            book_id: r.get(5)?,
            created_at: r.get(6)?,
            updated_at: r.get(7)?,
        })
    })?;
    rows.collect()
}

pub fn create_saved_search(
    conn: &Connection,
    title: &str,
    query: &str,
    translation_code: Option<&str>,
    testament: Option<&str>,
    book_id: Option<i64>,
) -> SqlResult<i64> {
    conn.execute(
        "INSERT INTO saved_searches (title, query, translation_code, testament, book_id)
         VALUES (?, ?, ?, ?, ?)",
        params![
            title.trim(),
            query.trim(),
            translation_code,
            testament,
            book_id
        ],
    )?;
    Ok(conn.last_insert_rowid())
}

pub fn update_saved_search_title(conn: &Connection, id: i64, title: &str) -> SqlResult<usize> {
    conn.execute(
        "UPDATE saved_searches
         SET title = ?, updated_at = datetime('now')
         WHERE id = ?",
        params![title.trim(), id],
    )
}

pub fn delete_saved_search(conn: &Connection, id: i64) -> SqlResult<usize> {
    conn.execute("DELETE FROM saved_searches WHERE id = ?", params![id])
}

// ---------- Modules ----------

#[derive(Serialize, Clone)]
pub struct ModuleSummary {
    pub id: i64,
    pub slug: String,
    pub title: String,
    pub kind: String,
    pub source: Option<String>,
    pub license: Option<String>,
    pub version: Option<String>,
    pub installed_at: String,
}

#[derive(Serialize, Clone)]
pub struct ModuleEntry {
    pub id: i64,
    pub module_id: i64,
    pub module_title: String,
    pub key_type: String,
    pub key_value: String,
    pub title: Option<String>,
    pub body: String,
    pub metadata: Option<serde_json::Value>,
}

#[derive(Serialize, Clone)]
pub struct ModuleTopic {
    pub key_value: String,
    pub title: Option<String>,
    pub entry_count: i64,
}

#[derive(Serialize, Clone)]
pub struct ModuleImportReport {
    pub module_id: i64,
    pub entry_count: usize,
}

pub fn list_modules(conn: &Connection) -> SqlResult<Vec<ModuleSummary>> {
    let mut stmt = conn.prepare(
        "SELECT id, slug, title, kind, source, license, version, installed_at
         FROM modules
         ORDER BY title",
    )?;
    let rows = stmt.query_map([], |r| {
        Ok(ModuleSummary {
            id: r.get(0)?,
            slug: r.get(1)?,
            title: r.get(2)?,
            kind: r.get(3)?,
            source: r.get(4)?,
            license: r.get(5)?,
            version: r.get(6)?,
            installed_at: r.get(7)?,
        })
    })?;
    rows.collect()
}

pub fn create_module(
    conn: &Connection,
    slug: &str,
    title: &str,
    kind: &str,
    source: Option<&str>,
    license: Option<&str>,
    version: Option<&str>,
) -> SqlResult<i64> {
    conn.execute(
        "INSERT INTO modules (slug, title, kind, source, license, version)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(slug) DO UPDATE SET
           title = excluded.title,
           kind = excluded.kind,
           source = excluded.source,
           license = excluded.license,
           version = excluded.version",
        params![slug.trim(), title.trim(), kind, source, license, version],
    )?;
    conn.query_row(
        "SELECT id FROM modules WHERE slug = ?",
        params![slug.trim()],
        |r| r.get(0),
    )
}

pub fn delete_module(conn: &Connection, id: i64) -> SqlResult<usize> {
    conn.execute(
        "DELETE FROM module_entries WHERE module_id = ?",
        params![id],
    )?;
    conn.execute("DELETE FROM modules WHERE id = ?", params![id])
}

pub fn add_module_entry(
    conn: &Connection,
    module_id: i64,
    key_type: &str,
    key_value: &str,
    title: Option<&str>,
    body: &str,
    metadata_json: Option<&str>,
) -> SqlResult<i64> {
    conn.execute(
        "INSERT INTO module_entries (module_id, key_type, key_value, title, body, metadata_json)
         VALUES (?, ?, ?, ?, ?, ?)",
        params![
            module_id,
            key_type,
            key_value,
            title.map(str::trim),
            body,
            metadata_json
        ],
    )?;
    Ok(conn.last_insert_rowid())
}

fn list_module_entries_for_key(
    conn: &Connection,
    key_type: &str,
    key_value: &str,
) -> SqlResult<Vec<ModuleEntry>> {
    let mut stmt = conn.prepare(
        "SELECT e.id, e.module_id, m.title, e.key_type, e.key_value, e.title, e.body, e.metadata_json
         FROM module_entries e
         JOIN modules m ON m.id = e.module_id
         WHERE e.key_type = ? AND e.key_value = ?
         ORDER BY m.title, e.id",
    )?;
    let rows = stmt.query_map(params![key_type, key_value], |r| {
        let metadata_json: Option<String> = r.get(7)?;
        let metadata = metadata_json.and_then(|s| serde_json::from_str(&s).ok());
        Ok(ModuleEntry {
            id: r.get(0)?,
            module_id: r.get(1)?,
            module_title: r.get(2)?,
            key_type: r.get(3)?,
            key_value: r.get(4)?,
            title: r.get(5)?,
            body: r.get(6)?,
            metadata,
        })
    })?;
    rows.collect()
}

pub fn list_module_entries_for_verse(
    conn: &Connection,
    verse_id: i64,
) -> SqlResult<Vec<ModuleEntry>> {
    list_module_entries_for_key(conn, "verse", &verse_id.to_string())
}

pub fn list_module_entries_for_range(
    conn: &Connection,
    start_verse_id: i64,
    end_verse_id: i64,
) -> SqlResult<Vec<ModuleEntry>> {
    let start = start_verse_id.min(end_verse_id);
    let end = start_verse_id.max(end_verse_id);
    list_module_entries_for_key(conn, "verse_range", &format!("{start}-{end}"))
}

pub fn list_module_entries_for_strongs(
    conn: &Connection,
    codes: &[String],
) -> SqlResult<Vec<ModuleEntry>> {
    let mut entries = Vec::new();
    for code in codes {
        for normalized in strongs_key_variants(code) {
            entries.extend(list_module_entries_for_key(conn, "strongs", &normalized)?);
        }
    }
    entries.sort_by_key(|e| (e.module_title.clone(), e.id));
    entries.dedup_by_key(|e| e.id);
    Ok(entries)
}

pub fn list_module_topics(conn: &Connection) -> SqlResult<Vec<ModuleTopic>> {
    let mut stmt = conn.prepare(
        "SELECT key_value, MAX(title), COUNT(*)
         FROM module_entries
         WHERE key_type = 'topic'
         GROUP BY key_value
         ORDER BY key_value",
    )?;
    let rows = stmt.query_map([], |r| {
        Ok(ModuleTopic {
            key_value: r.get(0)?,
            title: r.get(1)?,
            entry_count: r.get(2)?,
        })
    })?;
    rows.collect()
}

pub fn list_module_entries_for_topic(
    conn: &Connection,
    topic: &str,
) -> SqlResult<Vec<ModuleEntry>> {
    list_module_entries_for_key(conn, "topic", topic.trim())
}

fn strongs_key_variants(code: &str) -> Vec<String> {
    let trimmed = code.trim();
    if trimmed.is_empty() {
        return Vec::new();
    }
    let upper = trimmed.to_ascii_uppercase();
    let mut variants = vec![upper.clone()];
    if let Some(rest) = upper.strip_prefix("HB") {
        variants.push(format!("H{rest}"));
    }
    if let Some(rest) = upper.strip_prefix("HG") {
        variants.push(format!("G{rest}"));
    }
    variants.sort();
    variants.dedup();
    variants
}

#[derive(Serialize, Clone)]
pub struct SessionSummary {
    pub id: i64,
    pub question: String,
    pub created_at: String,
    pub retrieval_mode: Option<String>,
}

#[derive(Serialize, Clone)]
pub struct StoredSession {
    pub id: i64,
    pub question: String,
    pub created_at: String,
    pub retrieval_mode: Option<String>,
    /// The entire CouncilResponse as originally returned to the UI.
    pub response: serde_json::Value,
}

pub fn insert_session(
    conn: &Connection,
    question: &str,
    retrieval_mode: &str,
    retrieval_options_json: Option<&str>,
    retrieved_evidence_json: Option<&str>,
    response_json: &str,
) -> SqlResult<i64> {
    conn.execute(
        "INSERT INTO council_sessions
           (question, status, retrieval_mode, retrieval_options_json, retrieved_evidence_json, response_json, completed_at)
         VALUES (?, 'complete', ?, ?, ?, ?, datetime('now'))",
        params![
            question,
            retrieval_mode,
            retrieval_options_json,
            retrieved_evidence_json,
            response_json
        ],
    )?;
    Ok(conn.last_insert_rowid())
}

pub fn list_sessions(conn: &Connection, limit: i64) -> SqlResult<Vec<SessionSummary>> {
    let mut stmt = conn.prepare(
        "SELECT id, question, created_at, retrieval_mode
         FROM council_sessions
         WHERE status = 'complete'
         ORDER BY created_at DESC
         LIMIT ?",
    )?;
    let rows = stmt.query_map(params![limit], |r| {
        Ok(SessionSummary {
            id: r.get(0)?,
            question: r.get(1)?,
            created_at: r.get(2)?,
            retrieval_mode: r.get(3)?,
        })
    })?;
    rows.collect()
}

pub fn get_session(conn: &Connection, id: i64) -> SqlResult<Option<StoredSession>> {
    let mut stmt = conn.prepare(
        "SELECT id, question, created_at, retrieval_mode, response_json
         FROM council_sessions
         WHERE id = ?",
    )?;
    let mut rows = stmt.query_map(params![id], |r| {
        let id: i64 = r.get(0)?;
        let question: String = r.get(1)?;
        let created_at: String = r.get(2)?;
        let retrieval_mode: Option<String> = r.get(3)?;
        let response_json: String = r.get(4)?;
        Ok((id, question, created_at, retrieval_mode, response_json))
    })?;
    match rows.next() {
        Some(row) => {
            let (id, question, created_at, retrieval_mode, response_json) = row?;
            let response: serde_json::Value =
                serde_json::from_str(&response_json).map_err(|e| {
                    rusqlite::Error::FromSqlConversionFailure(
                        0,
                        rusqlite::types::Type::Text,
                        Box::new(e),
                    )
                })?;
            Ok(Some(StoredSession {
                id,
                question,
                created_at,
                retrieval_mode,
                response,
            }))
        }
        None => Ok(None),
    }
}

pub fn delete_session(conn: &Connection, id: i64) -> SqlResult<usize> {
    conn.execute("DELETE FROM council_sessions WHERE id = ?", params![id])
}

// ---------- Backup/export ----------

#[derive(Serialize, Clone)]
pub struct UserDataImportReport {
    pub imported: usize,
    pub skipped: usize,
    pub replaced: usize,
    pub tables: usize,
}

pub fn export_user_data(conn: &Connection) -> SqlResult<serde_json::Value> {
    let mut map = serde_json::Map::new();
    for table in USER_TABLES {
        map.insert(table.to_string(), export_table_rows(conn, table)?);
    }
    Ok(serde_json::json!({
        "app": "Bible AI",
        "export_version": EXPORT_VERSION,
        "user_schema_version": USER_SCHEMA_VERSION,
        "exported_at": sqlite_utc_now(conn)?,
        "tables": map,
    }))
}

fn export_table_rows(conn: &Connection, table: &str) -> SqlResult<serde_json::Value> {
    let rows = table_rows(conn, table)?;
    if table != "app_settings" {
        return Ok(rows);
    }
    let Some(items) = rows.as_array() else {
        return Ok(rows);
    };
    let safe_rows = items
        .iter()
        .filter(|row| {
            let key = row
                .get("key")
                .and_then(serde_json::Value::as_str)
                .unwrap_or_default()
                .to_ascii_lowercase();
            !is_secret_setting_key(&key)
        })
        .cloned()
        .collect::<Vec<_>>();
    Ok(serde_json::Value::Array(safe_rows))
}

fn is_secret_setting_key(key: &str) -> bool {
    key.ends_with("_api_key") || key.contains("api_key") || key.contains("token")
}

pub fn import_user_data(
    conn: &Connection,
    payload: &serde_json::Value,
    conflict_strategy: &str,
) -> Result<UserDataImportReport, String> {
    match conflict_strategy {
        "skip_existing" | "replace_existing" | "duplicate" => {}
        _ => {
            return Err(format!(
                "unsupported conflict strategy: {conflict_strategy}"
            ))
        }
    }

    validate_import_payload(payload)?;
    let tables = payload
        .get("tables")
        .and_then(serde_json::Value::as_object)
        .ok_or_else(|| "backup payload requires a tables object".to_string())?;

    conn.execute_batch("BEGIN IMMEDIATE")
        .map_err(|e| e.to_string())?;
    let result = import_user_data_inner(conn, tables, conflict_strategy);
    match result {
        Ok(report) => {
            conn.execute_batch("COMMIT").map_err(|e| e.to_string())?;
            Ok(report)
        }
        Err(err) => {
            let _ = conn.execute_batch("ROLLBACK");
            Err(err)
        }
    }
}

fn validate_import_payload(payload: &serde_json::Value) -> Result<(), String> {
    let export_version = payload
        .get("export_version")
        .and_then(serde_json::Value::as_i64)
        .ok_or_else(|| "backup payload requires export_version".to_string())?;
    if export_version != EXPORT_VERSION {
        return Err(format!("unsupported export_version: {export_version}"));
    }
    let schema_version = payload
        .get("user_schema_version")
        .and_then(serde_json::Value::as_i64)
        .ok_or_else(|| "backup payload requires user_schema_version".to_string())?;
    if schema_version > USER_SCHEMA_VERSION {
        return Err(format!(
            "backup schema version {schema_version} is newer than app schema {USER_SCHEMA_VERSION}"
        ));
    }
    if !payload
        .get("tables")
        .is_some_and(serde_json::Value::is_object)
    {
        return Err("backup payload requires a tables object".to_string());
    }
    Ok(())
}

fn import_user_data_inner(
    conn: &Connection,
    tables: &serde_json::Map<String, serde_json::Value>,
    conflict_strategy: &str,
) -> Result<UserDataImportReport, String> {
    let mut report = UserDataImportReport {
        imported: 0,
        skipped: 0,
        replaced: 0,
        tables: 0,
    };
    let mut workspace_id_map = std::collections::HashMap::<i64, i64>::new();
    let mut module_id_map = std::collections::HashMap::<i64, i64>::new();

    for table in USER_TABLES {
        let Some(rows_value) = tables.get(*table) else {
            continue;
        };
        let rows = rows_value
            .as_array()
            .ok_or_else(|| format!("table {table} must be an array"))?;
        report.tables += 1;
        let columns = table_column_names(conn, table).map_err(|e| e.to_string())?;

        for row_value in rows {
            let row = row_value
                .as_object()
                .ok_or_else(|| format!("table {table} contains a non-object row"))?;
            let old_id = row.get("id").and_then(serde_json::Value::as_i64);
            let mut row = row.clone();
            if conflict_strategy == "duplicate" {
                prepare_duplicate_row(conn, table, &mut row, &workspace_id_map, &module_id_map)?;
            }

            let was_existing = conflict_strategy == "replace_existing"
                && row_exists_by_primary_key(conn, table, &row).map_err(|e| e.to_string())?;
            let affected = insert_import_row(conn, table, &columns, &row, conflict_strategy)
                .map_err(|e| format!("import {table}: {e}"))?;

            if conflict_strategy == "skip_existing" && affected == 0 {
                report.skipped += 1;
            } else if conflict_strategy == "replace_existing" && was_existing {
                report.replaced += affected;
            } else {
                report.imported += affected;
            }

            if conflict_strategy == "duplicate" && affected > 0 {
                if *table == "study_workspaces" {
                    if let Some(old_id) = old_id {
                        workspace_id_map.insert(old_id, conn.last_insert_rowid());
                    }
                } else if *table == "modules" {
                    if let Some(old_id) = old_id {
                        module_id_map.insert(old_id, conn.last_insert_rowid());
                    }
                }
            }
        }
    }
    Ok(report)
}

fn prepare_duplicate_row(
    conn: &Connection,
    table: &str,
    row: &mut serde_json::Map<String, serde_json::Value>,
    workspace_id_map: &std::collections::HashMap<i64, i64>,
    module_id_map: &std::collections::HashMap<i64, i64>,
) -> Result<(), String> {
    row.remove("id");
    match table {
        "study_items" => {
            let old = row
                .get("workspace_id")
                .and_then(serde_json::Value::as_i64)
                .ok_or_else(|| "study_items row requires workspace_id".to_string())?;
            let new = workspace_id_map
                .get(&old)
                .copied()
                .ok_or_else(|| format!("no imported workspace mapping for id {old}"))?;
            row.insert("workspace_id".to_string(), serde_json::json!(new));
        }
        "module_entries" => {
            let old = row
                .get("module_id")
                .and_then(serde_json::Value::as_i64)
                .ok_or_else(|| "module_entries row requires module_id".to_string())?;
            let new = module_id_map
                .get(&old)
                .copied()
                .ok_or_else(|| format!("no imported module mapping for id {old}"))?;
            row.insert("module_id".to_string(), serde_json::json!(new));
        }
        "modules" => prepare_duplicate_module_slug(conn, row)?,
        _ => {}
    }
    Ok(())
}

fn prepare_duplicate_module_slug(
    conn: &Connection,
    row: &mut serde_json::Map<String, serde_json::Value>,
) -> Result<(), String> {
    let Some(slug) = row.get("slug").and_then(serde_json::Value::as_str) else {
        return Ok(());
    };
    if !module_slug_exists(conn, slug).map_err(|e| e.to_string())? {
        return Ok(());
    }
    let base = slug.trim();
    let mut counter = 1;
    loop {
        let candidate = format!("{base}-import-{counter}");
        if !module_slug_exists(conn, &candidate).map_err(|e| e.to_string())? {
            row.insert("slug".to_string(), serde_json::Value::String(candidate));
            return Ok(());
        }
        counter += 1;
    }
}

fn module_slug_exists(conn: &Connection, slug: &str) -> SqlResult<bool> {
    conn.query_row(
        "SELECT EXISTS(SELECT 1 FROM modules WHERE slug = ?)",
        params![slug],
        |r| r.get::<_, i64>(0),
    )
    .map(|v| v != 0)
}

fn insert_import_row(
    conn: &Connection,
    table: &str,
    table_columns: &[String],
    row: &serde_json::Map<String, serde_json::Value>,
    conflict_strategy: &str,
) -> SqlResult<usize> {
    let columns = table_columns
        .iter()
        .filter(|name| row.contains_key(*name))
        .cloned()
        .collect::<Vec<_>>();
    if columns.is_empty() {
        return Ok(0);
    }
    let placeholders = std::iter::repeat("?")
        .take(columns.len())
        .collect::<Vec<_>>()
        .join(", ");
    let verb = match conflict_strategy {
        "replace_existing" => "INSERT OR REPLACE",
        _ => "INSERT OR IGNORE",
    };
    let sql = format!(
        "{verb} INTO {table} ({}) VALUES ({placeholders})",
        columns.join(", ")
    );
    let values = columns
        .iter()
        .map(|name| sql_value_from_import_row(row, name))
        .collect::<SqlResult<Vec<_>>>()?;
    conn.execute(&sql, rusqlite::params_from_iter(values))
}

fn row_exists_by_primary_key(
    conn: &Connection,
    table: &str,
    row: &serde_json::Map<String, serde_json::Value>,
) -> SqlResult<bool> {
    let pk_columns = table_primary_key_columns(conn, table)?;
    if pk_columns.is_empty() || !pk_columns.iter().all(|c| row.contains_key(c)) {
        return Ok(false);
    }
    let clauses = pk_columns
        .iter()
        .map(|c| format!("{c} = ?"))
        .collect::<Vec<_>>()
        .join(" AND ");
    let values = pk_columns
        .iter()
        .map(|name| sql_value_from_import_row(row, name))
        .collect::<SqlResult<Vec<_>>>()?;
    conn.query_row(
        &format!("SELECT EXISTS(SELECT 1 FROM {table} WHERE {clauses})"),
        rusqlite::params_from_iter(values),
        |r| r.get::<_, i64>(0),
    )
    .map(|v| v != 0)
}

fn table_column_names(conn: &Connection, table: &str) -> SqlResult<Vec<String>> {
    let mut stmt = conn.prepare(&format!("PRAGMA table_info({table})"))?;
    let rows = stmt.query_map([], |r| r.get::<_, String>(1))?;
    rows.collect()
}

fn table_primary_key_columns(conn: &Connection, table: &str) -> SqlResult<Vec<String>> {
    let mut stmt = conn.prepare(&format!("PRAGMA table_info({table})"))?;
    let rows = stmt.query_map([], |r| Ok((r.get::<_, String>(1)?, r.get::<_, i64>(5)?)))?;
    let mut cols = rows.collect::<SqlResult<Vec<_>>>()?;
    cols.sort_by_key(|(_, order)| *order);
    Ok(cols
        .into_iter()
        .filter(|(_, order)| *order > 0)
        .map(|(name, _)| name)
        .collect())
}

fn import_value_error(message: String) -> rusqlite::Error {
    rusqlite::Error::ToSqlConversionFailure(Box::new(std::io::Error::new(
        std::io::ErrorKind::InvalidInput,
        message,
    )))
}

fn sql_value_from_import_row(
    row: &serde_json::Map<String, serde_json::Value>,
    name: &str,
) -> SqlResult<Value> {
    let value = row
        .get(name)
        .ok_or_else(|| import_value_error(format!("import row missing column {name}")))?;
    json_to_sql_value(value).map_err(import_value_error)
}

fn json_to_sql_value(value: &serde_json::Value) -> Result<Value, String> {
    match value {
        serde_json::Value::Null => Ok(Value::Null),
        serde_json::Value::Bool(v) => Ok(Value::Integer(if *v { 1 } else { 0 })),
        serde_json::Value::Number(n) => {
            if let Some(v) = n.as_i64() {
                Ok(Value::Integer(v))
            } else if let Some(v) = n.as_u64() {
                i64::try_from(v)
                    .map(Value::Integer)
                    .map_err(|_| format!("integer value {v} is too large"))
            } else if let Some(v) = n.as_f64() {
                Ok(Value::Real(v))
            } else {
                Err("unsupported JSON number".to_string())
            }
        }
        serde_json::Value::String(v) => Ok(Value::Text(v.clone())),
        serde_json::Value::Array(_) | serde_json::Value::Object(_) => serde_json::to_string(value)
            .map(Value::Text)
            .map_err(|e| e.to_string()),
    }
}

fn table_rows(conn: &Connection, table: &str) -> SqlResult<serde_json::Value> {
    let mut stmt = conn.prepare(&format!("SELECT * FROM {table}"))?;
    let column_names: Vec<String> = stmt.column_names().iter().map(|s| s.to_string()).collect();
    let rows = stmt.query_map([], |row| {
        let mut obj = serde_json::Map::new();
        for (idx, name) in column_names.iter().enumerate() {
            let value = match row.get_ref(idx)? {
                ValueRef::Null => serde_json::Value::Null,
                ValueRef::Integer(v) => serde_json::Value::Number(v.into()),
                ValueRef::Real(v) => serde_json::json!(v),
                ValueRef::Text(v) => {
                    serde_json::Value::String(String::from_utf8_lossy(v).to_string())
                }
                ValueRef::Blob(v) => serde_json::Value::String(format!("<{} bytes>", v.len())),
            };
            obj.insert(name.clone(), value);
        }
        Ok(serde_json::Value::Object(obj))
    })?;
    let rows = rows.collect::<SqlResult<Vec<_>>>()?;
    Ok(serde_json::Value::Array(rows))
}

fn sqlite_utc_now(conn: &Connection) -> SqlResult<String> {
    conn.query_row("SELECT strftime('%Y-%m-%dT%H:%M:%SZ', 'now')", [], |r| {
        r.get(0)
    })
}

// ---------- Highlights ----------

#[derive(Serialize, Clone)]
pub struct Highlight {
    pub verse_id: i64,
    pub color: String,
}

#[derive(Serialize, Clone)]
pub struct RangeHighlight {
    pub id: i64,
    pub start_verse_id: i64,
    pub end_verse_id: i64,
    pub color: String,
}

pub fn upsert_highlight(conn: &Connection, verse_id: i64, color: &str) -> SqlResult<()> {
    conn.execute(
        "INSERT INTO user_highlights (verse_id, color) VALUES (?, ?)
         ON CONFLICT(verse_id) DO UPDATE SET color = excluded.color, updated_at = datetime('now')",
        params![verse_id, color],
    )?;
    Ok(())
}

pub fn delete_highlight(conn: &Connection, verse_id: i64) -> SqlResult<usize> {
    conn.execute(
        "DELETE FROM user_highlights WHERE verse_id = ?",
        params![verse_id],
    )
}

/// All highlights for a chapter — verse_ids fall in [book*1e6+chap*1e3, +1000).
pub fn list_highlights_for_chapter(
    conn: &Connection,
    book_id: i64,
    chapter: i64,
) -> SqlResult<Vec<Highlight>> {
    let lo = book_id * 1_000_000 + chapter * 1_000;
    let hi = lo + 1_000;
    let mut stmt = conn.prepare(
        "SELECT verse_id, color FROM user_highlights WHERE verse_id >= ? AND verse_id < ?",
    )?;
    let rows = stmt.query_map(params![lo, hi], |r| {
        Ok(Highlight {
            verse_id: r.get(0)?,
            color: r.get(1)?,
        })
    })?;
    rows.collect()
}

pub fn upsert_range_highlight(
    conn: &Connection,
    start_verse_id: i64,
    end_verse_id: i64,
    color: &str,
) -> SqlResult<()> {
    let start = start_verse_id.min(end_verse_id);
    let end = start_verse_id.max(end_verse_id);
    let changed = conn.execute(
        "UPDATE user_range_highlights
         SET color = ?, updated_at = datetime('now')
         WHERE start_verse_id = ? AND end_verse_id = ?",
        params![color, start, end],
    )?;
    if changed == 0 {
        conn.execute(
            "INSERT INTO user_range_highlights (start_verse_id, end_verse_id, color)
             VALUES (?, ?, ?)",
            params![start, end, color],
        )?;
    }
    Ok(())
}

pub fn delete_range_highlight(
    conn: &Connection,
    start_verse_id: i64,
    end_verse_id: i64,
) -> SqlResult<usize> {
    let start = start_verse_id.min(end_verse_id);
    let end = start_verse_id.max(end_verse_id);
    conn.execute(
        "DELETE FROM user_range_highlights WHERE start_verse_id = ? AND end_verse_id = ?",
        params![start, end],
    )
}

pub fn list_range_highlights_for_chapter(
    conn: &Connection,
    book_id: i64,
    chapter: i64,
) -> SqlResult<Vec<RangeHighlight>> {
    let lo = book_id * 1_000_000 + chapter * 1_000;
    let hi = lo + 1_000;
    let mut stmt = conn.prepare(
        "SELECT id, start_verse_id, end_verse_id, color
         FROM user_range_highlights
         WHERE start_verse_id < ? AND end_verse_id >= ?
         ORDER BY start_verse_id, end_verse_id",
    )?;
    let rows = stmt.query_map(params![hi, lo], |r| {
        Ok(RangeHighlight {
            id: r.get(0)?,
            start_verse_id: r.get(1)?,
            end_verse_id: r.get(2)?,
            color: r.get(3)?,
        })
    })?;
    rows.collect()
}

// ---------- Notes ----------

#[derive(Serialize, Clone)]
pub struct Note {
    pub verse_id: i64,
    pub body: String,
    pub updated_at: String,
}

#[derive(Serialize, Clone)]
pub struct RangeNote {
    pub id: i64,
    pub start_verse_id: i64,
    pub end_verse_id: i64,
    pub body: String,
    pub updated_at: String,
}

pub fn get_note(conn: &Connection, verse_id: i64) -> SqlResult<Option<Note>> {
    let mut stmt =
        conn.prepare("SELECT verse_id, body, updated_at FROM user_notes WHERE verse_id = ?")?;
    let mut rows = stmt.query_map(params![verse_id], |r| {
        Ok(Note {
            verse_id: r.get(0)?,
            body: r.get(1)?,
            updated_at: r.get(2)?,
        })
    })?;
    match rows.next() {
        Some(row) => Ok(Some(row?)),
        None => Ok(None),
    }
}

pub fn upsert_note(conn: &Connection, verse_id: i64, body: &str) -> SqlResult<()> {
    conn.execute(
        "INSERT INTO user_notes (verse_id, body) VALUES (?, ?)
         ON CONFLICT(verse_id) DO UPDATE SET body = excluded.body, updated_at = datetime('now')",
        params![verse_id, body],
    )?;
    Ok(())
}

pub fn delete_note(conn: &Connection, verse_id: i64) -> SqlResult<usize> {
    conn.execute(
        "DELETE FROM user_notes WHERE verse_id = ?",
        params![verse_id],
    )
}

pub fn list_notes_for_chapter(
    conn: &Connection,
    book_id: i64,
    chapter: i64,
) -> SqlResult<Vec<Note>> {
    let lo = book_id * 1_000_000 + chapter * 1_000;
    let hi = lo + 1_000;
    let mut stmt = conn.prepare(
        "SELECT verse_id, body, updated_at FROM user_notes WHERE verse_id >= ? AND verse_id < ?",
    )?;
    let rows = stmt.query_map(params![lo, hi], |r| {
        Ok(Note {
            verse_id: r.get(0)?,
            body: r.get(1)?,
            updated_at: r.get(2)?,
        })
    })?;
    rows.collect()
}

pub fn get_range_note(
    conn: &Connection,
    start_verse_id: i64,
    end_verse_id: i64,
) -> SqlResult<Option<RangeNote>> {
    let start = start_verse_id.min(end_verse_id);
    let end = start_verse_id.max(end_verse_id);
    let mut stmt = conn.prepare(
        "SELECT id, start_verse_id, end_verse_id, body, updated_at
         FROM user_range_notes
         WHERE start_verse_id = ? AND end_verse_id = ?
         ORDER BY updated_at DESC
         LIMIT 1",
    )?;
    let mut rows = stmt.query_map(params![start, end], |r| {
        Ok(RangeNote {
            id: r.get(0)?,
            start_verse_id: r.get(1)?,
            end_verse_id: r.get(2)?,
            body: r.get(3)?,
            updated_at: r.get(4)?,
        })
    })?;
    match rows.next() {
        Some(row) => Ok(Some(row?)),
        None => Ok(None),
    }
}

pub fn upsert_range_note(
    conn: &Connection,
    start_verse_id: i64,
    end_verse_id: i64,
    body: &str,
) -> SqlResult<()> {
    let start = start_verse_id.min(end_verse_id);
    let end = start_verse_id.max(end_verse_id);
    let changed = conn.execute(
        "UPDATE user_range_notes
         SET body = ?, updated_at = datetime('now')
         WHERE start_verse_id = ? AND end_verse_id = ?",
        params![body, start, end],
    )?;
    if changed == 0 {
        conn.execute(
            "INSERT INTO user_range_notes (start_verse_id, end_verse_id, body)
             VALUES (?, ?, ?)",
            params![start, end, body],
        )?;
    }
    Ok(())
}

pub fn delete_range_note(
    conn: &Connection,
    start_verse_id: i64,
    end_verse_id: i64,
) -> SqlResult<usize> {
    let start = start_verse_id.min(end_verse_id);
    let end = start_verse_id.max(end_verse_id);
    conn.execute(
        "DELETE FROM user_range_notes WHERE start_verse_id = ? AND end_verse_id = ?",
        params![start, end],
    )
}

pub fn list_range_notes_for_chapter(
    conn: &Connection,
    book_id: i64,
    chapter: i64,
) -> SqlResult<Vec<RangeNote>> {
    let lo = book_id * 1_000_000 + chapter * 1_000;
    let hi = lo + 1_000;
    let mut stmt = conn.prepare(
        "SELECT id, start_verse_id, end_verse_id, body, updated_at
         FROM user_range_notes
         WHERE start_verse_id < ? AND end_verse_id >= ?
         ORDER BY start_verse_id, end_verse_id",
    )?;
    let rows = stmt.query_map(params![hi, lo], |r| {
        Ok(RangeNote {
            id: r.get(0)?,
            start_verse_id: r.get(1)?,
            end_verse_id: r.get(2)?,
            body: r.get(3)?,
            updated_at: r.get(4)?,
        })
    })?;
    rows.collect()
}
