mod credentials;
mod db;
mod ollama;
mod sidecar;
mod user_db;

use std::path::{Path, PathBuf};
use std::sync::Mutex;
use tauri::ipc::Channel;
use tauri::{AppHandle, Manager};

use sidecar::{build_council_request, question_to_fts_query, SidecarState};

const EMBED_MODEL: &str = "nomic-embed-text";
const USER_DATA_DIR_ENV: &str = "BIBLE_AI_USER_DATA_DIR";
const MIN_VERSE_ID: i64 = 1_001_001;
const MAX_VERSE_ID: i64 = 1_001_000_999;

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

fn bounded_limit(limit: Option<i64>, default: i64, max: i64) -> i64 {
    limit.unwrap_or(default).clamp(1, max)
}

fn validate_book_id(book_id: i64) -> Result<(), String> {
    if !(1..=1000).contains(&book_id) {
        return Err("book_id must be within the corpus range".to_string());
    }
    Ok(())
}

fn validate_book_chapter(book_id: i64, chapter: i64) -> Result<(), String> {
    validate_book_id(book_id)?;
    if !(1..=1000).contains(&chapter) {
        return Err("chapter must be within the corpus range".to_string());
    }
    Ok(())
}

fn validate_verse_id(verse_id: i64) -> Result<(), String> {
    if !(MIN_VERSE_ID..=MAX_VERSE_ID).contains(&verse_id) {
        return Err("verse_id must be within the corpus range".to_string());
    }
    Ok(())
}

fn validate_verse_range(start_verse_id: i64, end_verse_id: i64) -> Result<(), String> {
    validate_verse_id(start_verse_id)?;
    validate_verse_id(end_verse_id)?;
    if start_verse_id > end_verse_id {
        return Err("start verse must be before end verse".to_string());
    }
    Ok(())
}

fn validate_hex_color(color: &str) -> Result<&str, String> {
    let color = color.trim();
    let valid = color.len() == 7
        && color.starts_with('#')
        && color[1..].chars().all(|ch| ch.is_ascii_hexdigit());
    if !valid {
        return Err("highlight color must be a #RRGGBB hex value".to_string());
    }
    Ok(color)
}

fn normalize_module_key_value(key_type: &str, key_value: &str) -> Result<String, String> {
    let key_value = key_value.trim();
    if key_value.is_empty() {
        return Err("module entry requires key_value".to_string());
    }
    match key_type {
        "verse" => {
            let verse_id = key_value
                .parse::<i64>()
                .map_err(|_| "module verse key must be a verse_id".to_string())?;
            validate_verse_id(verse_id)?;
            Ok(verse_id.to_string())
        }
        "verse_range" => {
            let (start, end) = key_value
                .split_once('-')
                .ok_or_else(|| "module verse_range key must be start-end".to_string())?;
            let start = start
                .trim()
                .parse::<i64>()
                .map_err(|_| "module verse_range start must be a verse_id".to_string())?;
            let end = end
                .trim()
                .parse::<i64>()
                .map_err(|_| "module verse_range end must be a verse_id".to_string())?;
            validate_verse_range(start, end)?;
            Ok(format!("{start}-{end}"))
        }
        "strongs" => {
            if key_value.len() > 32 {
                return Err("module Strong's key is too long".to_string());
            }
            if !key_value
                .chars()
                .all(|ch| ch.is_ascii_alphanumeric() || ch == '-')
            {
                return Err("module Strong's key contains unsupported characters".to_string());
            }
            Ok(key_value.to_ascii_uppercase())
        }
        "topic" => {
            if key_value.len() > 160 {
                return Err("module topic key is too long".to_string());
            }
            Ok(key_value.to_string())
        }
        _ => Err(format!("unsupported key_type: {key_type}")),
    }
}

fn normalize_strongs_codes(codes: Vec<String>) -> Result<Vec<String>, String> {
    let codes = codes
        .into_iter()
        .map(|code| code.trim().to_string())
        .filter(|code| !code.is_empty())
        .collect::<Vec<_>>();
    if codes.len() > 64 {
        return Err("too many Strong's codes requested".to_string());
    }
    if codes.iter().any(|code| code.len() > 32) {
        return Err("Strong's code is too long".to_string());
    }
    Ok(codes)
}

fn normalize_testament_filter(value: Option<String>) -> Result<Option<String>, String> {
    let Some(value) = value
        .map(|item| item.trim().to_string())
        .filter(|item| !item.is_empty())
    else {
        return Ok(None);
    };
    if matches!(value.as_str(), "OT" | "NT" | "DC") {
        Ok(Some(value))
    } else {
        Err("testament must be OT, NT, or DC".to_string())
    }
}

fn normalize_optional_text_setting(
    value: &mut Option<String>,
    label: &str,
    max_chars: usize,
) -> Result<(), String> {
    let Some(raw) = value.take() else {
        return Ok(());
    };
    let trimmed = raw.trim();
    if trimmed.is_empty() {
        *value = None;
        return Ok(());
    }
    if trimmed.chars().count() > max_chars {
        return Err(format!("{label} is too long"));
    }
    if trimmed.chars().any(char::is_control) {
        return Err(format!("{label} cannot contain control characters"));
    }
    *value = Some(trimmed.to_string());
    Ok(())
}

fn normalize_secret_setting(
    value: &mut Option<String>,
    label: &str,
    max_chars: usize,
) -> Result<(), String> {
    if let Some(raw) = value {
        let trimmed = raw.trim().to_string();
        if trimmed.chars().count() > max_chars {
            return Err(format!("{label} is too long"));
        }
        if !trimmed.is_empty() && trimmed.chars().any(char::is_control) {
            return Err(format!("{label} cannot contain control characters"));
        }
        *raw = trimmed;
    }
    Ok(())
}

fn normalize_model_setting(value: &mut Option<String>, label: &str) -> Result<(), String> {
    normalize_optional_text_setting(value, label, 128)
}

fn normalize_model_id(value: &str, label: &str) -> Result<String, String> {
    let mut normalized = Some(value.to_string());
    normalize_model_setting(&mut normalized, label)?;
    normalized.ok_or_else(|| format!("{label} is required"))
}

fn normalize_http_url_setting(value: &mut Option<String>, label: &str) -> Result<(), String> {
    normalize_optional_text_setting(value, label, 2048)?;
    let Some(raw) = value.as_deref() else {
        return Ok(());
    };
    let parsed = reqwest::Url::parse(raw).map_err(|_| format!("{label} must be a valid URL"))?;
    if !matches!(parsed.scheme(), "http" | "https") {
        return Err(format!("{label} must use http or https"));
    }
    if parsed.host_str().is_none() {
        return Err(format!("{label} must include a host"));
    }
    Ok(())
}

fn normalize_translation_code_value(value: &str, label: &str) -> Result<String, String> {
    let code = value.trim();
    if code.is_empty() {
        return Err(format!("{label} is required"));
    }
    if code.len() > 32 {
        return Err(format!("{label} is too long"));
    }
    if !code
        .chars()
        .all(|ch| ch.is_ascii_alphanumeric() || ch == '_' || ch == '-')
    {
        return Err(format!("{label} contains unsupported characters"));
    }
    Ok(code.to_ascii_uppercase())
}

fn normalize_translation_setting(value: &mut Option<String>, label: &str) -> Result<(), String> {
    let Some(raw) = value.take() else {
        return Ok(());
    };
    if raw.trim().is_empty() {
        *value = None;
        return Ok(());
    }
    *value = Some(normalize_translation_code_value(&raw, label)?);
    Ok(())
}

fn normalize_active_translations(value: &mut Option<String>) -> Result<(), String> {
    let Some(raw) = value.take() else {
        return Ok(());
    };
    let mut seen = std::collections::HashSet::new();
    let mut codes = Vec::new();
    for part in raw.split(',') {
        let part = part.trim();
        if part.is_empty() {
            continue;
        }
        let code = normalize_translation_code_value(part, "active translation")?;
        if seen.insert(code.clone()) {
            codes.push(code);
        }
    }
    if codes.len() > 24 {
        return Err("too many active translations".to_string());
    }
    *value = (!codes.is_empty()).then(|| codes.join(","));
    Ok(())
}

fn normalize_enum_setting(
    value: &mut Option<String>,
    label: &str,
    allowed: &[&str],
) -> Result<(), String> {
    let Some(raw) = value.take() else {
        return Ok(());
    };
    let trimmed = raw.trim();
    if trimmed.is_empty() {
        *value = None;
        return Ok(());
    }
    if !allowed.contains(&trimmed) {
        return Err(format!("{label} is unsupported"));
    }
    *value = Some(trimmed.to_string());
    Ok(())
}

fn normalize_app_settings(settings: &mut user_db::AppSettings) -> Result<(), String> {
    normalize_secret_setting(&mut settings.google_api_key, "Google API key", 8192)?;
    normalize_secret_setting(&mut settings.openai_api_key, "OpenAI API key", 8192)?;
    normalize_secret_setting(&mut settings.anthropic_api_key, "Anthropic API key", 8192)?;
    normalize_secret_setting(
        &mut settings.managed_gateway_token,
        "Managed gateway token",
        8192,
    )?;
    normalize_http_url_setting(&mut settings.managed_gateway_url, "Managed gateway URL")?;
    normalize_http_url_setting(&mut settings.ollama_host, "Ollama host")?;
    normalize_model_setting(&mut settings.claude_model, "Claude model")?;
    normalize_model_setting(&mut settings.openai_model, "OpenAI model")?;
    normalize_model_setting(&mut settings.gemini_model, "Gemini model")?;
    normalize_model_setting(&mut settings.anthropic_model, "Anthropic API model")?;
    normalize_translation_setting(&mut settings.retrieval_translation, "Retrieval translation")?;
    normalize_active_translations(&mut settings.active_translations)?;
    normalize_enum_setting(
        &mut settings.reader_layout,
        "Reader layout",
        &["columns", "interleaved"],
    )?;
    normalize_enum_setting(
        &mut settings.reader_density,
        "Reader density",
        &["comfortable", "compact"],
    )?;
    normalize_enum_setting(
        &mut settings.search_strategy,
        "Search strategy",
        &["keyword", "semantic", "hybrid"],
    )?;
    settings.font_scale = settings
        .font_scale
        .and_then(|value| value.is_finite().then(|| value.clamp(0.8, 1.4)));
    Ok(())
}

fn has_legacy_provider_key_rows(settings: &user_db::AppSettings) -> bool {
    settings.google_api_key.is_some()
        || settings.openai_api_key.is_some()
        || settings.anthropic_api_key.is_some()
        || settings.managed_gateway_token.is_some()
}

fn provider_settings_for_legacy_migration(settings: &user_db::AppSettings) -> user_db::AppSettings {
    let mut migrated = settings.clone();
    keep_only_non_empty_secret(&mut migrated.google_api_key);
    keep_only_non_empty_secret(&mut migrated.openai_api_key);
    keep_only_non_empty_secret(&mut migrated.anthropic_api_key);
    keep_only_non_empty_secret(&mut migrated.managed_gateway_token);
    migrated
}

fn keep_only_non_empty_secret(value: &mut Option<String>) {
    if value.as_deref().is_none_or(|v| v.trim().is_empty()) {
        *value = None;
    }
}

