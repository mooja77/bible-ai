use keyring::Entry;

const SERVICE: &str = "Bible AI";

fn entry(name: &str) -> Result<Entry, String> {
    Entry::new(SERVICE, name).map_err(|e| format!("credential entry {name}: {e}"))
}

pub fn read_provider_keys(settings: &mut crate::user_db::AppSettings) {
    if let Some(key) = read_key("google_api_key") {
        settings.google_api_key = Some(key);
    }
    if let Some(key) = read_key("openai_api_key") {
        settings.openai_api_key = Some(key);
    }
    if let Some(key) = read_key("anthropic_api_key") {
        settings.anthropic_api_key = Some(key);
    }
}

pub fn save_provider_keys(settings: &crate::user_db::AppSettings) -> Result<(), String> {
    save_key("google_api_key", settings.google_api_key.as_deref())?;
    save_key("openai_api_key", settings.openai_api_key.as_deref())?;
    save_key("anthropic_api_key", settings.anthropic_api_key.as_deref())?;
    Ok(())
}

fn read_key(name: &str) -> Option<String> {
    let value = entry(name).ok()?.get_password().ok()?;
    if value.trim().is_empty() {
        None
    } else {
        Some(value)
    }
}

fn save_key(name: &str, value: Option<&str>) -> Result<(), String> {
    let credential = entry(name)?;
    match value.map(str::trim).filter(|v| !v.is_empty()) {
        Some(secret) => credential
            .set_password(secret)
            .map_err(|e| format!("save credential {name}: {e}")),
        None => {
            let _ = credential.delete_credential();
            Ok(())
        }
    }
}
