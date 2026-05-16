mod credentials;
mod db;
mod ollama;
mod sidecar;
mod user_db;

use std::path::PathBuf;
use std::sync::Mutex;
use tauri::{AppHandle, Manager};

use sidecar::{build_council_request, question_to_fts_query, SidecarState};

const EMBED_MODEL: &str = "nomic-embed-text";

const MODULE_KINDS: &[&str] = &["commentary", "lexicon", "dictionary", "map", "timeline"];
const MODULE_KEY_TYPES: &[&str] = &["verse", "verse_range", "strongs", "topic"];

#[derive(Clone, serde::Serialize)]
struct RetrievalOptions {
    strategy: String,
    include_cross_refs: bool,
    translation_code: String,
    book_id: Option<i64>,
    testament: Option<String>,
    start_verse_id: Option<i64>,
    end_verse_id: Option<i64>,
    evidence_limit: usize,
}

#[derive(serde::Deserialize)]
struct ModuleImportManifest {
    slug: String,
    title: String,
    kind: String,
    source: Option<String>,
    license: Option<String>,
    version: Option<String>,
}

#[derive(serde::Deserialize)]
struct ModuleImportEntry {
    key_type: String,
    key_value: String,
    title: Option<String>,
    body: String,
    metadata: Option<serde_json::Value>,
}

/// Lazy-init container for the user.sqlite connection.
pub struct UserDbState(pub Mutex<Option<rusqlite::Connection>>);

impl UserDbState {
    pub fn new() -> Self {
        Self(Mutex::new(None))
    }
}

fn user_db_path(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("could not resolve app data dir: {e}"))?;
    std::fs::create_dir_all(&dir)
        .map_err(|e| format!("could not create app data dir {}: {e}", dir.display()))?;
    Ok(dir.join("user.sqlite"))
}

fn with_user_db<T>(
    app: &AppHandle,
    state: &UserDbState,
    f: impl FnOnce(&rusqlite::Connection) -> Result<T, String>,
) -> Result<T, String> {
    let mut guard = state
        .0
        .lock()
        .map_err(|e| format!("user.sqlite mutex poisoned: {e}"))?;
    if guard.is_none() {
        let path = user_db_path(app)?;
        let conn = user_db::open(&path)
            .map_err(|e| format!("open user.sqlite ({}): {e}", path.display()))?;
        *guard = Some(conn);
    }
    let conn = guard
        .as_ref()
        .ok_or_else(|| "user.sqlite connection was not initialized".to_string())?;
    f(conn)
}

const CORPUS_RESOURCE: &str = "corpus.sqlite";

fn corpus_path(app: &AppHandle) -> Result<PathBuf, String> {
    app.path()
        .resolve(CORPUS_RESOURCE, tauri::path::BaseDirectory::Resource)
        .map_err(|e| format!("failed to resolve corpus path: {e}"))
}

fn open_corpus(app: &AppHandle) -> Result<rusqlite::Connection, String> {
    let path = corpus_path(app)?;
    db::open(&path).map_err(|e| format!("failed to open corpus ({}): {e}", path.display()))
}

#[tauri::command]
fn list_books(app: AppHandle) -> Result<Vec<db::Book>, String> {
    let conn = open_corpus(&app)?;
    db::list_books(&conn).map_err(|e| e.to_string())
}

#[tauri::command]
fn list_translations(app: AppHandle) -> Result<Vec<db::Translation>, String> {
    let conn = open_corpus(&app)?;
    db::list_translations(&conn).map_err(|e| e.to_string())
}

#[tauri::command]
fn get_chapter(
    app: AppHandle,
    translation_code: String,
    book_id: i64,
    chapter: i64,
) -> Result<Vec<db::Verse>, String> {
    let conn = open_corpus(&app)?;
    db::get_chapter(&conn, &translation_code, book_id, chapter).map_err(|e| e.to_string())
}

#[tauri::command]
fn get_verse_range(
    app: AppHandle,
    translation_code: String,
    start_verse_id: i64,
    end_verse_id: i64,
    limit: Option<i64>,
) -> Result<Vec<db::Verse>, String> {
    if start_verse_id > end_verse_id {
        return Err("start verse must be before end verse".to_string());
    }
    let conn = open_corpus(&app)?;
    db::get_verse_range(
        &conn,
        &translation_code,
        start_verse_id,
        end_verse_id,
        limit.unwrap_or(200),
    )
    .map_err(|e| e.to_string())
}

#[tauri::command]
fn search(
    app: AppHandle,
    query: String,
    translation_code: Option<String>,
    limit: Option<i64>,
    book_id: Option<i64>,
    testament: Option<String>,
) -> Result<Vec<db::SearchHit>, String> {
    let conn = open_corpus(&app)?;
    db::search(
        &conn,
        &query,
        translation_code.as_deref(),
        limit.unwrap_or(50),
        book_id,
        testament.as_deref(),
    )
    .map_err(|e| e.to_string())
}

#[tauri::command]
fn get_word_tokens(
    app: AppHandle,
    translation_code: String,
    book_id: i64,
    chapter: i64,
) -> Result<Vec<db::WordToken>, String> {
    let conn = open_corpus(&app)?;
    db::get_word_tokens(&conn, &translation_code, book_id, chapter).map_err(|e| e.to_string())
}

#[tauri::command]
fn get_strongs(app: AppHandle, codes: Vec<String>) -> Result<Vec<db::StrongsEntry>, String> {
    let conn = open_corpus(&app)?;
    db::get_strongs(&conn, &codes).map_err(|e| e.to_string())
}

#[tauri::command]
fn get_strongs_occurrences(
    app: AppHandle,
    code: String,
    limit: Option<i64>,
) -> Result<Vec<db::StrongsOccurrence>, String> {
    let conn = open_corpus(&app)?;
    db::get_strongs_occurrences(&conn, &code, limit.unwrap_or(80)).map_err(|e| e.to_string())
}

#[tauri::command]
fn get_cross_refs(
    app: AppHandle,
    verse_id: i64,
    text_translation: Option<String>,
    limit: Option<i64>,
) -> Result<Vec<db::CrossRef>, String> {
    let conn = open_corpus(&app)?;
    db::get_cross_refs(
        &conn,
        verse_id,
        text_translation.as_deref().unwrap_or("KJV"),
        limit.unwrap_or(20),
    )
    .map_err(|e| e.to_string())
}

#[tauri::command]
fn get_app_settings(
    app: AppHandle,
    state: tauri::State<'_, UserDbState>,
) -> Result<user_db::AppSettings, String> {
    let mut settings = with_user_db(&app, &state, |conn| {
        user_db::get_app_settings(conn).map_err(|e| e.to_string())
    })?;
    let had_legacy_provider_keys = settings.google_api_key.is_some()
        || settings.openai_api_key.is_some()
        || settings.anthropic_api_key.is_some()
        || settings.managed_gateway_token.is_some();
    credentials::read_provider_keys(&mut settings);
    if had_legacy_provider_keys {
        credentials::save_provider_keys(&settings)?;
        with_user_db(&app, &state, |conn| {
            user_db::delete_secret_settings(conn).map_err(|e| e.to_string())
        })?;
    }
    Ok(settings)
}

#[tauri::command]
fn save_app_settings(
    app: AppHandle,
    state: tauri::State<'_, UserDbState>,
    settings: user_db::AppSettings,
) -> Result<(), String> {
    credentials::save_provider_keys(&settings)?;
    with_user_db(&app, &state, |conn| {
        user_db::save_app_settings(conn, &settings).map_err(|e| e.to_string())
    })
}

#[tauri::command]
async fn check_app_setup(
    app: AppHandle,
    state: tauri::State<'_, SidecarState>,
    settings: user_db::AppSettings,
) -> Result<serde_json::Value, String> {
    let model = settings
        .claude_model
        .clone()
        .unwrap_or_else(|| "sonnet".to_string());
    let mut diagnostics = state
        .request(
            &app,
            "diagnostics",
            serde_json::json!({
                "settings": &settings,
                "model": model,
            }),
        )
        .await?;

    diagnostics["checks"]["ollama"] = match check_ollama(settings.ollama_host.as_deref()).await {
        Ok(value) => value,
        Err(e) => serde_json::json!({
            "configured": true,
            "ok": false,
            "error": e,
        }),
    };
    Ok(diagnostics)
}

async fn check_ollama(host_override: Option<&str>) -> Result<serde_json::Value, String> {
    let host = host_override
        .filter(|h| !h.trim().is_empty())
        .unwrap_or("http://localhost:11434")
        .trim()
        .trim_end_matches('/')
        .to_string();
    let url = format!("{host}/api/tags");
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(5))
        .build()
        .map_err(|e| format!("ollama diagnostics client: {e}"))?;
    let resp = client
        .get(&url)
        .send()
        .await
        .map_err(|e| format!("ollama is not reachable at {host}: {e}"))?;
    if !resp.status().is_success() {
        return Err(format!("ollama {} at {host}", resp.status()));
    }
    Ok(serde_json::json!({
        "configured": true,
        "ok": true,
        "error": null,
        "host": host,
    }))
}

