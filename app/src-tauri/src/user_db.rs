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

pub const USER_SCHEMA_VERSION: i64 = 14;
const EXPORT_VERSION: i64 = 1;
// Import budgets, enforced before any transaction starts so an oversized or
// malformed backup cannot lock the DB and grind through a huge transaction
// before failing. Generous for real personal study data; they only bound the
// pathological/abusive case.
const MAX_IMPORT_ROWS_PER_TABLE: usize = 50_000;
const MAX_IMPORT_ROWS_TOTAL: usize = 200_000;
const MAX_IMPORT_TEXT_FIELD_CHARS: usize = 2_000_000;
pub const USER_TABLES: &[&str] = &[
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
    "guided_study_sessions",
    "modules",
    "module_entries",
    "study_workspaces",
    "study_items",
    // Imported last: theology_links.target_id may reference council sessions
    // or study items, which must be imported (and id-remapped) first under
    // the "duplicate" conflict strategy.
    "theology_links",
    "bookmarks",
    "reading_history",
    "saved_searches",
    // tags before item_tags; item_tags references tags + bookmarks + study_items, so it is imported last.
    "tags",
    "item_tags",
];
const APP_SETTING_KEYS: &[&str] = &[
    "managed_gateway_url",
    "claude_model",
    "openai_model",
    "gemini_model",
    "anthropic_model",
    "ollama_host",
    "retrieval_translation",
    "active_translations",
    "font_scale",
    "reader_layout",
    "reader_density",
    "sync_scroll",
    "search_strategy",
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

CREATE TABLE IF NOT EXISTS tags (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE COLLATE NOCASE,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS item_tags (
  tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  item_type TEXT NOT NULL CHECK (item_type IN ('bookmark', 'note', 'range_note', 'study_item')),
  item_id INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (tag_id, item_type, item_id)
);

CREATE INDEX IF NOT EXISTS idx_item_tags_item ON item_tags(item_type, item_id);
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
    // Seed the built-in doctrine topics once. This runs on every open, so it
    // must DO NOTHING on conflict — these topics are user-editable, and an
    // upsert would silently revert a user's renamed title or reordering on
    // the next launch.
    for (slug, title, summary, sort_order) in TOPICS {
        conn.execute(
            "INSERT INTO theology_topics (slug, title, summary, sort_order)
             VALUES (?, ?, ?, ?)
             ON CONFLICT(slug) DO NOTHING",
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
    pub search_strategy: Option<String>,
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
        search_strategy: get_setting(conn, "search_strategy")?,
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
    upsert_setting(conn, "search_strategy", settings.search_strategy.as_deref())?;
    Ok(())
}

pub fn delete_secret_settings(conn: &Connection) -> SqlResult<()> {
    conn.pragma_update(None, "secure_delete", "ON")?;
    let keys = {
        let mut stmt = conn.prepare("SELECT key FROM app_settings")?;
        let rows = stmt.query_map([], |r| r.get::<_, String>(0))?;
        rows.collect::<SqlResult<Vec<_>>>()?
    };
    let mut deleted = 0;
    for key in keys.iter().filter(|key| is_secret_setting_key(key)) {
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
    let title = title.trim();
    if title.is_empty() {
        return Err(rusqlite::Error::InvalidQuery);
    }
    conn.execute(
        "INSERT INTO study_workspaces (title, description) VALUES (?, ?)",
        params![title, description.map(str::trim)],
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
    let title = title.trim();
    if title.is_empty() {
        return Err(rusqlite::Error::InvalidQuery);
    }
    conn.execute(
        "UPDATE study_workspaces
         SET title = ?, description = ?, archived_at = CASE WHEN ? THEN COALESCE(archived_at, datetime('now')) ELSE NULL END,
             updated_at = datetime('now')
         WHERE id = ?",
        params![title, description.map(str::trim), archived, id],
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
    let kind = kind.trim();
    if !is_supported_study_item_kind(kind) {
        return Err(rusqlite::Error::InvalidQuery);
    }
    let payload_json = clean_required_json_payload(payload_json, false)?;
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
    let payload_json = match payload_json {
        Some(value) => Some(clean_required_json_payload(value, false)?),
        None => None,
    };
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

fn is_supported_study_item_kind(kind: &str) -> bool {
    matches!(
        kind,
        "verse"
            | "verse_range"
            | "note"
            | "search_hit"
            | "search"
            | "council_session"
            | "council_result"
            | "explanation"
            | "module_entry"
            | "freeform"
    )
}

pub fn delete_study_item(conn: &Connection, id: i64) -> SqlResult<usize> {
    let workspace_id = conn
        .query_row(
            "SELECT workspace_id FROM study_items WHERE id = ?",
            params![id],
            |r| r.get::<_, i64>(0),
        )
        .optional()?;
    let Some(workspace_id) = workspace_id else {
        return Ok(0);
    };
    let changed = conn.execute("DELETE FROM study_items WHERE id = ?", params![id])?;
    if changed > 0 {
        conn.execute(
            "UPDATE study_workspaces SET updated_at = datetime('now') WHERE id = ?",
            params![workspace_id],
        )?;
    }
    Ok(changed)
}

pub fn reorder_study_items(
    conn: &Connection,
    workspace_id: i64,
    item_ids: &[i64],
) -> SqlResult<()> {
    let unique_ids = item_ids.iter().collect::<std::collections::HashSet<_>>();
    if unique_ids.len() != item_ids.len() {
        return Err(rusqlite::Error::InvalidQuery);
    }
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
    let label = label.map(str::trim).filter(|value| !value.is_empty());
    let Some(end_verse_id) = end_verse_id else {
        let changed = conn.execute(
            "UPDATE bookmarks
             SET label = ?, created_at = datetime('now')
             WHERE verse_id = ? AND end_verse_id IS NULL",
            params![label, verse_id],
        )?;
        if changed == 0 {
            conn.execute(
                "INSERT INTO bookmarks (verse_id, end_verse_id, label)
                 VALUES (?, NULL, ?)",
                params![verse_id, label],
            )?;
        }
        return conn.query_row(
            "SELECT id FROM bookmarks
             WHERE verse_id = ? AND end_verse_id IS NULL
             ORDER BY datetime(created_at) DESC, id DESC
             LIMIT 1",
            params![verse_id],
            |r| r.get(0),
        );
    };

    conn.execute(
        "INSERT INTO bookmarks (verse_id, end_verse_id, label)
         VALUES (?, ?, ?)
         ON CONFLICT(verse_id, end_verse_id) DO UPDATE SET
           label = excluded.label,
           created_at = datetime('now')",
        params![verse_id, end_verse_id, label],
    )?;
    conn.query_row(
        "SELECT id FROM bookmarks WHERE verse_id = ? AND end_verse_id = ?",
        params![verse_id, end_verse_id],
        |r| r.get(0),
    )
}

pub fn delete_bookmark(conn: &Connection, id: i64) -> SqlResult<usize> {
    conn.execute(
        "DELETE FROM item_tags WHERE item_type = 'bookmark' AND item_id = ?",
        params![id],
    )?;
    conn.execute("DELETE FROM bookmarks WHERE id = ?", params![id])
}

// ---------- Tags ----------

#[derive(Serialize, Clone)]
pub struct Tag {
    pub id: i64,
    pub name: String,
    pub created_at: String,
}

#[derive(Serialize, Clone)]
pub struct ItemTag {
    pub item_id: i64,
    pub tag_id: i64,
    pub name: String,
}

#[derive(Serialize, Clone)]
pub struct TagCount {
    pub id: i64,
    pub name: String,
    pub count: i64,
}

#[derive(Serialize, Clone)]
pub struct TaggedItemRaw {
    pub item_type: String,
    pub item_id: i64,
    pub verse_id: i64,
    pub text: Option<String>,
}

/// Find-or-create a tag by (case-insensitive) name. Returns the existing or new row.
pub fn create_tag(conn: &Connection, name: &str) -> SqlResult<Tag> {
    let name = name.trim();
    if name.is_empty() {
        // Mirror the existing blank-field rejection convention used by insert_session.
        return Err(rusqlite::Error::InvalidQuery);
    }
    conn.execute(
        "INSERT INTO tags (name) VALUES (?) ON CONFLICT(name) DO NOTHING",
        params![name],
    )?;
    conn.query_row(
        "SELECT id, name, created_at FROM tags WHERE name = ?",
        params![name],
        |r| {
            Ok(Tag {
                id: r.get(0)?,
                name: r.get(1)?,
                created_at: r.get(2)?,
            })
        },
    )
}

pub fn list_tags(conn: &Connection) -> SqlResult<Vec<Tag>> {
    let mut stmt =
        conn.prepare("SELECT id, name, created_at FROM tags ORDER BY name COLLATE NOCASE")?;
    let rows = stmt.query_map([], |r| {
        Ok(Tag {
            id: r.get(0)?,
            name: r.get(1)?,
            created_at: r.get(2)?,
        })
    })?;
    rows.collect()
}

pub fn delete_tag(conn: &Connection, id: i64) -> SqlResult<usize> {
    // ON DELETE CASCADE removes the item_tags links.
    conn.execute("DELETE FROM tags WHERE id = ?", params![id])
}

pub fn tag_item(conn: &Connection, tag_id: i64, item_type: &str, item_id: i64) -> SqlResult<usize> {
    conn.execute(
        "INSERT INTO item_tags (tag_id, item_type, item_id) VALUES (?, ?, ?)
         ON CONFLICT DO NOTHING",
        params![tag_id, item_type, item_id],
    )
}

pub fn untag_item(
    conn: &Connection,
    tag_id: i64,
    item_type: &str,
    item_id: i64,
) -> SqlResult<usize> {
    conn.execute(
        "DELETE FROM item_tags WHERE tag_id = ? AND item_type = ? AND item_id = ?",
        params![tag_id, item_type, item_id],
    )
}

pub fn list_item_tags(conn: &Connection, item_type: &str) -> SqlResult<Vec<ItemTag>> {
    let mut stmt = conn.prepare(
        "SELECT it.item_id, t.id, t.name
         FROM item_tags it JOIN tags t ON t.id = it.tag_id
         WHERE it.item_type = ?
         ORDER BY it.item_id, t.name COLLATE NOCASE",
    )?;
    let rows = stmt.query_map(params![item_type], |r| {
        Ok(ItemTag {
            item_id: r.get(0)?,
            tag_id: r.get(1)?,
            name: r.get(2)?,
        })
    })?;
    rows.collect()
}

pub fn list_tags_with_counts(conn: &Connection) -> SqlResult<Vec<TagCount>> {
    // Count only links whose underlying item still exists, so the count always
    // agrees with list_tagged_items (which JOINs the item tables). A raw
    // COUNT over item_tags would include orphaned links and disagree with the
    // visible items.
    let mut stmt = conn.prepare(
        "SELECT t.id, t.name, (
             SELECT COUNT(*) FROM item_tags it
             WHERE it.tag_id = t.id AND (
                 (it.item_type = 'bookmark'
                  AND EXISTS (SELECT 1 FROM bookmarks b WHERE b.id = it.item_id))
              OR (it.item_type = 'note'
                  AND EXISTS (SELECT 1 FROM user_notes n WHERE n.verse_id = it.item_id))
             )
         )
         FROM tags t
         ORDER BY t.name COLLATE NOCASE",
    )?;
    let rows = stmt.query_map([], |r| {
        Ok(TagCount {
            id: r.get(0)?,
            name: r.get(1)?,
            count: r.get(2)?,
        })
    })?;
    rows.collect()
}

pub fn list_tagged_items(conn: &Connection, tag_id: i64) -> SqlResult<Vec<TaggedItemRaw>> {
    let mut stmt = conn.prepare(
        "SELECT 'bookmark' AS item_type, b.id AS item_id, b.verse_id AS verse_id, b.label AS text
         FROM item_tags it JOIN bookmarks b ON b.id = it.item_id
         WHERE it.tag_id = ?1 AND it.item_type = 'bookmark'
         UNION ALL
         SELECT 'note' AS item_type, n.verse_id AS item_id, n.verse_id AS verse_id, n.body AS text
         FROM item_tags it JOIN user_notes n ON n.verse_id = it.item_id
         WHERE it.tag_id = ?1 AND it.item_type = 'note'
         ORDER BY item_type, verse_id",
    )?;
    let rows = stmt.query_map(params![tag_id], |r| {
        Ok(TaggedItemRaw {
            item_type: r.get(0)?,
            item_id: r.get(1)?,
            verse_id: r.get(2)?,
            text: r.get(3)?,
        })
    })?;
    rows.collect()
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
    let slug = slug.trim();
    let title = title.trim();
    let kind = kind.trim();
    if slug.is_empty() || title.is_empty() || !is_supported_module_kind(kind) {
        return Err(rusqlite::Error::InvalidQuery);
    }
    conn.execute(
        "INSERT INTO modules (slug, title, kind, source, license, version)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(slug) DO UPDATE SET
           title = excluded.title,
           kind = excluded.kind,
           source = excluded.source,
           license = excluded.license,
           version = excluded.version",
        params![slug, title, kind, source, license, version],
    )?;
    conn.query_row(
        "SELECT id FROM modules WHERE slug = ?",
        params![slug],
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
    let key_type = key_type.trim();
    let key_value = key_value.trim();
    let body = body.trim();
    if !is_supported_module_key_type(key_type) || key_value.is_empty() || body.is_empty() {
        return Err(rusqlite::Error::InvalidQuery);
    }
    let metadata_json = clean_optional_json_payload(metadata_json, false)?;
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

fn is_supported_module_kind(kind: &str) -> bool {
    matches!(
        kind,
        "commentary" | "lexicon" | "dictionary" | "map" | "timeline"
    )
}

fn is_supported_module_key_type(key_type: &str) -> bool {
    matches!(key_type, "verse" | "verse_range" | "strongs" | "topic")
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
    let question = question.trim();
    let retrieval_mode = retrieval_mode.trim();
    if question.is_empty() || retrieval_mode.is_empty() {
        return Err(rusqlite::Error::InvalidQuery);
    }
    let retrieval_options_json = clean_optional_json_payload(retrieval_options_json, false)?;
    let retrieved_evidence_json = clean_optional_json_payload(retrieved_evidence_json, true)?;
    let response_json = clean_council_response_json_payload(response_json)?;
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
            validate_council_response_value(&response).map_err(|e| {
                rusqlite::Error::FromSqlConversionFailure(
                    4,
                    rusqlite::types::Type::Text,
                    Box::new(std::io::Error::new(std::io::ErrorKind::InvalidData, e)),
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
        .and_then(positive_json_i64)
        .or_else(|| {
            payload
                .get("response")
                .and_then(|response| response.get("session_id"))
                .and_then(positive_json_i64)
        })
        .or_else(|| {
            payload
                .get("council_session_id")
                .and_then(positive_json_i64)
        })
}

fn positive_json_i64(value: &serde_json::Value) -> Option<i64> {
    value.as_i64().filter(|id| *id > 0)
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
    let clean_title = topic.title.trim();
    if clean_title.is_empty() {
        return Err(rusqlite::Error::InvalidQuery);
    }
    if topic.parent_id == Some(topic.id) {
        return Err(rusqlite::Error::InvalidQuery);
    }
    validate_theology_parent(conn, topic.id, topic.parent_id)?;
    conn.execute(
        "UPDATE theology_topics
         SET title = ?, parent_id = ?, summary = ?, sort_order = ?, updated_at = datetime('now')
         WHERE id = ?",
        params![
            clean_title,
            topic.parent_id,
            clean_optional(&topic.summary),
            topic.sort_order,
            topic.id,
        ],
    )
}

fn validate_theology_parent(
    conn: &Connection,
    topic_id: i64,
    parent_id: Option<i64>,
) -> SqlResult<()> {
    let Some(mut current_id) = parent_id else {
        return Ok(());
    };
    let mut seen = std::collections::HashSet::new();
    loop {
        if current_id == topic_id || !seen.insert(current_id) {
            return Err(rusqlite::Error::InvalidQuery);
        }
        let next_parent = conn
            .query_row(
                "SELECT parent_id FROM theology_topics WHERE id = ?",
                params![current_id],
                |row| row.get::<_, Option<i64>>(0),
            )
            .optional()?
            .flatten();
        match next_parent {
            Some(next_id) => current_id = next_id,
            None => return Ok(()),
        }
    }
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
    let clean_label = position.label.trim();
    if clean_label.is_empty() {
        return Err(rusqlite::Error::InvalidQuery);
    }
    if let Some(id) = position.id {
        let changed = conn.execute(
            "UPDATE theology_positions
             SET label = ?, tradition_family = ?, summary = ?, strengths = ?,
                 weaknesses = ?, sort_order = ?, updated_at = datetime('now')
             WHERE id = ? AND topic_id = ?",
            params![
                clean_label,
                clean_optional(&position.tradition_family),
                clean_optional(&position.summary),
                clean_optional(&position.strengths),
                clean_optional(&position.weaknesses),
                position.sort_order.unwrap_or(0),
                id,
                position.topic_id,
            ],
        )?;
        if changed != 1 {
            return Err(rusqlite::Error::InvalidQuery);
        }
        return Ok(id);
    }
    conn.execute(
        "INSERT INTO theology_positions
           (topic_id, label, tradition_family, summary, strengths, weaknesses, sort_order)
         VALUES (?, ?, ?, ?, ?, ?, ?)",
        params![
            position.topic_id,
            clean_label,
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
    let link_kind = link.link_kind.trim();
    if !is_supported_theology_link_kind(link_kind) {
        return Err(rusqlite::Error::InvalidQuery);
    }
    if link.target_id.is_some_and(|target_id| target_id <= 0) {
        return Err(rusqlite::Error::InvalidQuery);
    }
    let payload_json = clean_json_payload(link.payload_json.as_deref())?;
    conn.execute(
        "INSERT INTO theology_links (topic_id, link_kind, target_id, title, payload_json)
         VALUES (?, ?, ?, ?, ?)",
        params![
            link.topic_id,
            link_kind,
            link.target_id,
            clean_optional(&link.title),
            payload_json,
        ],
    )?;
    Ok(conn.last_insert_rowid())
}

fn is_supported_theology_link_kind(kind: &str) -> bool {
    matches!(
        kind,
        "verse"
            | "verse_range"
            | "workspace_item"
            | "council_session"
            | "resource_entry"
            | "note"
            | "argument_map"
    )
}

fn clean_json_payload(payload_json: Option<&str>) -> SqlResult<String> {
    let payload = payload_json
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .unwrap_or("{}");
    validate_json_payload(payload, false)?;
    Ok(payload.to_string())
}

fn clean_required_json_payload(payload_json: &str, require_array: bool) -> SqlResult<String> {
    let payload = payload_json.trim();
    if payload.is_empty() {
        return Err(rusqlite::Error::InvalidQuery);
    }
    validate_json_payload(payload, require_array)?;
    Ok(payload.to_string())
}

fn clean_council_response_json_payload(payload_json: &str) -> SqlResult<String> {
    let payload = clean_required_json_payload(payload_json, false)?;
    let value = serde_json::from_str::<serde_json::Value>(&payload)
        .map_err(|_| rusqlite::Error::InvalidQuery)?;
    validate_council_response_value(&value).map_err(|_| rusqlite::Error::InvalidQuery)?;
    Ok(payload)
}

fn clean_optional_json_payload(
    payload_json: Option<&str>,
    require_array: bool,
) -> SqlResult<Option<String>> {
    let Some(payload) = payload_json
        .map(str::trim)
        .filter(|value| !value.is_empty())
    else {
        return Ok(None);
    };
    validate_json_payload(payload, require_array)?;
    Ok(Some(payload.to_string()))
}

fn validate_json_payload(payload: &str, require_array: bool) -> SqlResult<()> {
    let value = serde_json::from_str::<serde_json::Value>(payload)
        .map_err(|_| rusqlite::Error::InvalidQuery)?;
    if require_array {
        if !value.is_array() {
            return Err(rusqlite::Error::InvalidQuery);
        }
    } else if !value.is_object() {
        return Err(rusqlite::Error::InvalidQuery);
    }
    Ok(())
}

fn validate_council_response_value(value: &serde_json::Value) -> Result<(), String> {
    let root = value
        .as_object()
        .ok_or_else(|| "response_json must be an object".to_string())?;
    let synthesis = root
        .get("synthesis")
        .ok_or_else(|| "response_json.synthesis must be an object".to_string())?;
    validate_council_result_value(synthesis, "response_json.synthesis")?;
    let voices = root
        .get("voices")
        .and_then(serde_json::Value::as_array)
        .ok_or_else(|| "response_json.voices must be an array".to_string())?;
    for (index, voice) in voices.iter().enumerate() {
        validate_council_voice_value(voice, &format!("response_json.voices[{index}]"))?;
    }
    let manifest = root
        .get("manifest")
        .and_then(serde_json::Value::as_array)
        .ok_or_else(|| "response_json.manifest must be an array".to_string())?;
    for (index, provider) in manifest.iter().enumerate() {
        validate_council_provider_value(provider, &format!("response_json.manifest[{index}]"))?;
    }
    if let Some(evidence) = root.get("retrieved_evidence") {
        validate_retrieved_evidence_array(evidence, "response_json.retrieved_evidence")?;
    }
    Ok(())
}

fn validate_council_result_value(value: &serde_json::Value, path: &str) -> Result<(), String> {
    let result = value
        .as_object()
        .ok_or_else(|| format!("{path} must be an object"))?;
    let positions = result
        .get("positions")
        .and_then(serde_json::Value::as_array)
        .ok_or_else(|| format!("{path}.positions must be an array"))?;
    if positions.is_empty() {
        return Err(format!("{path}.positions must not be empty"));
    }
    for (index, position) in positions.iter().enumerate() {
        validate_council_position_value(position, &format!("{path}.positions[{index}]"))?;
    }
    let confidence = result
        .get("confidence")
        .and_then(serde_json::Value::as_str)
        .unwrap_or("");
    if !matches!(confidence, "low" | "medium" | "high") {
        return Err(format!("{path}.confidence must be low, medium, or high"));
    }
    for field in ["synthesis", "dissent_notes", "confidence_rationale"] {
        if let Some(value) = result.get(field) {
            value
                .as_str()
                .ok_or_else(|| format!("{path}.{field} must be a string"))?;
        }
    }
    validate_optional_string_array(
        result,
        "unresolved_tensions",
        &format!("{path}.unresolved_tensions"),
    )?;
    if let Some(classifications) = result.get("evidence_classification") {
        validate_evidence_classification_array(
            classifications,
            &format!("{path}.evidence_classification"),
        )?;
    }
    if let Some(trail) = result.get("research_trail") {
        validate_research_trail_array(trail, &format!("{path}.research_trail"))?;
    }
    Ok(())
}

fn validate_council_position_value(value: &serde_json::Value, path: &str) -> Result<(), String> {
    let position = value
        .as_object()
        .ok_or_else(|| format!("{path} must be an object"))?;
    let label = position
        .get("label")
        .and_then(serde_json::Value::as_str)
        .map(str::trim)
        .unwrap_or("");
    if label.is_empty() {
        return Err(format!("{path}.label must be a non-empty string"));
    }
    let weight = position
        .get("weight")
        .and_then(serde_json::Value::as_f64)
        .ok_or_else(|| format!("{path}.weight must be a number"))?;
    if !weight.is_finite() || weight < 0.0 {
        return Err(format!(
            "{path}.weight must be a non-negative finite number"
        ));
    }
    position
        .get("summary")
        .and_then(serde_json::Value::as_str)
        .ok_or_else(|| format!("{path}.summary must be a string"))?;
    let evidence = position
        .get("evidence")
        .and_then(serde_json::Value::as_array)
        .ok_or_else(|| format!("{path}.evidence must be an array"))?;
    for (index, entry) in evidence.iter().enumerate() {
        validate_council_evidence_value(entry, &format!("{path}.evidence[{index}]"))?;
    }
    validate_optional_positive_integer_array(
        position,
        "supporting_evidence_ids",
        &format!("{path}.supporting_evidence_ids"),
    )?;
    validate_optional_positive_integer_array(
        position,
        "challenging_evidence_ids",
        &format!("{path}.challenging_evidence_ids"),
    )?;
    validate_optional_string_array(
        position,
        "interpretive_moves",
        &format!("{path}.interpretive_moves"),
    )?;
    validate_optional_string_array(
        position,
        "source_position_labels",
        &format!("{path}.source_position_labels"),
    )?;
    if let Some(argument_map) = position.get("argument_map") {
        validate_argument_map_value(argument_map, &format!("{path}.argument_map"))?;
    }
    Ok(())
}

fn validate_council_evidence_value(value: &serde_json::Value, path: &str) -> Result<(), String> {
    let entry = value
        .as_object()
        .ok_or_else(|| format!("{path} must be an object"))?;
    validate_positive_integer_field(entry, "verse_id", &format!("{path}.verse_id"))?;
    for field in ["citation", "translation_code", "quote", "reasoning"] {
        entry
            .get(field)
            .and_then(serde_json::Value::as_str)
            .ok_or_else(|| format!("{path}.{field} must be a string"))?;
    }
    Ok(())
}

fn validate_council_voice_value(value: &serde_json::Value, path: &str) -> Result<(), String> {
    let voice = value
        .as_object()
        .ok_or_else(|| format!("{path} must be an object"))?;
    for field in ["provider", "display_name", "status"] {
        voice
            .get(field)
            .and_then(serde_json::Value::as_str)
            .ok_or_else(|| format!("{path}.{field} must be a string"))?;
    }
    match voice
        .get("status")
        .and_then(serde_json::Value::as_str)
        .unwrap_or("")
    {
        "ok" => {
            let result = voice
                .get("result")
                .ok_or_else(|| format!("{path}.result must be an object for ok voices"))?;
            validate_council_result_value(result, &format!("{path}.result"))?;
        }
        "error" | "skipped" => {}
        _ => return Err(format!("{path}.status must be ok, error, or skipped")),
    }
    Ok(())
}

fn validate_council_provider_value(value: &serde_json::Value, path: &str) -> Result<(), String> {
    let provider = value
        .as_object()
        .ok_or_else(|| format!("{path} must be an object"))?;
    for field in ["name", "display_name"] {
        provider
            .get(field)
            .and_then(serde_json::Value::as_str)
            .ok_or_else(|| format!("{path}.{field} must be a string"))?;
    }
    provider
        .get("available")
        .and_then(serde_json::Value::as_bool)
        .ok_or_else(|| format!("{path}.available must be a boolean"))?;
    Ok(())
}

fn validate_argument_map_value(value: &serde_json::Value, path: &str) -> Result<(), String> {
    let argument_map = value
        .as_object()
        .ok_or_else(|| format!("{path} must be an object"))?;
    let nodes = argument_map
        .get("nodes")
        .and_then(serde_json::Value::as_array)
        .ok_or_else(|| format!("{path}.nodes must be an array"))?;
    for (index, node) in nodes.iter().enumerate() {
        let node = node
            .as_object()
            .ok_or_else(|| format!("{path}.nodes[{index}] must be an object"))?;
        for field in ["id", "kind", "label", "detail"] {
            node.get(field)
                .and_then(serde_json::Value::as_str)
                .ok_or_else(|| format!("{path}.nodes[{index}].{field} must be a string"))?;
        }
        validate_optional_positive_integer_array(
            node,
            "verse_ids",
            &format!("{path}.nodes[{index}].verse_ids"),
        )?;
    }
    let edges = argument_map
        .get("edges")
        .and_then(serde_json::Value::as_array)
        .ok_or_else(|| format!("{path}.edges must be an array"))?;
    for (index, edge) in edges.iter().enumerate() {
        let edge = edge
            .as_object()
            .ok_or_else(|| format!("{path}.edges[{index}] must be an object"))?;
        for field in ["from", "to"] {
            edge.get(field)
                .and_then(serde_json::Value::as_str)
                .ok_or_else(|| format!("{path}.edges[{index}].{field} must be a string"))?;
        }
    }
    Ok(())
}

fn validate_evidence_classification_array(
    value: &serde_json::Value,
    path: &str,
) -> Result<(), String> {
    let entries = value
        .as_array()
        .ok_or_else(|| format!("{path} must be an array"))?;
    for (index, entry) in entries.iter().enumerate() {
        let entry = entry
            .as_object()
            .ok_or_else(|| format!("{path}[{index}] must be an object"))?;
        validate_positive_integer_field(entry, "verse_id", &format!("{path}[{index}].verse_id"))?;
        match entry
            .get("status")
            .and_then(serde_json::Value::as_str)
            .unwrap_or("")
        {
            "used" | "supporting" | "conflicting" | "ignored" => {}
            _ => {
                return Err(format!(
                    "{path}[{index}].status must be used, supporting, conflicting, or ignored"
                ));
            }
        }
    }
    Ok(())
}

fn validate_research_trail_array(value: &serde_json::Value, path: &str) -> Result<(), String> {
    let entries = value
        .as_array()
        .ok_or_else(|| format!("{path} must be an array"))?;
    for (index, entry) in entries.iter().enumerate() {
        let entry = entry
            .as_object()
            .ok_or_else(|| format!("{path}[{index}] must be an object"))?;
        for field in ["id", "label", "detail", "event_type"] {
            entry
                .get(field)
                .and_then(serde_json::Value::as_str)
                .ok_or_else(|| format!("{path}[{index}].{field} must be a string"))?;
        }
        validate_optional_positive_integer_array(
            entry,
            "related_verse_ids",
            &format!("{path}[{index}].related_verse_ids"),
        )?;
    }
    Ok(())
}

fn validate_retrieved_evidence_array(value: &serde_json::Value, path: &str) -> Result<(), String> {
    let entries = value
        .as_array()
        .ok_or_else(|| format!("{path} must be an array"))?;
    for (index, entry) in entries.iter().enumerate() {
        let entry = entry
            .as_object()
            .ok_or_else(|| format!("{path}[{index}] must be an object"))?;
        validate_positive_integer_field(entry, "verse_id", &format!("{path}[{index}].verse_id"))?;
        validate_positive_integer_field(entry, "book_id", &format!("{path}[{index}].book_id"))?;
        validate_positive_integer_field(entry, "chapter", &format!("{path}[{index}].chapter"))?;
        validate_positive_integer_field(entry, "verse", &format!("{path}[{index}].verse"))?;
        for field in [
            "translation_code",
            "book_name",
            "book_osis",
            "text",
            "source",
        ] {
            entry
                .get(field)
                .and_then(serde_json::Value::as_str)
                .ok_or_else(|| format!("{path}[{index}].{field} must be a string"))?;
        }
    }
    Ok(())
}

fn validate_optional_string_array(
    object: &serde_json::Map<String, serde_json::Value>,
    key: &str,
    path: &str,
) -> Result<(), String> {
    let Some(value) = object.get(key) else {
        return Ok(());
    };
    let values = value
        .as_array()
        .ok_or_else(|| format!("{path} must be an array"))?;
    if values.iter().all(serde_json::Value::is_string) {
        Ok(())
    } else {
        Err(format!("{path} must contain only strings"))
    }
}

fn validate_optional_positive_integer_array(
    object: &serde_json::Map<String, serde_json::Value>,
    key: &str,
    path: &str,
) -> Result<(), String> {
    let Some(value) = object.get(key) else {
        return Ok(());
    };
    let values = value
        .as_array()
        .ok_or_else(|| format!("{path} must be an array"))?;
    if values.iter().all(is_positive_json_integer) {
        Ok(())
    } else {
        Err(format!(
            "{path} must contain only positive integer verse ids"
        ))
    }
}

fn validate_positive_integer_field(
    object: &serde_json::Map<String, serde_json::Value>,
    key: &str,
    path: &str,
) -> Result<(), String> {
    let Some(value) = object.get(key) else {
        return Err(format!("{path} must be a positive integer"));
    };
    if is_positive_json_integer(value) {
        Ok(())
    } else {
        Err(format!("{path} must be a positive integer"))
    }
}

fn is_positive_json_integer(value: &serde_json::Value) -> bool {
    value.as_i64().is_some_and(|number| number > 0)
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
            .filter(|topic| topic.id == id)
            .cloned()
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
                        "- **{}** ({}) — {}{}",
                        attribution.title,
                        attribution.license,
                        attribution.attribution,
                        share_alike
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
        .split(['\n', '?'])
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
        if starts_with_chars(&chars, index, "[redacted secret]") {
            output.push_str("[redacted secret]");
            index += "[redacted secret]".chars().count();
            continue;
        }
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
        if cursor < chars.len() && matches!(chars[cursor], '"' | '\'') {
            let quote = chars[cursor];
            cursor += 1;
            while cursor < chars.len() && chars[cursor] != '\n' {
                let ch = chars[cursor];
                cursor += 1;
                if ch == quote {
                    break;
                }
            }
        } else {
            while cursor < chars.len()
                && !chars[cursor].is_whitespace()
                && !matches!(
                    chars[cursor],
                    '`' | '"' | '\'' | '<' | '>' | ')' | ']' | '}' | ',' | ';'
                )
            {
                cursor += 1;
            }
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
        if starts_with_chars(&chars, index, "[redacted secret]") {
            output.push_str("[redacted secret]");
            index += "[redacted secret]".chars().count();
            continue;
        }
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
    is_secret_key_name(key)
}

fn is_secret_key_name(key: &str) -> bool {
    let compact = compact_secret_key_name(key);
    compact.contains("apikey")
        || compact.contains("token")
        || compact.contains("secret")
        || compact.contains("password")
        || compact.contains("credential")
}

fn is_named_secret_setting(key: &str) -> bool {
    let compact = compact_secret_key_name(key);
    if matches!(
        compact.as_str(),
        "token" | "secret" | "password" | "credential"
    ) {
        return false;
    }
    is_secret_key_name(key)
}

fn compact_secret_key_name(key: &str) -> String {
    key.chars()
        .filter(|ch| *ch != '_' && *ch != '-')
        .collect::<String>()
        .to_ascii_lowercase()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn test_conn() -> Connection {
        let conn = Connection::open_in_memory().expect("open in-memory user DB");
        conn.pragma_update(None, "foreign_keys", "ON")
            .expect("enable foreign keys");
        conn.execute_batch(USER_SCHEMA).expect("create user schema");
        conn
    }

    fn minimal_council_response_json() -> String {
        let position = serde_json::json!({
            "label": "Mock position",
            "weight": 1.0,
            "summary": "A minimal stored Council position.",
            "supporting_evidence_ids": [1001001],
            "challenging_evidence_ids": [],
            "why_not_higher": "",
            "confidence_rationale": "Fixture response.",
            "weakest_link": "",
            "what_would_change_this": "",
            "interpretive_moves": [],
            "argument_map": {
                "nodes": [],
                "edges": []
            },
            "evidence": [
                {
                    "verse_id": 1001001,
                    "citation": "Genesis 1:1",
                    "translation_code": "KJV",
                    "quote": "In the beginning God created the heaven and the earth.",
                    "reasoning": "Fixture citation."
                }
            ]
        });
        serde_json::json!({
            "synthesis": {
                "positions": [position.clone()],
                "dissent_notes": "",
                "unresolved_tensions": [],
                "synthesis": "A minimal stored Council synthesis.",
                "confidence": "medium",
                "confidence_rationale": "Fixture response.",
                "evidence_classification": [
                    {
                        "verse_id": 1001001,
                        "status": "used",
                        "reasoning": "Cited directly."
                    }
                ],
                "research_trail": []
            },
            "voices": [
                {
                    "provider": "mock",
                    "display_name": "Mock",
                    "status": "ok",
                    "result": {
                        "positions": [position],
                        "synthesis": "A minimal voice result.",
                        "confidence": "medium"
                    },
                    "error": null,
                    "duration_ms": 1
                }
            ],
            "manifest": [
                {
                    "name": "mock",
                    "display_name": "Mock",
                    "available": true
                }
            ],
            "retrieved_evidence": [
                {
                    "verse_id": 1001001,
                    "translation_code": "KJV",
                    "book_id": 1,
                    "book_name": "Genesis",
                    "book_osis": "Gen",
                    "chapter": 1,
                    "verse": 1,
                    "text": "In the beginning God created the heaven and the earth.",
                    "source": "mock"
                }
            ]
        })
        .to_string()
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
                "INSERT INTO app_settings (key, value) VALUES ('legacy_custom_token', ?)",
                params!["test-custom-token-delete-regression"],
            )
            .expect("insert legacy token");
            conn.execute(
                "INSERT INTO app_settings (key, value) VALUES ('smtp_password', ?)",
                params!["test-password-delete-regression"],
            )
            .expect("insert legacy password");
            conn.execute(
                "INSERT INTO app_settings (key, value) VALUES ('oauth_client_secret', ?)",
                params!["test-client-secret-delete-regression"],
            )
            .expect("insert legacy client secret");
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
                    "SELECT COUNT(*) FROM app_settings WHERE key IN ('google_api_key', 'legacy_custom_token', 'smtp_password', 'oauth_client_secret')",
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
        assert!(!file_contains_ascii(&path, "legacy_custom_token"));
        assert!(!file_contains_ascii(
            &path,
            "test-custom-token-delete-regression"
        ));
        assert!(!file_contains_ascii(&path, "smtp_password"));
        assert!(!file_contains_ascii(
            &path,
            "test-password-delete-regression"
        ));
        assert!(!file_contains_ascii(&path, "oauth_client_secret"));
        assert!(!file_contains_ascii(
            &path,
            "test-client-secret-delete-regression"
        ));
        let _ = std::fs::remove_file(path);
    }

    #[test]
    fn secret_key_detection_covers_common_setting_spellings() {
        for key in [
            "openai_api_key",
            "openaiApiKey",
            "x-api-key",
            "managed_gateway_token",
            "smtp_password",
            "oauth_client_secret",
            "stored_credential",
        ] {
            assert!(
                is_secret_setting_key(key),
                "{key} should be treated as secret"
            );
            assert!(
                is_secret_export_key(key),
                "{key} should be redacted in text exports"
            );
        }
        assert!(!is_secret_setting_key("openai_model"));
        assert!(!is_secret_export_key("retrieval_strategy"));
    }

    #[test]
    fn add_bookmark_updates_single_verse_bookmark_instead_of_duplicating_null_range() {
        let conn = test_conn();
        let first_id =
            add_bookmark(&conn, 1_001_001, None, Some("First label")).expect("add bookmark");
        let second_id =
            add_bookmark(&conn, 1_001_001, None, Some("Second label")).expect("update bookmark");

        assert_eq!(second_id, first_id);
        let rows = list_bookmarks(&conn).expect("list bookmarks");
        assert_eq!(rows.len(), 1);
        assert_eq!(rows[0].id, first_id);
        assert_eq!(rows[0].label.as_deref(), Some("Second label"));
    }

    #[test]
    fn council_session_insert_rejects_blank_fields_and_invalid_json() {
        let conn = test_conn();
        let response_json = minimal_council_response_json();

        assert!(insert_session(&conn, "   ", "mock", None, None, "{}").is_err());
        assert!(insert_session(&conn, "Question?", "   ", None, None, "{}").is_err());
        assert!(insert_session(&conn, "Question?", "mock", None, None, "{bad").is_err());
        assert!(insert_session(&conn, "Question?", "mock", Some("[]"), None, "{}").is_err());
        assert!(insert_session(&conn, "Question?", "mock", None, Some("{}"), "{}").is_err());
        assert!(insert_session(&conn, "Question?", "mock", None, None, "[]").is_err());
        assert!(insert_session(&conn, "Question?", "mock", None, None, "{}").is_err());

        let id = insert_session(
            &conn,
            "  Question?  ",
            " mock ",
            Some(" {\"strategy\":\"keyword\"} "),
            Some(" [] "),
            &format!(" {response_json} "),
        )
        .expect("insert valid session");
        let stored = get_session(&conn, id)
            .expect("get stored session")
            .expect("session exists");
        assert_eq!(stored.question, "Question?");
        assert_eq!(stored.retrieval_mode.as_deref(), Some("mock"));
    }

    #[test]
    fn get_session_rejects_legacy_malformed_council_response() {
        let conn = test_conn();
        conn.execute(
            "INSERT INTO council_sessions
               (question, status, retrieval_mode, response_json, completed_at)
             VALUES ('Malformed stored Council session', 'complete', 'mock', '{}', datetime('now'))",
            [],
        )
        .expect("insert malformed legacy session");
        let id = conn.last_insert_rowid();

        assert!(get_session(&conn, id).is_err());
    }

    #[test]
    fn theology_topic_update_rejects_empty_titles_and_parent_cycles() {
        let conn = test_conn();
        let parent_id =
            create_theology_topic(&conn, "Parent doctrine", None, None).expect("create parent");
        let child_id = create_theology_topic(&conn, "Child doctrine", None, Some(parent_id))
            .expect("create child");

        let mut parent = get_theology_topic(&conn, parent_id)
            .expect("get parent")
            .expect("parent exists");
        parent.title = "   ".to_string();
        assert!(update_theology_topic(&conn, &parent).is_err());

        parent.title = "Parent doctrine".to_string();
        parent.parent_id = Some(child_id);
        assert!(update_theology_topic(&conn, &parent).is_err());

        let unchanged = get_theology_topic(&conn, parent_id)
            .expect("get unchanged parent")
            .expect("parent exists");
        assert_eq!(unchanged.parent_id, None);
        assert_eq!(unchanged.title, "Parent doctrine");
    }

    #[test]
    fn theology_tree_export_does_not_loop_on_legacy_parent_cycles() {
        let conn = test_conn();
        let parent_id =
            create_theology_topic(&conn, "Cycle parent", None, None).expect("create parent");
        let child_id = create_theology_topic(&conn, "Cycle child", None, Some(parent_id))
            .expect("create child");
        conn.execute(
            "UPDATE theology_topics SET parent_id = ? WHERE id = ?",
            params![child_id, parent_id],
        )
        .expect("force legacy cycle");

        let markdown =
            export_theology_markdown(&conn, Some(parent_id), true).expect("export subtree");

        assert!(markdown.contains("## Cycle parent"));
        assert!(markdown.contains("## Cycle child"));
    }

    #[test]
    fn theology_position_and_link_writes_reject_invalid_values() {
        let conn = test_conn();
        let topic_id =
            create_theology_topic(&conn, "Validation topic", None, None).expect("create topic");

        assert!(upsert_theology_position(
            &conn,
            &TheologyPosition {
                id: None,
                topic_id,
                label: "   ".to_string(),
                tradition_family: None,
                summary: None,
                strengths: None,
                weaknesses: None,
                sort_order: None,
                created_at: None,
                updated_at: None,
            },
        )
        .is_err());

        let position_id = upsert_theology_position(
            &conn,
            &TheologyPosition {
                id: None,
                topic_id,
                label: "Historic view".to_string(),
                tradition_family: None,
                summary: None,
                strengths: None,
                weaknesses: None,
                sort_order: None,
                created_at: None,
                updated_at: None,
            },
        )
        .expect("insert position");
        assert!(upsert_theology_position(
            &conn,
            &TheologyPosition {
                id: Some(position_id + 10_000),
                topic_id,
                label: "Missing position".to_string(),
                tradition_family: None,
                summary: None,
                strengths: None,
                weaknesses: None,
                sort_order: None,
                created_at: None,
                updated_at: None,
            },
        )
        .is_err());
        let other_topic_id = create_theology_topic(&conn, "Other validation topic", None, None)
            .expect("create topic");
        assert!(upsert_theology_position(
            &conn,
            &TheologyPosition {
                id: Some(position_id),
                topic_id: other_topic_id,
                label: "Wrong topic".to_string(),
                tradition_family: None,
                summary: None,
                strengths: None,
                weaknesses: None,
                sort_order: None,
                created_at: None,
                updated_at: None,
            },
        )
        .is_err());

        let invalid_kind = TheologyLink {
            id: None,
            topic_id,
            link_kind: "external_url".to_string(),
            target_id: None,
            title: Some("Unsupported link".to_string()),
            payload_json: Some("{}".to_string()),
            created_at: None,
        };
        assert!(create_theology_link(&conn, &invalid_kind).is_err());

        let invalid_payload = TheologyLink {
            link_kind: "note".to_string(),
            payload_json: Some("{not json".to_string()),
            title: Some("Broken payload".to_string()),
            ..invalid_kind
        };
        assert!(create_theology_link(&conn, &invalid_payload).is_err());

        let array_payload = TheologyLink {
            link_kind: "note".to_string(),
            payload_json: Some("[]".to_string()),
            title: Some("Array payload".to_string()),
            ..invalid_payload
        };
        assert!(create_theology_link(&conn, &array_payload).is_err());

        let invalid_target = TheologyLink {
            link_kind: "verse".to_string(),
            target_id: Some(0),
            payload_json: Some("{}".to_string()),
            title: Some("Invalid target".to_string()),
            ..array_payload
        };
        assert!(create_theology_link(&conn, &invalid_target).is_err());
    }

    #[test]
    fn reorder_study_items_rejects_duplicate_item_ids() {
        let conn = test_conn();
        let workspace_id =
            create_study_workspace(&conn, "Workspace ordering", None).expect("create workspace");
        let first_id = add_study_item(
            &conn,
            workspace_id,
            "note",
            Some("First"),
            &serde_json::json!({ "body": "First" }).to_string(),
        )
        .expect("add first item");
        let second_id = add_study_item(
            &conn,
            workspace_id,
            "note",
            Some("Second"),
            &serde_json::json!({ "body": "Second" }).to_string(),
        )
        .expect("add second item");

        assert!(reorder_study_items(&conn, workspace_id, &[first_id, first_id]).is_err());

        let items = list_study_items(&conn, workspace_id).expect("list items");
        assert_eq!(
            items.iter().map(|item| item.id).collect::<Vec<_>>(),
            vec![first_id, second_id]
        );
        assert_eq!(
            items.iter().map(|item| item.sort_order).collect::<Vec<_>>(),
            vec![0, 1]
        );
    }

    #[test]
    fn delete_study_item_updates_parent_workspace_timestamp() {
        let conn = test_conn();
        let workspace_id =
            create_study_workspace(&conn, "Delete timestamp", None).expect("create workspace");
        let item_id = add_study_item(
            &conn,
            workspace_id,
            "note",
            Some("Temporary"),
            &serde_json::json!({ "body": "Remove me" }).to_string(),
        )
        .expect("add item");
        conn.execute(
            "UPDATE study_workspaces SET updated_at = '2000-01-01 00:00:00' WHERE id = ?",
            params![workspace_id],
        )
        .expect("set old timestamp");

        assert_eq!(delete_study_item(&conn, item_id).expect("delete item"), 1);

        let updated_at: String = conn
            .query_row(
                "SELECT updated_at FROM study_workspaces WHERE id = ?",
                params![workspace_id],
                |row| row.get(0),
            )
            .expect("read workspace timestamp");
        assert_ne!(updated_at, "2000-01-01 00:00:00");
        assert!(list_study_items(&conn, workspace_id)
            .expect("list items")
            .is_empty());
    }

    #[test]
    fn study_item_writes_reject_invalid_kind_or_payload_json() {
        let conn = test_conn();
        let workspace_id =
            create_study_workspace(&conn, "Study item validation", None).expect("create workspace");

        assert!(add_study_item(
            &conn,
            workspace_id,
            "external_link",
            Some("Unsupported"),
            "{}",
        )
        .is_err());
        assert!(add_study_item(&conn, workspace_id, "note", Some("Broken"), "{bad").is_err());
        assert!(add_study_item(&conn, workspace_id, "note", Some("Array"), "[]").is_err());

        let item_id = add_study_item(
            &conn,
            workspace_id,
            "note",
            Some("Valid"),
            &serde_json::json!({ "body": "Valid" }).to_string(),
        )
        .expect("add item");
        assert!(update_study_item(&conn, item_id, Some("Broken"), Some("{bad")).is_err());
        assert!(update_study_item(&conn, item_id, Some("Array"), Some("[]")).is_err());
    }

    #[test]
    fn guided_study_session_rejects_invalid_slug_and_review_cards() {
        let conn = test_conn();
        let topic_id =
            create_theology_topic(&conn, "Guided validation", None, None).expect("create topic");
        let valid = GuidedStudySession {
            id: None,
            topic_id,
            template_slug: "doctrine-reflection".to_string(),
            focus_question: Some("What should be tested?".to_string()),
            before_response: None,
            after_response: None,
            critique: None,
            review_cards_json: Some("[]".to_string()),
            completed_at: None,
            created_at: None,
            updated_at: None,
        };

        assert!(upsert_guided_study_session(&conn, &valid).is_ok());
        assert!(upsert_guided_study_session(
            &conn,
            &GuidedStudySession {
                template_slug: "Doctrine Review".to_string(),
                ..valid.clone()
            },
        )
        .is_err());
        assert!(upsert_guided_study_session(
            &conn,
            &GuidedStudySession {
                review_cards_json: Some("{}".to_string()),
                ..valid
            },
        )
        .is_err());
    }

    #[test]
    fn argument_annotation_rejects_blank_node_or_body() {
        let conn = test_conn();
        let session_id = insert_session(
            &conn,
            "Which premise needs annotation?",
            "mock",
            None,
            None,
            &minimal_council_response_json(),
        )
        .expect("insert council session");
        let valid = ArgumentAnnotation {
            id: None,
            council_session_id: session_id,
            node_id: "claim-1".to_string(),
            annotation: "Check the supporting citation.".to_string(),
            created_at: None,
            updated_at: None,
        };

        assert!(upsert_argument_annotation(&conn, &valid).is_ok());
        assert!(upsert_argument_annotation(
            &conn,
            &ArgumentAnnotation {
                node_id: "   ".to_string(),
                ..valid.clone()
            },
        )
        .is_err());
        assert!(upsert_argument_annotation(
            &conn,
            &ArgumentAnnotation {
                annotation: "   ".to_string(),
                ..valid
            },
        )
        .is_err());
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
            &minimal_council_response_json(),
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
    fn workspace_council_session_id_ignores_non_positive_ids() {
        assert_eq!(
            workspace_council_session_id(
                r#"{"session_id":0,"response":{"session_id":-4},"council_session_id":22}"#
            ),
            Some(22)
        );
        assert_eq!(
            workspace_council_session_id(
                r#"{"session_id":-1,"response":{"session_id":17},"council_session_id":22}"#
            ),
            Some(17)
        );
        assert_eq!(
            workspace_council_session_id(r#"{"session_id":0,"council_session_id":-2}"#),
            None
        );
        assert_eq!(
            workspace_council_session_id(r#"{"session_id":1.5,"council_session_id":23}"#),
            Some(23)
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
            &minimal_council_response_json(),
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
    fn untitled_resource_entries_index_the_newly_inserted_row() {
        let conn = test_conn();
        let source_id = create_resource_source(
            &conn,
            &ResourceSource {
                id: None,
                slug: "untitled-resource-source".to_string(),
                title: "Untitled Resource Source".to_string(),
                source_url: Some("local fixture".to_string()),
                license: "Public Domain".to_string(),
                attribution: "Resource FTS regression fixture.".to_string(),
                version: None,
                imported_at: None,
                metadata_json: Some("{}".to_string()),
            },
        )
        .expect("create resource source");
        let collection_id = create_resource_collection(
            &conn,
            &ResourceCollection {
                id: None,
                source_id,
                slug: "untitled-resource-collection".to_string(),
                title: "Untitled Resource Collection".to_string(),
                kind: "commentary".to_string(),
                metadata_json: Some("{}".to_string()),
            },
        )
        .expect("create resource collection");

        let first_id = create_resource_entry(
            &conn,
            &ResourceEntry {
                id: None,
                collection_id,
                source_id: None,
                source_title: None,
                collection_title: None,
                collection_kind: None,
                ref_value: Some("Untitled 1".to_string()),
                title: None,
                body: "First untitled entry.".to_string(),
                search_text: Some("firstuntitledterm".to_string()),
                payload_json: Some("{}".to_string()),
                license: None,
                attribution: None,
                share_alike_requirements: None,
            },
        )
        .expect("create first untitled resource entry");
        let second_id = create_resource_entry(
            &conn,
            &ResourceEntry {
                id: None,
                collection_id,
                source_id: None,
                source_title: None,
                collection_title: None,
                collection_kind: None,
                ref_value: Some("Untitled 2".to_string()),
                title: None,
                body: "Second untitled entry.".to_string(),
                search_text: Some("seconduntitledterm".to_string()),
                payload_json: Some("{}".to_string()),
                license: None,
                attribution: None,
                share_alike_requirements: None,
            },
        )
        .expect("create second untitled resource entry");

        assert_ne!(first_id, second_id);
        let hits = search_resources(&conn, "seconduntitledterm", None, None, None, None, 10)
            .expect("search second untitled entry");
        assert_eq!(hits.len(), 1);
        assert_eq!(hits[0].id, Some(second_id));
    }

    #[test]
    fn resource_search_splits_punctuation_before_building_fts_query() {
        assert_eq!(
            resource_fts_query("king's God-man"),
            "\"king\"* \"God\"* \"man\"*"
        );
    }

    #[test]
    fn resource_search_handles_apostrophes_and_hyphens() {
        let conn = test_conn();
        let source_id = create_resource_source(
            &conn,
            &ResourceSource {
                id: None,
                slug: "punctuation-resource-source".to_string(),
                title: "Punctuation Resource Source".to_string(),
                source_url: Some("local fixture".to_string()),
                license: "Public Domain".to_string(),
                attribution: "Resource punctuation fixture.".to_string(),
                version: None,
                imported_at: None,
                metadata_json: Some("{}".to_string()),
            },
        )
        .expect("create resource source");
        let collection_id = create_resource_collection(
            &conn,
            &ResourceCollection {
                id: None,
                source_id,
                slug: "punctuation-resource-collection".to_string(),
                title: "Punctuation Resource Collection".to_string(),
                kind: "commentary".to_string(),
                metadata_json: Some("{}".to_string()),
            },
        )
        .expect("create resource collection");
        let entry_id = create_resource_entry(
            &conn,
            &ResourceEntry {
                id: None,
                collection_id,
                source_id: None,
                source_title: None,
                collection_title: None,
                collection_kind: None,
                ref_value: Some("Punctuation 1".to_string()),
                title: Some("King God Man".to_string()),
                body: "The king receives testimony about the God man.".to_string(),
                search_text: Some("king God man punctuation fixture".to_string()),
                payload_json: Some("{}".to_string()),
                license: None,
                attribution: None,
                share_alike_requirements: None,
            },
        )
        .expect("create punctuation resource entry");

        let hits = search_resources(&conn, "king's God-man", None, None, None, None, 10)
            .expect("search punctuation resource");
        assert_eq!(hits.len(), 1);
        assert_eq!(hits[0].id, Some(entry_id));
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
    fn user_data_import_skips_secret_app_settings() {
        let conn = test_conn();
        let payload = serde_json::json!({
            "app": "Bible AI",
            "export_version": EXPORT_VERSION,
            "user_schema_version": USER_SCHEMA_VERSION,
            "exported_at": "2026-05-22T09:00:00Z",
            "tables": {
                "app_settings": [
                    {
                        "key": "openai_model",
                        "value": "gpt-5",
                        "updated_at": "2026-05-22T09:00:00Z"
                    },
                    {
                        "key": "openai_api_key",
                        "value": "sk-imported-secret",
                        "updated_at": "2026-05-22T09:00:00Z"
                    },
                    {
                        "key": "managed_gateway_token",
                        "value": "imported-gateway-token",
                        "updated_at": "2026-05-22T09:00:00Z"
                    },
                    {
                        "key": "smtp_password",
                        "value": "imported-password",
                        "updated_at": "2026-05-22T09:00:00Z"
                    },
                    {
                        "key": "oauthClientSecret",
                        "value": "imported-client-secret",
                        "updated_at": "2026-05-22T09:00:00Z"
                    },
                    {
                        "key": "legacy_non_secret_setting",
                        "value": "legacy value",
                        "updated_at": "2026-05-22T09:00:00Z"
                    }
                ]
            }
        });

        let report =
            import_user_data(&conn, &payload, "replace_existing").expect("import backup data");
        assert_eq!(report.imported, 1);
        assert_eq!(report.skipped, 5);
        assert_eq!(
            get_setting(&conn, "openai_model").expect("read model"),
            Some("gpt-5".to_string())
        );
        assert_eq!(
            get_setting(&conn, "openai_api_key").expect("read api key"),
            None
        );
        assert_eq!(
            get_setting(&conn, "managed_gateway_token").expect("read gateway token"),
            None
        );
        assert_eq!(
            get_setting(&conn, "smtp_password").expect("read password"),
            None
        );
        assert_eq!(
            get_setting(&conn, "oauthClientSecret").expect("read client secret"),
            None
        );
        assert_eq!(
            get_setting(&conn, "legacy_non_secret_setting").expect("read legacy setting"),
            None
        );
    }

    #[test]
    fn user_data_import_normalizes_safe_app_settings() {
        let conn = test_conn();
        let payload = serde_json::json!({
            "app": "Bible AI",
            "export_version": EXPORT_VERSION,
            "user_schema_version": USER_SCHEMA_VERSION,
            "exported_at": "2026-05-23T09:00:00Z",
            "tables": {
                "app_settings": [
                    {
                        "key": " retrieval_translation ",
                        "value": " kjv ",
                        "updated_at": "2026-05-23T09:00:00Z"
                    },
                    {
                        "key": "active_translations",
                        "value": " kjv, BHS, kjv ",
                        "updated_at": "2026-05-23T09:00:00Z"
                    },
                    {
                        "key": "font_scale",
                        "value": "9",
                        "updated_at": "2026-05-23T09:00:00Z"
                    },
                    {
                        "key": "sync_scroll",
                        "value": "FALSE",
                        "updated_at": "2026-05-23T09:00:00Z"
                    },
                    {
                        "key": "ollama_host",
                        "value": " http://localhost:11434/ ",
                        "updated_at": "2026-05-23T09:00:00Z"
                    }
                ]
            }
        });

        let report =
            import_user_data(&conn, &payload, "replace_existing").expect("import app settings");

        assert_eq!(report.imported, 5);
        assert_eq!(
            get_setting(&conn, "retrieval_translation").expect("read translation"),
            Some("KJV".to_string())
        );
        assert_eq!(
            get_setting(&conn, "active_translations").expect("read active translations"),
            Some("KJV,BHS".to_string())
        );
        assert_eq!(
            get_setting(&conn, "font_scale").expect("read font scale"),
            Some("1.4".to_string())
        );
        assert_eq!(
            get_setting(&conn, "sync_scroll").expect("read sync scroll"),
            Some("false".to_string())
        );
        assert_eq!(
            get_setting(&conn, "ollama_host").expect("read ollama host"),
            Some("http://localhost:11434/".to_string())
        );
    }

    #[test]
    fn user_data_import_rejects_invalid_app_settings_transactionally() {
        let conn = test_conn();
        let payload = serde_json::json!({
            "app": "Bible AI",
            "export_version": EXPORT_VERSION,
            "user_schema_version": USER_SCHEMA_VERSION,
            "exported_at": "2026-05-23T09:00:00Z",
            "tables": {
                "app_settings": [
                    {
                        "key": "openai_model",
                        "value": "gpt-5",
                        "updated_at": "2026-05-23T09:00:00Z"
                    },
                    {
                        "key": "managed_gateway_url",
                        "value": "file:///tmp/gateway",
                        "updated_at": "2026-05-23T09:00:00Z"
                    }
                ]
            }
        });

        let err = import_user_data(&conn, &payload, "replace_existing")
            .expect_err("invalid app setting should fail import");

        assert!(err.contains("managed_gateway_url"));
        assert_eq!(
            get_setting(&conn, "openai_model").expect("read model"),
            None
        );
    }

    #[test]
    fn import_rejects_oversized_text_field_before_transaction() {
        let conn = test_conn();
        let giant = "x".repeat(MAX_IMPORT_TEXT_FIELD_CHARS + 1);
        let payload = serde_json::json!({
            "app": "Bible AI",
            "export_version": EXPORT_VERSION,
            "user_schema_version": USER_SCHEMA_VERSION,
            "tables": { "user_notes": [ { "verse_id": 1, "body": giant } ] }
        });
        let err = import_user_data(&conn, &payload, "skip_existing")
            .expect_err("oversized text field should be rejected before import");
        assert!(err.contains("limit"), "expected a budget error, got: {err}");
    }

    #[test]
    fn import_rejects_too_many_rows_in_a_table_before_transaction() {
        let conn = test_conn();
        let rows: Vec<serde_json::Value> = (0..=MAX_IMPORT_ROWS_PER_TABLE)
            .map(|i| serde_json::json!({ "id": i as i64, "verse_id": 1, "label": "x" }))
            .collect();
        let payload = serde_json::json!({
            "app": "Bible AI",
            "export_version": EXPORT_VERSION,
            "user_schema_version": USER_SCHEMA_VERSION,
            "tables": { "bookmarks": rows }
        });
        let err = import_user_data(&conn, &payload, "skip_existing")
            .expect_err("over-budget row count should be rejected before import");
        assert!(
            err.contains("limit") && err.contains("bookmarks"),
            "expected a per-table budget error, got: {err}"
        );
    }

    #[test]
    fn user_data_import_rejects_invalid_guided_study_rows_transactionally() {
        let conn = test_conn();
        let payload = serde_json::json!({
            "app": "Bible AI",
            "export_version": EXPORT_VERSION,
            "user_schema_version": USER_SCHEMA_VERSION,
            "exported_at": "2026-05-22T09:00:00Z",
            "tables": {
                "theology_topics": [
                    {
                        "id": 9001,
                        "slug": "invalid-guided-import",
                        "title": "Invalid guided import"
                    }
                ],
                "guided_study_sessions": [
                    {
                        "id": 9101,
                        "topic_id": 9001,
                        "template_slug": "doctrine-reflection",
                        "review_cards_json": "{}"
                    }
                ]
            }
        });

        let err = import_user_data(&conn, &payload, "skip_existing")
            .expect_err("invalid guided rows should fail import");

        assert!(err.contains("review_cards_json"));
        assert!(list_theology_topics(&conn)
            .expect("list topics after rolled back import")
            .is_empty());
    }

    #[test]
    fn user_data_import_rejects_invalid_complete_council_sessions_transactionally() {
        let conn = test_conn();
        let payload = serde_json::json!({
            "app": "Bible AI",
            "export_version": EXPORT_VERSION,
            "user_schema_version": USER_SCHEMA_VERSION,
            "exported_at": "2026-05-22T09:00:00Z",
            "tables": {
                "council_sessions": [
                    {
                        "id": 9001,
                        "question": "Imported Council session",
                        "status": "complete",
                        "retrieval_mode": "mock",
                        "retrieved_evidence_json": "[]",
                        "response_json": "{}"
                    }
                ],
                "argument_annotations": [
                    {
                        "id": 9002,
                        "council_session_id": 9001,
                        "node_id": "claim-1",
                        "annotation": "Should roll back with the invalid session."
                    }
                ]
            }
        });

        let err = import_user_data(&conn, &payload, "skip_existing")
            .expect_err("invalid council rows should fail import");

        assert!(err.contains("response_json"));
        assert!(list_sessions(&conn, 10)
            .expect("list sessions after rolled back import")
            .is_empty());
        let annotation_count: i64 = conn
            .query_row("SELECT COUNT(*) FROM argument_annotations", [], |row| {
                row.get(0)
            })
            .expect("count annotations");
        assert_eq!(annotation_count, 0);
    }

    #[test]
    fn user_data_import_rejects_invalid_workspace_rows_transactionally() {
        let conn = test_conn();
        let payload = serde_json::json!({
            "app": "Bible AI",
            "export_version": EXPORT_VERSION,
            "user_schema_version": USER_SCHEMA_VERSION,
            "exported_at": "2026-05-22T09:00:00Z",
            "tables": {
                "study_workspaces": [
                    {
                        "id": 9001,
                        "title": "Imported workspace",
                        "description": null
                    }
                ],
                "study_items": [
                    {
                        "id": 9002,
                        "workspace_id": 9001,
                        "kind": "external_link",
                        "title": "Unsupported item",
                        "payload_json": "{}"
                    }
                ]
            }
        });

        let err = import_user_data(&conn, &payload, "skip_existing")
            .expect_err("invalid workspace rows should fail import");

        assert!(err.contains("unsupported kind"));
        assert!(list_study_workspaces(&conn, true)
            .expect("list workspaces after rolled back import")
            .is_empty());
    }

    #[test]
    fn user_data_import_rejects_invalid_theology_link_target_id_transactionally() {
        let conn = test_conn();
        let payload = serde_json::json!({
            "app": "Bible AI",
            "export_version": EXPORT_VERSION,
            "user_schema_version": USER_SCHEMA_VERSION,
            "exported_at": "2026-05-22T09:00:00Z",
            "tables": {
                "theology_topics": [
                    {
                        "id": 9001,
                        "slug": "invalid-link-target",
                        "title": "Invalid link target"
                    }
                ],
                "theology_links": [
                    {
                        "id": 9002,
                        "topic_id": 9001,
                        "link_kind": "council_session",
                        "target_id": -1,
                        "title": "Bad Council target",
                        "payload_json": "{}"
                    }
                ]
            }
        });

        let err = import_user_data(&conn, &payload, "skip_existing")
            .expect_err("invalid target ids should fail import");

        assert!(err.contains("target_id"));
        assert!(list_theology_topics(&conn)
            .expect("list topics after rolled back import")
            .is_empty());
    }

    #[test]
    fn user_data_import_rejects_object_json_fields_with_arrays_transactionally() {
        let conn = test_conn();
        let payload = serde_json::json!({
            "app": "Bible AI",
            "export_version": EXPORT_VERSION,
            "user_schema_version": USER_SCHEMA_VERSION,
            "exported_at": "2026-05-22T09:00:00Z",
            "tables": {
                "study_workspaces": [
                    {
                        "id": 9101,
                        "title": "Imported workspace",
                        "description": null
                    }
                ],
                "study_items": [
                    {
                        "id": 9102,
                        "workspace_id": 9101,
                        "kind": "note",
                        "title": "Wrong payload shape",
                        "payload_json": "[]"
                    }
                ]
            }
        });

        let err = import_user_data(&conn, &payload, "skip_existing")
            .expect_err("array payload should fail object-backed import");

        assert!(err.contains("payload_json"));
        assert!(err.contains("object"));
        assert!(list_study_workspaces(&conn, true)
            .expect("list workspaces after rolled back import")
            .is_empty());
    }

    #[test]
    fn user_data_export_skips_broad_secret_app_settings() {
        let conn = test_conn();
        upsert_setting(&conn, "openai_model", Some("gpt-5")).expect("save safe setting");
        upsert_setting(&conn, "smtp_password", Some("export-password"))
            .expect("save password setting");
        upsert_setting(&conn, "oauthClientSecret", Some("export-client-secret"))
            .expect("save client secret setting");
        upsert_setting(&conn, "serviceApiKey", Some("export-api-key"))
            .expect("save API key setting");
        upsert_setting(&conn, "legacy_non_secret_setting", Some("legacy value"))
            .expect("save unsupported setting");
        upsert_setting(&conn, "managed_gateway_url", Some("file:///tmp/gateway"))
            .expect("save invalid URL setting");

        let exported = export_user_data(&conn).expect("export user data");
        let settings = exported
            .pointer("/tables/app_settings")
            .and_then(serde_json::Value::as_array)
            .expect("settings rows");
        let keys = settings
            .iter()
            .filter_map(|row| row.get("key").and_then(serde_json::Value::as_str))
            .collect::<Vec<_>>();

        assert_eq!(keys, vec!["openai_model"]);
        let exported_text = exported.to_string();
        assert!(!exported_text.contains("export-password"));
        assert!(!exported_text.contains("export-client-secret"));
        assert!(!exported_text.contains("export-api-key"));
        assert!(!exported_text.contains("legacy value"));
        assert!(!exported_text.contains("file:///tmp/gateway"));
    }

    #[test]
    fn user_data_export_normalizes_safe_app_settings() {
        let conn = test_conn();
        upsert_setting(&conn, "retrieval_translation", Some("kjv"))
            .expect("save translation setting");
        upsert_setting(&conn, "active_translations", Some("kjv, BHS, kjv"))
            .expect("save active translations");
        upsert_setting(&conn, "font_scale", Some("9")).expect("save font scale");

        let exported = export_user_data(&conn).expect("export user data");
        let settings = exported
            .pointer("/tables/app_settings")
            .and_then(serde_json::Value::as_array)
            .expect("settings rows");
        let values = settings
            .iter()
            .filter_map(|row| {
                Some((
                    row.get("key")?.as_str()?.to_string(),
                    row.get("value")?.as_str()?.to_string(),
                ))
            })
            .collect::<std::collections::HashMap<_, _>>();

        assert_eq!(
            values.get("retrieval_translation"),
            Some(&"KJV".to_string())
        );
        assert_eq!(
            values.get("active_translations"),
            Some(&"KJV,BHS".to_string())
        );
        assert_eq!(values.get("font_scale"), Some(&"1.4".to_string()));
    }

    #[test]
    fn theology_export_redacts_quoted_secret_assignments() {
        let input =
            "OPENAI_API_KEY=\"sk-quoted-secret\" managed_gateway_token: 'gateway quoted secret' x-api-key=hyphen-secret";
        let output = sanitize_theology_export_text(input);
        assert_eq!(
            output,
            "[redacted secret] [redacted secret] [redacted secret]"
        );
        assert!(!output.contains("sk-quoted-secret"));
        assert!(!output.contains("gateway quoted secret"));
        assert!(!output.contains("hyphen-secret"));
    }

    #[test]
    fn theology_export_keeps_plain_secret_prose_while_redacting_setting_names() {
        let input = "The secret things belong to God, but oauth_client_secret should stay private.";
        let output = sanitize_theology_export_text(input);

        assert!(output.contains("The secret things belong to God"));
        assert!(output.contains("[redacted setting] should stay private"));
        assert!(!output.contains("oauth_client_secret"));
    }

    #[test]
    fn duplicate_import_reports_ignored_rows_as_skipped() {
        let conn = test_conn();
        upsert_setting(&conn, "openai_model", Some("gpt-5")).expect("save existing setting");
        let payload = serde_json::json!({
            "app": "Bible AI",
            "export_version": EXPORT_VERSION,
            "user_schema_version": USER_SCHEMA_VERSION,
            "exported_at": "2026-05-23T09:00:00Z",
            "tables": {
                "app_settings": [
                    {
                        "key": "openai_model",
                        "value": "gpt-5.1",
                        "updated_at": "2026-05-23T09:00:00Z"
                    }
                ]
            }
        });

        let report = import_user_data(&conn, &payload, "duplicate").expect("duplicate import");
        assert_eq!(report.imported, 0);
        assert_eq!(report.skipped, 1);
        assert_eq!(report.replaced, 0);
        assert_eq!(
            get_setting(&conn, "openai_model").expect("read existing setting"),
            Some("gpt-5".to_string())
        );
    }

    #[test]
    fn duplicate_import_remaps_workspace_council_payload_session_ids() {
        let conn = test_conn();
        let payload = serde_json::json!({
            "app": "Bible AI",
            "export_version": EXPORT_VERSION,
            "user_schema_version": USER_SCHEMA_VERSION,
            "exported_at": "2026-05-23T10:00:00Z",
            "tables": {
                "council_sessions": [
                    {
                        "id": 9101,
                        "question": "Which imported Council session should this workspace open?",
                        "topic_tag": null,
                        "status": "complete",
                        "created_at": "2026-05-23T10:00:00Z",
                        "completed_at": "2026-05-23T10:01:00Z",
                        "retrieval_mode": "mock",
                        "retrieval_options_json": "{}",
                        "retrieved_evidence_json": "[]",
                        "response_json": minimal_council_response_json()
                    }
                ],
                "study_workspaces": [
                    {
                        "id": 9201,
                        "title": "Imported Council Workspace",
                        "description": null,
                        "created_at": "2026-05-23T10:00:00Z",
                        "updated_at": "2026-05-23T10:00:00Z",
                        "archived_at": null
                    }
                ],
                "study_items": [
                    {
                        "id": 9301,
                        "workspace_id": 9201,
                        "kind": "council_result",
                        "title": "Imported Council result",
                        "payload_json": "{\"session_id\":9101,\"council_session_id\":9101,\"response\":{\"session_id\":9101}}",
                        "sort_order": 0,
                        "created_at": "2026-05-23T10:00:00Z",
                        "updated_at": "2026-05-23T10:00:00Z"
                    }
                ]
            }
        });

        import_user_data(&conn, &payload, "duplicate").expect("duplicate import");
        let new_session_id: i64 = conn
            .query_row(
                "SELECT id FROM council_sessions WHERE question LIKE 'Which imported Council session%'",
                [],
                |row| row.get(0),
            )
            .expect("read imported session id");
        assert_ne!(new_session_id, 9101);
        let payload_json: String = conn
            .query_row("SELECT payload_json FROM study_items", [], |row| row.get(0))
            .expect("read imported study item payload");
        let payload: serde_json::Value =
            serde_json::from_str(&payload_json).expect("parse study item payload");

        assert_eq!(
            payload
                .get("session_id")
                .and_then(serde_json::Value::as_i64),
            Some(new_session_id)
        );
        assert_eq!(
            payload
                .get("council_session_id")
                .and_then(serde_json::Value::as_i64),
            Some(new_session_id)
        );
        assert_eq!(
            payload
                .get("response")
                .and_then(|response| response.get("session_id"))
                .and_then(serde_json::Value::as_i64),
            Some(new_session_id)
        );
    }

    #[test]
    fn duplicate_import_remaps_workspace_resource_and_module_payload_ids() {
        let conn = test_conn();
        let old_source_id = 94_001;
        let old_collection_id = 94_002;
        let old_resource_entry_id = 94_003;
        let old_module_id = 94_004;
        let old_workspace_id = 94_005;

        let payload = serde_json::json!({
            "app": "Bible AI",
            "export_version": EXPORT_VERSION,
            "user_schema_version": USER_SCHEMA_VERSION,
            "exported_at": "2026-05-24T00:00:00Z",
            "tables": {
                "resource_sources": [
                    {
                        "id": old_source_id,
                        "slug": "workspace-payload-remap-source",
                        "title": "Workspace Payload Remap Source",
                        "source_url": "local fixture",
                        "license": "Public Domain",
                        "attribution": "Regression test fixture.",
                        "version": "fixture-1",
                        "metadata_json": "{}"
                    }
                ],
                "resource_collections": [
                    {
                        "id": old_collection_id,
                        "source_id": old_source_id,
                        "slug": "workspace-payload-remap-collection",
                        "title": "Workspace Payload Remap Collection",
                        "kind": "commentary",
                        "metadata_json": "{}"
                    }
                ],
                "resource_entries": [
                    {
                        "id": old_resource_entry_id,
                        "collection_id": old_collection_id,
                        "ref": "Fixture 1",
                        "title": "Imported Resource Payload Target",
                        "body": "Imported resource body.",
                        "search_text": "Imported resource body.",
                        "payload_json": "{}"
                    }
                ],
                "modules": [
                    {
                        "id": old_module_id,
                        "slug": "workspace-payload-remap-module",
                        "title": "Workspace Payload Remap Module",
                        "kind": "commentary",
                        "source": "Regression test",
                        "license": "Public Domain",
                        "version": "fixture-1"
                    }
                ],
                "module_entries": [
                    {
                        "id": 94_006,
                        "module_id": old_module_id,
                        "key_type": "verse",
                        "key_value": "1001001",
                        "title": "Imported module entry",
                        "body": "Imported module entry body.",
                        "metadata_json": "{}"
                    }
                ],
                "study_workspaces": [
                    {
                        "id": old_workspace_id,
                        "title": "Workspace Payload Remap",
                        "description": null,
                        "created_at": "2026-05-24T00:00:00Z",
                        "updated_at": "2026-05-24T00:00:00Z",
                        "archived_at": null
                    }
                ],
                "study_items": [
                    {
                        "id": 94_007,
                        "workspace_id": old_workspace_id,
                        "kind": "freeform",
                        "title": "Resource item",
                        "payload_json": serde_json::json!({
                            "type": "resource_entry",
                            "resource_entry_id": old_resource_entry_id,
                            "body": "Imported resource body."
                        }).to_string(),
                        "sort_order": 0,
                        "created_at": "2026-05-24T00:00:00Z",
                        "updated_at": "2026-05-24T00:00:00Z"
                    },
                    {
                        "id": 94_008,
                        "workspace_id": old_workspace_id,
                        "kind": "module_entry",
                        "title": "Module item",
                        "payload_json": serde_json::json!({
                            "module_id": old_module_id,
                            "module_title": "Workspace Payload Remap Module",
                            "body": "Imported module entry body."
                        }).to_string(),
                        "sort_order": 1,
                        "created_at": "2026-05-24T00:00:00Z",
                        "updated_at": "2026-05-24T00:00:00Z"
                    }
                ]
            }
        });

        import_user_data(&conn, &payload, "duplicate").expect("duplicate import");
        let new_resource_entry_id: i64 = conn
            .query_row(
                "SELECT id FROM resource_entries WHERE title = 'Imported Resource Payload Target'",
                [],
                |row| row.get(0),
            )
            .expect("read imported resource entry id");
        let new_module_id: i64 = conn
            .query_row(
                "SELECT id FROM modules WHERE slug = 'workspace-payload-remap-module'",
                [],
                |row| row.get(0),
            )
            .expect("read imported module id");
        assert_ne!(new_resource_entry_id, old_resource_entry_id);
        assert_ne!(new_module_id, old_module_id);

        let resource_payload_json: String = conn
            .query_row(
                "SELECT payload_json FROM study_items WHERE title = 'Resource item'",
                [],
                |row| row.get(0),
            )
            .expect("read resource workspace item payload");
        let resource_payload: serde_json::Value =
            serde_json::from_str(&resource_payload_json).expect("parse resource payload");
        assert_eq!(
            resource_payload
                .get("resource_entry_id")
                .and_then(serde_json::Value::as_i64),
            Some(new_resource_entry_id)
        );

        let module_payload_json: String = conn
            .query_row(
                "SELECT payload_json FROM study_items WHERE title = 'Module item'",
                [],
                |row| row.get(0),
            )
            .expect("read module workspace item payload");
        let module_payload: serde_json::Value =
            serde_json::from_str(&module_payload_json).expect("parse module payload");
        assert_eq!(
            module_payload
                .get("module_id")
                .and_then(serde_json::Value::as_i64),
            Some(new_module_id)
        );
    }

    #[test]
    fn user_data_import_rebuilds_resource_fts_without_malformed_index() {
        let conn = test_conn();
        let payload = serde_json::json!({
            "app": "Bible AI",
            "export_version": EXPORT_VERSION,
            "user_schema_version": USER_SCHEMA_VERSION,
            "exported_at": "2026-05-22T00:00:00Z",
            "tables": {
                "resource_sources": [
                    {
                        "id": 9001,
                        "slug": "fts-import-regression-source",
                        "title": "FTS Import Regression Source",
                        "source_url": "test",
                        "license": "Public Domain",
                        "attribution": "test",
                        "version": "test",
                        "imported_at": "2026-05-22T00:00:00Z",
                        "metadata_json": "{}"
                    }
                ],
                "resource_collections": [
                    {
                        "id": 9002,
                        "source_id": 9001,
                        "slug": "fts-import-regression-collection",
                        "title": "FTS Import Regression Collection",
                        "kind": "commentary",
                        "metadata_json": "{}"
                    }
                ],
                "resource_entries": [
                    {
                        "id": 9003,
                        "collection_id": 9002,
                        "ref": "FTS 1",
                        "title": "Imported FTS Resource",
                        "body": "A resource body with importedftsterm.",
                        "search_text": "Imported FTS Resource importedftsterm",
                        "payload_json": "{}"
                    }
                ]
            }
        });

        let report = import_user_data(&conn, &payload, "skip_existing").expect("import resources");
        assert_eq!(report.imported, 3);

        let hits = search_resources(&conn, "importedftsterm", None, None, None, None, 10)
            .expect("search imported resources");
        assert_eq!(hits.len(), 1);
        assert_eq!(hits[0].title.as_deref(), Some("Imported FTS Resource"));

        let quick_check: String = conn
            .query_row("PRAGMA quick_check", [], |row| row.get(0))
            .expect("quick_check");
        assert_eq!(quick_check, "ok");
    }

    #[test]
    fn replace_import_updates_parent_without_cascading_children() {
        let conn = test_conn();
        let topic_id = create_theology_topic(
            &conn,
            "Replace Parent Topic",
            Some("Original summary."),
            None,
        )
        .expect("create topic");
        upsert_theology_conclusion(
            &conn,
            &TheologyConclusion {
                id: None,
                topic_id,
                conclusion: Some("Child conclusion must survive parent replace.".to_string()),
                confidence: Some(80),
                unresolved_questions: None,
                changed_over_time: None,
                updated_at: None,
            },
        )
        .expect("save child conclusion");

        let payload = serde_json::json!({
            "app": "Bible AI",
            "export_version": EXPORT_VERSION,
            "user_schema_version": USER_SCHEMA_VERSION,
            "exported_at": "2026-05-22T00:00:00Z",
            "tables": {
                "theology_topics": [
                    {
                        "id": topic_id,
                        "slug": "replace-parent-topic",
                        "title": "Updated Parent Topic",
                        "parent_id": null,
                        "summary": "Updated summary.",
                        "sort_order": 11,
                        "created_at": "2026-05-22T00:00:00Z",
                        "updated_at": "2026-05-22T00:00:00Z"
                    }
                ]
            }
        });

        let report = import_user_data(&conn, &payload, "replace_existing").expect("replace import");
        assert_eq!(report.replaced, 1);
        let topic = get_theology_topic(&conn, topic_id)
            .expect("read topic")
            .expect("topic should remain");
        assert_eq!(topic.title, "Updated Parent Topic");
        let conclusion = get_theology_conclusion(&conn, topic_id)
            .expect("read child conclusion")
            .expect("child conclusion should not be cascaded away");
        assert_eq!(
            conclusion.conclusion.as_deref(),
            Some("Child conclusion must survive parent replace.")
        );
    }

    #[test]
    fn replace_import_rejects_non_primary_key_conflict_without_cascading_children() {
        let conn = test_conn();
        let topic_id = create_theology_topic(
            &conn,
            "Slug Conflict Topic",
            Some("Original summary."),
            None,
        )
        .expect("create topic");
        upsert_theology_conclusion(
            &conn,
            &TheologyConclusion {
                id: None,
                topic_id,
                conclusion: Some("Conclusion attached to the original topic.".to_string()),
                confidence: Some(70),
                unresolved_questions: None,
                changed_over_time: None,
                updated_at: None,
            },
        )
        .expect("save child conclusion");

        let payload = serde_json::json!({
            "app": "Bible AI",
            "export_version": EXPORT_VERSION,
            "user_schema_version": USER_SCHEMA_VERSION,
            "exported_at": "2026-05-22T00:00:00Z",
            "tables": {
                "theology_topics": [
                    {
                        "id": topic_id + 1000,
                        "slug": "slug-conflict-topic",
                        "title": "Conflicting Imported Topic",
                        "parent_id": null,
                        "summary": "This conflicts by slug, not primary key.",
                        "sort_order": 12,
                        "created_at": "2026-05-22T00:00:00Z",
                        "updated_at": "2026-05-22T00:00:00Z"
                    }
                ]
            }
        });

        let err = import_user_data(&conn, &payload, "replace_existing")
            .expect_err("replace import should reject non-PK unique conflict");
        assert!(err.contains("UNIQUE constraint failed"));
        let topic = get_theology_topic(&conn, topic_id)
            .expect("read topic")
            .expect("original topic should remain");
        assert_eq!(topic.title, "Slug Conflict Topic");
        let conclusion = get_theology_conclusion(&conn, topic_id)
            .expect("read child conclusion")
            .expect("child conclusion should remain");
        assert_eq!(
            conclusion.conclusion.as_deref(),
            Some("Conclusion attached to the original topic.")
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
    fn duplicate_import_remaps_theology_topic_parent_id() {
        let conn = test_conn();
        let old_parent_id = 20_001;
        let old_child_id = 20_002;
        let payload = serde_json::json!({
            "app": "Bible AI",
            "export_version": EXPORT_VERSION,
            "user_schema_version": USER_SCHEMA_VERSION,
            "exported_at": "2026-05-17T09:00:00Z",
            "tables": {
                "theology_topics": [
                    {
                        "id": old_child_id,
                        "slug": "duplicate-child-topic",
                        "title": "Duplicate Child Topic",
                        "parent_id": old_parent_id,
                        "summary": "Subtopic.",
                        "sort_order": 901,
                        "created_at": "2026-05-17T09:00:00Z",
                        "updated_at": "2026-05-17T09:00:00Z"
                    },
                    {
                        "id": old_parent_id,
                        "slug": "duplicate-parent-topic",
                        "title": "Duplicate Parent Topic",
                        "parent_id": null,
                        "summary": "Parent.",
                        "sort_order": 900,
                        "created_at": "2026-05-17T09:00:00Z",
                        "updated_at": "2026-05-17T09:00:00Z"
                    }
                ]
            }
        });

        // Source backups are not guaranteed to keep parents before children.
        // Duplicate import still needs to preserve the topic tree.
        let report = import_user_data(&conn, &payload, "duplicate").expect("duplicate import");
        assert_eq!(report.imported, 2);
        let topics = list_theology_topics(&conn).expect("list topics");
        let parent = topics
            .iter()
            .find(|t| t.title == "Duplicate Parent Topic")
            .expect("parent imported");
        let child = topics
            .iter()
            .find(|t| t.title == "Duplicate Child Topic")
            .expect("child imported");
        assert_ne!(parent.id, old_parent_id);
        assert_ne!(child.id, old_child_id);
        assert_eq!(
            child.parent_id,
            Some(parent.id),
            "child parent_id should point at the imported parent's new id",
        );
    }

    #[test]
    fn duplicate_import_remaps_doctrine_relation_targets() {
        let conn = test_conn();
        let old_source_topic_id = 30_001;
        let old_target_topic_id = 30_002;
        let payload = serde_json::json!({
            "app": "Bible AI",
            "export_version": EXPORT_VERSION,
            "user_schema_version": USER_SCHEMA_VERSION,
            "exported_at": "2026-05-22T09:00:00Z",
            "tables": {
                "theology_topics": [
                    {
                        "id": old_source_topic_id,
                        "slug": "duplicate-relation-source",
                        "title": "Duplicate Relation Source",
                        "parent_id": null,
                        "summary": "Source topic.",
                        "sort_order": 910,
                        "created_at": "2026-05-22T09:00:00Z",
                        "updated_at": "2026-05-22T09:00:00Z"
                    },
                    {
                        "id": old_target_topic_id,
                        "slug": "duplicate-relation-target",
                        "title": "Duplicate Relation Target",
                        "parent_id": null,
                        "summary": "Target topic.",
                        "sort_order": 911,
                        "created_at": "2026-05-22T09:00:00Z",
                        "updated_at": "2026-05-22T09:00:00Z"
                    }
                ],
                "theology_links": [
                    {
                        "id": 30_003,
                        "topic_id": old_source_topic_id,
                        "link_kind": "note",
                        "target_id": old_target_topic_id,
                        "title": "Supports: Duplicate Relation Target",
                        "payload_json": serde_json::json!({
                            "type": "doctrine_relation",
                            "relation": "supports",
                            "target_topic_id": old_target_topic_id,
                            "target_topic_title": "Duplicate Relation Target",
                            "note": "Duplicate import should remap this target."
                        }).to_string(),
                        "created_at": "2026-05-22T09:00:00Z"
                    }
                ]
            }
        });

        let report = import_user_data(&conn, &payload, "duplicate").expect("duplicate import");
        assert_eq!(report.imported, 3);
        let topics = list_theology_topics(&conn).expect("list topics");
        let source = topics
            .iter()
            .find(|topic| topic.title == "Duplicate Relation Source")
            .expect("source imported");
        let target = topics
            .iter()
            .find(|topic| topic.title == "Duplicate Relation Target")
            .expect("target imported");
        assert_ne!(source.id, old_source_topic_id);
        assert_ne!(target.id, old_target_topic_id);

        let links = list_theology_links(&conn, source.id).expect("list links");
        assert_eq!(links.len(), 1);
        assert_eq!(links[0].target_id, Some(target.id));
        let payload: serde_json::Value =
            serde_json::from_str(links[0].payload_json.as_deref().unwrap_or("{}"))
                .expect("relation payload");
        assert_eq!(
            payload
                .get("target_topic_id")
                .and_then(serde_json::Value::as_i64),
            Some(target.id)
        );
    }

    #[test]
    fn duplicate_import_remaps_workspace_item_theology_link_payload() {
        let conn = test_conn();
        let old_topic_id = 40_001;
        let old_workspace_id = 40_002;
        let old_item_id = 40_003;
        let payload = serde_json::json!({
            "app": "Bible AI",
            "export_version": EXPORT_VERSION,
            "user_schema_version": USER_SCHEMA_VERSION,
            "exported_at": "2026-05-23T10:30:00Z",
            "tables": {
                "theology_topics": [
                    {
                        "id": old_topic_id,
                        "slug": "duplicate-workspace-link-topic",
                        "title": "Duplicate Workspace Link Topic",
                        "parent_id": null,
                        "summary": "Workspace link duplicate import.",
                        "sort_order": 920,
                        "created_at": "2026-05-23T10:30:00Z",
                        "updated_at": "2026-05-23T10:30:00Z"
                    }
                ],
                "study_workspaces": [
                    {
                        "id": old_workspace_id,
                        "title": "Duplicate Linked Workspace",
                        "description": null,
                        "created_at": "2026-05-23T10:30:00Z",
                        "updated_at": "2026-05-23T10:30:00Z",
                        "archived_at": null
                    }
                ],
                "study_items": [
                    {
                        "id": old_item_id,
                        "workspace_id": old_workspace_id,
                        "kind": "freeform",
                        "title": "Duplicate linked note",
                        "payload_json": "{\"body\":\"Linked note\"}",
                        "sort_order": 0,
                        "created_at": "2026-05-23T10:30:00Z",
                        "updated_at": "2026-05-23T10:30:00Z"
                    }
                ],
                "theology_links": [
                    {
                        "id": 40_004,
                        "topic_id": old_topic_id,
                        "link_kind": "workspace_item",
                        "target_id": old_item_id,
                        "title": "Duplicate linked note",
                        "payload_json": serde_json::json!({
                            "source": "workspace",
                            "workspace_id": old_workspace_id,
                            "item_id": old_item_id,
                            "workspace_title": "Duplicate Linked Workspace"
                        }).to_string(),
                        "created_at": "2026-05-23T10:30:00Z"
                    }
                ]
            }
        });

        import_user_data(&conn, &payload, "duplicate").expect("duplicate import");
        let topic = list_theology_topics(&conn)
            .expect("list topics")
            .into_iter()
            .find(|topic| topic.title == "Duplicate Workspace Link Topic")
            .expect("imported topic");
        let workspace_id: i64 = conn
            .query_row(
                "SELECT id FROM study_workspaces WHERE title = 'Duplicate Linked Workspace'",
                [],
                |row| row.get(0),
            )
            .expect("read imported workspace id");
        let item_id: i64 = conn
            .query_row(
                "SELECT id FROM study_items WHERE title = 'Duplicate linked note'",
                [],
                |row| row.get(0),
            )
            .expect("read imported study item id");
        assert_ne!(workspace_id, old_workspace_id);
        assert_ne!(item_id, old_item_id);

        let links = list_theology_links(&conn, topic.id).expect("list links");
        assert_eq!(links.len(), 1);
        assert_eq!(links[0].target_id, Some(item_id));
        let payload: serde_json::Value =
            serde_json::from_str(links[0].payload_json.as_deref().unwrap_or("{}"))
                .expect("workspace link payload");
        assert_eq!(
            payload
                .get("workspace_id")
                .and_then(serde_json::Value::as_i64),
            Some(workspace_id)
        );
        assert_eq!(
            payload.get("item_id").and_then(serde_json::Value::as_i64),
            Some(item_id)
        );
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
                        "body": "User-authored workspace note carried into Theology. OPENAI_API_KEY=TEST_THEOLOGY_LEAK_VALUE legacy_custom_token C:\\Users\\Tester\\BibleApp\\user.sqlite"
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
        assert!(markdown.contains("[redacted setting]"));
        assert!(markdown.contains("[redacted local path]"));
        assert!(!markdown.contains("TEST_THEOLOGY_LEAK_VALUE"));
        assert!(!markdown.contains("legacy_custom_token"));
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

    #[test]
    fn app_settings_round_trip_search_strategy() {
        let conn = test_conn();
        let mut s = AppSettings::default();
        s.search_strategy = Some("hybrid".to_string());
        save_app_settings(&conn, &s).expect("save");
        let loaded = get_app_settings(&conn).expect("load");
        assert_eq!(loaded.search_strategy.as_deref(), Some("hybrid"));
    }

    #[test]
    fn normalize_app_setting_value_search_strategy() {
        // All three allowed values are accepted as-is.
        assert_eq!(
            normalize_app_setting_value("search_strategy", "keyword").unwrap(),
            "keyword"
        );
        assert_eq!(
            normalize_app_setting_value("search_strategy", "semantic").unwrap(),
            "semantic"
        );
        assert_eq!(
            normalize_app_setting_value("search_strategy", "hybrid").unwrap(),
            "hybrid"
        );
        // Whitespace is trimmed.
        assert_eq!(
            normalize_app_setting_value("search_strategy", " semantic ").unwrap(),
            "semantic"
        );
        // Unknown values are rejected.
        assert!(normalize_app_setting_value("search_strategy", "fulltext").is_err());
        assert!(normalize_app_setting_value("search_strategy", "").is_err());
    }

    #[test]
    fn user_data_import_normalizes_search_strategy() {
        let conn = test_conn();
        let payload = serde_json::json!({
            "app": "Bible AI",
            "export_version": EXPORT_VERSION,
            "user_schema_version": USER_SCHEMA_VERSION,
            "exported_at": "2026-05-25T09:00:00Z",
            "tables": {
                "app_settings": [
                    {
                        "key": "search_strategy",
                        "value": "semantic",
                        "updated_at": "2026-05-25T09:00:00Z"
                    }
                ]
            }
        });
        let report =
            import_user_data(&conn, &payload, "replace_existing").expect("import search_strategy");
        assert_eq!(report.imported, 1);
        assert_eq!(
            get_setting(&conn, "search_strategy").expect("read search_strategy"),
            Some("semantic".to_string())
        );

        // An unknown value must be rejected and the transaction rolled back.
        let bad_payload = serde_json::json!({
            "app": "Bible AI",
            "export_version": EXPORT_VERSION,
            "user_schema_version": USER_SCHEMA_VERSION,
            "exported_at": "2026-05-25T09:00:00Z",
            "tables": {
                "app_settings": [
                    {
                        "key": "search_strategy",
                        "value": "fulltext",
                        "updated_at": "2026-05-25T09:00:00Z"
                    }
                ]
            }
        });
        let err = import_user_data(&conn, &bad_payload, "replace_existing")
            .expect_err("unknown search_strategy should fail import");
        assert!(err.contains("search_strategy"));
        // Prior value must be unchanged (rollback).
        assert_eq!(
            get_setting(&conn, "search_strategy").expect("read after failed import"),
            Some("semantic".to_string())
        );
    }

    #[test]
    fn user_data_export_includes_search_strategy() {
        let conn = test_conn();
        upsert_setting(&conn, "search_strategy", Some("hybrid"))
            .expect("save search_strategy setting");

        let exported = export_user_data(&conn).expect("export user data");
        let settings = exported
            .pointer("/tables/app_settings")
            .and_then(serde_json::Value::as_array)
            .expect("settings rows");
        let values = settings
            .iter()
            .filter_map(|row| {
                Some((
                    row.get("key")?.as_str()?.to_string(),
                    row.get("value")?.as_str()?.to_string(),
                ))
            })
            .collect::<std::collections::HashMap<_, _>>();

        assert_eq!(values.get("search_strategy"), Some(&"hybrid".to_string()));
    }

    #[test]
    fn search_notes_matches_all_tokens_case_insensitively() {
        let conn = test_conn();
        upsert_note(&conn, 1_001_001, "God is love").unwrap();
        upsert_range_note(&conn, 1_001_002, 1_001_005, "love your neighbour").unwrap();
        upsert_note(&conn, 1_001_010, "the law and the prophets").unwrap();

        let hits = search_notes(&conn, &["love".to_string()], 50).unwrap();
        let bodies: Vec<&str> = hits.iter().map(|h| h.body.as_str()).collect();
        assert!(bodies.contains(&"God is love"));
        assert!(bodies.contains(&"love your neighbour"));
        assert!(!bodies.contains(&"the law and the prophets"));

        let hits = search_notes(&conn, &["love".to_string(), "neighbour".to_string()], 50).unwrap();
        assert_eq!(hits.len(), 1);
        assert_eq!(hits[0].kind, "range");
        assert_eq!(hits[0].end_verse_id, Some(1_001_005));

        let hits = search_notes(&conn, &["LOVE".to_string()], 50).unwrap();
        assert_eq!(hits.len(), 2);

        assert!(search_notes(&conn, &[], 50).unwrap().is_empty());
    }

    #[test]
    fn like_pattern_escapes_wildcards() {
        assert_eq!(like_pattern("a_b"), "%a\\_b%");
        assert_eq!(like_pattern("50%"), "%50\\%%");
        assert_eq!(like_pattern("grace"), "%grace%");
    }

    #[test]
    fn create_tag_is_find_or_create_case_insensitive() {
        let conn = test_conn();
        let a = create_tag(&conn, "Grace").expect("create");
        let b = create_tag(&conn, "  grace ").expect("find-or-create (trimmed, case-insensitive)");
        assert_eq!(a.id, b.id);
        assert_eq!(list_tags(&conn).expect("list").len(), 1);
        assert!(create_tag(&conn, "   ").is_err());
    }

    #[test]
    fn tag_item_is_idempotent_and_listed_grouped() {
        let conn = test_conn();
        let id = add_bookmark(&conn, 1_001_001, None, Some("b")).expect("bookmark");
        let t = create_tag(&conn, "alpha").expect("tag");
        assert_eq!(tag_item(&conn, t.id, "bookmark", id).expect("tag_item"), 1);
        assert_eq!(
            tag_item(&conn, t.id, "bookmark", id).expect("idempotent"),
            0
        );
        let links = list_item_tags(&conn, "bookmark").expect("list");
        assert_eq!(links.len(), 1);
        assert_eq!(links[0].item_id, id);
        assert_eq!(links[0].name, "alpha");
        assert_eq!(untag_item(&conn, t.id, "bookmark", id).expect("untag"), 1);
        assert!(list_item_tags(&conn, "bookmark").expect("list2").is_empty());
    }

    #[test]
    fn delete_tag_cascades_links() {
        let conn = test_conn();
        let id = add_bookmark(&conn, 1_001_001, None, Some("b")).expect("bookmark");
        let t = create_tag(&conn, "beta").expect("tag");
        tag_item(&conn, t.id, "bookmark", id).expect("tag_item");
        delete_tag(&conn, t.id).expect("delete_tag");
        assert!(list_item_tags(&conn, "bookmark").expect("list").is_empty());
    }

    #[test]
    fn delete_bookmark_clears_its_item_tags() {
        let conn = test_conn();
        let id = add_bookmark(&conn, 1_001_001, None, Some("b")).expect("bookmark");
        let t = create_tag(&conn, "gamma").expect("tag");
        tag_item(&conn, t.id, "bookmark", id).expect("tag_item");
        delete_bookmark(&conn, id).expect("delete_bookmark");
        assert!(list_item_tags(&conn, "bookmark").expect("list").is_empty());
        // The tag itself remains in the vocabulary.
        assert_eq!(list_tags(&conn).expect("tags").len(), 1);
    }

    #[test]
    fn list_tags_with_counts_counts_browsable_items() {
        let conn = test_conn();
        let bm = add_bookmark(&conn, 1_001_001, None, Some("b")).expect("bm");
        conn.execute(
            "INSERT INTO user_notes (verse_id, body) VALUES (?, ?)",
            params![1_001_002_i64, "note body"],
        )
        .expect("note");
        let shared = create_tag(&conn, "shared").expect("t1");
        create_tag(&conn, "empty").expect("t2");
        tag_item(&conn, shared.id, "bookmark", bm).expect("tag bm");
        tag_item(&conn, shared.id, "note", 1_001_002).expect("tag note");
        let counts = list_tags_with_counts(&conn).expect("counts");
        assert_eq!(
            counts
                .iter()
                .find(|c| c.name == "shared")
                .expect("shared")
                .count,
            2
        );
        assert_eq!(
            counts
                .iter()
                .find(|c| c.name == "empty")
                .expect("empty")
                .count,
            0
        );
    }

    #[test]
    fn delete_note_clears_its_item_tags() {
        let conn = test_conn();
        let verse_id = 1_001_003_i64;
        upsert_note(&conn, verse_id, "note body").expect("note");
        let t = create_tag(&conn, "delta").expect("tag");
        tag_item(&conn, t.id, "note", verse_id).expect("tag_item");
        delete_note(&conn, verse_id).expect("delete_note");
        // Deleting the note must remove its tag links, like delete_bookmark does.
        assert!(list_item_tags(&conn, "note").expect("list").is_empty());
        // The tag itself remains in the vocabulary.
        assert_eq!(list_tags(&conn).expect("tags").len(), 1);
    }

    #[test]
    fn list_tags_with_counts_ignores_orphaned_note_links() {
        let conn = test_conn();
        let verse_id = 1_001_004_i64;
        upsert_note(&conn, verse_id, "note body").expect("note");
        let t = create_tag(&conn, "omega").expect("tag");
        tag_item(&conn, t.id, "note", verse_id).expect("tag_item");
        // Orphan the tag link by removing the note row directly (bypassing
        // delete_note), simulating any path that leaves an item_tags row whose
        // underlying item no longer exists.
        conn.execute(
            "DELETE FROM user_notes WHERE verse_id = ?",
            params![verse_id],
        )
        .expect("orphan the note");
        let counts = list_tags_with_counts(&conn).expect("counts");
        let omega = counts.iter().find(|c| c.name == "omega").expect("omega");
        // The count must agree with the number of actually-visible tagged items.
        let visible = list_tagged_items(&conn, t.id).expect("items").len();
        assert_eq!(visible, 0, "orphaned link should not be a visible item");
        assert_eq!(
            omega.count as usize, visible,
            "tag count must match visible tagged items, not orphaned links"
        );
    }

    #[test]
    fn list_tagged_items_unions_bookmarks_and_notes() {
        let conn = test_conn();
        let bm = add_bookmark(&conn, 1_001_001, None, Some("my bm")).expect("bm");
        conn.execute(
            "INSERT INTO user_notes (verse_id, body) VALUES (?, ?)",
            params![1_001_002_i64, "my note"],
        )
        .expect("note");
        let t = create_tag(&conn, "topic").expect("t");
        tag_item(&conn, t.id, "bookmark", bm).expect("tag bm");
        tag_item(&conn, t.id, "note", 1_001_002).expect("tag note");
        let items = list_tagged_items(&conn, t.id).expect("items");
        assert_eq!(items.len(), 2);
        let b = items
            .iter()
            .find(|i| i.item_type == "bookmark")
            .expect("bm item");
        assert_eq!(b.verse_id, 1_001_001);
        assert_eq!(b.text.as_deref(), Some("my bm"));
        let n = items
            .iter()
            .find(|i| i.item_type == "note")
            .expect("note item");
        assert_eq!(n.verse_id, 1_001_002);
        assert_eq!(n.text.as_deref(), Some("my note"));
        assert!(list_tagged_items(&conn, 99_999).expect("empty").is_empty());
    }

    #[test]
    fn duplicate_import_remaps_tags_and_item_tags() {
        let conn = test_conn();
        // Pre-create a local tag "grace" so its id will differ from the imported id 10.
        let local_grace = create_tag(&conn, "grace").expect("pre-create grace tag");
        assert_ne!(local_grace.id, 10);

        let payload = serde_json::json!({
            "app": "Bible AI",
            "export_version": EXPORT_VERSION,
            "user_schema_version": USER_SCHEMA_VERSION,
            "exported_at": "2026-05-26T00:00:00Z",
            "tables": {
                "user_notes": [
                    {
                        "verse_id": 1_001_002_i64,
                        "body": "imported note",
                        "created_at": "2026-05-26T00:00:00Z",
                        "updated_at": "2026-05-26T00:00:00Z"
                    }
                ],
                "bookmarks": [
                    {
                        "id": 5,
                        "verse_id": 1_001_001_i64,
                        "end_verse_id": null,
                        "label": "imported bm",
                        "created_at": "2026-05-26T00:00:00Z"
                    }
                ],
                "tags": [
                    {
                        "id": 10,
                        "name": "grace",
                        "created_at": "2026-05-26T00:00:00Z"
                    }
                ],
                "item_tags": [
                    {
                        "tag_id": 10,
                        "item_type": "bookmark",
                        "item_id": 5,
                        "created_at": "2026-05-26T00:00:00Z"
                    },
                    {
                        "tag_id": 10,
                        "item_type": "note",
                        "item_id": 1_001_002_i64,
                        "created_at": "2026-05-26T00:00:00Z"
                    }
                ]
            }
        });

        import_user_data(&conn, &payload, "duplicate").expect("duplicate import");

        // Exactly one "grace" tag — the imported row merged into the pre-existing one.
        let tags = list_tags(&conn).expect("list tags");
        let grace_count = tags
            .iter()
            .filter(|t| t.name.eq_ignore_ascii_case("grace"))
            .count();
        assert_eq!(grace_count, 1, "expected exactly one grace tag");

        let grace_id = tags
            .iter()
            .find(|t| t.name.eq_ignore_ascii_case("grace"))
            .expect("grace tag")
            .id;

        let items = list_tagged_items(&conn, grace_id).expect("tagged items");
        assert_eq!(items.len(), 2, "expected 2 tagged items");
        let bm_item = items
            .iter()
            .find(|i| i.item_type == "bookmark")
            .expect("bookmark item");
        assert_eq!(bm_item.verse_id, 1_001_001);
        let note_item = items
            .iter()
            .find(|i| i.item_type == "note")
            .expect("note item");
        assert_eq!(note_item.verse_id, 1_001_002);
    }

    #[test]
    fn replace_import_links_tags_and_items() {
        let conn = test_conn();

        let payload = serde_json::json!({
            "app": "Bible AI",
            "export_version": EXPORT_VERSION,
            "user_schema_version": USER_SCHEMA_VERSION,
            "exported_at": "2026-05-26T00:00:00Z",
            "tables": {
                "user_notes": [
                    {
                        "verse_id": 1_001_002_i64,
                        "body": "imported note",
                        "created_at": "2026-05-26T00:00:00Z",
                        "updated_at": "2026-05-26T00:00:00Z"
                    }
                ],
                "bookmarks": [
                    {
                        "id": 5,
                        "verse_id": 1_001_001_i64,
                        "end_verse_id": null,
                        "label": "imported bm",
                        "created_at": "2026-05-26T00:00:00Z"
                    }
                ],
                "tags": [
                    {
                        "id": 10,
                        "name": "grace",
                        "created_at": "2026-05-26T00:00:00Z"
                    }
                ],
                "item_tags": [
                    {
                        "tag_id": 10,
                        "item_type": "bookmark",
                        "item_id": 5,
                        "created_at": "2026-05-26T00:00:00Z"
                    },
                    {
                        "tag_id": 10,
                        "item_type": "note",
                        "item_id": 1_001_002_i64,
                        "created_at": "2026-05-26T00:00:00Z"
                    }
                ]
            }
        });

        import_user_data(&conn, &payload, "replace_existing").expect("replace import");

        let tags = list_tags(&conn).expect("list tags");
        let grace_id = tags
            .iter()
            .find(|t| t.name.eq_ignore_ascii_case("grace"))
            .expect("grace tag")
            .id;

        let items = list_tagged_items(&conn, grace_id).expect("tagged items");
        assert_eq!(items.len(), 2, "expected bookmark + note links");
        assert!(items
            .iter()
            .any(|i| i.item_type == "bookmark" && i.verse_id == 1_001_001));
        assert!(items
            .iter()
            .any(|i| i.item_type == "note" && i.verse_id == 1_001_002));
    }

    #[test]
    fn export_includes_tags_and_item_tags() {
        let conn = test_conn();
        let bm_id = add_bookmark(&conn, 1_001_001, None, Some("export bm")).expect("bm");
        conn.execute(
            "INSERT INTO user_notes (verse_id, body) VALUES (?, ?)",
            params![1_001_002_i64, "export note"],
        )
        .expect("note");
        let tag = create_tag(&conn, "export-tag").expect("tag");
        tag_item(&conn, tag.id, "bookmark", bm_id).expect("tag bm");
        tag_item(&conn, tag.id, "note", 1_001_002).expect("tag note");

        let exported = export_user_data(&conn).expect("export");
        // The export shape is: { "tables": { "tags": [...], "item_tags": [...], ... } }
        let tables = exported
            .get("tables")
            .and_then(serde_json::Value::as_object)
            .expect("tables object");
        let tags_arr = tables
            .get("tags")
            .and_then(serde_json::Value::as_array)
            .expect("tags array");
        assert!(!tags_arr.is_empty(), "exported tags should be non-empty");
        let item_tags_arr = tables
            .get("item_tags")
            .and_then(serde_json::Value::as_array)
            .expect("item_tags array");
        assert!(
            !item_tags_arr.is_empty(),
            "exported item_tags should be non-empty"
        );
    }

    #[test]
    fn import_without_tags_tables_is_ok() {
        let conn = test_conn();
        let payload = serde_json::json!({
            "app": "Bible AI",
            "export_version": EXPORT_VERSION,
            "user_schema_version": USER_SCHEMA_VERSION,
            "exported_at": "2026-05-26T00:00:00Z",
            "tables": {
                "user_notes": [
                    {
                        "verse_id": 1_002_001_i64,
                        "body": "note without tags",
                        "created_at": "2026-05-26T00:00:00Z",
                        "updated_at": "2026-05-26T00:00:00Z"
                    }
                ]
            }
        });
        import_user_data(&conn, &payload, "duplicate").expect("import without tags ok");
    }
}

fn list_theology_topic_tree(conn: &Connection, root_id: i64) -> SqlResult<Vec<TheologyTopic>> {
    let topics = list_theology_topics(conn)?;
    let mut result = Vec::new();
    let mut seen = std::collections::HashSet::new();
    let mut stack = vec![root_id];
    while let Some(id) = stack.pop() {
        if !seen.insert(id) {
            continue;
        }
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
    let template_slug = template_slug.trim();
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
    let template_slug = clean_guided_template_slug(&session.template_slug)?;
    let review_cards_json = clean_json_array_payload(session.review_cards_json.as_deref())?;
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
            template_slug,
            clean_optional(&session.focus_question),
            clean_optional(&session.before_response),
            clean_optional(&session.after_response),
            clean_optional(&session.critique),
            review_cards_json,
            session.completed_at,
        ],
    )?;
    conn.query_row(
        "SELECT id FROM guided_study_sessions WHERE topic_id = ? AND template_slug = ?",
        params![session.topic_id, template_slug],
        |r| r.get(0),
    )
}

fn clean_guided_template_slug(slug: &str) -> SqlResult<&str> {
    let slug = slug.trim();
    if slug.is_empty()
        || slug.len() > 80
        || !slug
            .chars()
            .all(|ch| ch.is_ascii_lowercase() || ch.is_ascii_digit() || ch == '-')
    {
        return Err(rusqlite::Error::InvalidQuery);
    }
    Ok(slug)
}

fn clean_json_array_payload(payload_json: Option<&str>) -> SqlResult<String> {
    let payload = payload_json
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .unwrap_or("[]");
    validate_json_payload(payload, true)?;
    Ok(payload.to_string())
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
    let slug = source.slug.trim();
    let title = source.title.trim();
    let license = source.license.trim();
    let attribution = source.attribution.trim();
    if slug.is_empty() || title.is_empty() || license.is_empty() || attribution.is_empty() {
        return Err(rusqlite::Error::InvalidQuery);
    }
    let metadata_json = clean_json_payload(source.metadata_json.as_deref())?;
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
            slug,
            title,
            clean_optional(&source.source_url),
            license,
            attribution,
            clean_optional(&source.version),
            metadata_json,
        ],
    )?;
    conn.query_row(
        "SELECT id FROM resource_sources WHERE slug = ?",
        params![slug],
        |r| r.get(0),
    )
}

pub fn create_resource_collection(
    conn: &Connection,
    collection: &ResourceCollection,
) -> SqlResult<i64> {
    let slug = collection.slug.trim();
    let title = collection.title.trim();
    let kind = collection.kind.trim();
    if slug.is_empty() || title.is_empty() || kind.is_empty() {
        return Err(rusqlite::Error::InvalidQuery);
    }
    let metadata_json = clean_json_payload(collection.metadata_json.as_deref())?;
    conn.execute(
        "INSERT INTO resource_collections (source_id, slug, title, kind, metadata_json)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(source_id, slug) DO UPDATE SET
           title = excluded.title,
           kind = excluded.kind,
           metadata_json = excluded.metadata_json",
        params![collection.source_id, slug, title, kind, metadata_json,],
    )?;
    conn.query_row(
        "SELECT id FROM resource_collections WHERE source_id = ? AND slug = ?",
        params![collection.source_id, slug],
        |r| r.get(0),
    )
}

pub fn create_resource_entry(conn: &Connection, entry: &ResourceEntry) -> SqlResult<i64> {
    let body = entry.body.trim();
    if body.is_empty() {
        return Err(rusqlite::Error::InvalidQuery);
    }
    let search_text = entry
        .search_text
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .unwrap_or(body)
        .trim()
        .to_string();
    let title = clean_optional(&entry.title);
    let payload_json = clean_json_payload(entry.payload_json.as_deref())?;
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
            title.as_deref(),
            body,
            search_text,
            payload_json,
        ],
    )?;
    let id: i64 = if let Some(title) = title.as_deref() {
        conn.query_row(
            "SELECT id FROM resource_entries WHERE collection_id = ? AND title = ?",
            params![entry.collection_id, title],
            |r| r.get(0),
        )?
    } else {
        conn.last_insert_rowid()
    };
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
        read_resource_entry_row,
    )?;
    rows.collect()
}

fn resource_fts_query(query: &str) -> String {
    query
        .split(|c: char| !c.is_alphanumeric())
        .filter(|term| term.chars().count() >= 2)
        .map(|term| term.replace('"', "\"\""))
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
        read_resource_entry_row,
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
        read_resource_entry_row,
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
    let node_id = annotation.node_id.trim();
    let body = annotation.annotation.trim();
    if node_id.is_empty() || body.is_empty() {
        return Err(rusqlite::Error::InvalidQuery);
    }
    conn.execute(
        "INSERT INTO argument_annotations (council_session_id, node_id, annotation)
         VALUES (?, ?, ?)
         ON CONFLICT(council_session_id, node_id) DO UPDATE SET
           annotation = excluded.annotation,
           updated_at = datetime('now')",
        params![annotation.council_session_id, node_id, body],
    )?;
    conn.query_row(
        "SELECT id FROM argument_annotations WHERE council_session_id = ? AND node_id = ?",
        params![annotation.council_session_id, node_id],
        |r| r.get(0),
    )
}

pub fn delete_argument_annotation(conn: &Connection, id: i64) -> SqlResult<usize> {
    conn.execute("DELETE FROM argument_annotations WHERE id = ?", params![id])
}

// ---------- Backup/export ----------

#[derive(Debug, Serialize, Clone)]
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
        .filter_map(normalized_export_app_setting_row)
        .collect::<Vec<_>>();
    Ok(serde_json::Value::Array(safe_rows))
}

fn normalized_export_app_setting_row(row: &serde_json::Value) -> Option<serde_json::Value> {
    let key = row.get("key")?.as_str()?.trim();
    if is_secret_setting_key(key) || !is_supported_app_setting_key(key) {
        return None;
    }
    let value = normalize_app_setting_value(key, row.get("value")?.as_str()?).ok()?;
    let mut normalized = row.clone();
    let obj = normalized.as_object_mut()?;
    obj.insert(
        "key".to_string(),
        serde_json::Value::String(key.to_string()),
    );
    obj.insert("value".to_string(), serde_json::Value::String(value));
    Some(normalized)
}

fn is_secret_setting_key(key: &str) -> bool {
    is_secret_key_name(key)
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
    validate_import_budgets(tables)?;

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

/// Enforce import size budgets on the parsed payload before any transaction
/// starts. Rejects over-budget per-table row counts, total row counts, and
/// oversized text fields with a clear message.
fn validate_import_budgets(
    tables: &serde_json::Map<String, serde_json::Value>,
) -> Result<(), String> {
    let mut total_rows = 0usize;
    for (table, value) in tables {
        let Some(rows) = value.as_array() else {
            continue; // non-array shapes are rejected later by row validation
        };
        if rows.len() > MAX_IMPORT_ROWS_PER_TABLE {
            return Err(format!(
                "import rejected: table '{table}' has {} rows, over the limit of {MAX_IMPORT_ROWS_PER_TABLE}",
                rows.len()
            ));
        }
        total_rows += rows.len();
        for row in rows {
            let Some(obj) = row.as_object() else { continue };
            for (column, field) in obj {
                if let Some(text) = field.as_str() {
                    if text.len() > MAX_IMPORT_TEXT_FIELD_CHARS {
                        return Err(format!(
                            "import rejected: field '{table}.{column}' is {} characters, over the limit of {MAX_IMPORT_TEXT_FIELD_CHARS}",
                            text.len()
                        ));
                    }
                }
            }
        }
    }
    if total_rows > MAX_IMPORT_ROWS_TOTAL {
        return Err(format!(
            "import rejected: {total_rows} total rows, over the limit of {MAX_IMPORT_ROWS_TOTAL}"
        ));
    }
    Ok(())
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
    let mut study_item_id_map = std::collections::HashMap::<i64, i64>::new();
    let mut tag_id_map = std::collections::HashMap::<i64, i64>::new();
    let mut bookmark_id_map = std::collections::HashMap::<i64, i64>::new();

    for table in USER_TABLES {
        let Some(rows_value) = tables.get(*table) else {
            continue;
        };
        let rows = rows_value
            .as_array()
            .ok_or_else(|| format!("table {table} must be an array"))?;
        report.tables += 1;
        let columns = table_column_names(conn, table).map_err(|e| e.to_string())?;
        let primary_key_columns =
            table_primary_key_columns(conn, table).map_err(|e| e.to_string())?;

        for row_value in ordered_import_rows(table, rows) {
            let row = row_value
                .as_object()
                .ok_or_else(|| format!("table {table} contains a non-object row"))?;
            if *table == "app_settings" {
                let key = row
                    .get("key")
                    .and_then(serde_json::Value::as_str)
                    .map(str::trim)
                    .unwrap_or_default();
                if is_secret_setting_key(key)
                    || (!key.is_empty() && !is_supported_app_setting_key(key))
                {
                    report.skipped += 1;
                    continue;
                }
            }
            if *table == "tags" {
                let old_id = row.get("id").and_then(serde_json::Value::as_i64);
                let name = row
                    .get("name")
                    .and_then(serde_json::Value::as_str)
                    .map(str::trim)
                    .unwrap_or_default();
                if name.is_empty() {
                    report.skipped += 1;
                    continue;
                }
                let tag = create_tag(conn, name).map_err(|e| e.to_string())?;
                if let Some(old) = old_id {
                    tag_id_map.insert(old, tag.id);
                }
                report.imported += 1;
                continue;
            }
            if *table == "item_tags" {
                let Some(old_tag) = row.get("tag_id").and_then(serde_json::Value::as_i64) else {
                    report.skipped += 1;
                    continue;
                };
                let Some(&new_tag) = tag_id_map.get(&old_tag) else {
                    report.skipped += 1;
                    continue;
                };
                let item_type = row
                    .get("item_type")
                    .and_then(serde_json::Value::as_str)
                    .unwrap_or_default()
                    .to_string();
                let Some(old_item) = row.get("item_id").and_then(serde_json::Value::as_i64) else {
                    report.skipped += 1;
                    continue;
                };
                let new_item = match item_type.as_str() {
                    "bookmark" => match bookmark_id_map.get(&old_item) {
                        Some(&n) => n,
                        None => {
                            report.skipped += 1;
                            continue;
                        }
                    },
                    // notes are keyed by verse_id (stable corpus id — not remapped).
                    "note" => old_item,
                    // range_note / study_item are not yet taggable; when they are, add their
                    // id-maps here (study_item_id_map exists; range_note needs a new map).
                    _ => {
                        report.skipped += 1;
                        continue;
                    }
                };
                let affected = conn
                    .execute(
                        "INSERT OR IGNORE INTO item_tags (tag_id, item_type, item_id) VALUES (?, ?, ?)",
                        params![new_tag, item_type, new_item],
                    )
                    .map_err(|e| format!("import item_tags: {e}"))?;
                if affected > 0 {
                    report.imported += 1;
                } else {
                    report.skipped += 1;
                }
                continue;
            }
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
                    &study_item_id_map,
                )?;
            }
            normalize_import_row(table, &mut row)?;

            let was_existing = conflict_strategy == "replace_existing"
                && row_exists_by_primary_key(conn, table, &primary_key_columns, &row)
                    .map_err(|e| e.to_string())?;
            let affected = insert_import_row(
                conn,
                table,
                &columns,
                &primary_key_columns,
                &row,
                conflict_strategy,
            )
            .map_err(|e| format!("import {table}: {e}"))?;

            if affected == 0 {
                report.skipped += 1;
            } else if conflict_strategy == "replace_existing" && was_existing {
                report.replaced += affected;
            } else {
                report.imported += affected;
            }

            if *table == "bookmarks" {
                if let Some(old_id) = old_id {
                    if let Some(resolved) =
                        resolve_imported_bookmark_id(conn, &row).map_err(|e| e.to_string())?
                    {
                        bookmark_id_map.insert(old_id, resolved);
                    }
                }
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
                } else if *table == "study_items" {
                    if let Some(old_id) = old_id {
                        study_item_id_map.insert(old_id, conn.last_insert_rowid());
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

fn ordered_import_rows<'a>(
    table: &str,
    rows: &'a [serde_json::Value],
) -> Vec<&'a serde_json::Value> {
    let mut ordered = rows.iter().collect::<Vec<_>>();
    if table == "theology_topics" {
        let parent_by_id = rows
            .iter()
            .filter_map(|row| {
                let obj = row.as_object()?;
                let id = obj.get("id").and_then(serde_json::Value::as_i64)?;
                let parent_id = obj.get("parent_id").and_then(serde_json::Value::as_i64);
                Some((id, parent_id))
            })
            .collect::<std::collections::HashMap<_, _>>();
        ordered.sort_by_key(|row| theology_import_depth(row, &parent_by_id));
    }
    ordered
}

fn theology_import_depth(
    row: &serde_json::Value,
    parent_by_id: &std::collections::HashMap<i64, Option<i64>>,
) -> usize {
    let Some(obj) = row.as_object() else {
        return 0;
    };
    let mut depth = 0;
    let mut seen = std::collections::HashSet::new();
    let mut parent = obj.get("parent_id").and_then(serde_json::Value::as_i64);
    while let Some(parent_id) = parent {
        if !seen.insert(parent_id) {
            break;
        }
        let Some(next_parent) = parent_by_id.get(&parent_id) else {
            break;
        };
        depth += 1;
        parent = *next_parent;
    }
    depth
}

fn rebuild_resource_entries_fts(conn: &Connection) -> SqlResult<()> {
    conn.execute(
        "INSERT INTO resource_entries_fts(resource_entries_fts) VALUES('rebuild')",
        [],
    )?;
    Ok(())
}

fn normalize_import_row(
    table: &str,
    row: &mut serde_json::Map<String, serde_json::Value>,
) -> Result<(), String> {
    match table {
        "app_settings" => {
            normalize_app_setting_import_row(row, table)?;
        }
        "council_sessions" => {
            normalize_required_import_text(row, table, "question")?;
            normalize_optional_import_text(row, "retrieval_mode");
            normalize_optional_json_import_text(row, table, "retrieval_options_json", false)?;
            normalize_optional_json_import_text(row, table, "retrieved_evidence_json", true)?;
            let status = row
                .get("status")
                .and_then(serde_json::Value::as_str)
                .map(str::trim)
                .unwrap_or("pending")
                .to_string();
            if status == "complete" {
                normalize_council_response_import_text(row, table, "response_json")?;
            } else {
                normalize_optional_json_import_text(row, table, "response_json", false)?;
            }
        }
        "council_position_judgments" => {
            normalize_required_import_text(row, table, "position_label")?;
            let user_rating = normalize_required_import_text(row, table, "user_rating")?;
            if !valid_position_rating(user_rating) {
                return Err(format!(
                    "table {table} has invalid user_rating: {user_rating}"
                ));
            }
        }
        "study_workspaces" => {
            normalize_required_import_text(row, table, "title")?;
        }
        "study_items" => {
            let kind = normalize_required_import_text(row, table, "kind")?;
            if !is_supported_study_item_kind(kind) {
                return Err(format!("table {table} has unsupported kind: {kind}"));
            }
            normalize_json_import_text(row, table, "payload_json", "{}", false)?;
        }
        "theology_topics" => {
            normalize_required_import_text(row, table, "title")?;
        }
        "theology_positions" => {
            normalize_required_import_text(row, table, "label")?;
        }
        "theology_links" => {
            let link_kind = normalize_required_import_text(row, table, "link_kind")?;
            if !is_supported_theology_link_kind(link_kind) {
                return Err(format!(
                    "table {table} has unsupported link_kind: {link_kind}"
                ));
            }
            normalize_optional_positive_integer_import_value(row, table, "target_id")?;
            normalize_json_import_text(row, table, "payload_json", "{}", false)?;
        }
        "guided_study_sessions" => {
            let slug = normalize_required_import_text(row, table, "template_slug")?;
            clean_guided_template_slug(slug)
                .map_err(|_| format!("table {table} has invalid template_slug: {slug}"))?;
            normalize_json_import_text(row, table, "review_cards_json", "[]", true)?;
        }
        "argument_annotations" => {
            normalize_required_import_text(row, table, "node_id")?;
            normalize_required_import_text(row, table, "annotation")?;
        }
        "resource_sources" => {
            normalize_required_import_text(row, table, "slug")?;
            normalize_required_import_text(row, table, "title")?;
            normalize_required_import_text(row, table, "license")?;
            normalize_required_import_text(row, table, "attribution")?;
            normalize_optional_import_text(row, "source_url");
            normalize_optional_import_text(row, "version");
            normalize_json_import_text(row, table, "metadata_json", "{}", false)?;
        }
        "resource_collections" => {
            normalize_required_import_text(row, table, "slug")?;
            normalize_required_import_text(row, table, "title")?;
            normalize_required_import_text(row, table, "kind")?;
            normalize_json_import_text(row, table, "metadata_json", "{}", false)?;
        }
        "resource_entries" => {
            let body = normalize_required_import_text(row, table, "body")?.to_string();
            normalize_optional_import_text(row, "ref");
            normalize_optional_import_text(row, "title");
            normalize_optional_import_text(row, "search_text");
            if row
                .get("search_text")
                .and_then(serde_json::Value::as_str)
                .is_none_or(|value| value.trim().is_empty())
            {
                row.insert("search_text".to_string(), serde_json::Value::String(body));
            }
            normalize_json_import_text(row, table, "payload_json", "{}", false)?;
        }
        "saved_searches" => {
            normalize_required_import_text(row, table, "title")?;
            normalize_required_import_text(row, table, "query")?;
            normalize_optional_import_text(row, "translation_code");
            normalize_optional_import_text(row, "testament");
        }
        "modules" => {
            normalize_required_import_text(row, table, "slug")?;
            normalize_required_import_text(row, table, "title")?;
            let kind = normalize_required_import_text(row, table, "kind")?;
            if !is_supported_module_kind(kind) {
                return Err(format!("table {table} has unsupported kind: {kind}"));
            }
            normalize_optional_import_text(row, "source");
            normalize_optional_import_text(row, "license");
            normalize_optional_import_text(row, "version");
        }
        "module_entries" => {
            let key_type = normalize_required_import_text(row, table, "key_type")?;
            if !is_supported_module_key_type(key_type) {
                return Err(format!(
                    "table {table} has unsupported key_type: {key_type}"
                ));
            }
            normalize_required_import_text(row, table, "key_value")?;
            normalize_required_import_text(row, table, "body")?;
            normalize_optional_import_text(row, "title");
            normalize_optional_json_import_text(row, table, "metadata_json", false)?;
        }
        _ => {}
    }
    Ok(())
}

fn normalize_app_setting_import_row(
    row: &mut serde_json::Map<String, serde_json::Value>,
    table: &str,
) -> Result<(), String> {
    let key = normalize_required_import_text(row, table, "key")?.to_string();
    if !is_supported_app_setting_key(&key) {
        return Err(format!("table {table} has unsupported app setting: {key}"));
    }
    let value = normalize_required_import_text(row, table, "value")?.to_string();
    let normalized = normalize_app_setting_value(&key, &value)?;
    row.insert("key".to_string(), serde_json::Value::String(key));
    row.insert("value".to_string(), serde_json::Value::String(normalized));
    Ok(())
}

fn is_supported_app_setting_key(key: &str) -> bool {
    APP_SETTING_KEYS.contains(&key)
}

fn normalize_app_setting_value(key: &str, value: &str) -> Result<String, String> {
    match key {
        "managed_gateway_url" | "ollama_host" => normalize_http_setting_value(key, value),
        "claude_model" | "openai_model" | "gemini_model" | "anthropic_model" => {
            normalize_bounded_setting_text(key, value, 128)
        }
        "retrieval_translation" => normalize_translation_setting_value(key, value),
        "active_translations" => normalize_active_translation_setting_value(value),
        "font_scale" => {
            let parsed = value
                .trim()
                .parse::<f64>()
                .map_err(|_| "font_scale must be a number".to_string())?;
            if !parsed.is_finite() {
                return Err("font_scale must be finite".to_string());
            }
            Ok(parsed.clamp(0.8, 1.4).to_string())
        }
        "reader_layout" => normalize_enum_setting_value(key, value, &["columns", "interleaved"]),
        "reader_density" => normalize_enum_setting_value(key, value, &["comfortable", "compact"]),
        "search_strategy" => {
            normalize_enum_setting_value(key, value, &["keyword", "semantic", "hybrid"])
        }
        "sync_scroll" => normalize_bool_setting_value(key, value),
        _ => Err(format!("unsupported app setting: {key}")),
    }
}

fn normalize_http_setting_value(key: &str, value: &str) -> Result<String, String> {
    let value = normalize_bounded_setting_text(key, value, 2048)?;
    let parsed = reqwest::Url::parse(&value)
        .map_err(|_| format!("app setting {key} must be a valid URL"))?;
    if !matches!(parsed.scheme(), "http" | "https") {
        return Err(format!("app setting {key} must use http or https"));
    }
    if parsed.host_str().is_none() {
        return Err(format!("app setting {key} must include a host"));
    }
    Ok(value)
}

fn normalize_bounded_setting_text(
    key: &str,
    value: &str,
    max_chars: usize,
) -> Result<String, String> {
    let value = value.trim();
    if value.is_empty() {
        return Err(format!("app setting {key} requires a value"));
    }
    if value.chars().count() > max_chars {
        return Err(format!("app setting {key} is too long"));
    }
    if value.chars().any(char::is_control) {
        return Err(format!(
            "app setting {key} cannot contain control characters"
        ));
    }
    Ok(value.to_string())
}

fn normalize_translation_setting_value(key: &str, value: &str) -> Result<String, String> {
    let value = value.trim();
    if value.is_empty() {
        return Err(format!("app setting {key} requires a value"));
    }
    if value.len() > 32 {
        return Err(format!("app setting {key} is too long"));
    }
    if !value
        .chars()
        .all(|ch| ch.is_ascii_alphanumeric() || ch == '_' || ch == '-')
    {
        return Err(format!("app setting {key} contains unsupported characters"));
    }
    Ok(value.to_ascii_uppercase())
}

fn normalize_active_translation_setting_value(value: &str) -> Result<String, String> {
    let mut seen = std::collections::HashSet::new();
    let mut codes = Vec::new();
    for part in value.split(',') {
        let part = part.trim();
        if part.is_empty() {
            continue;
        }
        let code = normalize_translation_setting_value("active_translations", part)?;
        if seen.insert(code.clone()) {
            codes.push(code);
        }
    }
    if codes.is_empty() {
        return Err("app setting active_translations requires a value".to_string());
    }
    if codes.len() > 24 {
        return Err("too many active translations".to_string());
    }
    Ok(codes.join(","))
}

fn normalize_enum_setting_value(
    key: &str,
    value: &str,
    allowed: &[&str],
) -> Result<String, String> {
    let value = value.trim();
    if allowed.contains(&value) {
        Ok(value.to_string())
    } else {
        Err(format!("app setting {key} has unsupported value: {value}"))
    }
}

fn normalize_bool_setting_value(key: &str, value: &str) -> Result<String, String> {
    match value.trim().to_ascii_lowercase().as_str() {
        "true" => Ok("true".to_string()),
        "false" => Ok("false".to_string()),
        _ => Err(format!("app setting {key} must be true or false")),
    }
}

fn normalize_required_import_text<'a>(
    row: &'a mut serde_json::Map<String, serde_json::Value>,
    table: &str,
    column: &str,
) -> Result<&'a str, String> {
    let clean = {
        let raw = row
            .get(column)
            .and_then(serde_json::Value::as_str)
            .ok_or_else(|| format!("table {table} row requires text column {column}"))?;
        let clean = raw.trim();
        if clean.is_empty() {
            return Err(format!("table {table} row requires non-empty {column}"));
        }
        clean.to_string()
    };
    row.insert(column.to_string(), serde_json::Value::String(clean));
    row.get(column)
        .and_then(serde_json::Value::as_str)
        .ok_or_else(|| format!("table {table} row requires text column {column}"))
}

fn normalize_optional_import_text(
    row: &mut serde_json::Map<String, serde_json::Value>,
    column: &str,
) {
    let Some(raw) = row.get(column).and_then(serde_json::Value::as_str) else {
        return;
    };
    let clean = raw.trim();
    if clean.is_empty() {
        row.insert(column.to_string(), serde_json::Value::Null);
    } else if clean != raw {
        row.insert(
            column.to_string(),
            serde_json::Value::String(clean.to_string()),
        );
    }
}

fn normalize_council_response_import_text(
    row: &mut serde_json::Map<String, serde_json::Value>,
    table: &str,
    column: &str,
) -> Result<(), String> {
    let raw = row
        .get(column)
        .and_then(serde_json::Value::as_str)
        .ok_or_else(|| format!("table {table} row requires text column {column}"))?;
    let clean = raw.trim();
    if clean.is_empty() {
        return Err(format!("table {table} row requires non-empty {column}"));
    }
    validate_import_json_value(table, column, clean, false)?;
    let parsed = serde_json::from_str::<serde_json::Value>(clean)
        .map_err(|e| format!("table {table} row has invalid {column}: {e}"))?;
    validate_council_response_value(&parsed)
        .map_err(|e| format!("table {table} row has invalid {column}: {e}"))?;
    row.insert(
        column.to_string(),
        serde_json::Value::String(clean.to_string()),
    );
    Ok(())
}

fn normalize_optional_json_import_text(
    row: &mut serde_json::Map<String, serde_json::Value>,
    table: &str,
    column: &str,
    require_array: bool,
) -> Result<(), String> {
    let Some(value) = row.get(column) else {
        return Ok(());
    };
    if value.is_null() {
        return Ok(());
    }
    let raw = value
        .as_str()
        .ok_or_else(|| format!("table {table} row requires text column {column}"))?;
    let clean = raw.trim();
    if clean.is_empty() {
        row.insert(column.to_string(), serde_json::Value::Null);
        return Ok(());
    }
    validate_import_json_value(table, column, clean, require_array)?;
    row.insert(
        column.to_string(),
        serde_json::Value::String(clean.to_string()),
    );
    Ok(())
}

fn normalize_json_import_text(
    row: &mut serde_json::Map<String, serde_json::Value>,
    table: &str,
    column: &str,
    default: &str,
    require_array: bool,
) -> Result<(), String> {
    let raw = row
        .get(column)
        .and_then(serde_json::Value::as_str)
        .unwrap_or(default);
    let clean = raw.trim();
    validate_import_json_value(table, column, clean, require_array)?;
    row.insert(
        column.to_string(),
        serde_json::Value::String(clean.to_string()),
    );
    Ok(())
}

fn normalize_optional_positive_integer_import_value(
    row: &serde_json::Map<String, serde_json::Value>,
    table: &str,
    column: &str,
) -> Result<(), String> {
    let Some(value) = row.get(column) else {
        return Ok(());
    };
    if value.is_null() {
        return Ok(());
    }
    match value.as_i64() {
        Some(id) if id > 0 => Ok(()),
        _ => Err(format!(
            "table {table} row requires {column} to be a positive integer or null"
        )),
    }
}

fn validate_import_json_value(
    table: &str,
    column: &str,
    value: &str,
    require_array: bool,
) -> Result<(), String> {
    let parsed = serde_json::from_str::<serde_json::Value>(value)
        .map_err(|e| format!("table {table} row has invalid {column}: {e}"))?;
    if require_array {
        if !parsed.is_array() {
            return Err(format!(
                "table {table} row requires {column} to be an array"
            ));
        }
    } else if !parsed.is_object() {
        return Err(format!(
            "table {table} row requires {column} to be an object"
        ));
    }
    Ok(())
}

/// Remap an optional foreign-key column on an import row. If the referenced
/// row was imported under a new id, point at it; if it was not imported, null
/// the link rather than risk an FK violation or a reference to an unrelated
/// row that happens to reuse the old id.
fn remap_optional_fk(
    row: &mut serde_json::Map<String, serde_json::Value>,
    column: &str,
    id_map: &std::collections::HashMap<i64, i64>,
) {
    let Some(old) = row.get(column).and_then(serde_json::Value::as_i64) else {
        return;
    };
    let value = match id_map.get(&old) {
        Some(new) => serde_json::json!(new),
        None => serde_json::Value::Null,
    };
    row.insert(column.to_string(), value);
}

#[allow(clippy::too_many_arguments)] // Threads several id-remap maps for import; a context struct buys little here.
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
    study_item_id_map: &std::collections::HashMap<i64, i64>,
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
            remap_workspace_council_payload(row, council_session_id_map);
            remap_workspace_item_payload_ids(row, resource_entry_id_map, module_id_map);
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
        "theology_topics" => {
            prepare_duplicate_theology_slug(conn, row)?;
            // Remap the self-referential parent. theology_topics.parent_id has
            // an FK constraint, so a stale id would either fail the import or
            // silently re-parent under an unrelated topic.
            remap_optional_fk(row, "parent_id", theology_topic_id_map);
        }
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
            if table == "theology_links" {
                // target_id points into a different table per link_kind; remap
                // it for the kinds whose ids change on a duplicate import.
                // verse / verse_range target stable corpus verse ids.
                match row.get("link_kind").and_then(serde_json::Value::as_str) {
                    Some("resource_entry") => {
                        remap_optional_fk(row, "target_id", resource_entry_id_map);
                    }
                    Some("council_session") => {
                        remap_optional_fk(row, "target_id", council_session_id_map);
                    }
                    Some("workspace_item") => {
                        remap_optional_fk(row, "target_id", study_item_id_map);
                        remap_workspace_item_link_payload(row, workspace_id_map, study_item_id_map);
                    }
                    Some("note") => {
                        remap_doctrine_relation_link(row, theology_topic_id_map);
                    }
                    _ => {}
                }
            }
        }
        _ => {}
    }
    Ok(())
}

fn resolve_imported_bookmark_id(
    conn: &Connection,
    row: &serde_json::Map<String, serde_json::Value>,
) -> SqlResult<Option<i64>> {
    let Some(verse_id) = row.get("verse_id").and_then(serde_json::Value::as_i64) else {
        return Ok(None);
    };
    let end_verse_id = row.get("end_verse_id").and_then(serde_json::Value::as_i64);
    conn.query_row(
        "SELECT id FROM bookmarks
         WHERE verse_id = ?1 AND ((?2 IS NULL AND end_verse_id IS NULL) OR end_verse_id = ?2)",
        params![verse_id, end_verse_id],
        |r| r.get(0),
    )
    .optional()
}

fn remap_workspace_item_link_payload(
    row: &mut serde_json::Map<String, serde_json::Value>,
    workspace_id_map: &std::collections::HashMap<i64, i64>,
    study_item_id_map: &std::collections::HashMap<i64, i64>,
) {
    let Some(payload_text) = row.get("payload_json").and_then(serde_json::Value::as_str) else {
        return;
    };
    let Ok(mut payload) = serde_json::from_str::<serde_json::Value>(payload_text) else {
        return;
    };
    let Some(payload_obj) = payload.as_object_mut() else {
        return;
    };

    let mut changed = false;
    remap_json_id_field(payload_obj, "workspace_id", workspace_id_map, &mut changed);
    remap_json_id_field(payload_obj, "item_id", study_item_id_map, &mut changed);
    if changed {
        row.insert(
            "payload_json".to_string(),
            serde_json::Value::String(payload.to_string()),
        );
    }
}

fn remap_workspace_item_payload_ids(
    row: &mut serde_json::Map<String, serde_json::Value>,
    resource_entry_id_map: &std::collections::HashMap<i64, i64>,
    module_id_map: &std::collections::HashMap<i64, i64>,
) {
    let kind = row.get("kind").and_then(serde_json::Value::as_str);
    let Some(payload_text) = row.get("payload_json").and_then(serde_json::Value::as_str) else {
        return;
    };
    let Ok(mut payload) = serde_json::from_str::<serde_json::Value>(payload_text) else {
        return;
    };
    let Some(payload_obj) = payload.as_object_mut() else {
        return;
    };

    let mut changed = false;
    if kind == Some("module_entry") {
        remap_json_id_field(payload_obj, "module_id", module_id_map, &mut changed);
    }
    if kind == Some("freeform")
        && payload_obj.get("type").and_then(serde_json::Value::as_str) == Some("resource_entry")
    {
        remap_json_id_field(
            payload_obj,
            "resource_entry_id",
            resource_entry_id_map,
            &mut changed,
        );
    }
    if changed {
        row.insert(
            "payload_json".to_string(),
            serde_json::Value::String(payload.to_string()),
        );
    }
}

fn remap_workspace_council_payload(
    row: &mut serde_json::Map<String, serde_json::Value>,
    council_session_id_map: &std::collections::HashMap<i64, i64>,
) {
    if !matches!(
        row.get("kind").and_then(serde_json::Value::as_str),
        Some("council_result" | "council_session")
    ) {
        return;
    }
    let Some(payload_text) = row.get("payload_json").and_then(serde_json::Value::as_str) else {
        return;
    };
    let Ok(mut payload) = serde_json::from_str::<serde_json::Value>(payload_text) else {
        return;
    };
    let Some(payload_obj) = payload.as_object_mut() else {
        return;
    };

    let mut changed = false;
    remap_json_id_field(
        payload_obj,
        "session_id",
        council_session_id_map,
        &mut changed,
    );
    remap_json_id_field(
        payload_obj,
        "council_session_id",
        council_session_id_map,
        &mut changed,
    );
    if let Some(response_obj) = payload_obj
        .get_mut("response")
        .and_then(serde_json::Value::as_object_mut)
    {
        remap_json_id_field(
            response_obj,
            "session_id",
            council_session_id_map,
            &mut changed,
        );
    }
    if changed {
        row.insert(
            "payload_json".to_string(),
            serde_json::Value::String(payload.to_string()),
        );
    }
}

fn remap_json_id_field(
    obj: &mut serde_json::Map<String, serde_json::Value>,
    field: &str,
    id_map: &std::collections::HashMap<i64, i64>,
    changed: &mut bool,
) {
    let Some(old) = obj.get(field).and_then(serde_json::Value::as_i64) else {
        return;
    };
    let value = id_map
        .get(&old)
        .copied()
        .map(serde_json::Value::from)
        .unwrap_or(serde_json::Value::Null);
    obj.insert(field.to_string(), value);
    *changed = true;
}

fn remap_doctrine_relation_link(
    row: &mut serde_json::Map<String, serde_json::Value>,
    theology_topic_id_map: &std::collections::HashMap<i64, i64>,
) {
    let Some(payload_text) = row.get("payload_json").and_then(serde_json::Value::as_str) else {
        return;
    };
    let Ok(mut payload) = serde_json::from_str::<serde_json::Value>(payload_text) else {
        return;
    };
    if payload.get("type").and_then(serde_json::Value::as_str) != Some("doctrine_relation") {
        return;
    }

    let old_target = row
        .get("target_id")
        .and_then(serde_json::Value::as_i64)
        .or_else(|| {
            payload
                .get("target_topic_id")
                .and_then(serde_json::Value::as_i64)
        });
    let target_value = old_target
        .and_then(|old| theology_topic_id_map.get(&old).copied())
        .map(serde_json::Value::from)
        .unwrap_or(serde_json::Value::Null);

    row.insert("target_id".to_string(), target_value.clone());
    if let Some(obj) = payload.as_object_mut() {
        obj.insert("target_topic_id".to_string(), target_value);
    }
    row.insert(
        "payload_json".to_string(),
        serde_json::Value::String(payload.to_string()),
    );
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
    primary_key_columns: &[String],
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
    let placeholders = std::iter::repeat_n("?", columns.len())
        .collect::<Vec<_>>()
        .join(", ");
    let sql = import_insert_sql(
        table,
        &columns,
        primary_key_columns,
        conflict_strategy,
        &placeholders,
    );
    let values = columns
        .iter()
        .map(|name| sql_value_from_import_row(row, name))
        .collect::<SqlResult<Vec<_>>>()?;
    conn.execute(&sql, rusqlite::params_from_iter(values))
}

fn import_insert_sql(
    table: &str,
    columns: &[String],
    primary_key_columns: &[String],
    conflict_strategy: &str,
    placeholders: &str,
) -> String {
    if conflict_strategy != "replace_existing"
        || primary_key_columns.is_empty()
        || !primary_key_columns
            .iter()
            .all(|column| columns.contains(column))
    {
        return format!(
            "INSERT OR IGNORE INTO {table} ({}) VALUES ({placeholders})",
            columns.join(", ")
        );
    }

    let update_columns = columns
        .iter()
        .filter(|column| !primary_key_columns.contains(column))
        .collect::<Vec<_>>();
    if update_columns.is_empty() {
        return format!(
            "INSERT OR IGNORE INTO {table} ({}) VALUES ({placeholders})",
            columns.join(", ")
        );
    }

    let updates = update_columns
        .iter()
        .map(|column| format!("{column} = excluded.{column}"))
        .collect::<Vec<_>>()
        .join(", ");
    format!(
        "INSERT INTO {table} ({}) VALUES ({placeholders}) \
         ON CONFLICT({}) DO UPDATE SET {updates}",
        columns.join(", "),
        primary_key_columns.join(", ")
    )
}

fn row_exists_by_primary_key(
    conn: &Connection,
    table: &str,
    pk_columns: &[String],
    row: &serde_json::Map<String, serde_json::Value>,
) -> SqlResult<bool> {
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

#[derive(Serialize, Clone, Debug, PartialEq)]
pub struct NoteMatch {
    pub kind: String,  // "verse" | "range"
    pub verse_id: i64, // verse note: the verse; range note: start_verse_id
    pub end_verse_id: Option<i64>,
    pub body: String,
    pub updated_at: String,
}

/// Build a case-insensitive substring LIKE pattern, escaping SQLite LIKE
/// metacharacters so they match literally (paired with `ESCAPE '\'`).
fn like_pattern(token: &str) -> String {
    let mut out = String::with_capacity(token.len() + 2);
    out.push('%');
    for ch in token.chars() {
        if matches!(ch, '\\' | '%' | '_') {
            out.push('\\');
        }
        out.push(ch);
    }
    out.push('%');
    out
}

/// Find notes whose body contains every token (case-insensitive substring),
/// most-recently-edited first. Spans both note tables.
pub fn search_notes(conn: &Connection, tokens: &[String], limit: i64) -> SqlResult<Vec<NoteMatch>> {
    if tokens.is_empty() {
        return Ok(Vec::new());
    }
    let patterns: Vec<String> = tokens.iter().map(|t| like_pattern(t)).collect();
    let cond = patterns
        .iter()
        .map(|_| "body LIKE ? ESCAPE '\\'")
        .collect::<Vec<_>>()
        .join(" AND ");

    let mut out: Vec<NoteMatch> = Vec::new();

    let verse_sql = format!("SELECT verse_id, body, updated_at FROM user_notes WHERE {cond}");
    {
        let mut stmt = conn.prepare(&verse_sql)?;
        let rows = stmt.query_map(rusqlite::params_from_iter(patterns.iter()), |r| {
            Ok(NoteMatch {
                kind: "verse".to_string(),
                verse_id: r.get(0)?,
                end_verse_id: None,
                body: r.get(1)?,
                updated_at: r.get(2)?,
            })
        })?;
        for row in rows {
            out.push(row?);
        }
    }

    let range_sql = format!(
        "SELECT start_verse_id, end_verse_id, body, updated_at FROM user_range_notes WHERE {cond}"
    );
    {
        let mut stmt = conn.prepare(&range_sql)?;
        let rows = stmt.query_map(rusqlite::params_from_iter(patterns.iter()), |r| {
            Ok(NoteMatch {
                kind: "range".to_string(),
                verse_id: r.get(0)?,
                end_verse_id: Some(r.get(1)?),
                body: r.get(2)?,
                updated_at: r.get(3)?,
            })
        })?;
        for row in rows {
            out.push(row?);
        }
    }

    // ISO-8601 timestamps sort lexically == chronologically; newest first.
    out.sort_by(|a, b| b.updated_at.cmp(&a.updated_at));
    out.truncate(limit.max(0) as usize);
    Ok(out)
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
    // Clear the note's tag links first so they cannot outlive the note and
    // inflate tag counts (mirrors delete_bookmark). Note tags key on verse_id.
    conn.execute(
        "DELETE FROM item_tags WHERE item_type = 'note' AND item_id = ?",
        params![verse_id],
    )?;
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
