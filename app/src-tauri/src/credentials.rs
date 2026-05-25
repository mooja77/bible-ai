use keyring::{Entry, Error as KeyringError};

const DEFAULT_SERVICE: &str = "Bible AI";
const SERVICE_ENV: &str = "BIBLE_AI_CREDENTIAL_SERVICE";

#[derive(Debug, PartialEq)]
enum CredentialUpdate<'a> {
    Keep,
    Delete,
    Set(&'a str),
}

fn service_name() -> String {
    std::env::var(SERVICE_ENV)
        .ok()
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
        .unwrap_or_else(|| DEFAULT_SERVICE.to_string())
}

fn entry(name: &str) -> Result<Entry, String> {
    let service = service_name();
    Entry::new(&service, name).map_err(|e| format!("credential entry {name} ({service}): {e}"))
}

pub fn read_provider_keys(settings: &mut crate::user_db::AppSettings) -> Result<(), String> {
    if let Some(key) = read_key("google_api_key")? {
        settings.google_api_key = Some(key);
    }
    if let Some(key) = read_key("openai_api_key")? {
        settings.openai_api_key = Some(key);
    }
    if let Some(key) = read_key("anthropic_api_key")? {
        settings.anthropic_api_key = Some(key);
    }
    if let Some(key) = read_key("managed_gateway_token")? {
        settings.managed_gateway_token = Some(key);
    }
    Ok(())
}

pub fn save_provider_keys(settings: &crate::user_db::AppSettings) -> Result<(), String> {
    save_key("google_api_key", settings.google_api_key.as_deref())?;
    save_key("openai_api_key", settings.openai_api_key.as_deref())?;
    save_key("anthropic_api_key", settings.anthropic_api_key.as_deref())?;
    save_key(
        "managed_gateway_token",
        settings.managed_gateway_token.as_deref(),
    )?;
    Ok(())
}

fn read_key(name: &str) -> Result<Option<String>, String> {
    let value = match entry(name)?.get_password() {
        Ok(value) => value,
        Err(KeyringError::NoEntry) => return Ok(None),
        Err(e) => return Err(format!("read credential {name}: {e}")),
    };
    if value.trim().is_empty() {
        Ok(None)
    } else {
        Ok(Some(value))
    }
}

fn save_key(name: &str, value: Option<&str>) -> Result<(), String> {
    let update = credential_update(value);
    let credential = match update {
        CredentialUpdate::Keep => return Ok(()),
        CredentialUpdate::Delete | CredentialUpdate::Set(_) => entry(name)?,
    };
    match update {
        CredentialUpdate::Set(secret) => credential
            .set_password(secret)
            .map_err(|e| format!("save credential {name}: {e}")),
        CredentialUpdate::Delete => match credential.delete_credential() {
            Ok(()) | Err(KeyringError::NoEntry) => Ok(()),
            Err(e) => Err(format!("delete credential {name}: {e}")),
        },
        CredentialUpdate::Keep => Ok(()),
    }
}

fn credential_update(value: Option<&str>) -> CredentialUpdate<'_> {
    match value.map(str::trim) {
        Some(secret) if !secret.is_empty() => CredentialUpdate::Set(secret),
        Some(_) => CredentialUpdate::Delete,
        None => CredentialUpdate::Keep,
    }
}

#[cfg(test)]
mod tests {
    use super::{credential_update, CredentialUpdate};

    #[test]
    fn missing_secret_fields_do_not_delete_existing_credentials() {
        assert_eq!(credential_update(None), CredentialUpdate::Keep);
        assert_eq!(credential_update(Some("")), CredentialUpdate::Delete);
        assert_eq!(credential_update(Some("   ")), CredentialUpdate::Delete);
        assert_eq!(
            credential_update(Some("  sk-test  ")),
            CredentialUpdate::Set("sk-test")
        );
    }
}