#[tauri::command]
fn list_study_workspaces(
    app: AppHandle,
    state: tauri::State<'_, UserDbState>,
    include_archived: Option<bool>,
) -> Result<Vec<user_db::StudyWorkspaceSummary>, String> {
    with_user_db(&app, &state, |conn| {
        user_db::list_study_workspaces(conn, include_archived.unwrap_or(false))
            .map_err(|e| e.to_string())
    })
}

#[tauri::command]
fn create_study_workspace(
    app: AppHandle,
    state: tauri::State<'_, UserDbState>,
    title: String,
    description: Option<String>,
) -> Result<i64, String> {
    let trimmed = title.trim();
    if trimmed.is_empty() {
        return Err("workspace title is required".to_string());
    }
    with_user_db(&app, &state, |conn| {
        user_db::create_study_workspace(conn, trimmed, description.as_deref())
            .map_err(|e| e.to_string())
    })
}

#[tauri::command]
fn update_study_workspace(
    app: AppHandle,
    state: tauri::State<'_, UserDbState>,
    id: i64,
    title: String,
    description: Option<String>,
    archived: Option<bool>,
) -> Result<usize, String> {
    let trimmed = title.trim();
    if trimmed.is_empty() {
        return Err("workspace title is required".to_string());
    }
    with_user_db(&app, &state, |conn| {
        user_db::update_study_workspace(
            conn,
            id,
            trimmed,
            description.as_deref(),
            archived.unwrap_or(false),
        )
        .map_err(|e| e.to_string())
    })
}

#[tauri::command]
fn delete_study_workspace(
    app: AppHandle,
    state: tauri::State<'_, UserDbState>,
    id: i64,
) -> Result<usize, String> {
    with_user_db(&app, &state, |conn| {
        user_db::delete_study_workspace(conn, id).map_err(|e| e.to_string())
    })
}

#[tauri::command]
fn get_study_workspace(
    app: AppHandle,
    state: tauri::State<'_, UserDbState>,
    id: i64,
) -> Result<Option<user_db::StudyWorkspace>, String> {
    with_user_db(&app, &state, |conn| {
        user_db::get_study_workspace(conn, id).map_err(|e| e.to_string())
    })
}

#[tauri::command]
fn add_study_item(
    app: AppHandle,
    state: tauri::State<'_, UserDbState>,
    workspace_id: i64,
    kind: String,
    title: Option<String>,
    payload: serde_json::Value,
) -> Result<i64, String> {
    let payload_json = serde_json::to_string(&payload).map_err(|e| e.to_string())?;
    with_user_db(&app, &state, |conn| {
        user_db::add_study_item(conn, workspace_id, &kind, title.as_deref(), &payload_json)
            .map_err(|e| e.to_string())
    })
}

#[tauri::command]
fn update_study_item(
    app: AppHandle,
    state: tauri::State<'_, UserDbState>,
    id: i64,
    title: Option<String>,
    payload: Option<serde_json::Value>,
) -> Result<usize, String> {
    let payload_json = payload
        .map(|value| serde_json::to_string(&value))
        .transpose()
        .map_err(|e| e.to_string())?;
    with_user_db(&app, &state, |conn| {
        user_db::update_study_item(conn, id, title.as_deref(), payload_json.as_deref())
            .map_err(|e| e.to_string())
    })
}

#[tauri::command]
fn delete_study_item(
    app: AppHandle,
    state: tauri::State<'_, UserDbState>,
    id: i64,
) -> Result<usize, String> {
    with_user_db(&app, &state, |conn| {
        user_db::delete_study_item(conn, id).map_err(|e| e.to_string())
    })
}

#[tauri::command]
fn reorder_study_items(
    app: AppHandle,
    state: tauri::State<'_, UserDbState>,
    workspace_id: i64,
    item_ids: Vec<i64>,
) -> Result<(), String> {
    if item_ids.is_empty() {
        return Err("workspace item order cannot be empty".to_string());
    }
    with_user_db(&app, &state, |conn| {
        user_db::reorder_study_items(conn, workspace_id, &item_ids).map_err(|e| e.to_string())
    })
}

#[tauri::command]
fn list_bookmarks(
    app: AppHandle,
    state: tauri::State<'_, UserDbState>,
) -> Result<Vec<user_db::Bookmark>, String> {
    with_user_db(&app, &state, |conn| {
        user_db::list_bookmarks(conn).map_err(|e| e.to_string())
    })
}

#[tauri::command]
fn add_bookmark(
    app: AppHandle,
    state: tauri::State<'_, UserDbState>,
    verse_id: i64,
    end_verse_id: Option<i64>,
    label: Option<String>,
) -> Result<i64, String> {
    with_user_db(&app, &state, |conn| {
        user_db::add_bookmark(conn, verse_id, end_verse_id, label.as_deref())
            .map_err(|e| e.to_string())
    })
}

#[tauri::command]
fn delete_bookmark(
    app: AppHandle,
    state: tauri::State<'_, UserDbState>,
    id: i64,
) -> Result<usize, String> {
    with_user_db(&app, &state, |conn| {
        user_db::delete_bookmark(conn, id).map_err(|e| e.to_string())
    })
}

#[tauri::command]
fn record_reading_location(
    app: AppHandle,
    state: tauri::State<'_, UserDbState>,
    book_id: i64,
    chapter: i64,
    translation_codes: String,
) -> Result<(), String> {
    with_user_db(&app, &state, |conn| {
        user_db::record_reading_location(conn, book_id, chapter, &translation_codes)
            .map_err(|e| e.to_string())
    })
}

#[tauri::command]
fn list_reading_history(
    app: AppHandle,
    state: tauri::State<'_, UserDbState>,
    limit: Option<i64>,
) -> Result<Vec<user_db::ReadingHistoryItem>, String> {
    with_user_db(&app, &state, |conn| {
        user_db::list_reading_history(conn, limit.unwrap_or(20)).map_err(|e| e.to_string())
    })
}

#[tauri::command]
fn list_saved_searches(
    app: AppHandle,
    state: tauri::State<'_, UserDbState>,
) -> Result<Vec<user_db::SavedSearch>, String> {
    with_user_db(&app, &state, |conn| {
        user_db::list_saved_searches(conn).map_err(|e| e.to_string())
    })
}

#[tauri::command]
fn create_saved_search(
    app: AppHandle,
    state: tauri::State<'_, UserDbState>,
    title: String,
    query: String,
    translation_code: Option<String>,
    testament: Option<String>,
    book_id: Option<i64>,
) -> Result<i64, String> {
    if title.trim().is_empty() || query.trim().is_empty() {
        return Err("saved search title and query are required".to_string());
    }
    with_user_db(&app, &state, |conn| {
        user_db::create_saved_search(
            conn,
            &title,
            &query,
            translation_code.as_deref(),
            testament.as_deref(),
            book_id,
        )
        .map_err(|e| e.to_string())
    })
}

#[tauri::command]
fn update_saved_search_title(
    app: AppHandle,
    state: tauri::State<'_, UserDbState>,
    id: i64,
    title: String,
) -> Result<usize, String> {
    if title.trim().is_empty() {
        return Err("saved search title is required".to_string());
    }
    with_user_db(&app, &state, |conn| {
        user_db::update_saved_search_title(conn, id, &title).map_err(|e| e.to_string())
    })
}

#[tauri::command]
fn delete_saved_search(
    app: AppHandle,
    state: tauri::State<'_, UserDbState>,
    id: i64,
) -> Result<usize, String> {
    with_user_db(&app, &state, |conn| {
        user_db::delete_saved_search(conn, id).map_err(|e| e.to_string())
    })
}

#[tauri::command]
fn list_modules(
    app: AppHandle,
    state: tauri::State<'_, UserDbState>,
) -> Result<Vec<user_db::ModuleSummary>, String> {
    with_user_db(&app, &state, |conn| {
        user_db::list_modules(conn).map_err(|e| e.to_string())
    })
}

#[tauri::command]
fn create_module(
    app: AppHandle,
    state: tauri::State<'_, UserDbState>,
    slug: String,
    title: String,
    kind: String,
    source: Option<String>,
    license: Option<String>,
    version: Option<String>,
) -> Result<i64, String> {
    with_user_db(&app, &state, |conn| {
        user_db::create_module(
            conn,
            &slug,
            &title,
            &kind,
            source.as_deref(),
            license.as_deref(),
            version.as_deref(),
        )
        .map_err(|e| e.to_string())
    })
}

#[tauri::command]
fn delete_module(
    app: AppHandle,
    state: tauri::State<'_, UserDbState>,
    id: i64,
) -> Result<usize, String> {
    with_user_db(&app, &state, |conn| {
        user_db::delete_module(conn, id).map_err(|e| e.to_string())
    })
}

#[tauri::command]
fn add_module_entry(
    app: AppHandle,
    state: tauri::State<'_, UserDbState>,
    module_id: i64,
    key_type: String,
    key_value: String,
    title: Option<String>,
    body: String,
    metadata: Option<serde_json::Value>,
) -> Result<i64, String> {
    let metadata_json = metadata
        .as_ref()
        .map(serde_json::to_string)
        .transpose()
        .map_err(|e| e.to_string())?;
    with_user_db(&app, &state, |conn| {
        user_db::add_module_entry(
            conn,
            module_id,
            &key_type,
            &key_value,
            title.as_deref(),
            &body,
            metadata_json.as_deref(),
        )
        .map_err(|e| e.to_string())
    })
}

