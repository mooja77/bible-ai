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

const USER_SCHEMA_VERSION: i64 = 13;
const EXPORT_VERSION: i64 = 1;
const USER_TABLES: &[&str] = &[
    "app_settings",
    "user_notes",
    "user_highlights",
    "user_range_notes",
    "user_range_highlights",
    "council_sessions",
    "council_judgments",
    "council_position_judgments",
    "argument_annotations",
    "theology_topics",
    "theology_positions",
    "theology_conclusions",
    "resource_sources",
    "resource_collections",
    "resource_entries",
    "theology_links",
    "guided_study_sessions",
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

CREATE TABLE IF NOT EXISTS council_judgments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  council_session_id INTEGER NOT NULL UNIQUE REFERENCES council_sessions(id) ON DELETE CASCADE,
  before_judgment TEXT,
  after_judgment TEXT,
  personal_conclusion TEXT,
  confidence INTEGER CHECK (confidence IS NULL OR (confidence BETWEEN 0 AND 100)),
  changed_mind_note TEXT,
  open_questions TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS council_position_judgments (
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

CREATE INDEX IF NOT EXISTS idx_council_position_judgments_parent
  ON council_position_judgments(council_judgment_id);

CREATE TABLE IF NOT EXISTS argument_annotations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  council_session_id INTEGER NOT NULL REFERENCES council_sessions(id) ON DELETE CASCADE,
  node_id TEXT NOT NULL,
  annotation TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(council_session_id, node_id)
);

CREATE INDEX IF NOT EXISTS idx_argument_annotations_session
  ON argument_annotations(council_session_id);

CREATE TABLE IF NOT EXISTS theology_topics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  parent_id INTEGER REFERENCES theology_topics(id) ON DELETE SET NULL,
  summary TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS theology_positions (
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

CREATE TABLE IF NOT EXISTS theology_conclusions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  topic_id INTEGER NOT NULL REFERENCES theology_topics(id) ON DELETE CASCADE,
  conclusion TEXT,
  confidence INTEGER CHECK (confidence IS NULL OR (confidence BETWEEN 0 AND 100)),
  unresolved_questions TEXT,
  changed_over_time TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(topic_id)
);

CREATE TABLE IF NOT EXISTS resource_sources (
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

CREATE TABLE IF NOT EXISTS resource_collections (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_id INTEGER NOT NULL REFERENCES resource_sources(id) ON DELETE CASCADE,
  slug TEXT NOT NULL,
  title TEXT NOT NULL,
  kind TEXT NOT NULL,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  UNIQUE(source_id, slug)
);

CREATE TABLE IF NOT EXISTS resource_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  collection_id INTEGER NOT NULL REFERENCES resource_collections(id) ON DELETE CASCADE,
  ref TEXT,
  title TEXT,
  body TEXT NOT NULL,
  search_text TEXT NOT NULL,
  payload_json TEXT NOT NULL DEFAULT '{}',
  UNIQUE(collection_id, title)
);

CREATE VIRTUAL TABLE IF NOT EXISTS resource_entries_fts
USING fts5(title, search_text, content='resource_entries', content_rowid='id');

CREATE TABLE IF NOT EXISTS theology_links (
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

CREATE INDEX IF NOT EXISTS idx_theology_links_topic_kind
  ON theology_links(topic_id, link_kind);

CREATE TABLE IF NOT EXISTS guided_study_sessions (
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
    conn.pragma_update(None, "foreign_keys", "ON")?;
    conn.execute_batch(USER_SCHEMA)?;
    add_column_if_missing(&conn, "council_sessions", "retrieval_options_json", "TEXT")?;
    add_column_if_missing(&conn, "council_sessions", "retrieved_evidence_json", "TEXT")?;
    add_column_if_missing(&conn, "guided_study_sessions", "focus_question", "TEXT")?;
    seed_theology_topics(&conn)?;
    seed_resource_fixtures(&conn)?;
    let version: i64 = conn.pragma_query_value(None, "user_version", |r| r.get(0))?;
    if version < USER_SCHEMA_VERSION {
        conn.pragma_update(None, "user_version", USER_SCHEMA_VERSION)?;
    }
    Ok(conn)
}

fn seed_theology_topics(conn: &Connection) -> SqlResult<()> {
    const TOPICS: &[(&str, &str, &str, i64)] = &[
        (
            "scripture",
            "Scripture",
            "Revelation, inspiration, canon, authority, and interpretation.",
            10,
        ),
        (
            "god",
            "God",
            "The being, attributes, names, and works of God.",
            20,
        ),
        (
            "trinity",
            "Trinity",
            "Father, Son, and Spirit in one divine being.",
            30,
        ),
        (
            "creation",
            "Creation",
            "Creation, providence, angels, and the created order.",
            40,
        ),
        (
            "humanity",
            "Humanity",
            "The image of God, vocation, embodiment, and human nature.",
            50,
        ),
        (
            "sin",
            "Sin",
            "Fall, guilt, corruption, death, and evil.",
            60,
        ),
        (
            "christ",
            "Christ",
            "The person and work of Jesus Christ.",
            70,
        ),
        (
            "spirit",
            "Spirit",
            "The person and work of the Holy Spirit.",
            80,
        ),
        (
            "salvation",
            "Salvation",
            "Election, calling, justification, sanctification, and perseverance.",
            90,
        ),
        (
            "church",
            "Church",
            "The people of God, ministry, order, mission, and discipline.",
            100,
        ),
        (
            "sacraments",
            "Sacraments/Ordinances",
            "Baptism, the Lord's Supper, and related disputes.",
            110,
        ),
        (
            "last-things",
            "Last Things",
            "Resurrection, judgment, millennium, new creation, and hope.",
            120,
        ),
        (
            "ethics",
            "Ethics",
            "Christian moral reasoning, virtues, commands, and disputed practices.",
            130,
        ),
    ];
    for (slug, title, summary, sort_order) in TOPICS {
        conn.execute(
            "INSERT INTO theology_topics (slug, title, summary, sort_order)
             VALUES (?, ?, ?, ?)
             ON CONFLICT(slug) DO UPDATE SET
               title = excluded.title,
               summary = COALESCE(theology_topics.summary, excluded.summary),
               sort_order = excluded.sort_order,
               updated_at = datetime('now')",
            params![slug, title, summary, sort_order],
        )?;
    }
    Ok(())
}

fn seed_resource_fixtures(conn: &Connection) -> SqlResult<()> {
    let source_id = create_resource_source(
        conn,
        &ResourceSource {
            id: None,
            slug: "public-domain-creeds".to_string(),
            title: "Public Domain Creeds".to_string(),
            source_url: Some("Built-in fixture".to_string()),
            license: "Public Domain".to_string(),
            attribution: "Traditional public-domain creed text bundled as an offline fixture."
                .to_string(),
            version: Some("fixture-1".to_string()),
            imported_at: None,
            metadata_json: Some(
                serde_json::json!({
                    "source_status": "bundled",
                    "source_review": "Fixture source for resource workflow tests.",
                    "redistribution": "Allowed as public-domain text."
                })
                .to_string(),
            ),
        },
    )?;
    let collection_id = create_resource_collection(
        conn,
        &ResourceCollection {
            id: None,
            source_id,
            slug: "creeds".to_string(),
            title: "Creeds".to_string(),
            kind: "creed".to_string(),
            metadata_json: Some("{}".to_string()),
        },
    )?;
    create_resource_entry(
        conn,
        &ResourceEntry {
            id: None,
            collection_id,
            source_id: Some(source_id),
            source_title: Some("Public Domain Creeds".to_string()),
            collection_title: Some("Creeds".to_string()),
            collection_kind: Some("creed".to_string()),
            ref_value: Some("Apostles' Creed".to_string()),
            title: Some("Apostles' Creed".to_string()),
            body: "I believe in God the Father Almighty, Maker of heaven and earth; and in Jesus Christ his only Son our Lord."
                .to_string(),
            search_text: Some(
                "Apostles Creed believe God Father Almighty Maker heaven earth Jesus Christ Son Lord"
                    .to_string(),
            ),
            payload_json: Some(
                serde_json::json!({
                    "related_scripture_refs": ["Genesis 1:1", "John 1:1"],
                    "citation_note": "Traditional creed excerpt used as a resource workflow fixture."
                })
                .to_string(),
            ),
            license: Some("Public Domain".to_string()),
            attribution: Some(
                "Traditional public-domain creed text bundled as an offline fixture.".to_string(),
            ),
            share_alike_requirements: None,
        },
    )?;
    Ok(())
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
    pub managed_gateway_url: Option<String>,
    pub managed_gateway_token: Option<String>,
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
        managed_gateway_url: get_setting(conn, "managed_gateway_url")?,
        managed_gateway_token: get_setting(conn, "managed_gateway_token")?,
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
    upsert_setting(
        conn,
        "managed_gateway_url",
        settings.managed_gateway_url.as_deref(),
    )?;
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
    conn.pragma_update(None, "secure_delete", "ON")?;
    let mut deleted = 0;
    for key in [
        "google_api_key",
        "openai_api_key",
        "anthropic_api_key",
        "managed_gateway_token",
    ] {
        deleted += conn.execute("DELETE FROM app_settings WHERE key = ?", params![key])?;
    }
    if deleted > 0 {
        conn.execute_batch("VACUUM")?;
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
            let mut response: serde_json::Value =
                serde_json::from_str(&response_json).map_err(|e| {
                    rusqlite::Error::FromSqlConversionFailure(
                        0,
                        rusqlite::types::Type::Text,
                        Box::new(e),
                    )
                })?;
            response["session_id"] = serde_json::Value::Number(id.into());
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
    conn.execute(
        "DELETE FROM argument_annotations WHERE council_session_id = ?",
        params![id],
    )?;
    conn.execute(
        "DELETE FROM council_judgments WHERE council_session_id = ?",
        params![id],
    )?;
    conn.execute("DELETE FROM council_sessions WHERE id = ?", params![id])
}

#[derive(Serialize, Deserialize, Clone)]
pub struct PositionJudgment {
    pub position_label: String,
    pub user_rating: String,
    pub user_weight: Option<f64>,
    pub persuasive_evidence: Option<String>,
    pub weak_points: Option<String>,
    pub notes: Option<String>,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct CouncilJudgment {
    pub id: Option<i64>,
    pub council_session_id: i64,
    pub before_judgment: Option<String>,
    pub after_judgment: Option<String>,
    pub personal_conclusion: Option<String>,
    pub confidence: Option<i64>,
    pub changed_mind_note: Option<String>,
    pub open_questions: Option<String>,
    pub position_judgments: Vec<PositionJudgment>,
    pub created_at: Option<String>,
    pub updated_at: Option<String>,
}

pub fn get_council_judgment(
    conn: &Connection,
    council_session_id: i64,
) -> SqlResult<Option<CouncilJudgment>> {
    let mut stmt = conn.prepare(
        "SELECT id, council_session_id, before_judgment, after_judgment,
                personal_conclusion, confidence, changed_mind_note, open_questions,
                created_at, updated_at
         FROM council_judgments
         WHERE council_session_id = ?",
    )?;
    let row = stmt
        .query_row(params![council_session_id], |r| {
            Ok((
                r.get::<_, i64>(0)?,
                r.get::<_, i64>(1)?,
                r.get::<_, Option<String>>(2)?,
                r.get::<_, Option<String>>(3)?,
                r.get::<_, Option<String>>(4)?,
                r.get::<_, Option<i64>>(5)?,
                r.get::<_, Option<String>>(6)?,
                r.get::<_, Option<String>>(7)?,
                r.get::<_, String>(8)?,
                r.get::<_, String>(9)?,
            ))
        })
        .optional()?;
    let Some((
        id,
        council_session_id,
        before_judgment,
        after_judgment,
        personal_conclusion,
        confidence,
        changed_mind_note,
        open_questions,
        created_at,
        updated_at,
    )) = row
    else {
        return Ok(None);
    };

    Ok(Some(CouncilJudgment {
        id: Some(id),
        council_session_id,
        before_judgment,
        after_judgment,
        personal_conclusion,
        confidence,
        changed_mind_note,
        open_questions,
        position_judgments: list_position_judgments(conn, id)?,
        created_at: Some(created_at),
        updated_at: Some(updated_at),
    }))
}

fn list_position_judgments(
    conn: &Connection,
    council_judgment_id: i64,
) -> SqlResult<Vec<PositionJudgment>> {
    let mut stmt = conn.prepare(
        "SELECT position_label, user_rating, user_weight, persuasive_evidence, weak_points, notes
         FROM council_position_judgments
         WHERE council_judgment_id = ?
         ORDER BY id",
    )?;
    let rows = stmt.query_map(params![council_judgment_id], |r| {
        Ok(PositionJudgment {
            position_label: r.get(0)?,
            user_rating: r.get(1)?,
            user_weight: r.get(2)?,
            persuasive_evidence: r.get(3)?,
            weak_points: r.get(4)?,
            notes: r.get(5)?,
        })
    })?;
    rows.collect()
}

pub fn upsert_council_judgment(conn: &Connection, judgment: &CouncilJudgment) -> SqlResult<i64> {
    conn.execute(
        "INSERT INTO council_judgments
           (council_session_id, before_judgment, after_judgment, personal_conclusion,
            confidence, changed_mind_note, open_questions)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(council_session_id) DO UPDATE SET
           before_judgment = excluded.before_judgment,
           after_judgment = excluded.after_judgment,
           personal_conclusion = excluded.personal_conclusion,
           confidence = excluded.confidence,
           changed_mind_note = excluded.changed_mind_note,
           open_questions = excluded.open_questions,
           updated_at = datetime('now')",
        params![
            judgment.council_session_id,
            clean_optional(&judgment.before_judgment),
            clean_optional(&judgment.after_judgment),
            clean_optional(&judgment.personal_conclusion),
            judgment.confidence.map(|value| value.clamp(0, 100)),
            clean_optional(&judgment.changed_mind_note),
            clean_optional(&judgment.open_questions),
        ],
    )?;
    let judgment_id: i64 = conn.query_row(
        "SELECT id FROM council_judgments WHERE council_session_id = ?",
        params![judgment.council_session_id],
        |r| r.get(0),
    )?;
    conn.execute(
        "DELETE FROM council_position_judgments WHERE council_judgment_id = ?",
        params![judgment_id],
    )?;
    for position in &judgment.position_judgments {
        let label = position.position_label.trim();
        let rating = position.user_rating.trim();
        if label.is_empty() || !valid_position_rating(rating) {
            continue;
        }
        conn.execute(
            "INSERT INTO council_position_judgments
               (council_judgment_id, position_label, user_rating, user_weight,
                persuasive_evidence, weak_points, notes)
             VALUES (?, ?, ?, ?, ?, ?, ?)",
            params![
                judgment_id,
                label,
                rating,
                position.user_weight,
                clean_optional(&position.persuasive_evidence),
                clean_optional(&position.weak_points),
                clean_optional(&position.notes),
            ],
        )?;
    }
    Ok(judgment_id)
}

pub fn delete_council_judgment(conn: &Connection, council_session_id: i64) -> SqlResult<usize> {
    conn.execute(
        "DELETE FROM council_judgments WHERE council_session_id = ?",
        params![council_session_id],
    )
}

pub fn list_judgments_for_workspace(
    conn: &Connection,
    workspace_id: i64,
) -> SqlResult<Vec<CouncilJudgment>> {
    let mut stmt = conn.prepare(
        "SELECT kind, payload_json
         FROM study_items
         WHERE workspace_id = ?
           AND kind IN ('council_result', 'council_session')
         ORDER BY sort_order, id",
    )?;
    let rows = stmt.query_map(params![workspace_id], |r| {
        Ok((r.get::<_, String>(0)?, r.get::<_, String>(1)?))
    })?;
    let mut session_ids = Vec::new();
    for row in rows {
        let (_kind, payload_json) = row?;
        if let Some(session_id) = workspace_council_session_id(&payload_json) {
            if !session_ids.contains(&session_id) {
                session_ids.push(session_id);
            }
        }
    }

    let mut judgments = Vec::new();
    for session_id in session_ids {
        if let Some(judgment) = get_council_judgment(conn, session_id)? {
            judgments.push(judgment);
        }
    }
    Ok(judgments)
}

fn workspace_council_session_id(payload_json: &str) -> Option<i64> {
    let payload: serde_json::Value = serde_json::from_str(payload_json).ok()?;
    payload
        .get("session_id")
        .and_then(serde_json::Value::as_i64)
        .or_else(|| {
            payload
                .get("response")
                .and_then(|response| response.get("session_id"))
                .and_then(serde_json::Value::as_i64)
        })
        .or_else(|| {
            payload
                .get("council_session_id")
                .and_then(serde_json::Value::as_i64)
        })
}

fn valid_position_rating(value: &str) -> bool {
    matches!(
        value,
        "persuasive" | "weak" | "unclear" | "needs_study" | "disagree"
    )
}

fn clean_optional(value: &Option<String>) -> Option<String> {
    value
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(ToOwned::to_owned)
}

#[derive(Serialize, Deserialize, Clone)]
pub struct TheologyTopic {
    pub id: i64,
    pub slug: String,
    pub title: String,
    pub parent_id: Option<i64>,
    pub summary: Option<String>,
    pub sort_order: i64,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct TheologyConclusion {
    pub id: Option<i64>,
    pub topic_id: i64,
    pub conclusion: Option<String>,
    pub confidence: Option<i64>,
    pub unresolved_questions: Option<String>,
    pub changed_over_time: Option<String>,
    pub updated_at: Option<String>,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct TheologyPosition {
    pub id: Option<i64>,
    pub topic_id: i64,
    pub label: String,
    pub tradition_family: Option<String>,
    pub summary: Option<String>,
    pub strengths: Option<String>,
    pub weaknesses: Option<String>,
    pub sort_order: Option<i64>,
    pub created_at: Option<String>,
    pub updated_at: Option<String>,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct TheologyLink {
    pub id: Option<i64>,
    pub topic_id: i64,
    pub link_kind: String,
    pub target_id: Option<i64>,
    pub title: Option<String>,
    pub payload_json: Option<String>,
    pub created_at: Option<String>,
}

pub fn list_theology_topics(conn: &Connection) -> SqlResult<Vec<TheologyTopic>> {
    let mut stmt = conn.prepare(
        "SELECT id, slug, title, parent_id, summary, sort_order, created_at, updated_at
         FROM theology_topics
         ORDER BY sort_order, title",
    )?;
    let rows = stmt.query_map([], |r| {
        Ok(TheologyTopic {
            id: r.get(0)?,
            slug: r.get(1)?,
            title: r.get(2)?,
            parent_id: r.get(3)?,
            summary: r.get(4)?,
            sort_order: r.get(5)?,
            created_at: r.get(6)?,
            updated_at: r.get(7)?,
        })
    })?;
    rows.collect()
}

pub fn get_theology_topic(conn: &Connection, id: i64) -> SqlResult<Option<TheologyTopic>> {
    let mut stmt = conn.prepare(
        "SELECT id, slug, title, parent_id, summary, sort_order, created_at, updated_at
         FROM theology_topics
         WHERE id = ?",
    )?;
    let mut rows = stmt.query(params![id])?;
    let Some(row) = rows.next()? else {
        return Ok(None);
    };
    Ok(Some(TheologyTopic {
        id: row.get(0)?,
        slug: row.get(1)?,
        title: row.get(2)?,
        parent_id: row.get(3)?,
        summary: row.get(4)?,
        sort_order: row.get(5)?,
        created_at: row.get(6)?,
        updated_at: row.get(7)?,
    }))
}

pub fn create_theology_topic(
    conn: &Connection,
    title: &str,
    summary: Option<&str>,
    parent_id: Option<i64>,
) -> SqlResult<i64> {
    let clean_title = title.trim();
    if clean_title.is_empty() {
        return Err(rusqlite::Error::InvalidQuery);
    }
    let base_slug = slugify_theology_title(clean_title);
    let slug = unique_theology_slug(conn, &base_slug)?;
    let sort_order = conn.query_row(
        "SELECT COALESCE(MAX(sort_order), 0) + 10 FROM theology_topics",
        [],
        |r| r.get::<_, i64>(0),
    )?;
    conn.execute(
        "INSERT INTO theology_topics (slug, title, parent_id, summary, sort_order)
         VALUES (?, ?, ?, ?, ?)",
        params![
            slug,
            clean_title,
            parent_id,
            summary.map(str::trim).filter(|value| !value.is_empty()),
            sort_order,
        ],
    )?;
    Ok(conn.last_insert_rowid())
}

pub fn update_theology_topic(conn: &Connection, topic: &TheologyTopic) -> SqlResult<usize> {
    if topic.parent_id == Some(topic.id) {
        return Err(rusqlite::Error::InvalidQuery);
    }
    conn.execute(
        "UPDATE theology_topics
         SET title = ?, parent_id = ?, summary = ?, sort_order = ?, updated_at = datetime('now')
         WHERE id = ?",
        params![
            topic.title.trim(),
            topic.parent_id,
            clean_optional(&topic.summary),
            topic.sort_order,
            topic.id,
        ],
    )
}

fn slugify_theology_title(title: &str) -> String {
    let mut slug = String::new();
    let mut last_dash = false;
    for ch in title.chars().flat_map(char::to_lowercase) {
        if ch.is_ascii_alphanumeric() {
            slug.push(ch);
            last_dash = false;
        } else if !last_dash && !slug.is_empty() {
            slug.push('-');
            last_dash = true;
        }
    }
    while slug.ends_with('-') {
        slug.pop();
    }
    if slug.is_empty() {
        "topic".to_string()
    } else {
        slug
    }
}

fn unique_theology_slug(conn: &Connection, base_slug: &str) -> SqlResult<String> {
    if !theology_slug_exists(conn, base_slug)? {
        return Ok(base_slug.to_string());
    }
    for i in 2..1000 {
        let candidate = format!("{base_slug}-{i}");
        if !theology_slug_exists(conn, &candidate)? {
            return Ok(candidate);
        }
    }
    Err(rusqlite::Error::InvalidQuery)
}

pub fn get_theology_conclusion(
    conn: &Connection,
    topic_id: i64,
) -> SqlResult<Option<TheologyConclusion>> {
    conn.query_row(
        "SELECT id, topic_id, conclusion, confidence, unresolved_questions,
                changed_over_time, updated_at
         FROM theology_conclusions
         WHERE topic_id = ?",
        params![topic_id],
        |r| {
            Ok(TheologyConclusion {
                id: Some(r.get(0)?),
                topic_id: r.get(1)?,
                conclusion: r.get(2)?,
                confidence: r.get(3)?,
                unresolved_questions: r.get(4)?,
                changed_over_time: r.get(5)?,
                updated_at: Some(r.get(6)?),
            })
        },
    )
    .optional()
}

pub fn list_theology_positions(
    conn: &Connection,
    topic_id: i64,
) -> SqlResult<Vec<TheologyPosition>> {
    let mut stmt = conn.prepare(
        "SELECT id, topic_id, label, tradition_family, summary, strengths, weaknesses,
                sort_order, created_at, updated_at
         FROM theology_positions
         WHERE topic_id = ?
         ORDER BY sort_order, label",
    )?;
    let rows = stmt.query_map(params![topic_id], |r| {
        Ok(TheologyPosition {
            id: Some(r.get(0)?),
            topic_id: r.get(1)?,
            label: r.get(2)?,
            tradition_family: r.get(3)?,
            summary: r.get(4)?,
            strengths: r.get(5)?,
            weaknesses: r.get(6)?,
            sort_order: Some(r.get(7)?),
            created_at: Some(r.get(8)?),
            updated_at: Some(r.get(9)?),
        })
    })?;
    rows.collect()
}

pub fn upsert_theology_position(conn: &Connection, position: &TheologyPosition) -> SqlResult<i64> {
    if let Some(id) = position.id {
        conn.execute(
            "UPDATE theology_positions
             SET label = ?, tradition_family = ?, summary = ?, strengths = ?,
                 weaknesses = ?, sort_order = ?, updated_at = datetime('now')
             WHERE id = ?",
            params![
                position.label.trim(),
                clean_optional(&position.tradition_family),
                clean_optional(&position.summary),
                clean_optional(&position.strengths),
                clean_optional(&position.weaknesses),
                position.sort_order.unwrap_or(0),
                id,
            ],
        )?;
        return Ok(id);
    }
    conn.execute(
        "INSERT INTO theology_positions
           (topic_id, label, tradition_family, summary, strengths, weaknesses, sort_order)
         VALUES (?, ?, ?, ?, ?, ?, ?)",
        params![
            position.topic_id,
            position.label.trim(),
            clean_optional(&position.tradition_family),
            clean_optional(&position.summary),
            clean_optional(&position.strengths),
            clean_optional(&position.weaknesses),
            position.sort_order.unwrap_or(0),
        ],
    )?;
    Ok(conn.last_insert_rowid())
}

pub fn upsert_theology_conclusion(
    conn: &Connection,
    conclusion: &TheologyConclusion,
) -> SqlResult<i64> {
    conn.execute(
        "INSERT INTO theology_conclusions
           (topic_id, conclusion, confidence, unresolved_questions, changed_over_time)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(topic_id) DO UPDATE SET
           conclusion = excluded.conclusion,
           confidence = excluded.confidence,
           unresolved_questions = excluded.unresolved_questions,
           changed_over_time = excluded.changed_over_time,
           updated_at = datetime('now')",
        params![
            conclusion.topic_id,
            clean_optional(&conclusion.conclusion),
            conclusion.confidence.map(|value| value.clamp(0, 100)),
            clean_optional(&conclusion.unresolved_questions),
            clean_optional(&conclusion.changed_over_time),
        ],
    )?;
    conn.query_row(
        "SELECT id FROM theology_conclusions WHERE topic_id = ?",
        params![conclusion.topic_id],
        |r| r.get(0),
    )
}

pub fn list_theology_links(conn: &Connection, topic_id: i64) -> SqlResult<Vec<TheologyLink>> {
    let mut stmt = conn.prepare(
        "SELECT id, topic_id, link_kind, target_id, title, payload_json, created_at
         FROM theology_links
         WHERE topic_id = ?
         ORDER BY created_at DESC, id DESC",
    )?;
    let rows = stmt.query_map(params![topic_id], |r| {
        Ok(TheologyLink {
            id: Some(r.get(0)?),
            topic_id: r.get(1)?,
            link_kind: r.get(2)?,
            target_id: r.get(3)?,
            title: r.get(4)?,
            payload_json: Some(r.get(5)?),
            created_at: Some(r.get(6)?),
        })
    })?;
    rows.collect()
}

pub fn create_theology_link(conn: &Connection, link: &TheologyLink) -> SqlResult<i64> {
    conn.execute(
        "INSERT INTO theology_links (topic_id, link_kind, target_id, title, payload_json)
         VALUES (?, ?, ?, ?, ?)",
        params![
            link.topic_id,
            link.link_kind.trim(),
            link.target_id,
            clean_optional(&link.title),
            link.payload_json.as_deref().unwrap_or("{}"),
        ],
    )?;
    Ok(conn.last_insert_rowid())
}

pub fn delete_theology_link(conn: &Connection, id: i64) -> SqlResult<usize> {
    conn.execute("DELETE FROM theology_links WHERE id = ?", params![id])
}

pub fn export_theology_markdown(
    conn: &Connection,
    topic_id: Option<i64>,
    include_subtopics: bool,
) -> SqlResult<String> {
    let all_topics = list_theology_topics(conn)?;
    let topics = match topic_id {
        Some(id) if include_subtopics => list_theology_topic_tree(conn, id)?,
        Some(id) => all_topics
            .iter()
            .cloned()
            .into_iter()
            .filter(|topic| topic.id == id)
            .collect::<Vec<_>>(),
        None => all_topics.clone(),
    };
    let mut lines = vec!["# My Theology".to_string(), String::new()];
    for topic in topics {
        let links = list_theology_links(conn, topic.id)?;
        let conclusion = get_theology_conclusion(conn, topic.id)?;
        let positions = list_theology_positions(conn, topic.id)?;
        let subtopics = all_topics
            .iter()
            .filter(|candidate| candidate.parent_id == Some(topic.id))
            .collect::<Vec<_>>();
        let passage_count = links
            .iter()
            .filter(|link| link.link_kind == "verse" || link.link_kind == "verse_range")
            .count();
        let resource_count = links
            .iter()
            .filter(|link| link.link_kind == "resource_entry")
            .count();
        let council_count = links
            .iter()
            .filter(|link| link.link_kind == "council_session")
            .count();
        let open_question_count =
            count_theology_export_questions(conclusion.as_ref().and_then(|item| {
                item.unresolved_questions
                    .as_deref()
                    .filter(|value| !value.is_empty())
            }));

        lines.push(format!("## {}", topic.title));
        lines.push(String::new());
        lines.push("### Topic status".to_string());
        lines.push(String::new());
        lines.push(format!(
            "- Status: {}",
            theology_export_status(conclusion.as_ref(), links.len(), open_question_count)
        ));
        lines.push(format!("- Created: {}", topic.created_at));
        lines.push(format!("- Topic last updated: {}", topic.updated_at));
        if let Some(updated_at) = conclusion
            .as_ref()
            .and_then(|item| item.updated_at.as_deref())
            .filter(|value| !value.is_empty())
        {
            lines.push(format!("- Conclusion last updated: {updated_at}"));
        }
        lines.push(format!(
            "- Linked evidence: {passage_count} passage(s), {resource_count} resource(s), {council_count} Council session(s)"
        ));
        lines.push(String::new());
        if let Some(summary) = topic.summary.as_deref().filter(|value| !value.is_empty()) {
            lines.push(summary.to_string());
            lines.push(String::new());
        }
        let study_prompts = theology_export_study_prompts(
            &topic,
            resource_count,
            conclusion.as_ref(),
            &positions,
            &links,
            &subtopics,
        );
        if !study_prompts.is_empty() {
            lines.push("### Key study questions".to_string());
            lines.push(String::new());
            for prompt in study_prompts {
                lines.push(format!("- **{}** {}", prompt.question, prompt.rationale));
            }
            lines.push(String::new());
        }
        if let Some(conclusion) = conclusion.as_ref() {
            if let Some(body) = conclusion
                .conclusion
                .as_deref()
                .filter(|value| !value.is_empty())
            {
                lines.push("### My conclusion".to_string());
                lines.push(String::new());
                lines.push(body.to_string());
                lines.push(String::new());
            }
            if let Some(confidence) = conclusion.confidence {
                lines.push(format!("**Confidence:** {confidence}%"));
                lines.push(String::new());
            }
            if let Some(questions) = conclusion
                .unresolved_questions
                .as_deref()
                .filter(|value| !value.is_empty())
            {
                lines.push("### Unresolved questions".to_string());
                lines.push(String::new());
                lines.push(questions.to_string());
                lines.push(String::new());
                lines.push(format!("Open question count: {open_question_count}"));
                lines.push(String::new());
            }
            if conclusion
                .updated_at
                .as_deref()
                .filter(|value| !value.is_empty())
                .is_some()
                || conclusion
                    .changed_over_time
                    .as_deref()
                    .filter(|value| !value.is_empty())
                    .is_some()
            {
                lines.push("### Change history".to_string());
                lines.push(String::new());
                if let Some(updated_at) = conclusion
                    .updated_at
                    .as_deref()
                    .filter(|value| !value.is_empty())
                {
                    lines.push(format!("- Conclusion last updated: {updated_at}"));
                }
                if let Some(changed) = conclusion
                    .changed_over_time
                    .as_deref()
                    .filter(|value| !value.is_empty())
                {
                    lines.push(format!("- User change note: {changed}"));
                }
                lines.push(String::new());
            }
        }
        if !positions.is_empty() {
            lines.push("### Major positions".to_string());
            lines.push(String::new());
            for position in positions {
                lines.push(format!("- **{}**", position.label));
                if let Some(family) = position
                    .tradition_family
                    .as_deref()
                    .filter(|value| !value.is_empty())
                {
                    lines.push(format!("  - Tradition family: {family}"));
                }
                if let Some(summary) = position
                    .summary
                    .as_deref()
                    .filter(|value| !value.is_empty())
                {
                    lines.push(format!("  - Summary: {summary}"));
                }
                if let Some(strengths) = position
                    .strengths
                    .as_deref()
                    .filter(|value| !value.is_empty())
                {
                    lines.push(format!("  - Strengths: {strengths}"));
                }
                if let Some(weaknesses) = position
                    .weaknesses
                    .as_deref()
                    .filter(|value| !value.is_empty())
                {
                    lines.push(format!("  - Weaknesses: {weaknesses}"));
                }
            }
            lines.push(String::new());
        }
        if !links.is_empty() {
            let doctrine_relations = links
                .iter()
                .filter_map(format_doctrine_relation)
                .collect::<Vec<_>>();
            if !doctrine_relations.is_empty() {
                lines.push("### Doctrine map".to_string());
                lines.push(String::new());
                lines.push(format!("- **Current topic:** {}", topic.title));
                for relation in doctrine_relations {
                    lines.push(relation);
                }
                lines.push(String::new());
            }

            let mut resource_ids = Vec::new();
            for group in theology_link_export_groups(&links) {
                if group.links.is_empty() {
                    continue;
                }
                lines.push(format!("### {}", group.title));
                lines.push(String::new());
                for link in group.links {
                    lines.push(format_theology_link_export_row(link));
                    if link.link_kind == "resource_entry" {
                        if let Some(id) = link.target_id {
                            resource_ids.push(id);
                        }
                    }
                }
                lines.push(String::new());
            }
            let attributions = resource_attributions_for_entries(conn, &resource_ids)?;
            if !attributions.is_empty() {
                lines.push("### Source attribution".to_string());
                lines.push(String::new());
                for attribution in attributions {
                    let share_alike = attribution
                        .share_alike_requirements
                        .as_deref()
                        .filter(|value| !value.is_empty() && *value != "None.")
                        .map(|value| format!(" Share-alike: {value}"))
                        .unwrap_or_default();
                    lines.push(format!(
                        "- **{}** ({}) — {}",
                        attribution.title,
                        attribution.license,
                        format!("{}{}", attribution.attribution, share_alike)
                    ));
                }
                lines.push(String::new());
            }
        }
        let guided_sessions = list_guided_study_sessions_for_topic(conn, topic.id)?;
        if !guided_sessions.is_empty() {
            lines.push("### Guided studies".to_string());
            lines.push(String::new());
        }
        for session in guided_sessions {
            lines.push(format!(
                "#### {}",
                guided_template_title(&session.template_slug)
            ));
            lines.push(String::new());
            let mut timing = Vec::new();
            if let Some(completed_at) = session
                .completed_at
                .as_deref()
                .filter(|value| !value.is_empty())
            {
                timing.push(format!("completed {completed_at}"));
            }
            if let Some(updated_at) = session
                .updated_at
                .as_deref()
                .filter(|value| !value.is_empty())
            {
                timing.push(format!("updated {updated_at}"));
            }
            if !timing.is_empty() {
                lines.push(format!("_{}._", timing.join("; ")));
                lines.push(String::new());
            }
            if let Some(question) = session
                .focus_question
                .as_deref()
                .filter(|value| !value.is_empty())
            {
                lines.push("**Question:**".to_string());
                lines.push(question.to_string());
                lines.push(String::new());
            }
            if let Some(before) = session
                .before_response
                .as_deref()
                .filter(|value| !value.is_empty())
            {
                lines.push("**Before AI:**".to_string());
                lines.push(before.to_string());
                lines.push(String::new());
            }
            if let Some(after) = session
                .after_response
                .as_deref()
                .filter(|value| !value.is_empty())
            {
                lines.push("**After AI:**".to_string());
                lines.push(after.to_string());
                lines.push(String::new());
            }
            if let Some(critique) = session
                .critique
                .as_deref()
                .filter(|value| !value.is_empty())
            {
                lines.push("**Critique:**".to_string());
                lines.push(critique.to_string());
                lines.push(String::new());
            }
            let review_card_rows =
                guided_review_card_export_rows(session.review_cards_json.as_deref());
            if !review_card_rows.is_empty() {
                lines.push("**Study review cards:**".to_string());
                for row in review_card_rows {
                    lines.push(row);
                }
                lines.push(String::new());
            }
        }
    }
    Ok(sanitize_theology_export_text(&lines.join("\n")))
}

fn theology_export_status(
    conclusion: Option<&TheologyConclusion>,
    link_count: usize,
    open_question_count: usize,
) -> &'static str {
    let has_conclusion = conclusion
        .and_then(|item| item.conclusion.as_deref())
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .is_some();
    if !has_conclusion {
        if link_count > 0 {
            return "studying";
        }
        return "not started";
    }
    let confidence = conclusion.and_then(|item| item.confidence).unwrap_or(0);
    if confidence >= 80 && open_question_count == 0 {
        "settled for now"
    } else {
        "drafted"
    }
}

fn count_theology_export_questions(value: Option<&str>) -> usize {
    value
        .unwrap_or_default()
        .split(|ch| ch == '\n' || ch == '?')
        .map(str::trim)
        .filter(|part| !part.is_empty())
        .count()
}

struct TheologyStudyPrompt {
    question: String,
    rationale: &'static str,
}

fn theology_export_study_prompts(
    topic: &TheologyTopic,
    resource_count: usize,
    conclusion: Option<&TheologyConclusion>,
    positions: &[TheologyPosition],
    links: &[TheologyLink],
    subtopics: &[&TheologyTopic],
) -> Vec<TheologyStudyPrompt> {
    let mut prompts = Vec::new();
    push_theology_study_prompt(
        &mut prompts,
        format!(
            "Which passages most directly support or challenge my current view of {}?",
            topic.title
        ),
        "Start from the text before accepting a synthesis.",
    );
    if resource_count == 0 {
        push_theology_study_prompt(
            &mut prompts,
            format!(
                "Which attributable resources should I consult before settling {}?",
                topic.title
            ),
            "No linked resources are recorded yet.",
        );
    }
    match positions.len() {
        0 => push_theology_study_prompt(
            &mut prompts,
            format!(
                "What are the main theological positions I need to compare for {}?",
                topic.title
            ),
            "Major positions make disagreement visible instead of implicit.",
        ),
        1 => push_theology_study_prompt(
            &mut prompts,
            format!(
                "What is the strongest alternative to {}?",
                positions[0].label
            ),
            "A single saved position can hide dissent or unresolved interpretive options.",
        ),
        _ => push_theology_study_prompt(
            &mut prompts,
            "Which evidence would make one saved position stronger than the others?".to_string(),
            "Compare positions by evidence and assumptions, not only labels.",
        ),
    }
    if conclusion
        .and_then(|item| item.conclusion.as_deref())
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .is_some()
    {
        push_theology_study_prompt(
            &mut prompts,
            format!(
                "What evidence would change or weaken my current conclusion about {}?",
                topic.title
            ),
            "A living theology should preserve what could revise the user's judgment.",
        );
    }
    for link in links
        .iter()
        .filter_map(|link| theology_relation_prompt_question(link, &topic.title))
        .take(2)
    {
        push_theology_study_prompt(
            &mut prompts,
            link,
            "Doctrine links should shape interpretation, not just sit beside the topic.",
        );
    }
    if !subtopics.is_empty() {
        push_theology_study_prompt(
            &mut prompts,
            format!(
                "Which subtopic under {} needs its own conclusion next?",
                topic.title
            ),
            "Subtopics help split large doctrines into studyable questions.",
        );
    }
    prompts.truncate(5);
    prompts
}

fn push_theology_study_prompt(
    prompts: &mut Vec<TheologyStudyPrompt>,
    question: String,
    rationale: &'static str,
) {
    if prompts.iter().any(|prompt| prompt.question == question) {
        return;
    }
    prompts.push(TheologyStudyPrompt {
        question,
        rationale,
    });
}

fn theology_relation_prompt_question(link: &TheologyLink, topic_title: &str) -> Option<String> {
    if link.link_kind != "note" {
        return None;
    }
    let payload: serde_json::Value = serde_json::from_str(link.payload_json.as_deref()?).ok()?;
    if payload.get("type")?.as_str()? != "doctrine_relation" {
        return None;
    }
    let relation = match payload.get("relation").and_then(serde_json::Value::as_str) {
        Some("supports") => "supports",
        Some("tension") => "tension with",
        _ => "depends on",
    };
    let target = payload
        .get("target_topic_title")
        .and_then(serde_json::Value::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .unwrap_or("this related topic");
    Some(format!(
        "How does {relation} {target} affect my conclusion about {topic_title}?"
    ))
}

struct TheologyLinkExportGroup<'a> {
    title: &'static str,
    links: Vec<&'a TheologyLink>,
}

fn theology_link_export_groups(links: &[TheologyLink]) -> Vec<TheologyLinkExportGroup<'_>> {
    vec![
        TheologyLinkExportGroup {
            title: "Key passages",
            links: links
                .iter()
                .filter(|link| link.link_kind == "verse" || link.link_kind == "verse_range")
                .collect(),
        },
        TheologyLinkExportGroup {
            title: "Linked resources",
            links: links
                .iter()
                .filter(|link| link.link_kind == "resource_entry")
                .collect(),
        },
        TheologyLinkExportGroup {
            title: "Linked Council sessions",
            links: links
                .iter()
                .filter(|link| link.link_kind == "council_session")
                .collect(),
        },
        TheologyLinkExportGroup {
            title: "Workspace evidence",
            links: links
                .iter()
                .filter(|link| link.link_kind == "workspace_item")
                .collect(),
        },
        TheologyLinkExportGroup {
            title: "Notes and argument maps",
            links: links
                .iter()
                .filter(|link| {
                    link.link_kind == "argument_map"
                        || (link.link_kind == "note" && format_doctrine_relation(link).is_none())
                })
                .collect(),
        },
    ]
}

fn format_theology_link_export_row(link: &TheologyLink) -> String {
    let title = link.title.as_deref().unwrap_or("Untitled link");
    let target = link
        .target_id
        .map(|id| format!(" #{id}"))
        .unwrap_or_default();
    let preview = theology_link_export_preview(link)
        .map(|value| format!(" — {value}"))
        .unwrap_or_default();
    format!(
        "- **{}{}:** {}{}",
        theology_link_kind_label(&link.link_kind),
        target,
        title,
        preview
    )
}

fn theology_link_kind_label(kind: &str) -> &'static str {
    match kind {
        "verse" => "Passage",
        "verse_range" => "Passage range",
        "resource_entry" => "Resource",
        "council_session" => "Council",
        "workspace_item" => "Workspace item",
        "argument_map" => "Argument map",
        _ => "Note",
    }
}

fn theology_link_export_preview(link: &TheologyLink) -> Option<String> {
    let payload: serde_json::Value = serde_json::from_str(link.payload_json.as_deref()?).ok()?;
    let mut parts = Vec::new();
    for key in [
        "citation",
        "text",
        "snippet",
        "body",
        "summary",
        "question",
        "source",
        "source_title",
        "workspace_title",
        "collection",
    ] {
        if let Some(value) = payload.get(key).and_then(serde_json::Value::as_str) {
            let cleaned = strip_html_markers(value).trim().to_string();
            if !cleaned.is_empty() {
                parts.push(cleaned);
            }
        }
    }
    let preview = parts.join(" - ");
    if preview.is_empty() {
        None
    } else {
        Some(preview.chars().take(220).collect())
    }
}

fn strip_html_markers(value: &str) -> String {
    let mut output = String::new();
    let mut in_tag = false;
    for ch in value.chars() {
        match ch {
            '<' => in_tag = true,
            '>' => in_tag = false,
            _ if !in_tag => output.push(ch),
            _ => {}
        }
    }
    output
}

fn guided_review_card_export_rows(review_cards_json: Option<&str>) -> Vec<String> {
    let Some(raw_json) = review_cards_json
        .map(str::trim)
        .filter(|value| !value.is_empty())
    else {
        return Vec::new();
    };
    let Ok(cards) = serde_json::from_str::<serde_json::Value>(raw_json) else {
        return Vec::new();
    };
    let Some(cards) = cards.as_array() else {
        return Vec::new();
    };
    cards
        .iter()
        .filter_map(|card| {
            let prompt = card
                .get("prompt")
                .and_then(serde_json::Value::as_str)
                .map(clean_review_card_export_text)
                .unwrap_or_default();
            let answer = card
                .get("answer")
                .and_then(serde_json::Value::as_str)
                .map(clean_review_card_export_text)
                .unwrap_or_default();
            if prompt.is_empty() && answer.is_empty() {
                return None;
            }
            let kind = card
                .get("kind")
                .and_then(serde_json::Value::as_str)
                .map(clean_review_card_export_text)
                .filter(|value| !value.is_empty())
                .unwrap_or_else(|| "Review".to_string());
            if answer.is_empty() {
                Some(format!("- **{kind}:** {prompt}"))
            } else {
                Some(format!("- **{kind}:** {prompt} — {answer}"))
            }
        })
        .collect()
}

fn clean_review_card_export_text(value: &str) -> String {
    let cleaned = strip_html_markers(value)
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ");
    cleaned.chars().take(360).collect()
}

fn sanitize_theology_export_text(value: &str) -> String {
    let redacted = redact_secret_assignments(value);
    let redacted = redact_secret_setting_names(&redacted);
    let redacted = redact_windows_paths(&redacted);
    redact_unix_paths(&redacted)
}

fn redact_secret_assignments(value: &str) -> String {
    let chars = value.chars().collect::<Vec<_>>();
    let mut output = String::new();
    let mut index = 0;
    while index < chars.len() {
        if !is_export_key_char(chars[index]) {
            output.push(chars[index]);
            index += 1;
            continue;
        }

        let start = index;
        while index < chars.len() && is_export_key_char(chars[index]) {
            index += 1;
        }
        let key = chars[start..index].iter().collect::<String>();
        if !is_secret_export_key(&key) {
            output.push(chars[start]);
            index = start + 1;
            continue;
        }

        let mut cursor = index;
        while cursor < chars.len() && chars[cursor].is_whitespace() && chars[cursor] != '\n' {
            cursor += 1;
        }
        if cursor >= chars.len() || (chars[cursor] != '=' && chars[cursor] != ':') {
            output.push(chars[start]);
            index = start + 1;
            continue;
        }

        cursor += 1;
        while cursor < chars.len() && chars[cursor].is_whitespace() && chars[cursor] != '\n' {
            cursor += 1;
        }
        while cursor < chars.len()
            && !chars[cursor].is_whitespace()
            && !matches!(
                chars[cursor],
                '`' | '"' | '\'' | '<' | '>' | ')' | ']' | '}' | ',' | ';'
            )
        {
            cursor += 1;
        }
        output.push_str("[redacted secret]");
        index = cursor;
    }
    output
}

fn redact_secret_setting_names(value: &str) -> String {
    let chars = value.chars().collect::<Vec<_>>();
    let mut output = String::new();
    let mut index = 0;
    while index < chars.len() {
        if !is_export_key_char(chars[index]) {
            output.push(chars[index]);
            index += 1;
            continue;
        }
        let start = index;
        while index < chars.len() && is_export_key_char(chars[index]) {
            index += 1;
        }
        let key = chars[start..index].iter().collect::<String>();
        if is_named_secret_setting(&key) {
            output.push_str("[redacted setting]");
        } else {
            output.push_str(&key);
        }
    }
    output
}

fn redact_windows_paths(value: &str) -> String {
    let chars = value.chars().collect::<Vec<_>>();
    let mut output = String::new();
    let mut index = 0;
    while index < chars.len() {
        if index + 2 < chars.len()
            && chars[index].is_ascii_alphabetic()
            && chars[index + 1] == ':'
            && (chars[index + 2] == '\\' || chars[index + 2] == '/')
        {
            index += 3;
            while index < chars.len()
                && chars[index] != '\n'
                && !matches!(chars[index], '`' | '*' | '?' | '"' | '<' | '>' | '|')
            {
                index += 1;
            }
            output.push_str("[redacted local path]");
            continue;
        }
        output.push(chars[index]);
        index += 1;
    }
    output
}

fn redact_unix_paths(value: &str) -> String {
    let chars = value.chars().collect::<Vec<_>>();
    let mut output = String::new();
    let mut index = 0;
    while index < chars.len() {
        if starts_with_chars(&chars, index, "/Users/")
            || starts_with_chars(&chars, index, "/home/")
            || starts_with_chars(&chars, index, "/tmp/")
            || starts_with_chars(&chars, index, "/var/")
            || starts_with_chars(&chars, index, "/etc/")
        {
            while index < chars.len()
                && !chars[index].is_whitespace()
                && !matches!(chars[index], '`' | '"' | '\'' | '<' | '>')
            {
                index += 1;
            }
            output.push_str("[redacted local path]");
            continue;
        }
        output.push(chars[index]);
        index += 1;
    }
    output
}

fn starts_with_chars(chars: &[char], index: usize, needle: &str) -> bool {
    let needle = needle.chars().collect::<Vec<_>>();
    index + needle.len() <= chars.len() && chars[index..index + needle.len()] == needle
}

fn is_export_key_char(ch: char) -> bool {
    ch.is_ascii_alphanumeric() || ch == '_' || ch == '-'
}

fn is_secret_export_key(key: &str) -> bool {
    let key = key.to_ascii_uppercase();
    key.contains("API_KEY")
        || key.contains("TOKEN")
        || key.contains("SECRET")
        || key.contains("PASSWORD")
}

fn is_named_secret_setting(key: &str) -> bool {
    matches!(
        key.to_ascii_lowercase().as_str(),
        "google_api_key" | "openai_api_key" | "anthropic_api_key" | "managed_gateway_token"
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    fn test_conn() -> Connection {
        let conn = Connection::open_in_memory().expect("open in-memory user DB");
        conn.execute_batch(USER_SCHEMA).expect("create user schema");
        conn
    }

    fn temp_db_path(name: &str) -> std::path::PathBuf {
        let id = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .expect("system time")
            .as_nanos();
        std::env::temp_dir().join(format!(
            "bible-ai-{name}-{}-{id}.sqlite",
            std::process::id()
        ))
    }

    fn file_contains_ascii(path: &std::path::Path, needle: &str) -> bool {
        let bytes = std::fs::read(path).expect("read sqlite file");
        let needle = needle.as_bytes();
        bytes.windows(needle.len()).any(|window| window == needle)
    }

    #[test]
    fn delete_secret_settings_vacuums_legacy_provider_keys_from_db_file() {
        let path = temp_db_path("secret-cleanup");
        let secret = "test-secret-delete-regression";
        {
            let conn = open(&path).expect("open file-backed user DB");
            conn.execute(
                "INSERT INTO app_settings (key, value) VALUES ('google_api_key', ?)",
                params![secret],
            )
            .expect("insert legacy provider key");
            conn.execute(
                "INSERT INTO app_settings (key, value) VALUES ('openai_model', 'gpt-5')",
                [],
            )
            .expect("insert non-secret setting");
        }

        assert!(file_contains_ascii(&path, "google_api_key"));
        assert!(file_contains_ascii(&path, secret));

        {
            let conn = open(&path).expect("reopen file-backed user DB");
            delete_secret_settings(&conn).expect("delete legacy provider keys");
            let remaining: i64 = conn
                .query_row(
                    "SELECT COUNT(*) FROM app_settings WHERE key = 'google_api_key'",
                    [],
                    |row| row.get(0),
                )
                .expect("count legacy provider keys");
            assert_eq!(remaining, 0);
            let model: String = conn
                .query_row(
                    "SELECT value FROM app_settings WHERE key = 'openai_model'",
                    [],
                    |row| row.get(0),
                )
                .expect("read non-secret setting");
            assert_eq!(model, "gpt-5");
        }

        assert!(!file_contains_ascii(&path, "google_api_key"));
        assert!(!file_contains_ascii(&path, secret));
        let _ = std::fs::remove_file(path);
    }

    #[test]
    fn list_judgments_for_workspace_finds_saved_council_items() {
        let conn = test_conn();
        let session_id = insert_session(
            &conn,
            "What is the doctrine of Scripture?",
            "mock",
            None,
            None,
            "{}",
        )
        .expect("insert council session");
        upsert_council_judgment(
            &conn,
            &CouncilJudgment {
                id: None,
                council_session_id: session_id,
                before_judgment: Some("I need to inspect the evidence first.".to_string()),
                after_judgment: Some(
                    "The argument is stronger when citations are clear.".to_string(),
                ),
                personal_conclusion: Some(
                    "The user judgment remains distinct from AI synthesis.".to_string(),
                ),
                confidence: Some(65),
                changed_mind_note: Some("I weighted direct citations more heavily.".to_string()),
                open_questions: Some("How should tradition claims be tested?".to_string()),
                position_judgments: vec![PositionJudgment {
                    position_label: "Canonical authority".to_string(),
                    user_rating: "persuasive".to_string(),
                    user_weight: Some(0.8),
                    persuasive_evidence: Some("Cited passages were inspectable.".to_string()),
                    weak_points: None,
                    notes: Some("Keep this separate from the AI answer.".to_string()),
                }],
                created_at: None,
                updated_at: None,
            },
        )
        .expect("save council judgment");
        let workspace_id =
            create_study_workspace(&conn, "Doctrine workspace", None).expect("create workspace");
        add_study_item(
            &conn,
            workspace_id,
            "council_result",
            Some("Council: Scripture"),
            &serde_json::json!({
                "session_id": session_id,
                "question": "What is the doctrine of Scripture?"
            })
            .to_string(),
        )
        .expect("add council item");
        add_study_item(
            &conn,
            workspace_id,
            "council_session",
            Some("Duplicate Council session"),
            &serde_json::json!({
                "response": {
                    "session_id": session_id
                }
            })
            .to_string(),
        )
        .expect("add duplicate council item");

        let judgments =
            list_judgments_for_workspace(&conn, workspace_id).expect("list workspace judgments");

        assert_eq!(judgments.len(), 1);
        assert_eq!(judgments[0].council_session_id, session_id);
        assert_eq!(judgments[0].confidence, Some(65));
        assert_eq!(judgments[0].position_judgments.len(), 1);
        assert_eq!(
            judgments[0].position_judgments[0].position_label,
            "Canonical authority"
        );
    }

    #[test]
    fn delete_session_removes_learning_rows() {
        let conn = test_conn();
        let session_id = insert_session(
            &conn,
            "What makes one argument stronger than another?",
            "mock",
            None,
            None,
            "{}",
        )
        .expect("insert council session");
        upsert_council_judgment(
            &conn,
            &CouncilJudgment {
                id: None,
                council_session_id: session_id,
                before_judgment: Some("I need to inspect the process.".to_string()),
                after_judgment: Some("The better argument explains its evidence.".to_string()),
                personal_conclusion: Some("User judgment should remain reviewable.".to_string()),
                confidence: Some(70),
                changed_mind_note: None,
                open_questions: None,
                position_judgments: vec![PositionJudgment {
                    position_label: "Evidence-aware argument".to_string(),
                    user_rating: "persuasive".to_string(),
                    user_weight: None,
                    persuasive_evidence: Some("It names citations and limits.".to_string()),
                    weak_points: None,
                    notes: None,
                }],
                created_at: None,
                updated_at: None,
            },
        )
        .expect("save judgment");
        upsert_argument_annotation(
            &conn,
            &ArgumentAnnotation {
                id: None,
                council_session_id: session_id,
                node_id: "node-1".to_string(),
                annotation: "This step needs source checking.".to_string(),
                created_at: None,
                updated_at: None,
            },
        )
        .expect("save annotation");

        delete_session(&conn, session_id).expect("delete session");

        assert!(get_council_judgment(&conn, session_id)
            .expect("read judgment")
            .is_none());
        assert!(list_argument_annotations(&conn, session_id)
            .expect("list annotations")
            .is_empty());
        assert!(get_session(&conn, session_id)
            .expect("read session")
            .is_none());
    }

    #[test]
    fn user_data_export_omits_imported_resource_entry_bodies() {
        let conn = test_conn();
        let source_id = create_resource_source(
            &conn,
            &ResourceSource {
                id: None,
                slug: "large-resource-fixture".to_string(),
                title: "Large Resource Fixture".to_string(),
                source_url: Some("local fixture".to_string()),
                license: "Public Domain".to_string(),
                attribution: "Public-domain fixture source for backup export testing.".to_string(),
                version: Some("fixture-1".to_string()),
                imported_at: None,
                metadata_json: Some(
                    serde_json::json!({
                        "source_status": "user-imported",
                        "redistribution_permission": true
                    })
                    .to_string(),
                ),
            },
        )
        .expect("create resource source");
        let collection_id = create_resource_collection(
            &conn,
            &ResourceCollection {
                id: None,
                source_id,
                slug: "large-collection".to_string(),
                title: "Large Collection".to_string(),
                kind: "commentary".to_string(),
                metadata_json: Some("{}".to_string()),
            },
        )
        .expect("create resource collection");
        create_resource_entry(
            &conn,
            &ResourceEntry {
                id: None,
                collection_id,
                source_id: None,
                source_title: None,
                collection_title: None,
                collection_kind: None,
                ref_value: Some("Entry 1".to_string()),
                title: Some("Large imported entry".to_string()),
                body: "This imported body should not be duplicated into normal backups."
                    .to_string(),
                search_text: Some("large imported entry backup omission".to_string()),
                payload_json: Some("{}".to_string()),
                license: None,
                attribution: None,
                share_alike_requirements: None,
            },
        )
        .expect("create resource entry");

        let exported = export_user_data(&conn).expect("export user data");
        let tables = exported
            .get("tables")
            .and_then(serde_json::Value::as_object)
            .expect("tables object");
        assert_eq!(
            tables
                .get("resource_entries")
                .and_then(serde_json::Value::as_array)
                .map(Vec::len),
            Some(0)
        );
        assert_eq!(
            tables
                .get("resource_sources")
                .and_then(serde_json::Value::as_array)
                .map(Vec::len),
            Some(1)
        );
        assert_eq!(
            tables
                .get("resource_collections")
                .and_then(serde_json::Value::as_array)
                .map(Vec::len),
            Some(1)
        );
    }

    #[test]
    fn user_data_export_includes_guided_study_learning_fields() {
        let conn = test_conn();
        let topic_id = create_theology_topic(
            &conn,
            "Guided Export Topic",
            Some("Topic for guided study backup export coverage."),
            None,
        )
        .expect("create topic");
        let focus_question = "Which user-authored guided question is exported?";
        let review_cards = serde_json::json!([
            {
                "kind": "question",
                "prompt": "State the study question",
                "answer": focus_question
            },
            {
                "kind": "critique",
                "prompt": "What did the AI miss?",
                "answer": "The user critique must survive backup."
            }
        ])
        .to_string();
        upsert_guided_study_session(
            &conn,
            &GuidedStudySession {
                id: None,
                topic_id,
                template_slug: "theology-review".to_string(),
                focus_question: Some(focus_question.to_string()),
                before_response: Some("Before AI user reflection.".to_string()),
                after_response: Some("After AI user judgment.".to_string()),
                critique: Some("User-authored AI critique.".to_string()),
                review_cards_json: Some(review_cards.clone()),
                completed_at: Some("2026-05-07T09:00:00Z".to_string()),
                created_at: None,
                updated_at: None,
            },
        )
        .expect("save guided study");

        let exported = export_user_data(&conn).expect("export user data");
        assert_eq!(
            exported
                .get("user_schema_version")
                .and_then(serde_json::Value::as_i64),
            Some(USER_SCHEMA_VERSION)
        );
        let guided_rows = exported
            .get("tables")
            .and_then(|tables| tables.get("guided_study_sessions"))
            .and_then(serde_json::Value::as_array)
            .expect("guided study rows");
        let row = guided_rows
            .iter()
            .find(|row| {
                row.get("template_slug").and_then(serde_json::Value::as_str)
                    == Some("theology-review")
                    && row.get("topic_id").and_then(serde_json::Value::as_i64) == Some(topic_id)
            })
            .expect("exported guided study row");
        assert_eq!(
            row.get("focus_question")
                .and_then(serde_json::Value::as_str),
            Some(focus_question)
        );
        assert_eq!(
            row.get("review_cards_json")
                .and_then(serde_json::Value::as_str),
            Some(review_cards.as_str())
        );
    }

    #[test]
    fn duplicate_import_remaps_guided_study_topic_id() {
        let conn = test_conn();
        let old_topic_id = 10_001;
        let old_session_id = 10_002;
        let focus_question = "Which duplicate imported guided question was remapped?";
        let payload = serde_json::json!({
            "app": "Bible AI",
            "export_version": EXPORT_VERSION,
            "user_schema_version": USER_SCHEMA_VERSION,
            "exported_at": "2026-05-07T09:00:00Z",
            "tables": {
                "theology_topics": [
                    {
                        "id": old_topic_id,
                        "slug": "duplicate-guided-topic",
                        "title": "Duplicate Guided Topic",
                        "parent_id": null,
                        "summary": "Duplicate import should remap guided rows.",
                        "sort_order": 999,
                        "created_at": "2026-05-07T09:00:00Z",
                        "updated_at": "2026-05-07T09:00:00Z"
                    }
                ],
                "guided_study_sessions": [
                    {
                        "id": old_session_id,
                        "topic_id": old_topic_id,
                        "template_slug": "position-comparison",
                        "focus_question": focus_question,
                        "before_response": "Imported before reflection.",
                        "after_response": "Imported after judgment.",
                        "critique": "Imported critique.",
                        "review_cards_json": "[{\"kind\":\"question\",\"prompt\":\"State\",\"answer\":\"Remapped\"}]",
                        "completed_at": "2026-05-07T09:00:00Z",
                        "created_at": "2026-05-07T09:00:00Z",
                        "updated_at": "2026-05-07T09:00:00Z"
                    }
                ]
            }
        });

        let report = import_user_data(&conn, &payload, "duplicate").expect("duplicate import");
        assert_eq!(report.imported, 2);
        let imported_topic = list_theology_topics(&conn)
            .expect("list topics")
            .into_iter()
            .find(|topic| topic.title == "Duplicate Guided Topic")
            .expect("imported topic");
        assert_ne!(imported_topic.id, old_topic_id);
        let sessions = list_guided_study_sessions_for_topic(&conn, imported_topic.id)
            .expect("list guided sessions");
        assert_eq!(sessions.len(), 1);
        assert_eq!(sessions[0].template_slug, "position-comparison");
        assert_eq!(sessions[0].topic_id, imported_topic.id);
        assert_eq!(sessions[0].focus_question.as_deref(), Some(focus_question));
    }

    #[test]
    fn theology_export_includes_learning_history_context() {
        let conn = test_conn();
        let topic_id = create_theology_topic(
            &conn,
            "Export Learning Topic",
            Some("A doctrine topic used to verify learning exports."),
            None,
        )
        .expect("create topic");
        let related_topic_id = create_theology_topic(
            &conn,
            "Canon and Covenant",
            Some("A related doctrine topic used to verify doctrine map exports."),
            None,
        )
        .expect("create related topic");
        create_theology_link(
            &conn,
            &TheologyLink {
                id: None,
                topic_id,
                link_kind: "verse".to_string(),
                target_id: Some(1),
                title: Some("Genesis 1:1".to_string()),
                payload_json: Some(
                    serde_json::json!({
                        "citation": "Genesis 1:1",
                        "translation_code": "KJV",
                        "text": "In the beginning God created the heaven and the earth."
                    })
                    .to_string(),
                ),
                created_at: None,
            },
        )
        .expect("create theology passage link");
        create_theology_link(
            &conn,
            &TheologyLink {
                id: None,
                topic_id,
                link_kind: "workspace_item".to_string(),
                target_id: Some(42),
                title: Some("Workspace note on canon".to_string()),
                payload_json: Some(
                    serde_json::json!({
                        "workspace_title": "Canon study",
                        "body": "User-authored workspace note carried into Theology. OPENAI_API_KEY=TEST_THEOLOGY_LEAK_VALUE C:\\Users\\Tester\\BibleApp\\user.sqlite"
                    })
                    .to_string(),
                ),
                created_at: None,
            },
        )
        .expect("create theology workspace link");
        let resource_source_id = create_resource_source(
            &conn,
            &ResourceSource {
                id: None,
                slug: "share-alike-source".to_string(),
                title: "Share-Alike Theology Source".to_string(),
                source_url: Some("local fixture".to_string()),
                license: "CC BY-SA 4.0".to_string(),
                attribution: "Share-alike fixture attribution.".to_string(),
                version: Some("fixture-1".to_string()),
                imported_at: None,
                metadata_json: Some(
                    serde_json::json!({
                        "source_status": "user-imported",
                        "share_alike_requirements": "Redistributed excerpts must preserve CC BY-SA 4.0 terms."
                    })
                    .to_string(),
                ),
            },
        )
        .expect("create resource source");
        let resource_collection_id = create_resource_collection(
            &conn,
            &ResourceCollection {
                id: None,
                source_id: resource_source_id,
                slug: "doctrine-resources".to_string(),
                title: "Doctrine Resources".to_string(),
                kind: "commentary".to_string(),
                metadata_json: Some("{}".to_string()),
            },
        )
        .expect("create resource collection");
        let resource_entry_id = create_resource_entry(
            &conn,
            &ResourceEntry {
                id: None,
                collection_id: resource_collection_id,
                source_id: None,
                source_title: None,
                collection_title: None,
                collection_kind: None,
                ref_value: Some("Canon 1".to_string()),
                title: Some("Canon commentary".to_string()),
                body: "A resource excerpt used to test share-alike attribution.".to_string(),
                search_text: Some("canon commentary share alike".to_string()),
                payload_json: Some("{}".to_string()),
                license: None,
                attribution: None,
                share_alike_requirements: None,
            },
        )
        .expect("create resource entry");
        create_theology_link(
            &conn,
            &TheologyLink {
                id: None,
                topic_id,
                link_kind: "resource_entry".to_string(),
                target_id: Some(resource_entry_id),
                title: Some("Canon commentary".to_string()),
                payload_json: Some(
                    serde_json::json!({
                        "source": "Share-Alike Theology Source",
                        "snippet": "A resource excerpt used to test share-alike attribution."
                    })
                    .to_string(),
                ),
                created_at: None,
            },
        )
        .expect("create theology resource link");
        create_theology_link(
            &conn,
            &TheologyLink {
                id: None,
                topic_id,
                link_kind: "note".to_string(),
                target_id: Some(related_topic_id),
                title: Some("Tension with: Canon and Covenant".to_string()),
                payload_json: Some(
                    serde_json::json!({
                        "type": "doctrine_relation",
                        "relation": "tension",
                        "target_topic_id": related_topic_id,
                        "target_topic_title": "Canon and Covenant",
                        "note": "Canon and covenant claims should be compared without collapsing either topic."
                    })
                    .to_string(),
                ),
                created_at: None,
            },
        )
        .expect("create doctrine relation link");
        upsert_theology_position(
            &conn,
            &TheologyPosition {
                id: None,
                topic_id,
                label: "Canonical authority".to_string(),
                tradition_family: Some("Protestant".to_string()),
                summary: Some("Scripture functions as the rule for doctrine.".to_string()),
                strengths: Some("Keeps doctrine accountable to the canon.".to_string()),
                weaknesses: Some("Can flatten canon and tradition questions.".to_string()),
                sort_order: Some(1),
                created_at: None,
                updated_at: None,
            },
        )
        .expect("create theology position");
        upsert_theology_conclusion(
            &conn,
            &TheologyConclusion {
                id: None,
                topic_id,
                conclusion: Some("Scripture should govern the doctrine.".to_string()),
                confidence: Some(70),
                unresolved_questions: Some("How should canon questions be weighed?".to_string()),
                changed_over_time: Some(
                    "Moved from a flat proof-text answer to a canon-aware judgment.".to_string(),
                ),
                updated_at: None,
            },
        )
        .expect("save conclusion");
        upsert_guided_study_session(
            &conn,
            &GuidedStudySession {
                id: None,
                topic_id,
                template_slug: "position-comparison".to_string(),
                focus_question: Some("Which position best accounts for Scripture?".to_string()),
                before_response: Some("I assumed one position was obvious.".to_string()),
                after_response: Some("I now need to weigh evidence more carefully.".to_string()),
                critique: Some("Do not collapse tradition-specific concerns.".to_string()),
                review_cards_json: Some(
                    serde_json::json!([
                        {
                            "kind": "Linked passage",
                            "prompt": "What does Genesis 1:1 contribute to this doctrine?",
                            "answer": "It anchors the topic in creation and divine agency."
                        },
                        {
                            "kind": "User conclusion",
                            "prompt": "How did my conclusion change?",
                            "answer": "I moved toward a canon-aware judgment."
                        }
                    ])
                    .to_string(),
                ),
                completed_at: Some("2026-05-06T10:00:00Z".to_string()),
                created_at: None,
                updated_at: None,
            },
        )
        .expect("save guided study");

        let markdown =
            export_theology_markdown(&conn, Some(topic_id), false).expect("export markdown");

        assert!(markdown.contains("### Topic status"));
        assert!(markdown.contains("- Status: drafted"));
        assert!(markdown
            .contains("- Linked evidence: 1 passage(s), 1 resource(s), 0 Council session(s)"));
        assert!(markdown.contains("### Key study questions"));
        assert!(markdown.contains(
            "- **Which passages most directly support or challenge my current view of Export Learning Topic?** Start from the text before accepting a synthesis."
        ));
        assert!(markdown.contains(
            "- **What is the strongest alternative to Canonical authority?** A single saved position can hide dissent or unresolved interpretive options."
        ));
        assert!(markdown.contains("Open question count: 1"));
        assert!(markdown.contains("### Change history"));
        assert!(markdown.contains(
            "- User change note: Moved from a flat proof-text answer to a canon-aware judgment."
        ));
        assert!(markdown.contains("### Key passages"));
        assert!(markdown.contains(
            "- **Passage #1:** Genesis 1:1 — Genesis 1:1 - In the beginning God created"
        ));
        assert!(markdown.contains("### Workspace evidence"));
        assert!(markdown.contains(
            "- **Workspace item #42:** Workspace note on canon — User-authored workspace note"
        ));
        assert!(markdown.contains("[redacted secret]"));
        assert!(markdown.contains("[redacted local path]"));
        assert!(!markdown.contains("TEST_THEOLOGY_LEAK_VALUE"));
        assert!(!markdown.contains("C:\\Users\\Tester"));
        assert!(markdown.contains("### Linked resources"));
        assert!(markdown.contains("- **Resource #"));
        assert!(markdown.contains("### Doctrine map"));
        assert!(markdown.contains("- **Current topic:** Export Learning Topic"));
        assert!(markdown.contains(
            "- **Doctrine relation: Tension with Canon and Covenant:** Canon and covenant claims"
        ));
        assert!(markdown.contains("### Source attribution"));
        assert!(markdown
            .contains("Share-alike: Redistributed excerpts must preserve CC BY-SA 4.0 terms."));
        assert!(markdown.contains("#### Compare theological positions"));
        assert!(markdown.contains("_completed 2026-05-06T10:00:00Z; updated "));
        assert!(markdown.contains("**Question:**"));
        assert!(markdown.contains("Which position best accounts for Scripture?"));
        assert!(markdown.contains("**Study review cards:**"));
        assert!(markdown.contains(
            "- **Linked passage:** What does Genesis 1:1 contribute to this doctrine? — It anchors the topic in creation and divine agency."
        ));
    }
}

fn list_theology_topic_tree(conn: &Connection, root_id: i64) -> SqlResult<Vec<TheologyTopic>> {
    let topics = list_theology_topics(conn)?;
    let mut result = Vec::new();
    let mut stack = vec![root_id];
    while let Some(id) = stack.pop() {
        if let Some(topic) = topics.iter().find(|topic| topic.id == id) {
            result.push(topic.clone());
            let mut children = topics
                .iter()
                .filter(|candidate| candidate.parent_id == Some(id))
                .map(|candidate| candidate.id)
                .collect::<Vec<_>>();
            children.reverse();
            stack.extend(children);
        }
    }
    Ok(result)
}

fn guided_template_title(slug: &str) -> &str {
    match slug {
        "passage-study" => "Study a passage",
        "position-comparison" => "Compare theological positions",
        "theology-review" => "Review my theology",
        _ => "Build a doctrine topic",
    }
}

fn format_doctrine_relation(link: &TheologyLink) -> Option<String> {
    if link.link_kind != "note" {
        return None;
    }
    let payload: serde_json::Value = serde_json::from_str(link.payload_json.as_deref()?).ok()?;
    if payload.get("type")?.as_str()? != "doctrine_relation" {
        return None;
    }
    let relation = match payload.get("relation").and_then(serde_json::Value::as_str) {
        Some("supports") => "Supports",
        Some("tension") => "Tension with",
        _ => "Depends on",
    };
    let target = payload
        .get("target_topic_title")
        .and_then(serde_json::Value::as_str)
        .or(link.title.as_deref())
        .unwrap_or("related topic");
    let note = payload
        .get("note")
        .and_then(serde_json::Value::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty());
    Some(match note {
        Some(note) => format!("- **Doctrine relation: {relation} {target}:** {note}"),
        None => format!("- **Doctrine relation: {relation} {target}**"),
    })
}

#[derive(Serialize, Deserialize, Clone)]
pub struct GuidedStudySession {
    pub id: Option<i64>,
    pub topic_id: i64,
    pub template_slug: String,
    pub focus_question: Option<String>,
    pub before_response: Option<String>,
    pub after_response: Option<String>,
    pub critique: Option<String>,
    pub review_cards_json: Option<String>,
    pub completed_at: Option<String>,
    pub created_at: Option<String>,
    pub updated_at: Option<String>,
}

pub fn get_guided_study_session(
    conn: &Connection,
    topic_id: i64,
    template_slug: &str,
) -> SqlResult<Option<GuidedStudySession>> {
    conn.query_row(
        "SELECT id, topic_id, template_slug, focus_question, before_response, after_response, critique,
                review_cards_json, completed_at, created_at, updated_at
         FROM guided_study_sessions
         WHERE topic_id = ? AND template_slug = ?",
        params![topic_id, template_slug],
        |r| {
            Ok(GuidedStudySession {
                id: Some(r.get(0)?),
                topic_id: r.get(1)?,
                template_slug: r.get(2)?,
                focus_question: r.get(3)?,
                before_response: r.get(4)?,
                after_response: r.get(5)?,
                critique: r.get(6)?,
                review_cards_json: Some(r.get(7)?),
                completed_at: r.get(8)?,
                created_at: Some(r.get(9)?),
                updated_at: Some(r.get(10)?),
            })
        },
    )
    .optional()
}

pub fn list_guided_study_sessions_for_topic(
    conn: &Connection,
    topic_id: i64,
) -> SqlResult<Vec<GuidedStudySession>> {
    let mut stmt = conn.prepare(
        "SELECT id, topic_id, template_slug, focus_question, before_response, after_response, critique,
                review_cards_json, completed_at, created_at, updated_at
         FROM guided_study_sessions
         WHERE topic_id = ?
         ORDER BY completed_at IS NULL, completed_at DESC, updated_at DESC, template_slug",
    )?;
    let rows = stmt.query_map(params![topic_id], |r| {
        Ok(GuidedStudySession {
            id: Some(r.get(0)?),
            topic_id: r.get(1)?,
            template_slug: r.get(2)?,
            focus_question: r.get(3)?,
            before_response: r.get(4)?,
            after_response: r.get(5)?,
            critique: r.get(6)?,
            review_cards_json: Some(r.get(7)?),
            completed_at: r.get(8)?,
            created_at: Some(r.get(9)?),
            updated_at: Some(r.get(10)?),
        })
    })?;
    rows.collect()
}

pub fn upsert_guided_study_session(
    conn: &Connection,
    session: &GuidedStudySession,
) -> SqlResult<i64> {
    conn.execute(
        "INSERT INTO guided_study_sessions
           (topic_id, template_slug, focus_question, before_response, after_response, critique,
            review_cards_json, completed_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(topic_id, template_slug) DO UPDATE SET
           focus_question = excluded.focus_question,
           before_response = excluded.before_response,
           after_response = excluded.after_response,
           critique = excluded.critique,
           review_cards_json = excluded.review_cards_json,
           completed_at = excluded.completed_at,
           updated_at = datetime('now')",
        params![
            session.topic_id,
            session.template_slug.trim(),
            clean_optional(&session.focus_question),
            clean_optional(&session.before_response),
            clean_optional(&session.after_response),
            clean_optional(&session.critique),
            session.review_cards_json.as_deref().unwrap_or("[]"),
            session.completed_at,
        ],
    )?;
    conn.query_row(
        "SELECT id FROM guided_study_sessions WHERE topic_id = ? AND template_slug = ?",
        params![session.topic_id, session.template_slug.trim()],
        |r| r.get(0),
    )
}

#[derive(Serialize, Deserialize, Clone)]
pub struct ResourceSource {
    pub id: Option<i64>,
    pub slug: String,
    pub title: String,
    pub source_url: Option<String>,
    pub license: String,
    pub attribution: String,
    pub version: Option<String>,
    pub imported_at: Option<String>,
    pub metadata_json: Option<String>,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct ResourceCollection {
    pub id: Option<i64>,
    pub source_id: i64,
    pub slug: String,
    pub title: String,
    pub kind: String,
    pub metadata_json: Option<String>,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct ResourceEntry {
    pub id: Option<i64>,
    pub collection_id: i64,
    pub source_id: Option<i64>,
    pub source_title: Option<String>,
    pub collection_title: Option<String>,
    pub collection_kind: Option<String>,
    pub ref_value: Option<String>,
    pub title: Option<String>,
    pub body: String,
    pub search_text: Option<String>,
    pub payload_json: Option<String>,
    pub license: Option<String>,
    pub attribution: Option<String>,
    pub share_alike_requirements: Option<String>,
}

#[derive(Serialize, Clone)]
pub struct ResourceAttribution {
    pub source_id: i64,
    pub title: String,
    pub license: String,
    pub attribution: String,
    pub share_alike_requirements: Option<String>,
}

pub fn list_resource_sources(conn: &Connection) -> SqlResult<Vec<ResourceSource>> {
    let mut stmt = conn.prepare(
        "SELECT id, slug, title, source_url, license, attribution, version, imported_at, metadata_json
         FROM resource_sources
         ORDER BY title",
    )?;
    let rows = stmt.query_map([], |r| {
        Ok(ResourceSource {
            id: Some(r.get(0)?),
            slug: r.get(1)?,
            title: r.get(2)?,
            source_url: r.get(3)?,
            license: r.get(4)?,
            attribution: r.get(5)?,
            version: r.get(6)?,
            imported_at: Some(r.get(7)?),
            metadata_json: Some(r.get(8)?),
        })
    })?;
    rows.collect()
}

pub fn list_resource_collections(
    conn: &Connection,
    source_id: Option<i64>,
) -> SqlResult<Vec<ResourceCollection>> {
    let mut stmt = conn.prepare(
        "SELECT id, source_id, slug, title, kind, metadata_json
         FROM resource_collections
         WHERE (? IS NULL OR source_id = ?)
         ORDER BY kind, title",
    )?;
    let rows = stmt.query_map(params![source_id, source_id], |r| {
        Ok(ResourceCollection {
            id: Some(r.get(0)?),
            source_id: r.get(1)?,
            slug: r.get(2)?,
            title: r.get(3)?,
            kind: r.get(4)?,
            metadata_json: Some(r.get(5)?),
        })
    })?;
    rows.collect()
}

pub fn create_resource_source(conn: &Connection, source: &ResourceSource) -> SqlResult<i64> {
    conn.execute(
        "INSERT INTO resource_sources
           (slug, title, source_url, license, attribution, version, metadata_json)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(slug) DO UPDATE SET
           title = excluded.title,
           source_url = excluded.source_url,
           license = excluded.license,
           attribution = excluded.attribution,
           version = excluded.version,
           metadata_json = excluded.metadata_json",
        params![
            source.slug.trim(),
            source.title.trim(),
            clean_optional(&source.source_url),
            source.license.trim(),
            source.attribution.trim(),
            clean_optional(&source.version),
            source.metadata_json.as_deref().unwrap_or("{}"),
        ],
    )?;
    conn.query_row(
        "SELECT id FROM resource_sources WHERE slug = ?",
        params![source.slug.trim()],
        |r| r.get(0),
    )
}

pub fn create_resource_collection(
    conn: &Connection,
    collection: &ResourceCollection,
) -> SqlResult<i64> {
    conn.execute(
        "INSERT INTO resource_collections (source_id, slug, title, kind, metadata_json)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(source_id, slug) DO UPDATE SET
           title = excluded.title,
           kind = excluded.kind,
           metadata_json = excluded.metadata_json",
        params![
            collection.source_id,
            collection.slug.trim(),
            collection.title.trim(),
            collection.kind.trim(),
            collection.metadata_json.as_deref().unwrap_or("{}"),
        ],
    )?;
    conn.query_row(
        "SELECT id FROM resource_collections WHERE source_id = ? AND slug = ?",
        params![collection.source_id, collection.slug.trim()],
        |r| r.get(0),
    )
}

pub fn create_resource_entry(conn: &Connection, entry: &ResourceEntry) -> SqlResult<i64> {
    let search_text = entry
        .search_text
        .as_deref()
        .unwrap_or(&entry.body)
        .trim()
        .to_string();
    conn.execute(
        "INSERT INTO resource_entries (collection_id, ref, title, body, search_text, payload_json)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(collection_id, title) DO UPDATE SET
           ref = excluded.ref,
           body = excluded.body,
           search_text = excluded.search_text,
           payload_json = excluded.payload_json",
        params![
            entry.collection_id,
            clean_optional(&entry.ref_value),
            clean_optional(&entry.title),
            entry.body.trim(),
            search_text,
            entry.payload_json.as_deref().unwrap_or("{}"),
        ],
    )?;
    let id: i64 = conn.query_row(
        "SELECT id FROM resource_entries WHERE collection_id = ? AND title IS ?",
        params![entry.collection_id, clean_optional(&entry.title)],
        |r| r.get(0),
    )?;
    conn.execute(
        "INSERT OR REPLACE INTO resource_entries_fts(rowid, title, search_text)
         SELECT id, COALESCE(title, ''), search_text FROM resource_entries WHERE id = ?",
        params![id],
    )?;
    Ok(id)
}

pub fn search_resources(
    conn: &Connection,
    query: &str,
    source_id: Option<i64>,
    collection_kind: Option<&str>,
    license: Option<&str>,
    topic_id: Option<i64>,
    limit: i64,
) -> SqlResult<Vec<ResourceEntry>> {
    let q = query.trim();
    let collection_kind = collection_kind
        .map(str::trim)
        .filter(|value| !value.is_empty());
    let license = license.map(str::trim).filter(|value| !value.is_empty());
    if q.is_empty() {
        return list_recent_resource_entries(
            conn,
            source_id,
            collection_kind,
            license,
            topic_id,
            limit,
        );
    }
    let fts_query = resource_fts_query(q);
    if fts_query.is_empty() {
        return list_recent_resource_entries(
            conn,
            source_id,
            collection_kind,
            license,
            topic_id,
            limit,
        );
    }
    let mut stmt = conn.prepare(
        "SELECT e.id, e.collection_id, s.id, s.title, c.title, c.kind, e.ref, e.title, e.body,
                e.search_text, e.payload_json, s.license, s.attribution, s.metadata_json
         FROM resource_entries e
         JOIN resource_collections c ON c.id = e.collection_id
         JOIN resource_sources s ON s.id = c.source_id
         JOIN resource_entries_fts ON resource_entries_fts.rowid = e.id
         WHERE (? IS NULL OR s.id = ?)
           AND (? IS NULL OR c.kind = ?)
           AND (? IS NULL OR s.license = ?)
           AND (
             ? IS NULL OR EXISTS (
               SELECT 1 FROM theology_links tl
               WHERE tl.topic_id = ?
                 AND tl.link_kind = 'resource_entry'
                 AND tl.target_id = e.id
             )
           )
           AND resource_entries_fts MATCH ?
         ORDER BY bm25(resource_entries_fts), e.title, e.id
         LIMIT ?",
    )?;
    let rows = stmt.query_map(
        params![
            source_id,
            source_id,
            collection_kind,
            collection_kind,
            license,
            license,
            topic_id,
            topic_id,
            fts_query,
            limit
        ],
        |r| read_resource_entry_row(r),
    )?;
    rows.collect()
}

fn resource_fts_query(query: &str) -> String {
    query
        .split_whitespace()
        .map(|term| {
            term.trim_matches(|c: char| !c.is_alphanumeric())
                .replace('"', "\"\"")
        })
        .filter(|term| !term.is_empty())
        .map(|term| format!("\"{term}\"*"))
        .collect::<Vec<_>>()
        .join(" ")
}

pub fn get_resource_entry(conn: &Connection, id: i64) -> SqlResult<Option<ResourceEntry>> {
    conn.query_row(
        "SELECT e.id, e.collection_id, s.id, s.title, c.title, c.kind, e.ref, e.title, e.body,
                e.search_text, e.payload_json, s.license, s.attribution, s.metadata_json
         FROM resource_entries e
         JOIN resource_collections c ON c.id = e.collection_id
         JOIN resource_sources s ON s.id = c.source_id
         WHERE e.id = ?",
        params![id],
        |r| read_resource_entry_row(r),
    )
    .optional()
}

fn list_recent_resource_entries(
    conn: &Connection,
    source_id: Option<i64>,
    collection_kind: Option<&str>,
    license: Option<&str>,
    topic_id: Option<i64>,
    limit: i64,
) -> SqlResult<Vec<ResourceEntry>> {
    let mut stmt = conn.prepare(
        "SELECT e.id, e.collection_id, s.id, s.title, c.title, c.kind, e.ref, e.title, e.body,
                e.search_text, e.payload_json, s.license, s.attribution, s.metadata_json
         FROM resource_entries e
         JOIN resource_collections c ON c.id = e.collection_id
         JOIN resource_sources s ON s.id = c.source_id
         WHERE (? IS NULL OR s.id = ?)
           AND (? IS NULL OR c.kind = ?)
           AND (? IS NULL OR s.license = ?)
           AND (
             ? IS NULL OR EXISTS (
               SELECT 1 FROM theology_links tl
               WHERE tl.topic_id = ?
                 AND tl.link_kind = 'resource_entry'
                 AND tl.target_id = e.id
             )
           )
         ORDER BY e.id DESC
         LIMIT ?",
    )?;
    let rows = stmt.query_map(
        params![
            source_id,
            source_id,
            collection_kind,
            collection_kind,
            license,
            license,
            topic_id,
            topic_id,
            limit
        ],
        |r| read_resource_entry_row(r),
    )?;
    rows.collect()
}

fn read_resource_entry_row(r: &rusqlite::Row<'_>) -> SqlResult<ResourceEntry> {
    let metadata_json: String = r.get(13)?;
    Ok(ResourceEntry {
        id: Some(r.get(0)?),
        collection_id: r.get(1)?,
        source_id: Some(r.get(2)?),
        source_title: Some(r.get(3)?),
        collection_title: Some(r.get(4)?),
        collection_kind: Some(r.get(5)?),
        ref_value: r.get(6)?,
        title: r.get(7)?,
        body: r.get(8)?,
        search_text: Some(r.get(9)?),
        payload_json: Some(r.get(10)?),
        license: Some(r.get(11)?),
        attribution: Some(r.get(12)?),
        share_alike_requirements: resource_share_alike_requirements(&metadata_json),
    })
}

fn resource_attributions_for_entries(
    conn: &Connection,
    entry_ids: &[i64],
) -> SqlResult<Vec<ResourceAttribution>> {
    if entry_ids.is_empty() {
        return Ok(Vec::new());
    }
    let mut seen = std::collections::HashSet::new();
    let mut items = Vec::new();
    for entry_id in entry_ids {
        let attribution = conn
            .query_row(
                "SELECT s.id, s.title, s.license, s.attribution, s.metadata_json
                 FROM resource_entries e
                 JOIN resource_collections c ON c.id = e.collection_id
                 JOIN resource_sources s ON s.id = c.source_id
                 WHERE e.id = ?",
                params![entry_id],
                |r| {
                    let metadata_json: String = r.get(4)?;
                    Ok(ResourceAttribution {
                        source_id: r.get(0)?,
                        title: r.get(1)?,
                        license: r.get(2)?,
                        attribution: r.get(3)?,
                        share_alike_requirements: resource_share_alike_requirements(&metadata_json),
                    })
                },
            )
            .optional()?;
        if let Some(attribution) = attribution {
            if seen.insert(attribution.source_id) {
                items.push(attribution);
            }
        }
    }
    Ok(items)
}

fn resource_share_alike_requirements(metadata_json: &str) -> Option<String> {
    let metadata: serde_json::Value = serde_json::from_str(metadata_json).ok()?;
    for key in ["share_alike_requirements", "shareAlikeRequirements"] {
        if let Some(value) = metadata
            .get(key)
            .and_then(serde_json::Value::as_str)
            .map(str::trim)
            .filter(|value| !value.is_empty())
        {
            return Some(value.to_string());
        }
    }
    metadata
        .get("metadata")
        .and_then(|nested| nested.get("share_alike_requirements"))
        .and_then(serde_json::Value::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(ToOwned::to_owned)
}

#[derive(Serialize, Deserialize, Clone)]
pub struct ArgumentAnnotation {
    pub id: Option<i64>,
    pub council_session_id: i64,
    pub node_id: String,
    pub annotation: String,
    pub created_at: Option<String>,
    pub updated_at: Option<String>,
}

pub fn list_argument_annotations(
    conn: &Connection,
    council_session_id: i64,
) -> SqlResult<Vec<ArgumentAnnotation>> {
    let mut stmt = conn.prepare(
        "SELECT id, council_session_id, node_id, annotation, created_at, updated_at
         FROM argument_annotations
         WHERE council_session_id = ?
         ORDER BY updated_at DESC, id DESC",
    )?;
    let rows = stmt.query_map(params![council_session_id], |r| {
        Ok(ArgumentAnnotation {
            id: Some(r.get(0)?),
            council_session_id: r.get(1)?,
            node_id: r.get(2)?,
            annotation: r.get(3)?,
            created_at: Some(r.get(4)?),
            updated_at: Some(r.get(5)?),
        })
    })?;
    rows.collect()
}

pub fn upsert_argument_annotation(
    conn: &Connection,
    annotation: &ArgumentAnnotation,
) -> SqlResult<i64> {
    let body = annotation.annotation.trim();
    conn.execute(
        "INSERT INTO argument_annotations (council_session_id, node_id, annotation)
         VALUES (?, ?, ?)
         ON CONFLICT(council_session_id, node_id) DO UPDATE SET
           annotation = excluded.annotation,
           updated_at = datetime('now')",
        params![
            annotation.council_session_id,
            annotation.node_id.trim(),
            body
        ],
    )?;
    conn.query_row(
        "SELECT id FROM argument_annotations WHERE council_session_id = ? AND node_id = ?",
        params![annotation.council_session_id, annotation.node_id.trim()],
        |r| r.get(0),
    )
}

pub fn delete_argument_annotation(conn: &Connection, id: i64) -> SqlResult<usize> {
    conn.execute("DELETE FROM argument_annotations WHERE id = ?", params![id])
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
    if table == "resource_entries" {
        return Ok(serde_json::Value::Array(Vec::new()));
    }

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
    let mut council_session_id_map = std::collections::HashMap::<i64, i64>::new();
    let mut council_judgment_id_map = std::collections::HashMap::<i64, i64>::new();
    let mut theology_topic_id_map = std::collections::HashMap::<i64, i64>::new();
    let mut resource_source_id_map = std::collections::HashMap::<i64, i64>::new();
    let mut resource_collection_id_map = std::collections::HashMap::<i64, i64>::new();
    let mut resource_entry_id_map = std::collections::HashMap::<i64, i64>::new();
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
                prepare_duplicate_row(
                    conn,
                    table,
                    &mut row,
                    &workspace_id_map,
                    &council_session_id_map,
                    &council_judgment_id_map,
                    &theology_topic_id_map,
                    &resource_source_id_map,
                    &resource_collection_id_map,
                    &resource_entry_id_map,
                    &module_id_map,
                )?;
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
                } else if *table == "council_sessions" {
                    if let Some(old_id) = old_id {
                        council_session_id_map.insert(old_id, conn.last_insert_rowid());
                    }
                } else if *table == "council_judgments" {
                    if let Some(old_id) = old_id {
                        council_judgment_id_map.insert(old_id, conn.last_insert_rowid());
                    }
                } else if *table == "theology_topics" {
                    if let Some(old_id) = old_id {
                        theology_topic_id_map.insert(old_id, conn.last_insert_rowid());
                    }
                } else if *table == "resource_sources" {
                    if let Some(old_id) = old_id {
                        resource_source_id_map.insert(old_id, conn.last_insert_rowid());
                    }
                } else if *table == "resource_collections" {
                    if let Some(old_id) = old_id {
                        resource_collection_id_map.insert(old_id, conn.last_insert_rowid());
                    }
                } else if *table == "resource_entries" {
                    if let Some(old_id) = old_id {
                        resource_entry_id_map.insert(old_id, conn.last_insert_rowid());
                    }
                } else if *table == "modules" {
                    if let Some(old_id) = old_id {
                        module_id_map.insert(old_id, conn.last_insert_rowid());
                    }
                }
            }
        }
    }
    if tables.contains_key("resource_entries") {
        rebuild_resource_entries_fts(conn).map_err(|e| e.to_string())?;
    }
    Ok(report)
}

fn rebuild_resource_entries_fts(conn: &Connection) -> SqlResult<()> {
    conn.execute("DELETE FROM resource_entries_fts", [])?;
    conn.execute(
        "INSERT INTO resource_entries_fts(rowid, title, search_text)
         SELECT id, COALESCE(title, ''), search_text FROM resource_entries",
        [],
    )?;
    Ok(())
}

fn prepare_duplicate_row(
    conn: &Connection,
    table: &str,
    row: &mut serde_json::Map<String, serde_json::Value>,
    workspace_id_map: &std::collections::HashMap<i64, i64>,
    council_session_id_map: &std::collections::HashMap<i64, i64>,
    council_judgment_id_map: &std::collections::HashMap<i64, i64>,
    theology_topic_id_map: &std::collections::HashMap<i64, i64>,
    resource_source_id_map: &std::collections::HashMap<i64, i64>,
    resource_collection_id_map: &std::collections::HashMap<i64, i64>,
    resource_entry_id_map: &std::collections::HashMap<i64, i64>,
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
        "council_judgments" => {
            let old = row
                .get("council_session_id")
                .and_then(serde_json::Value::as_i64)
                .ok_or_else(|| "council_judgments row requires council_session_id".to_string())?;
            let new = council_session_id_map
                .get(&old)
                .copied()
                .ok_or_else(|| format!("no imported council session mapping for id {old}"))?;
            row.insert("council_session_id".to_string(), serde_json::json!(new));
        }
        "council_position_judgments" => {
            let old = row
                .get("council_judgment_id")
                .and_then(serde_json::Value::as_i64)
                .ok_or_else(|| {
                    "council_position_judgments row requires council_judgment_id".to_string()
                })?;
            let new = council_judgment_id_map
                .get(&old)
                .copied()
                .ok_or_else(|| format!("no imported council judgment mapping for id {old}"))?;
            row.insert("council_judgment_id".to_string(), serde_json::json!(new));
        }
        "argument_annotations" => {
            let old = row
                .get("council_session_id")
                .and_then(serde_json::Value::as_i64)
                .ok_or_else(|| {
                    "argument_annotations row requires council_session_id".to_string()
                })?;
            let new = council_session_id_map
                .get(&old)
                .copied()
                .ok_or_else(|| format!("no imported council session mapping for id {old}"))?;
            row.insert("council_session_id".to_string(), serde_json::json!(new));
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
        "resource_sources" => prepare_duplicate_resource_slug(conn, row)?,
        "resource_collections" => {
            let old = row
                .get("source_id")
                .and_then(serde_json::Value::as_i64)
                .ok_or_else(|| "resource_collections row requires source_id".to_string())?;
            let new = resource_source_id_map
                .get(&old)
                .copied()
                .ok_or_else(|| format!("no imported resource source mapping for id {old}"))?;
            row.insert("source_id".to_string(), serde_json::json!(new));
        }
        "resource_entries" => {
            let old = row
                .get("collection_id")
                .and_then(serde_json::Value::as_i64)
                .ok_or_else(|| "resource_entries row requires collection_id".to_string())?;
            let new = resource_collection_id_map
                .get(&old)
                .copied()
                .ok_or_else(|| format!("no imported resource collection mapping for id {old}"))?;
            row.insert("collection_id".to_string(), serde_json::json!(new));
        }
        "theology_topics" => prepare_duplicate_theology_slug(conn, row)?,
        "theology_positions"
        | "theology_conclusions"
        | "theology_links"
        | "guided_study_sessions" => {
            let old = row
                .get("topic_id")
                .and_then(serde_json::Value::as_i64)
                .ok_or_else(|| format!("{table} row requires topic_id"))?;
            let new = theology_topic_id_map
                .get(&old)
                .copied()
                .ok_or_else(|| format!("no imported theology topic mapping for id {old}"))?;
            row.insert("topic_id".to_string(), serde_json::json!(new));
            if table == "theology_links"
                && row.get("link_kind").and_then(serde_json::Value::as_str)
                    == Some("resource_entry")
            {
                if let Some(old_target) = row.get("target_id").and_then(serde_json::Value::as_i64) {
                    if let Some(new_target) = resource_entry_id_map.get(&old_target).copied() {
                        row.insert("target_id".to_string(), serde_json::json!(new_target));
                    }
                }
            }
        }
        _ => {}
    }
    Ok(())
}

fn prepare_duplicate_theology_slug(
    conn: &Connection,
    row: &mut serde_json::Map<String, serde_json::Value>,
) -> Result<(), String> {
    let Some(slug) = row.get("slug").and_then(serde_json::Value::as_str) else {
        return Ok(());
    };
    if !theology_slug_exists(conn, slug).map_err(|e| e.to_string())? {
        return Ok(());
    }
    let base = slug.trim();
    let mut counter = 1;
    loop {
        let candidate = format!("{base}-import-{counter}");
        if !theology_slug_exists(conn, &candidate).map_err(|e| e.to_string())? {
            row.insert("slug".to_string(), serde_json::Value::String(candidate));
            return Ok(());
        }
        counter += 1;
    }
}

fn prepare_duplicate_resource_slug(
    conn: &Connection,
    row: &mut serde_json::Map<String, serde_json::Value>,
) -> Result<(), String> {
    let Some(slug) = row.get("slug").and_then(serde_json::Value::as_str) else {
        return Ok(());
    };
    if !resource_slug_exists(conn, slug).map_err(|e| e.to_string())? {
        return Ok(());
    }
    let base = slug.trim();
    let mut counter = 1;
    loop {
        let candidate = format!("{base}-import-{counter}");
        if !resource_slug_exists(conn, &candidate).map_err(|e| e.to_string())? {
            row.insert("slug".to_string(), serde_json::Value::String(candidate));
            return Ok(());
        }
        counter += 1;
    }
}

fn resource_slug_exists(conn: &Connection, slug: &str) -> SqlResult<bool> {
    conn.query_row(
        "SELECT EXISTS(SELECT 1 FROM resource_sources WHERE slug = ?)",
        params![slug],
        |r| r.get::<_, i64>(0),
    )
    .map(|value| value != 0)
}

fn theology_slug_exists(conn: &Connection, slug: &str) -> SqlResult<bool> {
    conn.query_row(
        "SELECT EXISTS(SELECT 1 FROM theology_topics WHERE slug = ?)",
        params![slug],
        |r| r.get::<_, i64>(0),
    )
    .map(|value| value != 0)
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