/// Migrate legacy plaintext provider secrets out of a freshly-restored user DB.
///
/// A backup made before provider keys moved to the OS credential vault stores
/// them as plaintext rows in `app_settings`. Restore is a raw file copy, so it
/// would otherwise leave those secrets at rest in the active SQLite file until
/// the next settings read happened to migrate them. Run the same migration the
/// startup path uses (copy into the vault, then delete the rows) immediately, so
/// the active DB never retains plaintext secrets after a restore returns success.
fn migrate_restored_provider_secrets(conn: &rusqlite::Connection) -> Result<(), String> {
    let settings = user_db::get_app_settings(conn).map_err(|e| e.to_string())?;
    if has_legacy_provider_key_rows(&settings) {
        let legacy_settings = provider_settings_for_legacy_migration(&settings);
        credentials::save_provider_keys(&legacy_settings)?;
        user_db::delete_secret_settings(conn).map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[cfg(test)]
mod command_input_tests {
    use super::{
        bounded_limit, classify_sensitive_topic, council_retrieval_fallback_reason,
        normalize_app_settings, normalize_model_id, normalize_module_key_value,
        normalize_strongs_codes, normalize_testament_filter, normalize_translation_code_value,
        provider_settings_for_legacy_migration, sensitive_topic_message, validate_book_chapter,
        validate_book_id, validate_hex_color, validate_verse_range,
    };
    use crate::user_db::AppSettings;

    #[test]
    fn sensitive_router_flags_direct_crisis_prompts() {
        assert!(classify_sensitive_topic("I want to kill myself").is_some());
        assert!(classify_sensitive_topic("I am going to end my life tonight").is_some());
        assert!(classify_sensitive_topic("my husband hits me and I am scared").is_some());
    }

    #[test]
    fn sensitive_router_flags_indirect_phrasings() {
        // The dangerous failure is the false negative, so euphemistic / third-person
        // / Scripture-wrapped phrasings must still route to safety.
        assert!(
            classify_sensitive_topic("everyone would be better off without me").is_some(),
            "euphemistic self-harm must be flagged"
        );
        assert!(
            classify_sensitive_topic("asking for a friend, how do you end it all").is_some(),
            "third-person framing must be flagged"
        );
    }

    #[test]
    fn sensitive_router_ignores_ordinary_study_questions() {
        assert!(classify_sensitive_topic("What does Romans 9 say about election?").is_none());
        assert!(classify_sensitive_topic("Did Jesus die for our sins?").is_none());
        assert!(classify_sensitive_topic("How do I forgive someone who hurt me?").is_none());
    }

    #[test]
    fn sensitive_router_covers_every_policy_category() {
        let cases = [
            ("I want to end my life", "self-harm or suicide"),
            ("I am going to hurt someone", "harm to others"),
            ("my partner hits me", "abuse"),
            ("I was sexually assaulted", "sexual abuse or coercion"),
            ("a child is being abused", "child safety"),
            (
                "should I stop my medication",
                "medical or mental-health crisis",
            ),
            (
                "should I invest my life savings",
                "high-stakes legal or financial decision",
            ),
            ("my grief is unbearable", "pastoral emergency"),
            (
                "I will be shunned if I leave",
                "spiritual abuse or coercion",
            ),
            ("I hit my child", "confession involving harm"),
        ];
        for (prompt, expected) in cases {
            assert_eq!(classify_sensitive_topic(prompt), Some(expected), "{prompt}");
        }
    }

    #[test]
    fn sensitive_router_passes_auditable_direct_and_indirect_fixtures() {
        let fixtures: serde_json::Value = serde_json::from_str(include_str!(
            "../../tests/fixtures/sensitive-topic-cases.json"
        ))
        .expect("sensitive-topic fixture is valid JSON");
        for case in fixtures.as_array().expect("fixture is an array") {
            let prompt = case["prompt"].as_str().expect("prompt");
            let expected = case["expected_category"]
                .as_str()
                .expect("expected category");
            assert_eq!(classify_sensitive_topic(prompt), Some(expected), "{prompt}");
        }
    }

    #[test]
    fn sensitive_resources_are_locale_specific_and_safe_by_default() {
        let (ie, ie_message) = sensitive_topic_message(Some("en-IE"));
        assert_eq!(ie, "en-IE");
        assert!(ie_message.contains("112 or 999"));
        assert!(ie_message.contains("116 123"));

        let (fallback, fallback_message) = sensitive_topic_message(Some("fr-FR"));
        assert_eq!(fallback, "international");
        assert!(!fallback_message.contains("988"));
        assert!(!fallback_message.contains("911"));
    }

    #[test]
    fn council_fallback_reason_none_when_semantic_not_wanted() {
        // Keyword-only retrieval never "fell back" from anything.
        assert_eq!(
            council_retrieval_fallback_reason(false, "WEB", false, true),
            None
        );
    }

    #[test]
    fn council_fallback_reason_when_no_embeddings() {
        let reason = council_retrieval_fallback_reason(true, "WEB", false, true)
            .expect("missing embeddings should produce a fallback reason");
        assert!(
            reason.contains("WEB"),
            "reason should name the translation: {reason}"
        );
        assert!(
            reason.to_lowercase().contains("keyword"),
            "reason should explain it used keyword search: {reason}"
        );
    }

    #[test]
    fn council_fallback_reason_when_embedding_call_failed() {
        let reason = council_retrieval_fallback_reason(true, "WEB", true, false)
            .expect("a failed embedding call should produce a fallback reason");
        assert!(
            reason.to_lowercase().contains("keyword"),
            "reason should explain it used keyword search: {reason}"
        );
    }

    #[test]
    fn council_fallback_reason_none_when_semantic_succeeds() {
        assert_eq!(
            council_retrieval_fallback_reason(true, "WEB", true, true),
            None
        );
    }

    #[test]
    fn bounded_limit_rejects_sqlite_unbounded_negative_limits() {
        assert_eq!(bounded_limit(None, 20, 100), 20);
        assert_eq!(bounded_limit(Some(-1), 20, 100), 1);
        assert_eq!(bounded_limit(Some(0), 20, 100), 1);
        assert_eq!(bounded_limit(Some(250), 20, 100), 100);
    }

    #[test]
    fn validate_book_chapter_rejects_overflow_prone_values() {
        assert!(validate_book_id(1).is_ok());
        assert!(validate_book_id(0).is_err());
        assert!(validate_book_id(i64::MAX).is_err());
        assert!(validate_book_chapter(1, 1).is_ok());
        assert!(validate_book_chapter(0, 1).is_err());
        assert!(validate_book_chapter(1, 0).is_err());
        assert!(validate_book_chapter(i64::MAX, 1).is_err());
        assert!(validate_book_chapter(1, i64::MAX).is_err());
    }

    #[test]
    fn validate_verse_range_rejects_impossible_or_reversed_ranges() {
        assert!(validate_verse_range(1_001_001, 1_001_002).is_ok());
        assert!(validate_verse_range(1_001_002, 1_001_001).is_err());
        assert!(validate_verse_range(0, 1_001_001).is_err());
        assert!(validate_verse_range(1_001_001, i64::MAX).is_err());
    }

    #[test]
    fn validate_hex_color_rejects_non_hex_highlight_colors() {
        assert_eq!(
            validate_hex_color(" #fbbf24 ").expect("hex color"),
            "#fbbf24"
        );
        assert!(validate_hex_color("#FBBF24").is_ok());
        assert!(validate_hex_color("fbbf24").is_err());
        assert!(validate_hex_color("#fbbf24cc").is_err());
        assert!(validate_hex_color("var(--accent)").is_err());
    }

    #[test]
    fn normalize_module_key_value_matches_lookup_contracts() {
        assert_eq!(
            normalize_module_key_value("verse", " 1001001 ").expect("verse key"),
            "1001001"
        );
        assert_eq!(
            normalize_module_key_value("verse_range", "1001001 - 1001003").expect("range key"),
            "1001001-1001003"
        );
        assert_eq!(
            normalize_module_key_value("strongs", " h7225 ").expect("strongs key"),
            "H7225"
        );
        assert_eq!(
            normalize_module_key_value("topic", " creation ").expect("topic key"),
            "creation"
        );
        assert!(normalize_module_key_value("verse", "not-a-verse").is_err());
        assert!(normalize_module_key_value("verse_range", "1001003-1001001").is_err());
        assert!(normalize_module_key_value("strongs", "H7225 H1254").is_err());
        assert!(normalize_module_key_value("topic", &"x".repeat(161)).is_err());
    }

    #[test]
    fn normalize_strongs_codes_bounds_request_size() {
        assert_eq!(
            normalize_strongs_codes(vec![" H7225 ".to_string(), "".to_string()])
                .expect("normalize codes"),
            vec!["H7225".to_string()]
        );
        assert!(normalize_strongs_codes(vec!["G".repeat(33)]).is_err());
        assert!(normalize_strongs_codes((0..65).map(|idx| format!("H{idx}")).collect()).is_err());
    }

    #[test]
    fn normalize_testament_filter_rejects_unknown_values() {
        assert_eq!(
            normalize_testament_filter(Some(" OT ".to_string())).expect("normalize OT"),
            Some("OT".to_string())
        );
        assert_eq!(
            normalize_testament_filter(Some("   ".to_string())).expect("blank is all"),
            None
        );
        assert!(normalize_testament_filter(Some("old".to_string())).is_err());
    }

    #[test]
    fn normalize_app_settings_bounds_urls_models_and_reader_options() {
        let mut settings = AppSettings {
            google_api_key: Some("  goog-key  ".to_string()),
            managed_gateway_url: Some(" https://gateway.example.com/api ".to_string()),
            managed_gateway_token: Some(" gateway-token ".to_string()),
            claude_model: Some(" sonnet ".to_string()),
            openai_model: Some(" gpt-5 ".to_string()),
            gemini_model: Some(" gemini-2.5-flash ".to_string()),
            anthropic_model: Some(" claude-sonnet-4-6 ".to_string()),
            ollama_host: Some(" http://localhost:11434/ ".to_string()),
            retrieval_translation: Some(" kjv ".to_string()),
            active_translations: Some(" kjv, BHS, kjv ".to_string()),
            font_scale: Some(9.0),
            reader_layout: Some("interleaved".to_string()),
            reader_density: Some("compact".to_string()),
            search_strategy: Some("hybrid".to_string()),
            ..AppSettings::default()
        };

        normalize_app_settings(&mut settings).expect("settings should normalize");

        assert_eq!(settings.search_strategy.as_deref(), Some("hybrid"));
        assert_eq!(settings.google_api_key.as_deref(), Some("goog-key"));
        assert_eq!(
            settings.managed_gateway_url.as_deref(),
            Some("https://gateway.example.com/api")
        );
        assert_eq!(
            settings.managed_gateway_token.as_deref(),
            Some("gateway-token")
        );
        assert_eq!(settings.openai_model.as_deref(), Some("gpt-5"));
        assert_eq!(settings.retrieval_translation.as_deref(), Some("KJV"));
        assert_eq!(settings.active_translations.as_deref(), Some("KJV,BHS"));
        assert_eq!(settings.font_scale, Some(1.4));
    }

    #[test]
    fn normalize_app_settings_rejects_bad_network_and_display_values() {
        let mut bad_gateway = AppSettings {
            managed_gateway_url: Some("file:///tmp/socket".to_string()),
            ..AppSettings::default()
        };
        assert!(normalize_app_settings(&mut bad_gateway).is_err());

        let mut bad_layout = AppSettings {
            reader_layout: Some("stacked".to_string()),
            ..AppSettings::default()
        };
        assert!(normalize_app_settings(&mut bad_layout).is_err());

        let mut bad_strategy = AppSettings {
            search_strategy: Some("fulltext".to_string()),
            ..AppSettings::default()
        };
        assert!(normalize_app_settings(&mut bad_strategy).is_err());

        let mut bad_translation = AppSettings {
            retrieval_translation: Some("../KJV".to_string()),
            ..AppSettings::default()
        };
        assert!(normalize_app_settings(&mut bad_translation).is_err());
    }

    #[test]
    fn council_model_and_translation_overrides_are_bounded() {
        assert_eq!(
            normalize_model_id(" sonnet ", "Council model").expect("model"),
            "sonnet"
        );
        assert!(normalize_model_id(&"x".repeat(129), "Council model").is_err());
        assert_eq!(
            normalize_translation_code_value(" kjv ", "Retrieval translation")
                .expect("translation"),
            "KJV"
        );
        assert!(normalize_translation_code_value("kjv/../../x", "Retrieval translation").is_err());
    }

    #[test]
    fn legacy_provider_migration_does_not_delete_vault_entries_for_blank_rows() {
        let migrated = provider_settings_for_legacy_migration(&AppSettings {
            google_api_key: Some("   ".to_string()),
            openai_api_key: Some("sk-test".to_string()),
            anthropic_api_key: None,
            managed_gateway_token: Some("".to_string()),
            ..AppSettings::default()
        });

        assert_eq!(migrated.google_api_key, None);
        assert_eq!(migrated.openai_api_key.as_deref(), Some("sk-test"));
        assert_eq!(migrated.anthropic_api_key, None);
        assert_eq!(migrated.managed_gateway_token, None);
    }
}

/// Lazy-init container for the user.sqlite connection.
pub struct UserDbState(pub Mutex<Option<rusqlite::Connection>>);

impl Default for UserDbState {
    fn default() -> Self {
        Self::new()
    }
}

impl UserDbState {
    pub fn new() -> Self {
        Self(Mutex::new(None))
    }
}

fn user_db_path(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = user_data_dir(app)?;
    std::fs::create_dir_all(&dir)
        .map_err(|e| format!("could not create app data dir {}: {e}", dir.display()))?;
    Ok(dir.join("user.sqlite"))
}

fn user_data_dir(app: &AppHandle) -> Result<PathBuf, String> {
    if let Some(dir) = std::env::var_os(USER_DATA_DIR_ENV) {
        if !dir.is_empty() {
            let dir = PathBuf::from(dir);
            if !dir.is_absolute() {
                return Err(format!("{USER_DATA_DIR_ENV} must be an absolute path"));
            }
            return Ok(dir);
        }
    }

    app.path()
        .app_data_dir()
        .map_err(|e| format!("could not resolve app data dir: {e}"))
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
    validate_book_chapter(book_id, chapter)?;
    let translation_code = translation_code.trim();
    if translation_code.is_empty() {
        return Err("translation code is required".to_string());
    }
    let conn = open_corpus(&app)?;
    db::get_chapter(&conn, translation_code, book_id, chapter).map_err(|e| e.to_string())
}

#[tauri::command]
fn get_verse_range(
    app: AppHandle,
    translation_code: String,
    start_verse_id: i64,
    end_verse_id: i64,
    limit: Option<i64>,
) -> Result<Vec<db::Verse>, String> {
    validate_verse_range(start_verse_id, end_verse_id)?;
    let translation_code = translation_code.trim();
    if translation_code.is_empty() {
        return Err("translation code is required".to_string());
    }
    let conn = open_corpus(&app)?;
    let limit = bounded_limit(limit, 200, 500);
    db::get_verse_range(&conn, translation_code, start_verse_id, end_verse_id, limit)
        .map_err(|e| e.to_string())
}

#[derive(serde::Serialize, Clone)]
pub struct SearchResultHit {
    pub verse_id: i64,
    pub translation_code: String,
    pub book_id: i64,
    pub book_name: String,
    pub book_osis: String,
    pub chapter: i64,
    pub verse: i64,
    pub text: String,
    /// Empty for meaning-only hits; otherwise the FTS snippet (may contain <mark>).
    pub snippet: String,
    /// "keyword" | "meaning" | "both"
    pub match_kind: String,
    /// Cosine similarity 0..1, present for meaning/both.
    pub semantic_score: Option<f32>,
}

#[derive(serde::Serialize)]
pub struct SearchResponse {
    pub hits: Vec<SearchResultHit>,
    pub strategy_requested: String,
    pub strategy_used: String,
    pub degraded: bool,
    pub degraded_reason: Option<String>,
}

/// Merge semantic + keyword hits, deduped by verse_id.
/// Order: verses matched both ways first (semantic-score order), then
/// meaning-only (semantic-score order), then keyword-only (FTS order).
fn merge_search_hits(
    semantic: Vec<db::SemanticHit>,
    keyword: Vec<db::SearchHit>,
    limit: usize,
) -> Vec<SearchResultHit> {
    use std::collections::{HashMap, HashSet};
    let mut kw_by_id: HashMap<i64, db::SearchHit> = HashMap::new();
    let mut kw_order: Vec<i64> = Vec::new();
    for h in keyword {
        if !kw_by_id.contains_key(&h.verse_id) {
            kw_order.push(h.verse_id);
        }
        kw_by_id.insert(h.verse_id, h);
    }

    let mut both: Vec<SearchResultHit> = Vec::new();
    let mut meaning: Vec<SearchResultHit> = Vec::new();
    let mut seen: HashSet<i64> = HashSet::new();
    for s in semantic {
        if !seen.insert(s.verse_id) {
            continue;
        }
        let (match_kind, snippet) = match kw_by_id.get(&s.verse_id) {
            Some(k) => ("both", k.snippet.clone()),
            None => ("meaning", String::new()),
        };
        let hit = SearchResultHit {
            verse_id: s.verse_id,
            translation_code: s.translation_code,
            book_id: s.book_id,
            book_name: s.book_name,
            book_osis: s.book_osis,
            chapter: s.chapter,
            verse: s.verse,
            text: s.text,
            snippet,
            match_kind: match_kind.to_string(),
            semantic_score: Some(s.score),
        };
        if match_kind == "both" {
            both.push(hit);
        } else {
            meaning.push(hit);
        }
    }

    let mut out: Vec<SearchResultHit> = both;
    out.append(&mut meaning);
    for id in kw_order {
        if !seen.insert(id) {
            continue;
        }
        if let Some(k) = kw_by_id.remove(&id) {
            out.push(SearchResultHit {
                verse_id: k.verse_id,
                translation_code: k.translation_code,
                book_id: k.book_id,
                book_name: k.book_name,
                book_osis: k.book_osis,
                chapter: k.chapter,
                verse: k.verse,
                text: k.text,
                snippet: k.snippet,
                match_kind: "keyword".to_string(),
                semantic_score: None,
            });
        }
    }
    out.truncate(limit);
    out
}

#[tauri::command]
#[allow(clippy::too_many_arguments)]
async fn search(
    app: AppHandle,
    query: String,
    translation_code: Option<String>,
    limit: Option<i64>,
    book_id: Option<i64>,
    testament: Option<String>,
    strategy: Option<String>,
    ollama_host: Option<String>,
) -> Result<SearchResponse, String> {
    let query = query.trim().to_string();
    if query.len() > 500 {
        return Err("search query is too long".to_string());
    }
    if let Some(book_id) = book_id {
        validate_book_id(book_id)?;
    }
    let testament = normalize_testament_filter(testament)?;
    let requested = strategy
        .as_deref()
        .map(str::trim)
        .map(str::to_ascii_lowercase)
        .unwrap_or_else(|| "keyword".to_string());
    if !matches!(requested.as_str(), "keyword" | "semantic" | "hybrid") {
        return Err("unsupported search strategy".to_string());
    }
    let limit = bounded_limit(limit, 50, 200);
    let translation = translation_code
        .as_deref()
        .map(str::trim)
        .filter(|v| !v.is_empty());

    if query.is_empty() {
        return Ok(SearchResponse {
            hits: Vec::new(),
            strategy_requested: requested.clone(),
            strategy_used: requested,
            degraded: false,
            degraded_reason: None,
        });
    }

    let scope = db::VerseSearchScope {
        book_id,
        testament: testament.as_deref(),
        ..db::VerseSearchScope::default()
    };

    let use_semantic = matches!(requested.as_str(), "semantic" | "hybrid");
    let use_fts = matches!(requested.as_str(), "keyword" | "hybrid");
    let mut degraded = false;
    let mut degraded_reason: Option<String> = None;

    let semantic_hits: Vec<db::SemanticHit> = if use_semantic {
        match translation {
            None => {
                degraded = true;
                degraded_reason = Some(
                    "Meaning search needs a specific translation — showing keyword results"
                        .to_string(),
                );
                Vec::new()
            }
            Some(tr) => {
                let has_embeddings: i64 = {
                    let conn = open_corpus(&app)?;
                    conn.query_row(
                        "SELECT COUNT(*) FROM verse_embeddings WHERE translation_code = ?1 AND model = ?2",
                        rusqlite::params![tr, EMBED_MODEL],
                        |r| r.get(0),
                    )
                    .map_err(|e| e.to_string())?
                };
                if has_embeddings == 0 {
                    degraded = true;
                    degraded_reason = Some(format!(
                        "No meaning index for {tr} — showing keyword results"
                    ));
                    Vec::new()
                } else {
                    match ollama::embed_with_host(EMBED_MODEL, &query, ollama_host.as_deref()).await
                    {
                        Ok(q_emb) => {
                            let conn = open_corpus(&app)?;
                            db::semantic_search(
                                &conn,
                                &q_emb,
                                tr,
                                EMBED_MODEL,
                                limit as usize,
                                scope,
                            )
                            .map_err(|e| e.to_string())?
                        }
                        Err(e) => {
                            eprintln!("[search] semantic retrieval failed: {e}");
                            degraded = true;
                            degraded_reason = Some(
                                "Meaning search needs Ollama running — showing keyword results"
                                    .to_string(),
                            );
                            Vec::new()
                        }
                    }
                }
            }
        }
    } else {
        Vec::new()
    };

    let need_fts = use_fts || (use_semantic && degraded);
    let keyword_hits: Vec<db::SearchHit> = if need_fts {
        let conn = open_corpus(&app)?;
        db::search(&conn, &query, translation, limit, scope).map_err(|e| e.to_string())?
    } else {
        Vec::new()
    };

    let strategy_used = if degraded {
        "keyword".to_string()
    } else {
        requested.clone()
    };
    let hits = merge_search_hits(semantic_hits, keyword_hits, limit as usize);

    Ok(SearchResponse {
        hits,
        strategy_requested: requested,
        strategy_used,
        degraded,
        degraded_reason,
    })
}

#[tauri::command]
fn get_word_tokens(
    app: AppHandle,
    translation_code: String,
    book_id: i64,
    chapter: i64,
) -> Result<Vec<db::WordToken>, String> {
    // Bound the indices: db::get_word_tokens derives a verse_id range with
    // `book_id * 1_000_000 + chapter * 1_000`, which overflows on extreme
    // values. The corpus has far fewer than these limits.
    validate_book_chapter(book_id, chapter)?;
    let translation_code = translation_code.trim();
    if translation_code.is_empty() {
        return Err("translation code is required".to_string());
    }
    let conn = open_corpus(&app)?;
    db::get_word_tokens(&conn, translation_code, book_id, chapter).map_err(|e| e.to_string())
}

#[tauri::command]
fn get_strongs(app: AppHandle, codes: Vec<String>) -> Result<Vec<db::StrongsEntry>, String> {
    let codes = normalize_strongs_codes(codes)?;
    let conn = open_corpus(&app)?;
    db::get_strongs(&conn, &codes).map_err(|e| e.to_string())
}

#[tauri::command]
fn get_strongs_occurrences(
    app: AppHandle,
    code: String,
    limit: Option<i64>,
) -> Result<Vec<db::StrongsOccurrence>, String> {
    let code = code.trim();
    if code.is_empty() {
        return Ok(Vec::new());
    }
    if code.len() > 32 {
        return Err("Strong's code is too long".to_string());
    }
    let conn = open_corpus(&app)?;
    db::get_strongs_occurrences(&conn, code, bounded_limit(limit, 80, 500))
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn get_cross_refs(
    app: AppHandle,
    verse_id: i64,
    text_translation: Option<String>,
    limit: Option<i64>,
) -> Result<Vec<db::CrossRef>, String> {
    validate_verse_id(verse_id)?;
    let conn = open_corpus(&app)?;
    let text_translation = text_translation
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .unwrap_or("KJV");
    db::get_cross_refs(
        &conn,
        verse_id,
        text_translation,
        bounded_limit(limit, 20, 100),
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
    let had_legacy_provider_keys = has_legacy_provider_key_rows(&settings);
    if had_legacy_provider_keys {
        // Preserve legacy SQLite secrets before reading the vault; otherwise an
        // existing vault entry could overwrite the DB value before migration.
        let legacy_settings = provider_settings_for_legacy_migration(&settings);
        credentials::save_provider_keys(&legacy_settings)?;
        with_user_db(&app, &state, |conn| {
            user_db::delete_secret_settings(conn).map_err(|e| e.to_string())
        })?;
    }
    credentials::read_provider_keys(&mut settings)?;
    normalize_app_settings(&mut settings)?;
    Ok(settings)
}

#[tauri::command]
fn save_app_settings(
    app: AppHandle,
    state: tauri::State<'_, UserDbState>,
    mut settings: user_db::AppSettings,
) -> Result<(), String> {
    normalize_app_settings(&mut settings)?;
    credentials::save_provider_keys(&settings)?;
    with_user_db(&app, &state, |conn| {
        user_db::save_app_settings(conn, &settings).map_err(|e| e.to_string())
    })
}

#[tauri::command]
async fn check_app_setup(
    app: AppHandle,
    state: tauri::State<'_, SidecarState>,
    mut settings: user_db::AppSettings,
) -> Result<serde_json::Value, String> {
    normalize_app_settings(&mut settings)?;
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
        .connect_timeout(std::time::Duration::from_secs(2))
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
    validate_verse_id(verse_id)?;
    if let Some(end) = end_verse_id {
        validate_verse_range(verse_id, end)?;
    }
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

const TAGGABLE_ITEM_TYPES: &[&str] = &["bookmark", "note", "range_note", "study_item"];

fn validate_item_type(item_type: &str) -> Result<(), String> {
    if TAGGABLE_ITEM_TYPES.contains(&item_type) {
        Ok(())
    } else {
        Err(format!("unknown item_type: {item_type}"))
    }
}

#[tauri::command]
fn list_tags(
    app: AppHandle,
    state: tauri::State<'_, UserDbState>,
) -> Result<Vec<user_db::Tag>, String> {
    with_user_db(&app, &state, |conn| {
        user_db::list_tags(conn).map_err(|e| e.to_string())
    })
}

#[tauri::command]
fn create_tag(
    app: AppHandle,
    state: tauri::State<'_, UserDbState>,
    name: String,
) -> Result<user_db::Tag, String> {
    if name.trim().is_empty() {
        return Err("tag name must not be empty".into());
    }
    with_user_db(&app, &state, |conn| {
        user_db::create_tag(conn, &name).map_err(|e| e.to_string())
    })
}

#[tauri::command]
fn delete_tag(
    app: AppHandle,
    state: tauri::State<'_, UserDbState>,
    id: i64,
) -> Result<usize, String> {
    with_user_db(&app, &state, |conn| {
        user_db::delete_tag(conn, id).map_err(|e| e.to_string())
    })
}

#[tauri::command]
fn tag_item(
    app: AppHandle,
    state: tauri::State<'_, UserDbState>,
    tag_id: i64,
    item_type: String,
    item_id: i64,
) -> Result<usize, String> {
    validate_item_type(&item_type)?;
    with_user_db(&app, &state, |conn| {
        user_db::tag_item(conn, tag_id, &item_type, item_id).map_err(|e| e.to_string())
    })
}

#[tauri::command]
fn untag_item(
    app: AppHandle,
    state: tauri::State<'_, UserDbState>,
    tag_id: i64,
    item_type: String,
    item_id: i64,
) -> Result<usize, String> {
    validate_item_type(&item_type)?;
    with_user_db(&app, &state, |conn| {
        user_db::untag_item(conn, tag_id, &item_type, item_id).map_err(|e| e.to_string())
    })
}

#[tauri::command]
fn list_item_tags(
    app: AppHandle,
    state: tauri::State<'_, UserDbState>,
    item_type: String,
) -> Result<Vec<user_db::ItemTag>, String> {
    validate_item_type(&item_type)?;
    with_user_db(&app, &state, |conn| {
        user_db::list_item_tags(conn, &item_type).map_err(|e| e.to_string())
    })
}

#[tauri::command]
fn list_tags_with_counts(
    app: AppHandle,
    state: tauri::State<'_, UserDbState>,
) -> Result<Vec<user_db::TagCount>, String> {
    with_user_db(&app, &state, |conn| {
        user_db::list_tags_with_counts(conn).map_err(|e| e.to_string())
    })
}

#[tauri::command]
fn list_tagged_items(
    app: AppHandle,
    state: tauri::State<'_, UserDbState>,
    tag_id: i64,
) -> Result<Vec<TaggedItem>, String> {
    let raw: Vec<user_db::TaggedItemRaw> = with_user_db(&app, &state, |conn| {
        user_db::list_tagged_items(conn, tag_id).map_err(|e| e.to_string())
    })?;
    if raw.is_empty() {
        return Ok(Vec::new());
    }

    let mut ids: Vec<i64> = raw.iter().map(|r| r.verse_id).collect();
    ids.sort_unstable();
    ids.dedup();

    let mut refs: std::collections::HashMap<i64, (String, i64, i64)> =
        std::collections::HashMap::new();
    {
        let conn = open_corpus(&app)?;
        let placeholders = ids.iter().map(|_| "?").collect::<Vec<_>>().join(",");
        let sql = format!(
            "SELECT v.id, b.name, v.chapter, v.verse
             FROM verses v JOIN books b ON b.id = v.book_id
             WHERE v.id IN ({placeholders})"
        );
        let mut stmt = conn.prepare(&sql).map_err(|e| e.to_string())?;
        let rows = stmt
            .query_map(rusqlite::params_from_iter(ids.iter()), |r| {
                Ok((
                    r.get::<_, i64>(0)?,
                    r.get::<_, String>(1)?,
                    r.get::<_, i64>(2)?,
                    r.get::<_, i64>(3)?,
                ))
            })
            .map_err(|e| e.to_string())?;
        for row in rows {
            let (id, name, chapter, verse) = row.map_err(|e| e.to_string())?;
            refs.insert(id, (name, chapter, verse));
        }
    }

    let mut out: Vec<TaggedItem> = Vec::new();
    for r in raw {
        let Some((name, chapter, verse)) = refs.get(&r.verse_id).cloned() else {
            continue;
        };
        let citation = format_note_citation(&name, chapter, verse, None);
        let preview = r
            .text
            .map(|t| {
                let t = t.trim();
                if t.chars().count() > 100 {
                    let head: String = t.chars().take(100).collect();
                    format!("{head}…")
                } else {
                    t.to_string()
                }
            })
            .unwrap_or_default();
        out.push(TaggedItem {
            item_type: r.item_type,
            verse_id: r.verse_id,
            citation,
            preview,
        });
    }
    Ok(out)
}

#[tauri::command]
fn record_reading_location(
    app: AppHandle,
    state: tauri::State<'_, UserDbState>,
    book_id: i64,
    chapter: i64,
    translation_codes: String,
) -> Result<(), String> {
    validate_book_chapter(book_id, chapter)?;
    let translation_codes = translation_codes.trim();
    if translation_codes.is_empty() {
        return Err("reading location requires at least one translation".to_string());
    }
    with_user_db(&app, &state, |conn| {
        user_db::record_reading_location(conn, book_id, chapter, translation_codes)
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
        user_db::list_reading_history(conn, bounded_limit(limit, 20, 100))
            .map_err(|e| e.to_string())
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
    let title = title.trim();
    let query = query.trim();
    if title.is_empty() || query.is_empty() {
        return Err("saved search title and query are required".to_string());
    }
    if title.len() > 160 || query.len() > 500 {
        return Err("saved search title or query is too long".to_string());
    }
    let translation_code = translation_code
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty());
    let testament = testament
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty());
    let testament = normalize_testament_filter(testament)?;
    if let Some(book_id) = book_id {
        validate_book_id(book_id)?;
    }
    with_user_db(&app, &state, |conn| {
        user_db::create_saved_search(
            conn,
            title,
            query,
            translation_code,
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
    let title = title.trim();
    if title.is_empty() {
        return Err("saved search title is required".to_string());
    }
    if title.len() > 160 {
        return Err("saved search title is too long".to_string());
    }
    with_user_db(&app, &state, |conn| {
        user_db::update_saved_search_title(conn, id, title).map_err(|e| e.to_string())
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
#[allow(clippy::too_many_arguments)] // Tauri command: each arg is an invoke field.
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
    let slug = slug.trim();
    let title = title.trim();
    let kind = kind.trim();
    if slug.is_empty() || title.is_empty() {
        return Err("module requires slug and title".to_string());
    }
    if !MODULE_KINDS.contains(&kind) {
        return Err(format!("unsupported module kind: {kind}"));
    }
    with_user_db(&app, &state, |conn| {
        user_db::create_module(
            conn,
            slug,
            title,
            kind,
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
#[allow(clippy::too_many_arguments)] // Tauri command: each arg is an invoke field.
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
    let key_type = key_type.trim();
    let key_value = key_value.trim();
    let body = body.trim();
    if !MODULE_KEY_TYPES.contains(&key_type) {
        return Err(format!("unsupported key_type: {key_type}"));
    }
    if key_value.is_empty() || body.is_empty() {
        return Err("module entry requires key_value and body".to_string());
    }
    let key_value = normalize_module_key_value(key_type, key_value)?;
    let title = title
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(str::to_string);
    let metadata_json = metadata
        .as_ref()
        .map(serde_json::to_string)
        .transpose()
        .map_err(|e| e.to_string())?;
    with_user_db(&app, &state, |conn| {
        user_db::add_module_entry(
            conn,
            module_id,
            key_type,
            &key_value,
            title.as_deref(),
            body,
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
        let key_value = normalize_module_key_value(key_type, key_value)
            .map_err(|e| format!("module entry line {}: {e}", idx + 1))?;
        entries.push(ModuleImportEntry {
            key_type: key_type.to_string(),
            key_value,
            title: entry
                .title
                .as_deref()
                .map(str::trim)
                .filter(|value| !value.is_empty())
                .map(str::to_string),
            body: body.to_string(),
            metadata: entry.metadata,
        });
    }
    if entries.is_empty() {
        return Err("module import requires at least one JSONL entry".to_string());
    }
    with_user_db(&app, &state, |conn| {
        conn.execute_batch("BEGIN IMMEDIATE")
            .map_err(|e| e.to_string())?;
        let result = (|| {
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
        })();
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
    })
}

#[tauri::command]
fn list_module_entries_for_verse(
    app: AppHandle,
    state: tauri::State<'_, UserDbState>,
    verse_id: i64,
) -> Result<Vec<user_db::ModuleEntry>, String> {
    validate_verse_id(verse_id)?;
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
    validate_verse_range(start_verse_id, end_verse_id)?;
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
    let codes = normalize_strongs_codes(codes)?;
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
    let topic = topic.trim();
    if topic.is_empty() {
        return Err("topic is required".to_string());
    }
    if topic.len() > 160 {
        return Err("topic is too long".to_string());
    }
    with_user_db(&app, &state, |conn| {
        user_db::list_module_entries_for_topic(conn, topic).map_err(|e| e.to_string())
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
    let conflict_strategy = conflict_strategy.trim().to_string();
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
fn write_workspace_markdown_to_path(path: String, markdown: String) -> Result<String, String> {
    if markdown.trim().is_empty() {
        return Err("workspace Markdown is empty".to_string());
    }
    let path = PathBuf::from(path.trim());
    validate_markdown_export_path(&path)?;
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
    let pdf = render_text_pdf(&title, &markdown)?;
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
    let pdf = render_text_pdf(&title, &markdown)?;
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
    validate_user_sqlite_source(&source)?;
    if target.exists() && same_file(&source, &target)? {
        return Err(
            "restore source is already the active user.sqlite; choose a separate backup file"
                .to_string(),
        );
    }
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

    let restored = std::fs::copy(&source, &target)
        .map_err(|e| {
            format!(
                "could not restore {} to {}: {e}",
                source.display(),
                target.display()
            )
        })
        .and_then(|_| {
            user_db::open(&target)
                .map_err(|e| format!("restored sqlite did not open ({}): {e}", target.display()))
        });
    let conn = match restored {
        Ok(conn) => conn,
        Err(err) => {
            return Err(restore_safety_backup(
                &state,
                &target,
                safety_backup.as_deref(),
                err,
            ));
        }
    };
    if let Err(err) = migrate_restored_provider_secrets(&conn) {
        return Err(restore_safety_backup(
            &state,
            &target,
            safety_backup.as_deref(),
            format!("could not secure provider secrets in restored user.sqlite: {err}"),
        ));
    }
    let mut guard = state
        .0
        .lock()
        .map_err(|e| format!("user.sqlite mutex poisoned: {e}"))?;
    *guard = Some(conn);
    Ok(safety_backup
        .map(|p| p.display().to_string())
        .unwrap_or_else(|| "No previous user.sqlite existed".to_string()))
}

/// Minimum number of recognized Bible AI user tables a restore source must
/// contain to be accepted. Set well below the full table count so older backups
/// (which predate some tables) still pass, but high enough that a minimal or
/// wrong DB (e.g. only `app_settings`) is rejected.
const MIN_RECOGNIZED_USER_TABLES: usize = 4;

fn validate_user_sqlite_source(source: &Path) -> Result<(), String> {
    let conn =
        rusqlite::Connection::open_with_flags(source, rusqlite::OpenFlags::SQLITE_OPEN_READ_ONLY)
            .map_err(|e| format!("restore source did not open ({}): {e}", source.display()))?;
    let quick_check: String = conn
        .query_row("PRAGMA quick_check", [], |r| r.get(0))
        .map_err(|e| {
            format!(
                "restore source integrity check failed ({}): {e}",
                source.display()
            )
        })?;
    if quick_check != "ok" {
        return Err(format!(
            "restore source failed SQLite integrity check ({}): {quick_check}",
            source.display()
        ));
    }
    // Identity check: a genuine Bible AI user database has the `app_settings`
    // table plus a body of the recognized user tables. Requiring several
    // recognized tables (not just `app_settings`) rejects wrong or hand-crafted
    // minimal DBs, while staying tolerant of older backups that predate some of
    // the newer tables.
    let table_names: std::collections::HashSet<String> = {
        let mut stmt = conn
            .prepare("SELECT name FROM sqlite_master WHERE type = 'table'")
            .map_err(|e| {
                format!(
                    "restore source schema check failed ({}): {e}",
                    source.display()
                )
            })?;
        let rows = stmt.query_map([], |r| r.get::<_, String>(0)).map_err(|e| {
            format!(
                "restore source schema check failed ({}): {e}",
                source.display()
            )
        })?;
        rows.collect::<rusqlite::Result<_>>().map_err(|e| {
            format!(
                "restore source schema check failed ({}): {e}",
                source.display()
            )
        })?
    };
    if !table_names.contains("app_settings") {
        return Err(format!(
            "restore source is not a Bible AI user database ({}): missing app_settings table",
            source.display()
        ));
    }
    let recognized_user_tables = user_db::USER_TABLES
        .iter()
        .filter(|table| table_names.contains(**table))
        .count();
    if recognized_user_tables < MIN_RECOGNIZED_USER_TABLES {
        return Err(format!(
            "restore source is not a Bible AI user database ({}): only {recognized_user_tables} recognized user tables present",
            source.display()
        ));
    }
    let schema_version: i64 = conn
        .pragma_query_value(None, "user_version", |r| r.get(0))
        .map_err(|e| format!("restore source schema version check failed: {e}"))?;
    if schema_version > user_db::USER_SCHEMA_VERSION {
        return Err(format!(
            "restore source schema version {schema_version} is newer than app schema {}",
            user_db::USER_SCHEMA_VERSION
        ));
    }
    Ok(())
}

fn restore_safety_backup(
    state: &UserDbState,
    target: &Path,
    safety_backup: Option<&Path>,
    restore_error: String,
) -> String {
    let Some(safety_backup) = safety_backup else {
        let _ = std::fs::remove_file(target);
        return restore_error;
    };
    let rollback_result = std::fs::copy(safety_backup, target)
        .map_err(|e| format!("could not restore previous user.sqlite from safety backup: {e}"))
        .and_then(|_| {
            user_db::open(target)
                .map_err(|e| format!("previous user.sqlite did not reopen after rollback: {e}"))
        });
    match rollback_result {
        Ok(conn) => match state.0.lock() {
            Ok(mut guard) => {
                *guard = Some(conn);
                format!(
                    "{restore_error}; previous user.sqlite restored from {}",
                    safety_backup.display()
                )
            }
            Err(e) => format!(
                "{restore_error}; previous user.sqlite restored from {}, but the DB mutex is poisoned: {e}",
                safety_backup.display()
            ),
        },
        Err(rollback_error) => format!("{restore_error}; rollback failed: {rollback_error}"),
    }
}

fn same_file(left: &Path, right: &Path) -> Result<bool, String> {
    let left = left
        .canonicalize()
        .map_err(|e| format!("could not resolve {}: {e}", left.display()))?;
    let right = right
        .canonicalize()
        .map_err(|e| format!("could not resolve {}: {e}", right.display()))?;
    Ok(left == right)
}

#[cfg(test)]
mod sqlite_restore_tests {
    use super::*;
    use std::time::{SystemTime, UNIX_EPOCH};

    fn temp_sqlite_path(label: &str) -> PathBuf {
        let stamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("system clock should be after Unix epoch")
            .as_nanos();
        std::env::temp_dir().join(format!(
            "bible-ai-{label}-{}-{stamp}.sqlite",
            std::process::id()
        ))
    }

    #[test]
    fn validate_user_sqlite_source_accepts_bible_ai_backup() {
        let path = temp_sqlite_path("valid-restore-source");
        {
            // A genuine backup is produced by opening a user DB, which builds the
            // full Bible AI schema (all USER_TABLES) and sets the schema version.
            let _conn = user_db::open(&path).expect("create real Bible AI user schema");
        }

        let result = validate_user_sqlite_source(&path);
        let _ = std::fs::remove_file(&path);
        assert!(result.is_ok(), "{result:?}");
    }

    #[test]
    fn validate_user_sqlite_source_rejects_non_user_database() {
        let path = temp_sqlite_path("invalid-restore-source");
        {
            let conn = rusqlite::Connection::open(&path).expect("create sqlite file");
            conn.execute_batch("CREATE TABLE other_app (id INTEGER PRIMARY KEY);")
                .expect("create unrelated schema");
        }

        let result = validate_user_sqlite_source(&path);
        let _ = std::fs::remove_file(&path);
        assert!(result.is_err());
    }

    #[test]
    fn validate_user_sqlite_source_rejects_minimal_app_settings_only_db() {
        // A SQLite file that contains only `app_settings` (with a plausible
        // schema version) is not a real Bible AI user database — it must be
        // rejected so a wrong or hand-crafted minimal DB cannot silently become
        // the active user.sqlite on restore.
        let path = temp_sqlite_path("minimal-app-settings-restore-source");
        {
            let conn = rusqlite::Connection::open(&path).expect("create sqlite file");
            conn.execute_batch(&format!(
                "CREATE TABLE app_settings (
                  key TEXT PRIMARY KEY,
                  value TEXT NOT NULL,
                  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
                );
                PRAGMA user_version = {};",
                user_db::USER_SCHEMA_VERSION
            ))
            .expect("create minimal user schema");
        }

        let result = validate_user_sqlite_source(&path);
        let _ = std::fs::remove_file(&path);
        assert!(
            result.is_err(),
            "a DB containing only app_settings must be rejected: {result:?}"
        );
    }

    #[test]
    fn restore_migrates_legacy_provider_secret_rows_out_of_active_db() {
        // Restoring a legacy backup (one made before provider keys moved to the OS
        // vault) must not leave plaintext secrets sitting in the active SQLite file.
        // Isolate the credential service so the real "Bible AI" vault is untouched.
        let service = format!(
            "Bible-AI-restore-secret-test-{}-{}",
            std::process::id(),
            SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .expect("system clock should be after Unix epoch")
                .as_nanos()
        );
        std::env::set_var("BIBLE_AI_CREDENTIAL_SERVICE", &service);

        let path = temp_sqlite_path("restore-secret-cleanup");
        {
            let conn = user_db::open(&path).expect("open restored-style user db");
            conn.execute(
                "INSERT INTO app_settings (key, value) VALUES ('anthropic_api_key', 'sk-legacy-restore-secret')",
                [],
            )
            .expect("seed legacy plaintext provider key");
        }

        let conn = user_db::open(&path).expect("reopen restored user db");
        migrate_restored_provider_secrets(&conn).expect("migrate restored provider secrets");

        // Security guarantee: the plaintext secret row is gone from the active DB.
        let remaining: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM app_settings WHERE key = 'anthropic_api_key'",
                [],
                |row| row.get(0),
            )
            .expect("count secret rows");
        assert_eq!(
            remaining, 0,
            "restore must clear legacy provider secret rows from the active DB"
        );

        // Preservation: the key was migrated into the vault, not silently destroyed.
        let mut migrated = user_db::AppSettings::default();
        credentials::read_provider_keys(&mut migrated).expect("read migrated vault keys");
        assert_eq!(
            migrated.anthropic_api_key.as_deref(),
            Some("sk-legacy-restore-secret"),
            "restore must migrate legacy keys into the OS vault before deleting the rows"
        );

        // Cleanup: remove the isolated vault entry and temp file.
        let clear = user_db::AppSettings {
            anthropic_api_key: Some(String::new()), // empty value => delete entry
            ..Default::default()
        };
        let _ = credentials::save_provider_keys(&clear);
        let _ = std::fs::remove_file(&path);
        std::env::remove_var("BIBLE_AI_CREDENTIAL_SERVICE");
    }
}

fn backup_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = user_data_dir(app)?.join("backups");
    std::fs::create_dir_all(&dir)
        .map_err(|e| format!("could not create backup dir {}: {e}", dir.display()))?;
    Ok(dir)
}

#[derive(serde::Deserialize)]
struct PacketFile {
    name: String,
    content: String,
}

/// A safe single-leaf packet filename: no path separators, no traversal, no
/// hidden/absolute names, only conservative characters. Guards the folder writer
/// against a malformed or malicious file name escaping the packet directory.
fn is_safe_packet_filename(name: &str) -> bool {
    !name.is_empty()
        && name.len() <= 64
        && !name.starts_with('.')
        && !name.contains('/')
        && !name.contains('\\')
        && !name.contains("..")
        && name
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || matches!(c, '.' | '-' | '_'))
}

/// True if `text` contains a Windows drive-letter path like `C:\...`.
fn contains_windows_path(text: &str) -> bool {
    text.as_bytes()
        .windows(3)
        .any(|w| w[0].is_ascii_alphabetic() && w[1] == b':' && w[2] == b'\\')
}

/// High-confidence forbidden-data markers for the write-boundary guard. The JS
/// scanner (`scripts/scan-packet-leaks.mjs`) runs the fuller scan over generated
/// sample packets in CI; this is the last line of defense so a packet that
/// obviously embeds a secret or local path is never written to disk.
fn packet_content_leaks(text: &str) -> Vec<&'static str> {
    let mut leaks = Vec::new();
    if text.contains("sk-ant-") || text.contains("sk-proj-") || text.contains("AIza") {
        leaks.push("provider API key");
    }
    if contains_windows_path(text) || text.contains("/Users/") || text.contains("/home/") {
        leaks.push("local filesystem path");
    }
    if text.contains("\\\\") {
        leaks.push("network path");
    }
    leaks
}

/// Write a Study Packet as a folder of files. Validates every filename and scans
/// every file for forbidden data BEFORE creating anything, so a bad name or a
/// leaked secret fails without leaving a partial directory on disk.
fn write_study_packet_dir(dir: &Path, files: &[PacketFile]) -> Result<(), String> {
    if files.is_empty() {
        return Err("study packet has no files to write".to_string());
    }
    for file in files {
        if !is_safe_packet_filename(&file.name) {
            return Err(format!("unsafe study packet filename: {}", file.name));
        }
        let leaks = packet_content_leaks(&file.content);
        if !leaks.is_empty() {
            return Err(format!(
                "refusing to write study packet: {} contains forbidden data ({})",
                file.name,
                leaks.join(", ")
            ));
        }
    }
    std::fs::create_dir_all(dir)
        .map_err(|e| format!("could not create packet dir {}: {e}", dir.display()))?;
    for file in files {
        let path = dir.join(&file.name);
        std::fs::write(&path, &file.content)
            .map_err(|e| format!("could not write {}: {e}", path.display()))?;
    }
    Ok(())
}

#[tauri::command]
fn export_study_packet(
    app: AppHandle,
    title: String,
    files: Vec<PacketFile>,
) -> Result<String, String> {
    let dir = export_dir(&app)?;
    let safe_title = sanitize_filename(&title);
    let folder = dir.join(format!(
        "bible-ai-packet-{safe_title}-{stamp}",
        stamp = unix_stamp()
    ));
    write_study_packet_dir(&folder, &files)?;
    Ok(folder.display().to_string())
}

fn export_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = user_data_dir(app)?.join("exports");
    std::fs::create_dir_all(&dir)
        .map_err(|e| format!("could not create export dir {}: {e}", dir.display()))?;
    Ok(dir)
}

fn validate_markdown_export_path(path: &Path) -> Result<(), String> {
    if !path.is_absolute() {
        return Err("workspace Markdown export path must be absolute".to_string());
    }
    if path.file_name().is_none() {
        return Err("workspace Markdown export path must include a file name".to_string());
    }
    let extension = path
        .extension()
        .and_then(|value| value.to_str())
        .map(str::to_ascii_lowercase);
    if !matches!(extension.as_deref(), Some("md" | "markdown")) {
        return Err("workspace Markdown export path must end in .md or .markdown".to_string());
    }
    let parent = path
        .parent()
        .ok_or_else(|| "workspace Markdown export path must include a directory".to_string())?;
    if !parent.is_dir() {
        return Err(format!(
            "workspace Markdown export directory does not exist: {}",
            parent.display()
        ));
    }
    Ok(())
}

#[cfg(test)]
mod export_path_tests {
    use super::validate_markdown_export_path;
    use std::path::Path;

    #[test]
    fn markdown_export_path_rejects_relative_paths() {
        assert!(validate_markdown_export_path(Path::new("workspace.md")).is_err());
    }

    #[test]
    fn markdown_export_path_rejects_non_markdown_files() {
        let path = std::env::temp_dir().join("bible-ai-workspace-export.txt");
        assert!(validate_markdown_export_path(&path).is_err());
    }

    #[test]
    fn markdown_export_path_accepts_markdown_files_in_existing_dirs() {
        let path = std::env::temp_dir().join("bible-ai-workspace-export.md");
        assert!(validate_markdown_export_path(&path).is_ok());
    }
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

#[cfg(test)]
mod study_packet_tests {
    use super::{is_safe_packet_filename, write_study_packet_dir, PacketFile};
    use std::time::{SystemTime, UNIX_EPOCH};

    fn temp_dir(label: &str) -> std::path::PathBuf {
        let stamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("clock after epoch")
            .as_nanos();
        std::env::temp_dir().join(format!("bible-ai-{label}-{}-{stamp}", std::process::id()))
    }

    #[test]
    fn is_safe_packet_filename_accepts_leaf_names_and_rejects_traversal() {
        assert!(is_safe_packet_filename("README.md"));
        assert!(is_safe_packet_filename("manifest.json"));
        assert!(is_safe_packet_filename("passage.md"));
        assert!(!is_safe_packet_filename(""));
        assert!(!is_safe_packet_filename("../escape.md"));
        assert!(!is_safe_packet_filename("sub/dir.md"));
        assert!(!is_safe_packet_filename("sub\\dir.md"));
        assert!(!is_safe_packet_filename(".hidden"));
    }

    #[test]
    fn write_study_packet_dir_writes_each_file() {
        let dir = temp_dir("packet-write");
        let files = vec![
            PacketFile {
                name: "README.md".to_string(),
                content: "# Study Packet".to_string(),
            },
            PacketFile {
                name: "manifest.json".to_string(),
                content: "{\"schema\":\"bible-ai/study-packet\"}".to_string(),
            },
        ];
        write_study_packet_dir(&dir, &files).expect("write packet");
        assert_eq!(
            std::fs::read_to_string(dir.join("README.md")).expect("read readme"),
            "# Study Packet"
        );
        assert!(dir.join("manifest.json").exists());
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn write_study_packet_dir_rejects_unsafe_filename_and_writes_nothing() {
        let dir = temp_dir("packet-unsafe");
        let files = vec![PacketFile {
            name: "../escape.md".to_string(),
            content: "x".to_string(),
        }];
        assert!(write_study_packet_dir(&dir, &files).is_err());
        // Nothing should have been created when validation fails up front.
        assert!(!dir.exists());
    }

    #[test]
    fn write_study_packet_dir_refuses_to_write_leaked_secrets() {
        let dir = temp_dir("packet-leak");
        // Fake key built by concat! so this source has no contiguous secret-
        // format literal for external secret scanners to flag.
        let fake_key = concat!("sk-ant-", "api03-EXAMPLEonlyNOTAREALKEY00000");
        let files = vec![PacketFile {
            name: "manifest.json".to_string(),
            content: format!("{{\"key\":\"{fake_key}\"}}"),
        }];
        let err = write_study_packet_dir(&dir, &files).expect_err("leaky packet must be refused");
        assert!(err.contains("forbidden data"), "{err}");
        // Fail-closed: the directory is not created when a leak is detected.
        assert!(!dir.exists());
    }

    #[test]
    fn packet_content_leaks_flags_keys_and_paths_but_not_scripture() {
        use super::packet_content_leaks;
        assert!(packet_content_leaks("In the beginning God created the heaven").is_empty());
        assert!(
            !packet_content_leaks(concat!("token sk-", "proj-ABCDEFGHIJKLMNOP1234")).is_empty()
        );
        assert!(!packet_content_leaks("exported from C:\\Users\\me\\app").is_empty());
        assert!(!packet_content_leaks("/home/jdoe/.config/bible-ai").is_empty());
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

fn unix_stamp() -> u128 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_nanos())
        .unwrap_or(0)
}

/// DejaVu Sans, embedded into the binary for PDF exports. It covers Latin,
/// Greek, and Hebrew. License: src-tauri/fonts/DejaVuSans-LICENSE.txt.
const PDF_FONT: &[u8] = include_bytes!("../fonts/DejaVuSans.ttf");

/// Render plain text into a paginated PDF using the embedded DejaVu Sans font.
///
/// The font covers Latin, Greek, and Hebrew, so accented text and
/// original-language terms render correctly. Text is laid out left-to-right
/// with no bidirectional reordering, so Hebrew appears in logical (not visual)
/// order — Markdown or HTML export is preferable when Hebrew word order
/// matters.
fn render_text_pdf(title: &str, text: &str) -> Result<Vec<u8>, String> {
    use krilla::{
        geom::Point,
        page::PageSettings,
        text::{Font, TextDirection},
        Document,
    };

    // US Letter in PDF points (72 points per inch).
    const PAGE_W: f32 = 612.0;
    const PAGE_H: f32 = 792.0;
    const MARGIN: f32 = 51.0;
    const FONT_SIZE: f32 = 10.0;
    const LEADING: f32 = 12.5;
    const LINES_PER_PAGE: usize = 54;
    const MAX_LINE_CHARS: usize = 90;

    // Wrap the source text into display lines, breaking on whitespace.
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

    let font = Font::new(PDF_FONT.into(), 0)
        .ok_or_else(|| "could not load the embedded PDF font".to_string())?;
    let page_settings = PageSettings::from_wh(PAGE_W, PAGE_H)
        .ok_or_else(|| "invalid PDF page dimensions".to_string())?;
    let mut document = Document::new();

    // `lines` always holds at least the title row, so there is always a page.
    for chunk in lines.chunks(LINES_PER_PAGE) {
        let mut page = document.start_page_with(page_settings.clone());
        let mut surface = page.surface();
        let mut y = MARGIN;
        for line in chunk {
            if !line.is_empty() {
                surface.draw_text(
                    Point::from_xy(MARGIN, y),
                    font.clone(),
                    FONT_SIZE,
                    line,
                    false,
                    TextDirection::Auto,
                );
            }
            y += LEADING;
        }
        surface.finish();
        page.finish();
    }

    document
        .finish()
        .map_err(|e| format!("could not serialise the PDF: {e}"))
}

#[cfg(test)]
mod pdf_tests {
    use super::render_text_pdf;

    #[test]
    fn renders_unicode_text_to_a_valid_multi_page_pdf() {
        // Latin (accented), Greek, and Hebrew — all covered by the embedded
        // DejaVu Sans font. Repeated enough to force pagination.
        let body =
            "Latin: café résumé naïve\nGreek: λόγος ἀγάπη Χριστός\nHebrew: בְּרֵאשִׁית\n".repeat(40);
        let pdf = render_text_pdf("Unicode Export Test", &body).expect("PDF should render");

        assert!(pdf.starts_with(b"%PDF"), "output should be a PDF");
        assert!(
            pdf.len() > 10_000,
            "embedded font should make this non-trivial"
        );
        let tail = &pdf[pdf.len().saturating_sub(1024)..];
        assert!(
            tail.windows(5).any(|w| w == b"%%EOF"),
            "PDF should end with the %%EOF marker",
        );
    }

    #[test]
    fn renders_a_short_document() {
        let pdf = render_text_pdf("Tiny", "one line").expect("PDF should render");
        assert!(pdf.starts_with(b"%PDF"));
    }
}

/// Ask the council a disputed-point question.
///
/// Retrieval prefers semantic search via Ollama embeddings when the
/// embeddings table is populated and Ollama is reachable; otherwise falls
/// back to the FTS OR-query path. Either way, evidence is handed to the
/// sidecar along with the question.
fn sensitive_topic_message(locale: Option<&str>) -> (&'static str, &'static str) {
    let locale = locale.unwrap_or("").to_ascii_lowercase();
    let common = "This sounds serious, and a Bible study tool is not the right place to carry it alone. Bible AI is not a counselor, doctor, pastor, lawyer, financial advisor, or emergency service. Please contact a trusted person or qualified professional who can be present with you.";
    if locale.starts_with("en-ie") {
        return (
            "en-IE",
            "This sounds serious, and a Bible study tool is not the right place to carry it alone. Bible AI is not a counselor, doctor, pastor, lawyer, financial advisor, or emergency service. If you or someone else may be about to come to harm in Ireland, phone 112 or 999 or go to an emergency department now. For confidential listening support, Samaritans is available free on 116 123. Please also contact a trusted person or qualified professional who can be present with you.",
        );
    }

    if locale.starts_with("en-gb") {
        return (
            "en-GB",
            "This sounds serious, and a Bible study tool is not the right place to carry it alone. Bible AI is not a counselor, doctor, pastor, lawyer, financial advisor, or emergency service. If you or someone else is in immediate danger in the UK, call 999 or go to A&E now. For urgent mental-health help call NHS 111; for confidential listening support call Samaritans free on 116 123. Please also contact a trusted person or qualified professional who can be present with you.",
        );
    }
    if locale.starts_with("en-us") {
        return (
            "en-US",
            "This sounds serious, and a Bible study tool is not the right place to carry it alone. Bible AI is not a counselor, doctor, pastor, lawyer, financial advisor, or emergency service. In the US, call or text 988 for crisis support. If you or someone else is in immediate danger, call 911 now. Please also contact a trusted person or qualified professional who can be present with you.",
        );
    }
    ("international", common)
}

/// Starter rule set for the pre-Council sensitive-topic router (EP-020). It is
/// rule-based, local, and deliberately conservative: the dangerous failure is a
/// missed crisis disclosure (a false negative), so it prefers to over-trigger.
/// The rule coverage and the crisis wording are a starting point that needs
/// pastoral/professional review and expansion before release (see
/// docs/sensitive-topic-safety-policy.md). Returns a category label or None.
fn classify_sensitive_topic(question: &str) -> Option<&'static str> {
    let q = question.to_lowercase();
    const RULES: &[(&str, &[&str])] = &[
        (
            "self-harm or suicide",
            &[
                "kill myself",
                "killing myself",
                "end my life",
                "ending my life",
                "want to die",
                "wants to die",
                "wish i was dead",
                "wish i were dead",
                "better off dead",
                "better off without me",
                "no reason to live",
                "suicid",
                "self-harm",
                "self harm",
                "cut myself",
                "cutting myself",
                "take my own life",
                "end it all",
                "overdose",
                "everyone would be better off without me",
                "won't be here tomorrow",
                "does my life still have worth",
                "my life still has worth",
            ],
        ),
        (
            "harm to others",
            &[
                "kill him",
                "kill her",
                "kill them",
                "want to hurt someone",
                "going to hurt someone",
                "make them pay",
                "shoot them",
                "afraid i might hurt",
                "lose control and make them pay",
            ],
        ),
        (
            "child safety",
            &[
                "abusing a child",
                "hurting a child",
                "touched a child",
                "child is being abused",
                "child is not safe at home",
                "little one is being hurt",
            ],
        ),
        (
            "sexual abuse or coercion",
            &[
                "sexually assaulted",
                "forced me to have sex",
                "sexual coercion",
                "was raped",
                "being raped",
                "unwanted sexual touching",
                "made me do sexual things",
                "molest",
                "rape",
            ],
        ),
        (
            "abuse",
            &[
                "being abused",
                "abusing me",
                "beats me",
                "hits me",
                "domestic violence",
                "my husband hits",
                "my partner hits",
                "controls my money and won't let me leave",
                "monitors my phone and won't let me leave",
            ],
        ),
        (
            "medical or mental-health crisis",
            &[
                "having chest pain",
                "cannot breathe",
                "can't breathe",
                "should i stop my medication",
                "stopped taking my medication",
                "hearing voices telling me",
                "losing touch with reality",
                "medical emergency",
                "having a psychotic episode",
                "friend took too many pills",
                "took too many pills",
            ],
        ),
        (
            "high-stakes legal or financial decision",
            &[
                "should i sign this contract",
                "represent myself in court",
                "court hearing tomorrow",
                "should i plead guilty",
                "need legal advice",
                "invest my life savings",
                "put all my money into",
                "should i declare bankruptcy",
                "about to lose my home",
                "scripture decide my court case",
            ],
        ),
        (
            "pastoral emergency",
            &[
                "god has abandoned me and i cannot cope",
                "grief is unbearable",
                "faith crisis and i am alone",
                "spiritual crisis and cannot cope",
                "need a pastor right now",
                "cannot survive this crisis of faith alone",
            ],
        ),
        (
            "spiritual abuse or coercion",
            &[
                "pastor controls my",
                "church controls my",
                "church threatened me",
                "pastor threatened me",
                "shunned if i leave",
                "god will punish me unless",
                "religious leader blackmail",
                "forced to obey my pastor",
                "leader says i must cut off my family",
            ],
        ),
        (
            "confession involving harm",
            &[
                "i abused someone",
                "i hurt someone and need absolution",
                "i hit my child",
                "i harmed a child",
                "confess that i killed",
                "forgive me for hurting someone",
                "asking for absolution after i harmed",
            ],
        ),
    ];
    for (category, markers) in RULES {
        if markers.iter().any(|marker| q.contains(marker)) {
            return Some(category);
        }
    }
    None
}

#[tauri::command]
fn cancel_council(state: tauri::State<'_, SidecarState>) {
    state.cancel_active();
}

#[tauri::command]
#[allow(clippy::too_many_arguments)] // Tauri command: each arg is an invoke field.
async fn ask_council(
    app: AppHandle,
    on_progress: Channel<serde_json::Value>,
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
    locale: Option<String>,
) -> Result<serde_json::Value, String> {
    let cancellation_epoch = state.cancellation_epoch();
    let question = question.trim().to_string();
    if question.is_empty() {
        return Err("Council question is required".to_string());
    }
    if question.len() > 2_000 {
        return Err("Council question is too long".to_string());
    }
    let seq = std::sync::atomic::AtomicU64::new(0);
    let emit = |kind: &str, payload: serde_json::Value| {
        let n = seq.fetch_add(1, std::sync::atomic::Ordering::Relaxed) + 1;
        let mut ev = serde_json::json!({
            "seq": n,
            "ts": std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .map(|d| d.as_millis() as u64)
                .unwrap_or(0),
            "kind": kind,
        });
        if let Some(obj) = payload.as_object() {
            for (k, v) in obj {
                if k == "seq" || k == "ts" || k == "kind" {
                    continue;
                }
                ev[k] = v.clone();
            }
        }
        let _ = on_progress.send(ev);
    };
    // Pre-Council sensitive-topic routing: a crisis or sensitive disclosure must
    // never enter normal Council generation. Return a calm safety response
    // before any retrieval, provider call, or session persistence happens.
    if let Some(category) = classify_sensitive_topic(&question) {
        let (resource_locale, message) = sensitive_topic_message(locale.as_deref());
        emit(
            "safety_checked",
            serde_json::json!({ "status": "blocked", "category": category }),
        );
        return Ok(serde_json::json!({
            "sensitive_topic": {
                "category": category,
                "message": message,
                "resource_locale": resource_locale,
                "review_status": "pending_human_safety_review",
            }
        }));
    }
    emit("safety_checked", serde_json::json!({ "status": "clear" }));
    let mut settings = with_user_db(&app, &user_state, |conn| {
        user_db::get_app_settings(conn).map_err(|e| e.to_string())
    })?;
    credentials::read_provider_keys(&mut settings)?;
    normalize_app_settings(&mut settings)?;

    let translation = retrieval_translation
        .or_else(|| settings.retrieval_translation.clone())
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
        .unwrap_or_else(|| "KJV".to_string());
    let translation = normalize_translation_code_value(&translation, "Retrieval translation")?;
    let selected_model = model
        .or_else(|| settings.claude_model.clone())
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
        .unwrap_or_else(|| "sonnet".to_string());
    let selected_model = normalize_model_id(&selected_model, "Council model")?;
    let strategy = retrieval_strategy
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
        .unwrap_or_else(|| "hybrid".to_string());
    if !matches!(strategy.as_str(), "semantic" | "keyword" | "hybrid") {
        return Err("unsupported retrieval strategy".to_string());
    }
    let testament = normalize_testament_filter(testament)?;
    if let Some(book_id) = book_id {
        validate_book_id(book_id)?;
    }
    if let Some(start) = start_verse_id {
        validate_verse_id(start)?;
    }
    if let Some(end) = end_verse_id {
        validate_verse_id(end)?;
    }
    if let (Some(start), Some(end)) = (start_verse_id, end_verse_id) {
        validate_verse_range(start, end)?;
    }
    // Clamp to a sane range: the raw value flows into Vec::with_capacity and
    // `limit * 3` arithmetic, so a negative (wraps huge via `as usize`) or
    // very large value would panic or exhaust memory.
    let limit = evidence_limit.unwrap_or(60).clamp(1, 200) as usize;
    let retrieval_options = RetrievalOptions {
        strategy,
        include_cross_refs: include_cross_refs.unwrap_or(true),
        translation_code: translation.clone(),
        book_id,
        testament,
        start_verse_id,
        end_verse_id,
        evidence_limit: limit,
    };

    emit(
        "run_started",
        serde_json::json!({ "strategy": retrieval_options.strategy }),
    );
    emit(
        "retrieval_started",
        serde_json::json!({ "strategy": retrieval_options.strategy }),
    );
    let (evidence_json, retrieval_mode, retrieval_fallback_reason) = retrieve_evidence(
        &app,
        &question,
        &retrieval_options,
        settings.ollama_host.as_deref(),
    )
    .await?;

    if evidence_json.is_empty() {
        return Err("no evidence found for the question in the corpus".to_string());
    }

    if let Some(reason) = &retrieval_fallback_reason {
        emit(
            "retrieval_fallback",
            serde_json::json!({ "reason": reason }),
        );
    }
    emit(
        "retrieval_done",
        serde_json::json!({ "count": evidence_json.len(), "mode": retrieval_mode.clone() }),
    );

    // --- STAGE 2b: per-position retrieval (depth) ---------------------------
    // Broad retrieval gives the council a first-pass corpus. For genuine depth we
    // SCOPE the question (sidecar leg 1: `council_scope`), then retrieve targeted
    // evidence for EACH candidate position (Rust owns the corpus + embeddings) and
    // union it into the working corpus, so the grounding floor's membership set
    // covers every verse a voice can cite. Live-only: in mock mode we keep the
    // single-request path so the e2e harness is unaffected. Fail-soft throughout —
    // any failure falls back to broad-evidence-only.
    let mock_council = std::env::var("BIBLE_AI_MOCK_COUNCIL").ok().as_deref() == Some("1");
    let mut council_evidence = evidence_json.clone();
    let mut scoped_positions: Vec<serde_json::Value> = Vec::new();
    let mut position_evidence: Vec<serde_json::Value> = Vec::new();
    if !mock_council {
        emit("scope_started", serde_json::json!({}));
        let scope_body = serde_json::json!({
            "question": &question,
            "model": &selected_model,
            "settings": &settings,
        });
        match state.request(&app, "council_scope", scope_body).await {
            Ok(scope_result) => {
                let positions = scope_result
                    .get("positions")
                    .and_then(serde_json::Value::as_array)
                    .cloned()
                    .unwrap_or_default();
                emit(
                    "scope_done",
                    serde_json::json!({
                        "available": !positions.is_empty(),
                        "position_count": positions.len(),
                        "source": "host",
                    }),
                );
                // Dedup the unions against verses already in the working corpus.
                let mut seen: std::collections::HashSet<i64> = council_evidence
                    .iter()
                    .filter_map(|row| row.get("verse_id").and_then(serde_json::Value::as_i64))
                    .collect();
                // Bound the fan-out: at most 4 positions, smaller per-position limit.
                let per_position_limit = (limit / 2).clamp(8, 40);
                for (idx, pos) in positions.iter().take(4).enumerate() {
                    let label = pos
                        .get("label")
                        .and_then(serde_json::Value::as_str)
                        .unwrap_or("")
                        .trim()
                        .to_string();
                    if label.is_empty() {
                        continue;
                    }
                    let description = pos
                        .get("description")
                        .and_then(serde_json::Value::as_str)
                        .unwrap_or("")
                        .trim()
                        .to_string();
                    scoped_positions.push(serde_json::json!({
                        "label": label,
                        "description": description,
                    }));
                    let pos_query = format!("{question} {label} {description}");
                    let pos_options = RetrievalOptions {
                        evidence_limit: per_position_limit,
                        ..retrieval_options.clone()
                    };
                    emit(
                        "position_retrieval_started",
                        serde_json::json!({ "index": idx, "label": label }),
                    );
                    match retrieve_evidence(
                        &app,
                        &pos_query,
                        &pos_options,
                        settings.ollama_host.as_deref(),
                    )
                    .await
                    {
                        Ok((rows, _mode, _fallback)) => {
                            let mut bundle_ids: Vec<i64> = Vec::new();
                            for row in rows {
                                if let Some(vid) =
                                    row.get("verse_id").and_then(serde_json::Value::as_i64)
                                {
                                    bundle_ids.push(vid);
                                    if seen.insert(vid) {
                                        council_evidence.push(row);
                                    }
                                }
                            }
                            emit(
                                "position_retrieval_done",
                                serde_json::json!({
                                    "index": idx,
                                    "label": label,
                                    "count": bundle_ids.len(),
                                }),
                            );
                            position_evidence.push(serde_json::json!({
                                "label": label,
                                "description": description,
                                "verse_ids": bundle_ids,
                            }));
                        }
                        Err(e) => {
                            // A narrow position query may find nothing — that is not
                            // fatal; the broad corpus still covers the question.
                            emit(
                                "position_retrieval_failed",
                                serde_json::json!({ "index": idx, "label": label, "error": e }),
                            );
                        }
                    }
                }
            }
            Err(e) => {
                // Scope unavailable — proceed with broad evidence only.
                emit(
                    "scope_done",
                    serde_json::json!({ "available": false, "error": e }),
                );
            }
        }
    }
    // ------------------------------------------------------------------------

    let evidence_count = council_evidence.len();
    let mut body = build_council_request(
        &question,
        council_evidence.clone(),
        &selected_model,
        Some(&settings),
    );
    if !scoped_positions.is_empty() {
        body["scoped_positions"] = serde_json::Value::Array(scoped_positions.clone());
    }
    if !position_evidence.is_empty() {
        body["position_evidence"] = serde_json::Value::Array(position_evidence.clone());
    }
    let mut result = state
        .request_streaming_at_epoch(&app, "council", body, cancellation_epoch, |event| {
            let kind = event
                .get("kind")
                .and_then(serde_json::Value::as_str)
                .unwrap_or("unknown")
                .to_string();
            emit(&kind, event);
        })
        .await?;
    // Surface how we retrieved the evidence so the UI can show it.
    result["retrieval_mode"] = serde_json::Value::String(retrieval_mode.clone());
    result["retrieval_fallback_reason"] = match &retrieval_fallback_reason {
        Some(reason) => serde_json::Value::String(reason.clone()),
        None => serde_json::Value::Null,
    };
    result["evidence_count"] = serde_json::Value::Number(evidence_count.into());
    result["retrieval_options"] =
        serde_json::to_value(&retrieval_options).unwrap_or(serde_json::Value::Null);
    result["retrieved_evidence"] = serde_json::Value::Array(council_evidence.clone());

    // Persist to user.sqlite so the user has an audit trail they can revisit.
    // Non-fatal: if persistence fails, we still return the response.
    if let (Ok(response_json), Ok(options_json), Ok(evidence_json_text)) = (
        serde_json::to_string(&result),
        serde_json::to_string(&retrieval_options),
        serde_json::to_string(&council_evidence),
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

    emit(
        "run_complete",
        serde_json::json!({
            "session_id": result.get("session_id").cloned().unwrap_or(serde_json::Value::Null),
            "synthesis_mode": result.get("synthesis_mode").cloned().unwrap_or(serde_json::Value::Null),
        }),
    );
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
    validate_verse_range(start_verse_id, end)?;
    let translation_code = translation_code.trim();
    if translation_code.is_empty() {
        return Err("translation code is required".to_string());
    }
    let conn = open_corpus(&app)?;
    let verses = db::get_verse_range(&conn, translation_code, start_verse_id, end, 200)
        .map_err(|e| e.to_string())?;
    let passage: Vec<serde_json::Value> = verses
        .into_iter()
        .map(|v| {
            serde_json::json!({
                "verse_id": v.verse_id,
                "translation_code": translation_code,
                "book_name": v.book_name,
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
        user_db::list_sessions(conn, bounded_limit(limit, 30, 100)).map_err(|e| e.to_string())
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
#[allow(clippy::too_many_arguments)] // Tauri command: each arg is an invoke field.
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
    let query = query.trim();
    if query.len() > 500 {
        return Err("resource search query is too long".to_string());
    }
    with_user_db(&app, &state, |conn| {
        user_db::search_resources(
            conn,
            query,
            source_id,
            collection_kind.as_deref(),
            license.as_deref(),
            topic_id,
            bounded_limit(limit, 30, 100),
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
    validate_book_chapter(book_id, chapter)?;
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
    validate_verse_id(verse_id)?;
    let color = validate_hex_color(&color)?;
    with_user_db(&app, &state, |conn| {
        user_db::upsert_highlight(conn, verse_id, color).map_err(|e| e.to_string())
    })
}

#[tauri::command]
fn delete_highlight(
    app: AppHandle,
    state: tauri::State<'_, UserDbState>,
    verse_id: i64,
) -> Result<usize, String> {
    validate_verse_id(verse_id)?;
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
    validate_book_chapter(book_id, chapter)?;
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
    validate_verse_range(start_verse_id, end_verse_id)?;
    let color = validate_hex_color(&color)?;
    with_user_db(&app, &state, |conn| {
        user_db::upsert_range_highlight(conn, start_verse_id, end_verse_id, color)
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
    validate_verse_range(start_verse_id, end_verse_id)?;
    with_user_db(&app, &state, |conn| {
        user_db::delete_range_highlight(conn, start_verse_id, end_verse_id)
            .map_err(|e| e.to_string())
    })
}

// ---------- Notes ----------

#[derive(serde::Serialize)]
pub struct NoteHit {
    pub kind: String, // "verse" | "range"
    pub verse_id: i64,
    pub end_verse_id: Option<i64>,
    pub citation: String,
    pub book_id: i64,
    pub chapter: i64,
    pub verse: i64,
    pub body: String,
    pub updated_at: String,
}

#[derive(serde::Serialize)]
struct TaggedItem {
    item_type: String,
    verse_id: i64,
    citation: String,
    preview: String,
}

/// "Genesis 1:1" / "Genesis 1:1-5" (same chapter) / "Genesis 1:31-2:1" (cross-chapter).
/// `end` is (end_chapter, end_verse) for range notes; same-book is assumed.
fn format_note_citation(book: &str, chapter: i64, verse: i64, end: Option<(i64, i64)>) -> String {
    match end {
        None => format!("{book} {chapter}:{verse}"),
        Some((ec, ev)) if ec == chapter => format!("{book} {chapter}:{verse}-{ev}"),
        Some((ec, ev)) => format!("{book} {chapter}:{verse}-{ec}:{ev}"),
    }
}

#[tauri::command]
fn search_notes(
    app: AppHandle,
    state: tauri::State<'_, UserDbState>,
    query: String,
    limit: Option<i64>,
) -> Result<Vec<NoteHit>, String> {
    let query = query.trim();
    if query.len() > 500 {
        return Err("search query is too long".to_string());
    }
    let tokens: Vec<String> = query.split_whitespace().map(str::to_string).collect();
    let limit = bounded_limit(limit, 50, 200);
    if tokens.is_empty() {
        return Ok(Vec::new());
    }

    let matches: Vec<user_db::NoteMatch> = with_user_db(&app, &state, |conn| {
        user_db::search_notes(conn, &tokens, limit).map_err(|e| e.to_string())
    })?;
    if matches.is_empty() {
        return Ok(Vec::new());
    }

    let mut ids: Vec<i64> = Vec::new();
    for m in &matches {
        ids.push(m.verse_id);
        if let Some(e) = m.end_verse_id {
            ids.push(e);
        }
    }
    ids.sort_unstable();
    ids.dedup();

    let mut refs: std::collections::HashMap<i64, (i64, String, i64, i64)> =
        std::collections::HashMap::new();
    {
        let conn = open_corpus(&app)?;
        let placeholders = ids.iter().map(|_| "?").collect::<Vec<_>>().join(",");
        let sql = format!(
            "SELECT v.id, v.book_id, b.name, v.chapter, v.verse
             FROM verses v JOIN books b ON b.id = v.book_id
             WHERE v.id IN ({placeholders})"
        );
        let mut stmt = conn.prepare(&sql).map_err(|e| e.to_string())?;
        let rows = stmt
            .query_map(rusqlite::params_from_iter(ids.iter()), |r| {
                Ok((
                    r.get::<_, i64>(0)?,
                    r.get::<_, i64>(1)?,
                    r.get::<_, String>(2)?,
                    r.get::<_, i64>(3)?,
                    r.get::<_, i64>(4)?,
                ))
            })
            .map_err(|e| e.to_string())?;
        for row in rows {
            let (id, book_id, name, chapter, verse) = row.map_err(|e| e.to_string())?;
            refs.insert(id, (book_id, name, chapter, verse));
        }
    }

    let mut hits: Vec<NoteHit> = Vec::new();
    for m in matches {
        let Some((book_id, book_name, chapter, verse)) = refs.get(&m.verse_id).cloned() else {
            continue;
        };
        let end = m
            .end_verse_id
            .and_then(|e| refs.get(&e).map(|(_, _, ec, ev)| (*ec, *ev)));
        let citation = format_note_citation(&book_name, chapter, verse, end);
        hits.push(NoteHit {
            kind: m.kind,
            verse_id: m.verse_id,
            end_verse_id: m.end_verse_id,
            citation,
            book_id,
            chapter,
            verse,
            body: m.body,
            updated_at: m.updated_at,
        });
    }
    Ok(hits)
}

#[tauri::command]
fn get_note(
    app: AppHandle,
    state: tauri::State<'_, UserDbState>,
    verse_id: i64,
) -> Result<Option<user_db::Note>, String> {
    validate_verse_id(verse_id)?;
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
    validate_verse_id(verse_id)?;
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
    validate_verse_id(verse_id)?;
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
    validate_book_chapter(book_id, chapter)?;
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
    validate_verse_range(start_verse_id, end_verse_id)?;
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
    validate_verse_range(start_verse_id, end_verse_id)?;
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
    validate_verse_range(start_verse_id, end_verse_id)?;
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
    validate_book_chapter(book_id, chapter)?;
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
/// Reason the Council's semantic retrieval was downgraded to keyword search,
/// or None if semantic was not requested or completed successfully. Surfaced in
/// the Council UI and exports so a degraded run is never silently presented as a
/// full semantic one.
fn council_retrieval_fallback_reason(
    wanted_semantic: bool,
    translation: &str,
    has_embeddings: bool,
    embed_ok: bool,
) -> Option<String> {
    if !wanted_semantic {
        return None;
    }
    if !has_embeddings {
        return Some(format!(
            "No meaning index for {translation}; used keyword search instead."
        ));
    }
    if !embed_ok {
        return Some(
            "Meaning search needs Ollama running; used keyword search instead.".to_string(),
        );
    }
    None
}

async fn retrieve_evidence(
    app: &AppHandle,
    question: &str,
    options: &RetrievalOptions,
    ollama_host: Option<&str>,
) -> Result<(Vec<serde_json::Value>, String, Option<String>), String> {
    let translation = &options.translation_code;
    let limit = options.evidence_limit;
    let mock_council = std::env::var("BIBLE_AI_MOCK_COUNCIL").ok().as_deref() == Some("1");
    let use_semantic =
        !mock_council && (options.strategy == "semantic" || options.strategy == "hybrid");
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
    let scope = db::VerseSearchScope {
        book_id: options.book_id,
        testament: options.testament.as_deref(),
        start_verse_id: options.start_verse_id,
        end_verse_id: options.end_verse_id,
    };

    // Semantic pass (if possible). Track whether the embedding call itself
    // succeeded so a downgrade to keyword search can be explained.
    let mut embed_ok = true;
    let semantic_rows: Vec<serde_json::Value> = if use_semantic && has_embeddings {
        match ollama::embed_with_host(EMBED_MODEL, question, ollama_host).await {
            Ok(q_emb) => {
                let conn = open_corpus(app)?;
                // Request a bit more than `limit` so the merge can fall back
                // to FTS fills while still returning the top-ranked evidence.
                let sem_limit = (limit * 3) / 4 + 1;
                let hits =
                    db::semantic_search(&conn, &q_emb, translation, EMBED_MODEL, sem_limit, scope)
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
                embed_ok = false;
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
        let hits = db::search(&conn, &fts_query, Some(translation), limit as i64, scope)
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
    let core_target = core_evidence_target(limit); // leave roughly a quarter for cross-refs

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

    let fallback_reason =
        council_retrieval_fallback_reason(use_semantic, translation, has_embeddings, embed_ok);

    Ok((merged, mode, fallback_reason))
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
        if !reference_range_matches_options(&range, options) {
            continue;
        }
        if rows.len() >= options.evidence_limit {
            break;
        }
        let Some((start_verse_id, end_verse_id)) = clipped_reference_range_ids(&range, options)
        else {
            continue;
        };
        let remaining = (options.evidence_limit - rows.len()) as i64;
        let verses =
            db::get_verse_range(&conn, translation, start_verse_id, end_verse_id, remaining)
                .map_err(|e| e.to_string())?;
        for verse in verses {
            if rows.len() >= options.evidence_limit {
                break;
            }
            if !verse_in_requested_range(verse.verse_id, options) {
                continue;
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

fn core_evidence_target(limit: usize) -> usize {
    if limit == 0 {
        0
    } else {
        ((limit * 3) / 4).clamp(1, limit)
    }
}

fn clipped_reference_range_ids(
    range: &ReferenceRange,
    options: &RetrievalOptions,
) -> Option<(i64, i64)> {
    let start = options
        .start_verse_id
        .map_or(range.start_verse_id, |requested| {
            range.start_verse_id.max(requested)
        });
    let end = options
        .end_verse_id
        .map_or(range.end_verse_id, |requested| {
            range.end_verse_id.min(requested)
        });
    (start <= end).then_some((start, end))
}

fn reference_range_matches_options(range: &ReferenceRange, options: &RetrievalOptions) -> bool {
    if let Some(book_id) = options.book_id {
        if range.book.id != book_id {
            return false;
        }
    }
    if let Some(testament) = options.testament.as_deref() {
        if !book_matches_testament(range.book.id, testament) {
            return false;
        }
    }
    if let Some(start) = options.start_verse_id {
        if range.end_verse_id < start {
            return false;
        }
    }
    if let Some(end) = options.end_verse_id {
        if range.start_verse_id > end {
            return false;
        }
    }
    true
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
    aliases.sort_by_key(|alias| std::cmp::Reverse(alias.0.len()));

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
            if is_bare_john_inside_numbered_john(&normalized, start, &alias, &book.name) {
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

fn is_bare_john_inside_numbered_john(
    normalized: &str,
    start: usize,
    alias: &str,
    book_name: &str,
) -> bool {
    if book_name != "John" || alias != "john" {
        return false;
    }
    let prefix = normalized[..start].trim_end();
    let Some(marker) = prefix.chars().next_back() else {
        return false;
    };
    if !matches!(marker, '1' | '2' | '3') {
        return false;
    }
    let marker_start = prefix.len() - marker.len_utf8();
    prefix[..marker_start]
        .chars()
        .next_back()
        .is_none_or(|ch| !ch.is_alphanumeric())
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

/// (chapter, verse, end_chapter, end_verse) parsed from a reference string;
/// the trailing fields are `None` when the reference omits that part.
type ReferenceNumbers = (i64, Option<i64>, Option<i64>, Option<i64>);

fn parse_reference_numbers(value: &str, max_chapter: i64) -> Option<ReferenceNumbers> {
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
    if !valid_reference_verse(verse) {
        return None;
    }
    rest = next.trim_start();
    if !rest.starts_with('-') {
        return Some((chapter, Some(verse), None, None));
    }
    let (first, next) = consume_i64(&rest[1..])?;
    let next = next.trim_start();
    if let Some(stripped) = next.strip_prefix(':') {
        if first < chapter || first > max_chapter {
            return None;
        }
        let (end_verse, _) = consume_i64(stripped)?;
        if !valid_reference_verse(end_verse) || (first == chapter && end_verse < verse) {
            return None;
        }
        Some((chapter, Some(verse), Some(first), Some(end_verse)))
    } else {
        if !valid_reference_verse(first) || first < verse {
            return None;
        }
        Some((chapter, Some(verse), Some(chapter), Some(first)))
    }
}

fn valid_reference_verse(verse: i64) -> bool {
    (1..=999).contains(&verse)
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

#[cfg(test)]
mod retrieval_filter_tests {
    use super::{
        clipped_reference_range_ids, core_evidence_target, db, extract_reference_ranges,
        parse_reference_numbers, reference_range_matches_options, ReferenceRange, RetrievalOptions,
    };

    fn test_book(id: i64, name: &str, testament: &str) -> db::Book {
        db::Book {
            id,
            osis_code: name.replace(' ', "").to_uppercase(),
            name: name.to_string(),
            testament: testament.to_string(),
            chapter_count: 50,
        }
    }

    fn options(
        book_id: Option<i64>,
        testament: Option<&str>,
        start_verse_id: Option<i64>,
        end_verse_id: Option<i64>,
    ) -> RetrievalOptions {
        RetrievalOptions {
            strategy: "hybrid".to_string(),
            include_cross_refs: true,
            translation_code: "KJV".to_string(),
            book_id,
            testament: testament.map(str::to_string),
            start_verse_id,
            end_verse_id,
            evidence_limit: 10,
        }
    }

    #[test]
    fn explicit_reference_filter_respects_book_and_testament() {
        let acts = ReferenceRange {
            book: test_book(44, "Acts", "NT"),
            start_verse_id: 44_002_038,
            end_verse_id: 44_002_038,
        };

        assert!(reference_range_matches_options(
            &acts,
            &options(None, None, None, None)
        ));
        assert!(reference_range_matches_options(
            &acts,
            &options(Some(44), Some("NT"), None, None)
        ));
        assert!(!reference_range_matches_options(
            &acts,
            &options(Some(1), None, None, None)
        ));
        assert!(!reference_range_matches_options(
            &acts,
            &options(None, Some("OT"), None, None)
        ));
    }

    #[test]
    fn explicit_reference_filter_respects_requested_verse_window() {
        let genesis = ReferenceRange {
            book: test_book(1, "Genesis", "OT"),
            start_verse_id: 1_001_001,
            end_verse_id: 1_001_003,
        };

        assert!(reference_range_matches_options(
            &genesis,
            &options(None, None, Some(1_001_002), Some(1_001_002))
        ));
        assert!(!reference_range_matches_options(
            &genesis,
            &options(None, None, Some(1_001_004), None)
        ));
        assert!(!reference_range_matches_options(
            &genesis,
            &options(None, None, None, Some(1_001_000))
        ));
    }

    #[test]
    fn explicit_reference_ranges_are_clipped_before_querying() {
        let genesis = ReferenceRange {
            book: test_book(1, "Genesis", "OT"),
            start_verse_id: 1_001_001,
            end_verse_id: 1_001_003,
        };

        assert_eq!(
            clipped_reference_range_ids(
                &genesis,
                &options(None, None, Some(1_001_002), Some(1_001_002)),
            ),
            Some((1_001_002, 1_001_002))
        );
        assert_eq!(
            clipped_reference_range_ids(&genesis, &options(None, None, Some(1_001_004), None)),
            None
        );
    }

    #[test]
    fn numbered_john_references_do_not_also_match_gospel_john() {
        let books = vec![
            test_book(43, "John", "NT"),
            test_book(62, "1 John", "NT"),
            test_book(63, "2 John", "NT"),
            test_book(64, "3 John", "NT"),
        ];

        let ranges = extract_reference_ranges("Read 1 John 1:1 and 2 John 1:1", &books);
        let ids = ranges.iter().map(|range| range.book.id).collect::<Vec<_>>();

        assert_eq!(ids, vec![62, 63]);
    }

    #[test]
    fn reference_parser_rejects_invalid_verse_bounds() {
        assert_eq!(
            parse_reference_numbers(" 1:1-2", 21),
            Some((1, Some(1), Some(1), Some(2)))
        );
        assert!(parse_reference_numbers(" 1:0-2", 21).is_none());
        assert!(parse_reference_numbers(" 1:1-0", 21).is_none());
        assert!(parse_reference_numbers(" 2:3-2", 21).is_none());
        assert!(parse_reference_numbers(" 1:1-22:1", 21).is_none());
    }

    #[test]
    fn core_evidence_target_never_rounds_to_zero_for_tiny_limits() {
        assert_eq!(core_evidence_target(1), 1);
        assert_eq!(core_evidence_target(2), 1);
        assert_eq!(core_evidence_target(60), 45);
    }
}

#[cfg(test)]
mod search_merge_tests {
    use super::merge_search_hits;
    use crate::db::{SearchHit, SemanticHit};

    fn sem(verse_id: i64, score: f32) -> SemanticHit {
        SemanticHit {
            verse_id,
            translation_code: "KJV".into(),
            book_id: 1,
            book_name: "Genesis".into(),
            book_osis: "Gen".into(),
            chapter: 1,
            verse: verse_id,
            text: format!("verse {verse_id}"),
            score,
        }
    }
    fn kw(verse_id: i64) -> SearchHit {
        SearchHit {
            verse_id,
            translation_code: "KJV".into(),
            book_id: 1,
            book_name: "Genesis".into(),
            book_osis: "Gen".into(),
            chapter: 1,
            verse: verse_id,
            text: format!("verse {verse_id}"),
            snippet: format!("<mark>verse</mark> {verse_id}"),
        }
    }

    #[test]
    fn merges_both_then_meaning_then_keyword_and_dedupes() {
        let out = merge_search_hits(vec![sem(10, 0.9), sem(11, 0.8)], vec![kw(11), kw(12)], 50);
        let kinds: Vec<(&str, i64)> = out
            .iter()
            .map(|h| (h.match_kind.as_str(), h.verse_id))
            .collect();
        assert_eq!(kinds, vec![("both", 11), ("meaning", 10), ("keyword", 12)]);
        let both = &out[0];
        assert!(both.snippet.contains("<mark>"));
        assert!(both.semantic_score.is_some());
        assert_eq!(out[1].snippet, "");
    }

    #[test]
    fn respects_limit() {
        let out = merge_search_hits(vec![sem(1, 0.9)], vec![kw(2), kw(3)], 2);
        assert_eq!(out.len(), 2);
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
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
            list_tags,
            create_tag,
            delete_tag,
            tag_item,
            untag_item,
            list_item_tags,
            list_tags_with_counts,
            list_tagged_items,
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
            export_study_packet,
            write_workspace_markdown_to_path,
            write_workspace_html,
            write_workspace_pdf,
            write_theology_pdf,
            backup_user_sqlite,
            restore_user_sqlite,
            ask_council,
            cancel_council,
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
            list_range_notes_for_chapter,
            search_notes
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(test)]
mod note_citation_tests {
    use super::format_note_citation;

    #[test]
    fn formats_single_and_ranges() {
        assert_eq!(format_note_citation("Genesis", 1, 1, None), "Genesis 1:1");
        assert_eq!(
            format_note_citation("Genesis", 1, 1, Some((1, 5))),
            "Genesis 1:1-5"
        );
        assert_eq!(
            format_note_citation("Genesis", 1, 31, Some((2, 1))),
            "Genesis 1:31-2:1"
        );
    }
}