#[tauri::command]
fn import_module_jsonl(
    app: AppHandle,
    state: tauri::State<'_, UserDbState>,
    manifest: serde_json::Value,
    entries_jsonl: String,
) -> Result<user_db::ModuleImportReport, String> {
    let manifest: ModuleImportManifest =
        serde_json::from_value(manifest).map_err(|e| format!("invalid manifest: {e}"))?;
    let slug = manifest.slug.trim();
    let title = manifest.title.trim();
    let kind = manifest.kind.trim();
    if slug.is_empty() || title.is_empty() {
        return Err("module manifest requires slug and title".to_string());
    }
    if !MODULE_KINDS.contains(&kind) {
        return Err(format!("unsupported module kind: {kind}"));
    }
    let mut entries = Vec::new();
    for (idx, line) in entries_jsonl.lines().enumerate() {
        let trimmed = line.trim();
        if trimmed.is_empty() {
            continue;
        }
        let entry: ModuleImportEntry = serde_json::from_str(trimmed)
            .map_err(|e| format!("invalid JSONL line {}: {e}", idx + 1))?;
        let key_type = entry.key_type.trim();
        let key_value = entry.key_value.trim();
        let body = entry.body.trim();
        if !MODULE_KEY_TYPES.contains(&key_type) {
            return Err(format!(
                "unsupported key_type on line {}: {key_type}",
                idx + 1
            ));
        }
        if key_value.is_empty() || body.is_empty() {
            return Err(format!(
                "module entry line {} requires key_value and body",
                idx + 1
            ));
        }
        entries.push(entry);
    }
    if entries.is_empty() {
        return Err("module import requires at least one JSONL entry".to_string());
    }
    with_user_db(&app, &state, |conn| {
        let module_id = user_db::create_module(
            conn,
            slug,
            title,
            kind,
            manifest.source.as_deref(),
            manifest.license.as_deref(),
            manifest.version.as_deref(),
        )
        .map_err(|e| e.to_string())?;
        conn.execute(
            "DELETE FROM module_entries WHERE module_id = ?",
            rusqlite::params![module_id],
        )
        .map_err(|e| e.to_string())?;
        for entry in &entries {
            let metadata_json = entry
                .metadata
                .as_ref()
                .map(serde_json::to_string)
                .transpose()
                .map_err(|e| e.to_string())?;
            user_db::add_module_entry(
                conn,
                module_id,
                &entry.key_type,
                &entry.key_value,
                entry.title.as_deref(),
                &entry.body,
                metadata_json.as_deref(),
            )
            .map_err(|e| e.to_string())?;
        }
        Ok(user_db::ModuleImportReport {
            module_id,
            entry_count: entries.len(),
        })
    })
}

#[tauri::command]
fn list_module_entries_for_verse(
    app: AppHandle,
    state: tauri::State<'_, UserDbState>,
    verse_id: i64,
) -> Result<Vec<user_db::ModuleEntry>, String> {
    with_user_db(&app, &state, |conn| {
        user_db::list_module_entries_for_verse(conn, verse_id).map_err(|e| e.to_string())
    })
}

#[tauri::command]
fn list_module_entries_for_range(
    app: AppHandle,
    state: tauri::State<'_, UserDbState>,
    start_verse_id: i64,
    end_verse_id: i64,
) -> Result<Vec<user_db::ModuleEntry>, String> {
    with_user_db(&app, &state, |conn| {
        user_db::list_module_entries_for_range(conn, start_verse_id, end_verse_id)
            .map_err(|e| e.to_string())
    })
}

#[tauri::command]
fn list_module_entries_for_strongs(
    app: AppHandle,
    state: tauri::State<'_, UserDbState>,
    codes: Vec<String>,
) -> Result<Vec<user_db::ModuleEntry>, String> {
    with_user_db(&app, &state, |conn| {
        user_db::list_module_entries_for_strongs(conn, &codes).map_err(|e| e.to_string())
    })
}

#[tauri::command]
fn list_module_topics(
    app: AppHandle,
    state: tauri::State<'_, UserDbState>,
) -> Result<Vec<user_db::ModuleTopic>, String> {
    with_user_db(&app, &state, |conn| {
        user_db::list_module_topics(conn).map_err(|e| e.to_string())
    })
}

#[tauri::command]
fn list_module_entries_for_topic(
    app: AppHandle,
    state: tauri::State<'_, UserDbState>,
    topic: String,
) -> Result<Vec<user_db::ModuleEntry>, String> {
    if topic.trim().is_empty() {
        return Err("topic is required".to_string());
    }
    with_user_db(&app, &state, |conn| {
        user_db::list_module_entries_for_topic(conn, &topic).map_err(|e| e.to_string())
    })
}

#[tauri::command]
fn export_user_data_json(
    app: AppHandle,
    state: tauri::State<'_, UserDbState>,
) -> Result<serde_json::Value, String> {
    with_user_db(&app, &state, |conn| {
        user_db::export_user_data(conn).map_err(|e| e.to_string())
    })
}

#[tauri::command]
fn import_user_data_json(
    app: AppHandle,
    state: tauri::State<'_, UserDbState>,
    payload: serde_json::Value,
    conflict_strategy: String,
) -> Result<user_db::UserDataImportReport, String> {
    with_user_db(&app, &state, |conn| {
        user_db::import_user_data(conn, &payload, &conflict_strategy)
    })
}

#[tauri::command]
fn write_user_data_backup(
    app: AppHandle,
    state: tauri::State<'_, UserDbState>,
) -> Result<String, String> {
    let export = export_user_data_json(app.clone(), state)?;
    let dir = backup_dir(&app)?;
    let stamp = unix_stamp();
    let path = dir.join(format!("bible-ai-user-data-{stamp}.json"));
    let json = serde_json::to_string_pretty(&export).map_err(|e| e.to_string())?;
    std::fs::write(&path, json).map_err(|e| format!("could not write {}: {e}", path.display()))?;
    Ok(path.display().to_string())
}

#[tauri::command]
fn write_workspace_markdown(
    app: AppHandle,
    title: String,
    markdown: String,
) -> Result<String, String> {
    if markdown.trim().is_empty() {
        return Err("workspace Markdown is empty".to_string());
    }
    let dir = export_dir(&app)?;
    let safe_title = sanitize_filename(&title);
    let path = dir.join(format!(
        "bible-ai-workspace-{safe_title}-{stamp}.md",
        stamp = unix_stamp()
    ));
    std::fs::write(&path, markdown)
        .map_err(|e| format!("could not write {}: {e}", path.display()))?;
    Ok(path.display().to_string())
}

#[tauri::command]
fn write_workspace_html(app: AppHandle, title: String, html: String) -> Result<String, String> {
    if html.trim().is_empty() {
        return Err("workspace HTML is empty".to_string());
    }
    let dir = export_dir(&app)?;
    let safe_title = sanitize_filename(&title);
    let path = dir.join(format!(
        "bible-ai-workspace-{safe_title}-{stamp}.html",
        stamp = unix_stamp()
    ));
    std::fs::write(&path, html).map_err(|e| format!("could not write {}: {e}", path.display()))?;
    Ok(path.display().to_string())
}

#[tauri::command]
fn write_workspace_pdf(app: AppHandle, title: String, markdown: String) -> Result<String, String> {
    if markdown.trim().is_empty() {
        return Err("workspace PDF source is empty".to_string());
    }
    let dir = export_dir(&app)?;
    let safe_title = sanitize_filename(&title);
    let path = dir.join(format!(
        "bible-ai-workspace-{safe_title}-{stamp}.pdf",
        stamp = unix_stamp()
    ));
    let pdf = render_text_pdf(&title, &markdown);
    std::fs::write(&path, pdf).map_err(|e| format!("could not write {}: {e}", path.display()))?;
    Ok(path.display().to_string())
}

#[tauri::command]
fn write_theology_pdf(app: AppHandle, title: String, markdown: String) -> Result<String, String> {
    if markdown.trim().is_empty() {
        return Err("theology PDF source is empty".to_string());
    }
    let dir = export_dir(&app)?;
    let safe_title = sanitize_filename(&title);
    let path = dir.join(format!(
        "bible-ai-theology-{safe_title}-{stamp}.pdf",
        stamp = unix_stamp()
    ));
    let pdf = render_text_pdf(&title, &markdown);
    std::fs::write(&path, pdf).map_err(|e| format!("could not write {}: {e}", path.display()))?;
    Ok(path.display().to_string())
}

