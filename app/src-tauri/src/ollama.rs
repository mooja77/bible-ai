//! Thin HTTP client for a locally-running Ollama daemon.
//!
//! Only exposes what the app actually uses: an embeddings call. If Ollama
//! isn't running, we return a descriptive error and the caller falls back
//! to keyword retrieval.

use serde::{Deserialize, Serialize};

const DEFAULT_HOST: &str = "http://localhost:11434";

fn host() -> String {
    std::env::var("OLLAMA_HOST").unwrap_or_else(|_| DEFAULT_HOST.to_string())
}

fn configured_host(host_override: Option<&str>) -> String {
    host_override
        .filter(|h| !h.trim().is_empty())
        .map(|h| h.trim().trim_end_matches('/').to_string())
        .unwrap_or_else(host)
}

#[derive(Serialize)]
struct EmbedRequest<'a> {
    model: &'a str,
    prompt: &'a str,
}

#[derive(Deserialize)]
struct EmbedResponse {
    embedding: Vec<f32>,
}

pub async fn embed_with_host(
    model: &str,
    prompt: &str,
    host_override: Option<&str>,
) -> Result<Vec<f32>, String> {
    let url = format!("{}/api/embeddings", configured_host(host_override));
    let client = reqwest::Client::builder()
        .connect_timeout(std::time::Duration::from_secs(3))
        .timeout(std::time::Duration::from_secs(60))
        .build()
        .map_err(|e| format!("ollama client: {e}"))?;

    let resp = client
        .post(&url)
        .json(&EmbedRequest { model, prompt })
        .send()
        .await
        .map_err(|e| format!("ollama request failed (is `ollama serve` running?): {e}"))?;

    if !resp.status().is_success() {
        let status = resp.status();
        let body = resp.text().await.unwrap_or_default();
        return Err(format!(
            "ollama {status}: {}",
            body.chars().take(300).collect::<String>()
        ));
    }

    let body: EmbedResponse = resp
        .json()
        .await
        .map_err(|e| format!("ollama: could not parse embedding response: {e}"))?;

    if body.embedding.is_empty() {
        return Err("ollama: empty embedding".to_string());
    }
    Ok(body.embedding)
}
