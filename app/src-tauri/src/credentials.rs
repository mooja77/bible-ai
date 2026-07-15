use keyring::{Entry, Error as KeyringError};

const DEFAULT_SERVICE: &str = "Bible AI";
const SERVICE_ENV: &str = "BIBLE_AI_CREDENTIAL_SERVICE";

#[derive(Debug, PartialEq)]
enum CredentialUpdate<'a> {
    Keep,
    Delete,
    Set(&'a str),
}

#[derive(Debug, Default)]
pub struct ProviderKeyChangeSet {
    previous_values: Vec<(&'static str, Option<String>)>,
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

pub fn save_provider_keys(
    settings: &crate::user_db::AppSettings,
) -> Result<ProviderKeyChangeSet, String> {
    let requested = [
        ("google_api_key", settings.google_api_key.as_deref()),
        ("openai_api_key", settings.openai_api_key.as_deref()),
        ("anthropic_api_key", settings.anthropic_api_key.as_deref()),
        (
            "managed_gateway_token",
            settings.managed_gateway_token.as_deref(),
        ),
    ];
    let mut changes = ProviderKeyChangeSet::default();
    for (name, value) in requested {
        let desired = match credential_update(value) {
            CredentialUpdate::Keep => continue,
            CredentialUpdate::Delete => None,
            CredentialUpdate::Set(secret) => Some(secret),
        };
        let previous = match read_key(name) {
            Ok(previous) => previous,
            Err(error) => return Err(error_with_rollback(error, &changes)),
        };
        if previous.as_deref() == desired {
            continue;
        }
        if let Err(error) = write_key(name, desired) {
            return Err(error_with_rollback(error, &changes));
        }
        changes.previous_values.push((name, previous));
    }
    Ok(changes)
}

fn error_with_rollback(error: String, changes: &ProviderKeyChangeSet) -> String {
    match rollback_provider_keys(changes) {
        Ok(()) => error,
        Err(rollback) => {
            format!("{error}; some credential changes could not be rolled back: {rollback}")
        }
    }
}

pub fn rollback_provider_keys(changes: &ProviderKeyChangeSet) -> Result<(), String> {
    let failures = changes
        .previous_values
        .iter()
        .rev()
        .filter_map(|(name, previous)| {
            write_key(name, previous.as_deref())
                .err()
                .map(|error| format!("{name}: {error}"))
        })
        .collect::<Vec<_>>();
    if failures.is_empty() {
        Ok(())
    } else {
        Err(failures.join("; "))
    }
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

fn write_key(name: &str, value: Option<&str>) -> Result<(), String> {
    let credential = entry(name)?;
    match value {
        Some(secret) => credential
            .set_password(secret)
            .map_err(|e| format!("save credential {name}: {e}")),
        None => match credential.delete_credential() {
            Ok(()) | Err(KeyringError::NoEntry) => Ok(()),
            Err(e) => Err(format!("delete credential {name}: {e}")),
        },
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

    #[cfg(target_os = "macos")]
    #[test]
    fn macos_uses_native_keychain_and_round_trips_a_secret() {
        use keyring::Entry;
        use std::time::{SystemTime, UNIX_EPOCH};

        let unique = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("system clock must follow the Unix epoch")
            .as_nanos();
        let service = format!("BibleAI.CI.{unique}");
        let entry =
            Entry::new(&service, "keychain-smoke").expect("create a native macOS Keychain entry");

        assert!(
            entry
                .get_credential()
                .downcast_ref::<keyring::macos::MacCredential>()
                .is_some(),
            "macOS must use Keychain rather than keyring's in-memory mock store"
        );

        entry
            .set_password("disposable-keychain-smoke-secret")
            .expect("save a disposable Keychain secret");
        assert_eq!(
            entry.get_password().expect("read the Keychain secret"),
            "disposable-keychain-smoke-secret"
        );
        entry
            .delete_credential()
            .expect("delete the disposable Keychain secret");
    }
}