#[tauri::command]
fn backup_user_sqlite(
    app: AppHandle,
    state: tauri::State<'_, UserDbState>,
) -> Result<String, String> {
    let source = user_db_path(&app)?;
    if !source.exists() {
        with_user_db(&app, &state, |_| Ok(()))?;
    }
    close_user_db(&state)?;
    let dir = backup_dir(&app)?;
    let path = dir.join(format!(
        "bible-ai-user-{stamp}.sqlite",
        stamp = unix_stamp()
    ));
    std::fs::copy(&source, &path).map_err(|e| {
        format!(
            "could not copy {} to {}: {e}",
            source.display(),
            path.display()
        )
    })?;
    Ok(path.display().to_string())
}

#[tauri::command]
fn restore_user_sqlite(
    app: AppHandle,
    state: tauri::State<'_, UserDbState>,
    source_path: String,
) -> Result<String, String> {
    let source = PathBuf::from(source_path.trim());
    if !source.exists() {
        return Err(format!(
            "restore source does not exist: {}",
            source.display()
        ));
    }
    let target = user_db_path(&app)?;
    close_user_db(&state)?;

    let safety_backup = if target.exists() {
        let dir = backup_dir(&app)?;
        let path = dir.join(format!(
            "bible-ai-user-before-restore-{stamp}.sqlite",
            stamp = unix_stamp()
        ));
        std::fs::copy(&target, &path).map_err(|e| {
            format!(
                "could not create safety backup {} from {}: {e}",
                path.display(),
                target.display()
            )
        })?;
        Some(path)
    } else {
        None
    };

    std::fs::copy(&source, &target).map_err(|e| {
        format!(
            "could not restore {} to {}: {e}",
            source.display(),
            target.display()
        )
    })?;
    let conn = user_db::open(&target)
        .map_err(|e| format!("restored sqlite did not open ({}): {e}", target.display()))?;
    let mut guard = state
        .0
        .lock()
        .map_err(|e| format!("user.sqlite mutex poisoned: {e}"))?;
    *guard = Some(conn);
    Ok(safety_backup
        .map(|p| p.display().to_string())
        .unwrap_or_else(|| "No previous user.sqlite existed".to_string()))
}

fn backup_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("could not resolve app data dir: {e}"))?
        .join("backups");
    std::fs::create_dir_all(&dir)
        .map_err(|e| format!("could not create backup dir {}: {e}", dir.display()))?;
    Ok(dir)
}

fn export_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("could not resolve app data dir: {e}"))?
        .join("exports");
    std::fs::create_dir_all(&dir)
        .map_err(|e| format!("could not create export dir {}: {e}", dir.display()))?;
    Ok(dir)
}

fn sanitize_filename(value: &str) -> String {
    let mut out = String::with_capacity(value.len().min(64));
    for ch in value.trim().chars() {
        if ch.is_ascii_alphanumeric() {
            out.push(ch.to_ascii_lowercase());
        } else if matches!(ch, ' ' | '-' | '_') && !out.ends_with('-') {
            out.push('-');
        }
        if out.len() >= 64 {
            break;
        }
    }
    let trimmed = out.trim_matches('-').to_string();
    if trimmed.is_empty() {
        "workspace".to_string()
    } else {
        trimmed
    }
}

fn close_user_db(state: &UserDbState) -> Result<(), String> {
    let mut guard = state
        .0
        .lock()
        .map_err(|e| format!("user.sqlite mutex poisoned: {e}"))?;
    *guard = None;
    Ok(())
}

fn unix_stamp() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0)
}

/// Render plain text into a minimal, dependency-free PDF.
///
/// LIMITATION: the output uses the PDF standard-14 Helvetica font and only
/// emits ASCII glyphs — `pdf_escape_text` replaces every non-ASCII character
/// with a space. Accented Latin text, Greek, and Hebrew will therefore not
/// appear in PDF exports. Markdown and HTML exports preserve full Unicode and
/// should be preferred when original-language terms matter. Lifting this
/// limitation requires embedding a Unicode font (a deliberate dependency /
/// bundle-size decision that has not been made).
fn render_text_pdf(title: &str, text: &str) -> Vec<u8> {
    const LINES_PER_PAGE: usize = 58;
    const MAX_LINE_CHARS: usize = 92;

    let mut lines = vec![title.to_string(), String::new()];
    for raw_line in text.lines() {
        let mut line = raw_line.trim_end().to_string();
        if line.is_empty() {
            lines.push(String::new());
            continue;
        }
        while line.chars().count() > MAX_LINE_CHARS {
            let split_at = line
                .char_indices()
                .take(MAX_LINE_CHARS)
                .filter(|(_, ch)| ch.is_whitespace())
                .map(|(idx, _)| idx)
                .last()
                .unwrap_or_else(|| {
                    line.char_indices()
                        .nth(MAX_LINE_CHARS)
                        .map(|(idx, _)| idx)
                        .unwrap_or(line.len())
                });
            let head = line[..split_at].trim_end().to_string();
            if !head.is_empty() {
                lines.push(head);
            }
            line = line[split_at..].trim_start().to_string();
        }
        lines.push(line);
    }

    let pages: Vec<Vec<String>> = lines
        .chunks(LINES_PER_PAGE)
        .map(|chunk| chunk.to_vec())
        .collect();
    let page_count = pages.len().max(1);
    let font_id = 3 + page_count * 2;
    let mut objects = Vec::new();

    let kids = (0..page_count)
        .map(|idx| format!("{} 0 R", 3 + idx * 2))
        .collect::<Vec<_>>()
        .join(" ");
    objects.push("<< /Type /Catalog /Pages 2 0 R >>".to_string());
    objects.push(format!(
        "<< /Type /Pages /Kids [ {kids} ] /Count {page_count} >>"
    ));

    for idx in 0..page_count {
        let page_id = 3 + idx * 2;
        let content_id = page_id + 1;
        objects.push(format!(
            "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 {font_id} 0 R >> >> /Contents {content_id} 0 R >>"
        ));
        let mut stream = String::from("BT\n/F1 10 Tf\n50 760 Td\n12 TL\n");
        for line in pages.get(idx).cloned().unwrap_or_default() {
            stream.push_str(&format!("({}) Tj\nT*\n", pdf_escape_text(&line)));
        }
        stream.push_str("ET\n");
        objects.push(format!(
            "<< /Length {} >>\nstream\n{}endstream",
            stream.as_bytes().len(),
            stream
        ));
    }

    objects.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>".to_string());

    let mut pdf = Vec::new();
    pdf.extend_from_slice(b"%PDF-1.4\n");
    let mut offsets = vec![0usize];
    for (idx, object) in objects.iter().enumerate() {
        offsets.push(pdf.len());
        pdf.extend_from_slice(format!("{} 0 obj\n{}\nendobj\n", idx + 1, object).as_bytes());
    }
    let xref_offset = pdf.len();
    pdf.extend_from_slice(format!("xref\n0 {}\n", objects.len() + 1).as_bytes());
    pdf.extend_from_slice(b"0000000000 65535 f \n");
    for offset in offsets.iter().skip(1) {
        pdf.extend_from_slice(format!("{offset:010} 00000 n \n").as_bytes());
    }
    pdf.extend_from_slice(
        format!(
            "trailer\n<< /Size {} /Root 1 0 R >>\nstartxref\n{xref_offset}\n%%EOF\n",
            objects.len() + 1
        )
        .as_bytes(),
    );
    pdf
}

fn pdf_escape_text(value: &str) -> String {
    let mut escaped = String::with_capacity(value.len());
    for ch in value.chars() {
        match ch {
            '\\' => escaped.push_str("\\\\"),
            '(' => escaped.push_str("\\("),
            ')' => escaped.push_str("\\)"),
            '\t' => escaped.push(' '),
            ch if ch.is_ascii() && !ch.is_control() => escaped.push(ch),
            _ => escaped.push(' '),
        }
    }
    escaped
}

