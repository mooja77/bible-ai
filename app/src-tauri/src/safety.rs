use std::sync::OnceLock;

#[derive(Debug, serde::Deserialize)]
struct SafetyRegistry {
    format_version: u32,
    registry_version: String,
    owner_role: String,
    fallback: SafetyResource,
    entries: Vec<SafetyResource>,
}

#[derive(Debug, serde::Deserialize)]
pub(crate) struct SafetyResource {
    pub(crate) locale: String,
    locale_aliases: Vec<String>,
    pub(crate) jurisdictions: Vec<String>,
    pub(crate) message: String,
    pub(crate) review_status: String,
    pub(crate) reviewed_by: Option<String>,
    pub(crate) reviewed_on: Option<String>,
    pub(crate) expires_on: Option<String>,
    pub(crate) source_urls: Vec<String>,
}

static REGISTRY: OnceLock<SafetyRegistry> = OnceLock::new();

fn registry() -> &'static SafetyRegistry {
    REGISTRY.get_or_init(|| {
        let parsed: SafetyRegistry =
            serde_json::from_str(include_str!("../resources/safety-resources.json"))
                .expect("bundled safety resource registry must be valid");
        assert_eq!(
            parsed.format_version, 1,
            "bundled safety resource registry format must be supported"
        );
        parsed
    })
}

pub(crate) fn registry_version() -> &'static str {
    &registry().registry_version
}

pub(crate) fn registry_owner_role() -> &'static str {
    &registry().owner_role
}

pub(crate) fn sensitive_topic_resource(locale: Option<&str>) -> &'static SafetyResource {
    let requested = locale.unwrap_or("").to_ascii_lowercase();
    registry()
        .entries
        .iter()
        .find(|entry| {
            entry
                .locale_aliases
                .iter()
                .any(|alias| requested.starts_with(alias))
        })
        .unwrap_or(&registry().fallback)
}

/// Local, conservative pre-Council router. The dangerous failure is a missed
/// disclosure, so policy fixtures intentionally accept some false positives.
pub(crate) fn classify_sensitive_topic(question: &str) -> Option<&'static str> {
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
    RULES.iter().find_map(|(category, markers)| {
        markers
            .iter()
            .any(|marker| q.contains(marker))
            .then_some(*category)
    })
}

#[cfg(test)]
mod tests {
    use super::{registry, sensitive_topic_resource};
    use std::collections::HashSet;

    #[test]
    fn registry_is_versioned_unique_and_explicitly_pending() {
        let registry = registry();
        assert_eq!(registry.format_version, 1);
        assert!(!registry.registry_version.trim().is_empty());
        assert!(!registry.owner_role.trim().is_empty());
        let mut locales = HashSet::new();
        for entry in registry.entries.iter().chain([&registry.fallback]) {
            assert!(locales.insert(&entry.locale));
            assert!(!entry.jurisdictions.is_empty());
            assert!(!entry.message.trim().is_empty());
            if entry.review_status == "approved" {
                assert!(entry
                    .reviewed_by
                    .as_deref()
                    .is_some_and(|value| !value.trim().is_empty()));
                assert!(entry.reviewed_on.is_some());
                assert!(entry.expires_on.is_some());
            } else {
                assert_eq!(entry.review_status, "pending_human_safety_review");
                assert!(entry.reviewed_by.is_none());
                assert!(entry.reviewed_on.is_none());
                assert!(entry.expires_on.is_none());
            }
        }
    }

    #[test]
    fn unknown_locale_never_inherits_country_specific_numbers() {
        let fallback = sensitive_topic_resource(Some("fr-FR"));
        assert_eq!(fallback.locale, "international");
        assert!(!fallback.message.contains("988"));
        assert!(!fallback.message.contains("911"));
        assert!(!fallback.message.contains("999"));
    }
}