/// Ask the council a disputed-point question.
///
/// Retrieval prefers semantic search via Ollama embeddings when the
/// embeddings table is populated and Ollama is reachable; otherwise falls
/// back to the FTS OR-query path. Either way, evidence is handed to the
/// sidecar along with the question.
#[tauri::command]
async fn ask_council(
    app: AppHandle,
    state: tauri::State<'_, SidecarState>,
    user_state: tauri::State<'_, UserDbState>,
    question: String,
    model: Option<String>,
    evidence_limit: Option<i64>,
    retrieval_translation: Option<String>,
    retrieval_strategy: Option<String>,
    include_cross_refs: Option<bool>,
    book_id: Option<i64>,
    testament: Option<String>,
    start_verse_id: Option<i64>,
    end_verse_id: Option<i64>,
) -> Result<serde_json::Value, String> {
    let settings = with_user_db(&app, &user_state, |conn| {
        user_db::get_app_settings(conn).map_err(|e| e.to_string())
    })
    .unwrap_or_default();

    let translation = retrieval_translation
        .or_else(|| settings.retrieval_translation.clone())
        .unwrap_or_else(|| "KJV".to_string());
    let selected_model = model
        .or_else(|| settings.claude_model.clone())
        .unwrap_or_else(|| "sonnet".to_string());
    let limit = evidence_limit.unwrap_or(60) as usize;
    let retrieval_options = RetrievalOptions {
        strategy: retrieval_strategy.unwrap_or_else(|| "hybrid".to_string()),
        include_cross_refs: include_cross_refs.unwrap_or(true),
        translation_code: translation.clone(),
        book_id,
        testament,
        start_verse_id,
        end_verse_id,
        evidence_limit: limit,
    };

    let (evidence_json, retrieval_mode) = retrieve_evidence(
        &app,
        &question,
        &retrieval_options,
        settings.ollama_host.as_deref(),
    )
    .await?;

    if evidence_json.is_empty() {
        return Err("no evidence found for the question in the corpus".to_string());
    }

    let evidence_count = evidence_json.len();
    let body = build_council_request(
        &question,
        evidence_json.clone(),
        &selected_model,
        Some(&settings),
    );
    let mut result = state.request(&app, "council", body).await?;
    // Surface how we retrieved the evidence so the UI can show it.
    result["retrieval_mode"] = serde_json::Value::String(retrieval_mode.clone());
    result["evidence_count"] = serde_json::Value::Number(evidence_count.into());
    result["retrieval_options"] =
        serde_json::to_value(&retrieval_options).unwrap_or(serde_json::Value::Null);
    result["retrieved_evidence"] = serde_json::Value::Array(evidence_json.clone());

    // Persist to user.sqlite so the user has an audit trail they can revisit.
    // Non-fatal: if persistence fails, we still return the response.
    if let (Ok(response_json), Ok(options_json), Ok(evidence_json_text)) = (
        serde_json::to_string(&result),
        serde_json::to_string(&retrieval_options),
        serde_json::to_string(&evidence_json),
    ) {
        let app_for_persist = app.clone();
        let q = question.clone();
        let mode = retrieval_mode.clone();
        if let Err(e) = with_user_db(&app_for_persist, &user_state, |conn| {
            user_db::insert_session(
                conn,
                &q,
                &mode,
                Some(&options_json),
                Some(&evidence_json_text),
                &response_json,
            )
            .map(|id| {
                result["session_id"] = serde_json::Value::Number(id.into());
                eprintln!("[council] persisted session id={id}");
            })
            .map_err(|e| e.to_string())
        }) {
            eprintln!("[council] persist failed: {e}");
        }
    }

    Ok(result)
}

#[tauri::command]
async fn explain_passage(
    app: AppHandle,
    state: tauri::State<'_, SidecarState>,
    translation_code: String,
    start_verse_id: i64,
    end_verse_id: Option<i64>,
) -> Result<serde_json::Value, String> {
    let end = end_verse_id.unwrap_or(start_verse_id);
    let conn = open_corpus(&app)?;
    let verses = db::get_verse_range(&conn, &translation_code, start_verse_id, end, 200)
        .map_err(|e| e.to_string())?;
    let passage: Vec<serde_json::Value> = verses
        .into_iter()
        .map(|v| {
            serde_json::json!({
                "verse_id": v.verse_id,
                "translation_code": translation_code,
                "chapter": v.chapter,
                "verse": v.verse,
                "text": v.text,
            })
        })
        .collect();
    state
        .request(
            &app,
            "explain",
            serde_json::json!({
                "translation_code": translation_code,
                "passage": passage,
            }),
        )
        .await
}

#[tauri::command]
fn list_council_sessions(
    app: AppHandle,
    state: tauri::State<'_, UserDbState>,
    limit: Option<i64>,
) -> Result<Vec<user_db::SessionSummary>, String> {
    with_user_db(&app, &state, |conn| {
        user_db::list_sessions(conn, limit.unwrap_or(30)).map_err(|e| e.to_string())
    })
}

#[tauri::command]
fn get_council_session(
    app: AppHandle,
    state: tauri::State<'_, UserDbState>,
    id: i64,
) -> Result<Option<user_db::StoredSession>, String> {
    with_user_db(&app, &state, |conn| {
        user_db::get_session(conn, id).map_err(|e| e.to_string())
    })
}

#[tauri::command]
fn delete_council_session(
    app: AppHandle,
    state: tauri::State<'_, UserDbState>,
    id: i64,
) -> Result<usize, String> {
    with_user_db(&app, &state, |conn| {
        user_db::delete_session(conn, id).map_err(|e| e.to_string())
    })
}

#[tauri::command]
fn get_council_judgment(
    app: AppHandle,
    state: tauri::State<'_, UserDbState>,
    council_session_id: i64,
) -> Result<Option<user_db::CouncilJudgment>, String> {
    with_user_db(&app, &state, |conn| {
        user_db::get_council_judgment(conn, council_session_id).map_err(|e| e.to_string())
    })
}

#[tauri::command]
fn upsert_council_judgment(
    app: AppHandle,
    state: tauri::State<'_, UserDbState>,
    judgment: user_db::CouncilJudgment,
) -> Result<i64, String> {
    with_user_db(&app, &state, |conn| {
        user_db::upsert_council_judgment(conn, &judgment).map_err(|e| e.to_string())
    })
}

#[tauri::command]
fn delete_council_judgment(
    app: AppHandle,
    state: tauri::State<'_, UserDbState>,
    council_session_id: i64,
) -> Result<usize, String> {
    with_user_db(&app, &state, |conn| {
        user_db::delete_council_judgment(conn, council_session_id).map_err(|e| e.to_string())
    })
}

#[tauri::command]
fn list_judgments_for_workspace(
    app: AppHandle,
    state: tauri::State<'_, UserDbState>,
    workspace_id: i64,
) -> Result<Vec<user_db::CouncilJudgment>, String> {
    with_user_db(&app, &state, |conn| {
        user_db::list_judgments_for_workspace(conn, workspace_id).map_err(|e| e.to_string())
    })
}

#[tauri::command]
fn list_theology_topics(
    app: AppHandle,
    state: tauri::State<'_, UserDbState>,
) -> Result<Vec<user_db::TheologyTopic>, String> {
    with_user_db(&app, &state, |conn| {
        user_db::list_theology_topics(conn).map_err(|e| e.to_string())
    })
}

#[tauri::command]
fn get_theology_topic(
    app: AppHandle,
    state: tauri::State<'_, UserDbState>,
    id: i64,
) -> Result<Option<user_db::TheologyTopic>, String> {
    with_user_db(&app, &state, |conn| {
        user_db::get_theology_topic(conn, id).map_err(|e| e.to_string())
    })
}

#[tauri::command]
fn create_theology_topic(
    app: AppHandle,
    state: tauri::State<'_, UserDbState>,
    title: String,
    summary: Option<String>,
    parent_id: Option<i64>,
) -> Result<i64, String> {
    with_user_db(&app, &state, |conn| {
        user_db::create_theology_topic(conn, &title, summary.as_deref(), parent_id)
            .map_err(|e| e.to_string())
    })
}

#[tauri::command]
fn update_theology_topic(
    app: AppHandle,
    state: tauri::State<'_, UserDbState>,
    topic: user_db::TheologyTopic,
) -> Result<usize, String> {
    with_user_db(&app, &state, |conn| {
        user_db::update_theology_topic(conn, &topic).map_err(|e| e.to_string())
    })
}

#[tauri::command]
fn get_theology_conclusion(
    app: AppHandle,
    state: tauri::State<'_, UserDbState>,
    topic_id: i64,
) -> Result<Option<user_db::TheologyConclusion>, String> {
    with_user_db(&app, &state, |conn| {
        user_db::get_theology_conclusion(conn, topic_id).map_err(|e| e.to_string())
    })
}

#[tauri::command]
fn upsert_theology_conclusion(
    app: AppHandle,
    state: tauri::State<'_, UserDbState>,
    conclusion: user_db::TheologyConclusion,
) -> Result<i64, String> {
    with_user_db(&app, &state, |conn| {
        user_db::upsert_theology_conclusion(conn, &conclusion).map_err(|e| e.to_string())
    })
}

#[tauri::command]
fn list_theology_positions(
    app: AppHandle,
    state: tauri::State<'_, UserDbState>,
    topic_id: i64,
) -> Result<Vec<user_db::TheologyPosition>, String> {
    with_user_db(&app, &state, |conn| {
        user_db::list_theology_positions(conn, topic_id).map_err(|e| e.to_string())
    })
}

#[tauri::command]
fn upsert_theology_position(
    app: AppHandle,
    state: tauri::State<'_, UserDbState>,
    position: user_db::TheologyPosition,
) -> Result<i64, String> {
    with_user_db(&app, &state, |conn| {
        user_db::upsert_theology_position(conn, &position).map_err(|e| e.to_string())
    })
}

#[tauri::command]
fn list_theology_links(
    app: AppHandle,
    state: tauri::State<'_, UserDbState>,
    topic_id: i64,
) -> Result<Vec<user_db::TheologyLink>, String> {
    with_user_db(&app, &state, |conn| {
        user_db::list_theology_links(conn, topic_id).map_err(|e| e.to_string())
    })
}

#[tauri::command]
fn create_theology_link(
    app: AppHandle,
    state: tauri::State<'_, UserDbState>,
    link: user_db::TheologyLink,
) -> Result<i64, String> {
    with_user_db(&app, &state, |conn| {
        user_db::create_theology_link(conn, &link).map_err(|e| e.to_string())
    })
}

#[tauri::command]
fn delete_theology_link(
    app: AppHandle,
    state: tauri::State<'_, UserDbState>,
    id: i64,
) -> Result<usize, String> {
    with_user_db(&app, &state, |conn| {
        user_db::delete_theology_link(conn, id).map_err(|e| e.to_string())
    })
}

#[tauri::command]
fn export_theology_markdown(
    app: AppHandle,
    state: tauri::State<'_, UserDbState>,
    topic_id: Option<i64>,
    include_subtopics: Option<bool>,
) -> Result<String, String> {
    with_user_db(&app, &state, |conn| {
        user_db::export_theology_markdown(conn, topic_id, include_subtopics.unwrap_or(false))
            .map_err(|e| e.to_string())
    })
}

#[tauri::command]
fn list_resource_sources(
    app: AppHandle,
    state: tauri::State<'_, UserDbState>,
) -> Result<Vec<user_db::ResourceSource>, String> {
    with_user_db(&app, &state, |conn| {
        user_db::list_resource_sources(conn).map_err(|e| e.to_string())
    })
}

#[tauri::command]
fn list_resource_collections(
    app: AppHandle,
    state: tauri::State<'_, UserDbState>,
    source_id: Option<i64>,
) -> Result<Vec<user_db::ResourceCollection>, String> {
    with_user_db(&app, &state, |conn| {
        user_db::list_resource_collections(conn, source_id).map_err(|e| e.to_string())
    })
}

#[tauri::command]
fn search_resources(
    app: AppHandle,
    state: tauri::State<'_, UserDbState>,
    query: String,
    source_id: Option<i64>,
    collection_kind: Option<String>,
    license: Option<String>,
    topic_id: Option<i64>,
    limit: Option<i64>,
) -> Result<Vec<user_db::ResourceEntry>, String> {
    with_user_db(&app, &state, |conn| {
        user_db::search_resources(
            conn,
            &query,
            source_id,
            collection_kind.as_deref(),
            license.as_deref(),
            topic_id,
            limit.unwrap_or(30),
        )
        .map_err(|e| e.to_string())
    })
}

#[tauri::command]
fn get_resource_entry(
    app: AppHandle,
    state: tauri::State<'_, UserDbState>,
    id: i64,
) -> Result<Option<user_db::ResourceEntry>, String> {
    with_user_db(&app, &state, |conn| {
        user_db::get_resource_entry(conn, id).map_err(|e| e.to_string())
    })
}

#[tauri::command]
fn get_guided_study_session(
    app: AppHandle,
    state: tauri::State<'_, UserDbState>,
    topic_id: i64,
    template_slug: String,
) -> Result<Option<user_db::GuidedStudySession>, String> {
    with_user_db(&app, &state, |conn| {
        user_db::get_guided_study_session(conn, topic_id, &template_slug).map_err(|e| e.to_string())
    })
}

#[tauri::command]
fn list_guided_study_sessions_for_topic(
    app: AppHandle,
    state: tauri::State<'_, UserDbState>,
    topic_id: i64,
) -> Result<Vec<user_db::GuidedStudySession>, String> {
    with_user_db(&app, &state, |conn| {
        user_db::list_guided_study_sessions_for_topic(conn, topic_id).map_err(|e| e.to_string())
    })
}

#[tauri::command]
fn upsert_guided_study_session(
    app: AppHandle,
    state: tauri::State<'_, UserDbState>,
    session: user_db::GuidedStudySession,
) -> Result<i64, String> {
    with_user_db(&app, &state, |conn| {
        user_db::upsert_guided_study_session(conn, &session).map_err(|e| e.to_string())
    })
}

#[tauri::command]
fn list_argument_annotations(
    app: AppHandle,
    state: tauri::State<'_, UserDbState>,
    council_session_id: i64,
) -> Result<Vec<user_db::ArgumentAnnotation>, String> {
    with_user_db(&app, &state, |conn| {
        user_db::list_argument_annotations(conn, council_session_id).map_err(|e| e.to_string())
    })
}

#[tauri::command]
fn upsert_argument_annotation(
    app: AppHandle,
    state: tauri::State<'_, UserDbState>,
    annotation: user_db::ArgumentAnnotation,
) -> Result<i64, String> {
    with_user_db(&app, &state, |conn| {
        user_db::upsert_argument_annotation(conn, &annotation).map_err(|e| e.to_string())
    })
}

#[tauri::command]
fn delete_argument_annotation(
    app: AppHandle,
    state: tauri::State<'_, UserDbState>,
    id: i64,
) -> Result<usize, String> {
    with_user_db(&app, &state, |conn| {
        user_db::delete_argument_annotation(conn, id).map_err(|e| e.to_string())
    })
}

// ---------- Highlights ----------

#[tauri::command]
fn list_highlights_for_chapter(
    app: AppHandle,
    state: tauri::State<'_, UserDbState>,
    book_id: i64,
    chapter: i64,
) -> Result<Vec<user_db::Highlight>, String> {
    with_user_db(&app, &state, |conn| {
        user_db::list_highlights_for_chapter(conn, book_id, chapter).map_err(|e| e.to_string())
    })
}

#[tauri::command]
fn upsert_highlight(
    app: AppHandle,
    state: tauri::State<'_, UserDbState>,
    verse_id: i64,
    color: String,
) -> Result<(), String> {
    with_user_db(&app, &state, |conn| {
        user_db::upsert_highlight(conn, verse_id, &color).map_err(|e| e.to_string())
    })
}

#[tauri::command]
fn delete_highlight(
    app: AppHandle,
    state: tauri::State<'_, UserDbState>,
    verse_id: i64,
) -> Result<usize, String> {
    with_user_db(&app, &state, |conn| {
        user_db::delete_highlight(conn, verse_id).map_err(|e| e.to_string())
    })
}

#[tauri::command]
fn list_range_highlights_for_chapter(
    app: AppHandle,
    state: tauri::State<'_, UserDbState>,
    book_id: i64,
    chapter: i64,
) -> Result<Vec<user_db::RangeHighlight>, String> {
    with_user_db(&app, &state, |conn| {
        user_db::list_range_highlights_for_chapter(conn, book_id, chapter)
            .map_err(|e| e.to_string())
    })
}

#[tauri::command]
fn upsert_range_highlight(
    app: AppHandle,
    state: tauri::State<'_, UserDbState>,
    start_verse_id: i64,
    end_verse_id: i64,
    color: String,
) -> Result<(), String> {
    with_user_db(&app, &state, |conn| {
        user_db::upsert_range_highlight(conn, start_verse_id, end_verse_id, &color)
            .map_err(|e| e.to_string())
    })
}

#[tauri::command]
fn delete_range_highlight(
    app: AppHandle,
    state: tauri::State<'_, UserDbState>,
    start_verse_id: i64,
    end_verse_id: i64,
) -> Result<usize, String> {
    with_user_db(&app, &state, |conn| {
        user_db::delete_range_highlight(conn, start_verse_id, end_verse_id)
            .map_err(|e| e.to_string())
    })
}

// ---------- Notes ----------

#[tauri::command]
fn get_note(
    app: AppHandle,
    state: tauri::State<'_, UserDbState>,
    verse_id: i64,
) -> Result<Option<user_db::Note>, String> {
    with_user_db(&app, &state, |conn| {
        user_db::get_note(conn, verse_id).map_err(|e| e.to_string())
    })
}

#[tauri::command]
fn upsert_note(
    app: AppHandle,
    state: tauri::State<'_, UserDbState>,
    verse_id: i64,
    body: String,
) -> Result<(), String> {
    with_user_db(&app, &state, |conn| {
        user_db::upsert_note(conn, verse_id, &body).map_err(|e| e.to_string())
    })
}

#[tauri::command]
fn delete_note(
    app: AppHandle,
    state: tauri::State<'_, UserDbState>,
    verse_id: i64,
) -> Result<usize, String> {
    with_user_db(&app, &state, |conn| {
        user_db::delete_note(conn, verse_id).map_err(|e| e.to_string())
    })
}

#[tauri::command]
fn list_notes_for_chapter(
    app: AppHandle,
    state: tauri::State<'_, UserDbState>,
    book_id: i64,
    chapter: i64,
) -> Result<Vec<user_db::Note>, String> {
    with_user_db(&app, &state, |conn| {
        user_db::list_notes_for_chapter(conn, book_id, chapter).map_err(|e| e.to_string())
    })
}

#[tauri::command]
fn get_range_note(
    app: AppHandle,
    state: tauri::State<'_, UserDbState>,
    start_verse_id: i64,
    end_verse_id: i64,
) -> Result<Option<user_db::RangeNote>, String> {
    with_user_db(&app, &state, |conn| {
        user_db::get_range_note(conn, start_verse_id, end_verse_id).map_err(|e| e.to_string())
    })
}

#[tauri::command]
fn upsert_range_note(
    app: AppHandle,
    state: tauri::State<'_, UserDbState>,
    start_verse_id: i64,
    end_verse_id: i64,
    body: String,
) -> Result<(), String> {
    with_user_db(&app, &state, |conn| {
        user_db::upsert_range_note(conn, start_verse_id, end_verse_id, &body)
            .map_err(|e| e.to_string())
    })
}

#[tauri::command]
fn delete_range_note(
    app: AppHandle,
    state: tauri::State<'_, UserDbState>,
    start_verse_id: i64,
    end_verse_id: i64,
) -> Result<usize, String> {
    with_user_db(&app, &state, |conn| {
        user_db::delete_range_note(conn, start_verse_id, end_verse_id).map_err(|e| e.to_string())
    })
}

#[tauri::command]
fn list_range_notes_for_chapter(
    app: AppHandle,
    state: tauri::State<'_, UserDbState>,
    book_id: i64,
    chapter: i64,
) -> Result<Vec<user_db::RangeNote>, String> {
    with_user_db(&app, &state, |conn| {
        user_db::list_range_notes_for_chapter(conn, book_id, chapter).map_err(|e| e.to_string())
    })
}

/// Retrieve evidence for a council question.
///
/// Strategy: run semantic search (when embeddings exist + Ollama is reachable)
/// AND keyword FTS in parallel, then merge. Semantic results come first
/// (ordered by cosine); FTS-only hits (those not already in the semantic
/// list) are appended as a safety net for exact-phrase matches the embedding
/// missed. If semantic is unavailable, we fall back to FTS alone.
async fn retrieve_evidence(
    app: &AppHandle,
    question: &str,
    options: &RetrievalOptions,
    ollama_host: Option<&str>,
) -> Result<(Vec<serde_json::Value>, String), String> {
    let translation = &options.translation_code;
    let limit = options.evidence_limit;
    let use_semantic = options.strategy == "semantic" || options.strategy == "hybrid";
    let use_fts = options.strategy == "keyword" || options.strategy == "hybrid";
    let explicit_rows = explicit_reference_rows(app, question, translation, options)?;
    let had_explicit_refs = !explicit_rows.is_empty();
    let has_embeddings: bool = {
        let conn = open_corpus(app)?;
        let row: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM verse_embeddings WHERE translation_code = ?1 AND model = ?2",
                rusqlite::params![translation, EMBED_MODEL],
                |r| r.get(0),
            )
            .map_err(|e| e.to_string())?;
        row > 0
    };

    // Semantic pass (if possible).
    let semantic_rows: Vec<serde_json::Value> = if use_semantic && has_embeddings {
        match ollama::embed_with_host(EMBED_MODEL, question, ollama_host).await {
            Ok(q_emb) => {
                let conn = open_corpus(app)?;
                // Request a bit more than `limit` so the merge can fall back
                // to FTS fills while still returning the top-ranked evidence.
                let sem_limit = (limit * 3) / 4 + 1;
                let hits = db::semantic_search(&conn, &q_emb, translation, EMBED_MODEL, sem_limit)
                    .map_err(|e| e.to_string())?;
                hits.into_iter()
                    .filter(|h| semantic_hit_matches(h, options))
                    .map(|h| {
                        serde_json::json!({
                            "verse_id": h.verse_id,
                            "translation_code": h.translation_code,
                            "book_id": h.book_id,
                            "book_name": h.book_name,
                            "book_osis": h.book_osis,
                            "chapter": h.chapter,
                            "verse": h.verse,
                            "text": h.text,
                            "score": h.score,
                            "semantic_score": h.score,
                            "source": "semantic",
                        })
                    })
                    .collect()
            }
            Err(e) => {
                eprintln!("[council] semantic retrieval failed: {e}");
                Vec::new()
            }
        }
    } else {
        Vec::new()
    };

    // FTS pass (always attempt; cheap and gives exact-phrase recall).
    let fts_query = question_to_fts_query(question);
    let matched_terms: Vec<String> = fts_query
        .split_whitespace()
        .map(|term| term.trim_matches('"').to_string())
        .filter(|term| !term.is_empty() && term.to_uppercase() != "OR")
        .collect();
    let fts_rows: Vec<serde_json::Value> = if use_fts && !fts_query.is_empty() {
        let conn = open_corpus(app)?;
        let hits = db::search(
            &conn,
            &fts_query,
            Some(translation),
            limit as i64,
            options.book_id,
            options.testament.as_deref(),
        )
        .map_err(|e| e.to_string())?;
        hits.into_iter()
            .filter(|h| search_hit_matches(h, options))
            .map(|h| {
                serde_json::json!({
                    "verse_id": h.verse_id,
                    "translation_code": h.translation_code,
                    "book_id": h.book_id,
                    "book_name": h.book_name,
                    "book_osis": h.book_osis,
                    "chapter": h.chapter,
                    "verse": h.verse,
                    "text": h.text,
                    "keyword_score": 1.0,
                    "matched_terms": matched_terms.clone(),
                    "source": "fts",
                })
            })
            .collect()
    } else {
        Vec::new()
    };

    if explicit_rows.is_empty() && semantic_rows.is_empty() && fts_rows.is_empty() {
        return Err("no evidence found: retrieval produced no hits".to_string());
    }

    // Merge: semantic first (already ordered by score desc), then FTS-only
    // tail. Reserve ~25% of `limit` for cross-references of top hits so the
    // council sees passages the direct match might have missed.
    let mut seen: std::collections::HashSet<i64> = std::collections::HashSet::new();
    let mut merged: Vec<serde_json::Value> = Vec::with_capacity(limit);
    let core_target = (limit * 3) / 4; // leave a quarter for cross-refs

    for row in &explicit_rows {
        if let Some(vid) = row.get("verse_id").and_then(|v| v.as_i64()) {
            if seen.insert(vid) {
                merged.push(row.clone());
                if merged.len() >= limit {
                    break;
                }
            }
        }
    }

    for row in &semantic_rows {
        if merged.len() >= core_target {
            break;
        }
        if let Some(vid) = row.get("verse_id").and_then(|v| v.as_i64()) {
            if seen.insert(vid) {
                merged.push(row.clone());
            }
        }
    }
    for row in &fts_rows {
        if merged.len() >= core_target {
            break;
        }
        if let Some(vid) = row.get("verse_id").and_then(|v| v.as_i64()) {
            if seen.insert(vid) {
                merged.push(row.clone());
            }
        }
    }

    // Cross-reference expansion: for the top ~10 core hits, pull a few
    // cross-refs each. Adds passages the direct retrieval missed (e.g. NT
    // verses cross-referenced from an OT match). Capped overall at `limit`.
    let mut had_cross_refs = false;
    if options.include_cross_refs {
        let conn = open_corpus(app).map_err(|e| e.to_string())?;
        let core_seed: Vec<i64> = merged
            .iter()
            .take(10)
            .filter_map(|r| r.get("verse_id").and_then(|v| v.as_i64()))
            .collect();
        for seed_vid in core_seed {
            if merged.len() >= limit {
                break;
            }
            let xrefs = match db::get_cross_refs(&conn, seed_vid, translation, 3) {
                Ok(v) => v,
                Err(_) => continue,
            };
            for x in xrefs {
                if merged.len() >= limit {
                    break;
                }
                if x.text.trim().is_empty()
                    || !seen.insert(x.to_verse_id)
                    || !cross_ref_matches(&x, options)
                {
                    continue;
                }
                had_cross_refs = true;
                merged.push(serde_json::json!({
                    "verse_id": x.to_verse_id,
                    "translation_code": translation,
                    "book_id": x.book_id,
                    "book_name": x.book_name,
                    "book_osis": x.book_osis,
                    "chapter": x.chapter,
                    "verse": x.verse,
                    "text": x.text,
                    "source": "cross-ref",
                    "from_verse_id": seed_vid,
                    "cross_reference_weight": x.weight,
                }));
            }
        }
    }

    let mode = match (
        had_explicit_refs,
        !semantic_rows.is_empty(),
        !fts_rows.is_empty(),
        had_cross_refs,
    ) {
        (true, _, _, true) => "explicit+hybrid+xref",
        (true, _, _, false) => "explicit+hybrid",
        (false, true, _, true) | (false, _, true, true) => "hybrid+xref",
        (false, true, true, false) => "hybrid",
        (false, true, false, false) => "semantic",
        (false, false, true, false) => "fts",
        (false, false, false, _) => "none",
    }
    .to_string();

    Ok((merged, mode))
}

fn explicit_reference_rows(
    app: &AppHandle,
    question: &str,
    translation: &str,
    options: &RetrievalOptions,
) -> Result<Vec<serde_json::Value>, String> {
    let conn = open_corpus(app)?;
    let books = db::list_books(&conn).map_err(|e| e.to_string())?;
    let ranges = extract_reference_ranges(question, &books);
    if ranges.is_empty() {
        return Ok(Vec::new());
    }
    let mut rows = Vec::new();
    let mut seen = std::collections::HashSet::new();
    for range in ranges {
        if rows.len() >= options.evidence_limit {
            break;
        }
        let remaining = (options.evidence_limit - rows.len()) as i64;
        let verses = db::get_verse_range(
            &conn,
            translation,
            range.start_verse_id,
            range.end_verse_id,
            remaining,
        )
        .map_err(|e| e.to_string())?;
        for verse in verses {
            if rows.len() >= options.evidence_limit {
                break;
            }
            if !seen.insert(verse.verse_id) {
                continue;
            }
            rows.push(serde_json::json!({
                "verse_id": verse.verse_id,
                "translation_code": translation,
                "book_id": range.book.id,
                "book_name": range.book.name,
                "book_osis": range.book.osis_code,
                "chapter": verse.chapter,
                "verse": verse.verse,
                "text": verse.text,
                "source": "explicit-reference",
            }));
        }
    }
    Ok(rows)
}

#[derive(Clone)]
struct ReferenceRange {
    book: db::Book,
    start_verse_id: i64,
    end_verse_id: i64,
}

fn extract_reference_ranges(question: &str, books: &[db::Book]) -> Vec<ReferenceRange> {
    let normalized = normalize_reference_text(question);
    let mut ranges = Vec::new();
    let mut seen = std::collections::HashSet::new();
    let mut aliases: Vec<(String, db::Book)> = Vec::new();
    for book in books {
        aliases.push((book.name.to_lowercase(), book.clone()));
        aliases.push((book.osis_code.to_lowercase(), book.clone()));
        if let Some(short) = short_book_alias(&book.name) {
            aliases.push((short, book.clone()));
        }
    }
    aliases.sort_by(|a, b| b.0.len().cmp(&a.0.len()));

    for (alias, book) in aliases {
        let mut offset = 0;
        while let Some(index) = normalized[offset..].find(&alias) {
            let start = offset + index;
            let end = start + alias.len();
            let before = normalized[..start].chars().next_back().unwrap_or(' ');
            let after = normalized[end..].chars().next().unwrap_or(' ');
            if before.is_alphanumeric() || after.is_alphabetic() {
                offset = end;
                continue;
            }
            if let Some((chapter, verse, end_chapter, end_verse)) =
                parse_reference_numbers(&normalized[end..], book.chapter_count)
            {
                let start_verse = verse.unwrap_or(1);
                let end_chapter = end_chapter.unwrap_or(chapter);
                let end_verse =
                    end_verse.unwrap_or(if verse.is_some() { start_verse } else { 999 });
                let start_verse_id = book.id * 1_000_000 + chapter * 1000 + start_verse;
                let end_verse_id = book.id * 1_000_000 + end_chapter * 1000 + end_verse;
                if seen.insert((start_verse_id, end_verse_id)) {
                    ranges.push(ReferenceRange {
                        book: book.clone(),
                        start_verse_id,
                        end_verse_id,
                    });
                }
            }
            offset = end;
        }
    }
    ranges.sort_by_key(|range| range.start_verse_id);
    ranges
}

fn normalize_reference_text(value: &str) -> String {
    let mut out = String::with_capacity(value.len());
    for ch in value.chars() {
        if ch.is_ascii_alphanumeric() || ch == ':' || ch == '-' {
            out.push(ch.to_ascii_lowercase());
        } else {
            out.push(' ');
        }
    }
    while out.contains("  ") {
        out = out.replace("  ", " ");
    }
    out
}

fn short_book_alias(name: &str) -> Option<String> {
    match name {
        "1 Timothy" => Some("1 tim".to_string()),
        "2 Timothy" => Some("2 tim".to_string()),
        "1 Corinthians" => Some("1 cor".to_string()),
        "2 Corinthians" => Some("2 cor".to_string()),
        "1 Thessalonians" => Some("1 thess".to_string()),
        "2 Thessalonians" => Some("2 thess".to_string()),
        "1 Peter" => Some("1 pet".to_string()),
        "2 Peter" => Some("2 pet".to_string()),
        "1 John" => Some("1 jn".to_string()),
        "2 John" => Some("2 jn".to_string()),
        "3 John" => Some("3 jn".to_string()),
        _ => None,
    }
}

fn parse_reference_numbers(
    value: &str,
    max_chapter: i64,
) -> Option<(i64, Option<i64>, Option<i64>, Option<i64>)> {
    let trimmed = value.trim_start();
    let (chapter, mut rest) = consume_i64(trimmed)?;
    if chapter < 1 || chapter > max_chapter {
        return None;
    }
    rest = rest.trim_start();
    if !rest.starts_with(':') {
        return Some((chapter, None, None, None));
    }
    let (verse, next) = consume_i64(&rest[1..])?;
    rest = next.trim_start();
    if !rest.starts_with('-') {
        return Some((chapter, Some(verse), None, None));
    }
    let (first, next) = consume_i64(&rest[1..])?;
    let next = next.trim_start();
    if let Some(stripped) = next.strip_prefix(':') {
        let (end_verse, _) = consume_i64(stripped)?;
        Some((chapter, Some(verse), Some(first), Some(end_verse)))
    } else {
        Some((chapter, Some(verse), Some(chapter), Some(first)))
    }
}

fn consume_i64(value: &str) -> Option<(i64, &str)> {
    let bytes = value.as_bytes();
    let mut end = 0;
    while end < bytes.len() && bytes[end].is_ascii_digit() {
        end += 1;
    }
    if end == 0 {
        return None;
    }
    let parsed = value[..end].parse().ok()?;
    Some((parsed, &value[end..]))
}

fn semantic_hit_matches(hit: &db::SemanticHit, options: &RetrievalOptions) -> bool {
    if let Some(book_id) = options.book_id {
        if hit.book_id != book_id {
            return false;
        }
    }
    if let Some(testament) = options.testament.as_deref() {
        if !book_matches_testament(hit.book_id, testament) {
            return false;
        }
    }
    verse_in_requested_range(hit.verse_id, options)
}

fn search_hit_matches(hit: &db::SearchHit, options: &RetrievalOptions) -> bool {
    verse_in_requested_range(hit.verse_id, options)
}

fn cross_ref_matches(hit: &db::CrossRef, options: &RetrievalOptions) -> bool {
    if let Some(book_id) = options.book_id {
        if hit.book_id != book_id {
            return false;
        }
    }
    if let Some(testament) = options.testament.as_deref() {
        if !book_matches_testament(hit.book_id, testament) {
            return false;
        }
    }
    verse_in_requested_range(hit.to_verse_id, options)
}

fn verse_in_requested_range(verse_id: i64, options: &RetrievalOptions) -> bool {
    if let Some(start) = options.start_verse_id {
        if verse_id < start {
            return false;
        }
    }
    if let Some(end) = options.end_verse_id {
        if verse_id > end {
            return false;
        }
    }
    true
}

fn book_matches_testament(book_id: i64, testament: &str) -> bool {
    match testament {
        "OT" => (1..=39).contains(&book_id),
        "NT" => (40..=66).contains(&book_id),
        "DC" => book_id > 66,
        _ => true,
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .manage(SidecarState::new())
        .manage(UserDbState::new())
        .invoke_handler(tauri::generate_handler![
            list_books,
            list_translations,
            get_chapter,
            get_verse_range,
            search,
            get_word_tokens,
            get_strongs,
            get_strongs_occurrences,
            get_cross_refs,
            get_app_settings,
            save_app_settings,
            check_app_setup,
            list_study_workspaces,
            create_study_workspace,
            update_study_workspace,
            delete_study_workspace,
            get_study_workspace,
            add_study_item,
            update_study_item,
            delete_study_item,
            reorder_study_items,
            list_bookmarks,
            add_bookmark,
            delete_bookmark,
            record_reading_location,
            list_reading_history,
            list_saved_searches,
            create_saved_search,
            update_saved_search_title,
            delete_saved_search,
            list_modules,
            create_module,
            delete_module,
            add_module_entry,
            import_module_jsonl,
            list_module_entries_for_verse,
            list_module_entries_for_range,
            list_module_entries_for_strongs,
            list_module_topics,
            list_module_entries_for_topic,
            export_user_data_json,
            import_user_data_json,
            write_user_data_backup,
            write_workspace_markdown,
            write_workspace_html,
            write_workspace_pdf,
            write_theology_pdf,
            backup_user_sqlite,
            restore_user_sqlite,
            ask_council,
            explain_passage,
            list_council_sessions,
            get_council_session,
            delete_council_session,
            get_council_judgment,
            upsert_council_judgment,
            delete_council_judgment,
            list_judgments_for_workspace,
            list_theology_topics,
            get_theology_topic,
            create_theology_topic,
            update_theology_topic,
            get_theology_conclusion,
            upsert_theology_conclusion,
            list_theology_positions,
            upsert_theology_position,
            list_theology_links,
            create_theology_link,
            delete_theology_link,
            export_theology_markdown,
            list_resource_sources,
            list_resource_collections,
            search_resources,
            get_resource_entry,
            get_guided_study_session,
            list_guided_study_sessions_for_topic,
            upsert_guided_study_session,
            list_argument_annotations,
            upsert_argument_annotation,
            delete_argument_annotation,
            list_highlights_for_chapter,
            upsert_highlight,
            delete_highlight,
            list_range_highlights_for_chapter,
            upsert_range_highlight,
            delete_range_highlight,
            get_note,
            upsert_note,
            delete_note,
            list_notes_for_chapter,
            get_range_note,
            upsert_range_note,
            delete_range_note,
            list_range_notes_for_chapter
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
