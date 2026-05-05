//! Long-running Node sidecar for Claude Agent SDK calls.
//!
//! We spawn `node index.mjs` once (lazily, on the first council call) and hold
//! a handle to its stdio in Tauri managed state. Every request is a single
//! line of JSON in, single line of JSON out. Calls are serialised behind a
//! mutex — v0.1 does not need concurrent council requests.

use std::path::PathBuf;
use std::process::Stdio;

use serde_json::{json, Value};
use tauri::{AppHandle, Manager};
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::process::{ChildStdin, ChildStdout, Command};

pub struct Sidecar {
    // Keep the Child alive so dropping Sidecar kills the process.
    _child: tokio::process::Child,
    stdin: ChildStdin,
    reader: BufReader<ChildStdout>,
    next_id: u64,
}

fn dev_sidecar_dir() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .map(|p| p.join("sidecar"))
        .expect("CARGO_MANIFEST_DIR has no parent")
}

fn project_env_file() -> Option<PathBuf> {
    let path = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .and_then(|p| p.parent())
        .map(|p| p.join(".env"))?;
    path.exists().then_some(path)
}

fn sidecar_dir(app: &AppHandle) -> PathBuf {
    let bundled = app
        .path()
        .resolve("sidecar", tauri::path::BaseDirectory::Resource)
        .ok();
    if let Some(dir) = bundled {
        if dir.join("index.mjs").exists() {
            return dir;
        }
    }
    dev_sidecar_dir()
}

fn node_command_for(dir: &std::path::Path) -> String {
    let bundled_node = if cfg!(windows) {
        dir.join("node").join("node.exe")
    } else {
        dir.join("node").join("bin").join("node")
    };
    if bundled_node.exists() {
        return bundled_node.display().to_string();
    }
    std::env::var("BIBLE_AI_NODE").unwrap_or_else(|_| "node".to_string())
}

impl Sidecar {
    pub async fn spawn(app: &AppHandle) -> Result<Self, String> {
        let dir = sidecar_dir(app);
        let entry = dir.join("index.mjs");
        if !entry.exists() {
            return Err(format!(
                "sidecar entry not found at {} — run `npm install` in app/sidecar",
                entry.display()
            ));
        }

        let node_command = node_command_for(&dir);
        let mut command = Command::new(&node_command);
        // --env-file-if-exists requires Node >= 20.12. In development this
        // loads the project-root .env. Packaged apps rely on inherited env.
        if let Some(env_file) = project_env_file() {
            command.arg(format!("--env-file-if-exists={}", env_file.display()));
        }
        let mut child = command
            .arg("index.mjs")
            .current_dir(&dir)
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .kill_on_drop(true)
            .spawn()
            .map_err(|e| {
                format!(
                    "failed to spawn sidecar with `{node_command}` from {}. Install Node.js, set BIBLE_AI_NODE, or bundle a runtime at sidecar/node: {e}",
                    dir.display()
                )
            })?;

        let stdin = child.stdin.take().ok_or("sidecar: no stdin handle")?;
        let stdout = child.stdout.take().ok_or("sidecar: no stdout handle")?;
        let reader = BufReader::new(stdout);

        // stderr is drained into the parent process stderr so Tauri's dev
        // console shows sidecar logs. A dedicated task avoids back-pressure.
        if let Some(stderr) = child.stderr.take() {
            tokio::spawn(async move {
                let mut lines = BufReader::new(stderr).lines();
                while let Ok(Some(line)) = lines.next_line().await {
                    eprintln!("{line}");
                }
            });
        }

        Ok(Self {
            _child: child,
            stdin,
            reader,
            next_id: 0,
        })
    }

    pub async fn request(&mut self, kind: &str, mut body: Value) -> Result<Value, String> {
        self.next_id += 1;
        let id = format!("r{}", self.next_id);
        body["id"] = Value::String(id.clone());
        body["type"] = Value::String(kind.to_string());

        let line = serde_json::to_string(&body).map_err(|e| e.to_string())?;
        self.stdin
            .write_all(line.as_bytes())
            .await
            .map_err(|e| format!("sidecar stdin write: {e}"))?;
        self.stdin
            .write_all(b"\n")
            .await
            .map_err(|e| format!("sidecar stdin newline: {e}"))?;
        self.stdin
            .flush()
            .await
            .map_err(|e| format!("sidecar stdin flush: {e}"))?;

        let mut buf = String::new();
        let n = self
            .reader
            .read_line(&mut buf)
            .await
            .map_err(|e| format!("sidecar stdout read: {e}"))?;
        if n == 0 {
            return Err("sidecar closed stdout before responding".to_string());
        }

        let resp: Value = serde_json::from_str(buf.trim())
            .map_err(|e| format!("sidecar: malformed response `{}`: {e}", buf.trim()))?;

        if resp.get("id").and_then(Value::as_str) != Some(&id) {
            return Err(format!("sidecar response id mismatch: {buf}"));
        }
        if resp.get("type").and_then(Value::as_str) == Some("error") {
            return Err(resp
                .get("error")
                .and_then(Value::as_str)
                .unwrap_or("unknown sidecar error")
                .to_string());
        }
        resp.get("result")
            .cloned()
            .ok_or_else(|| "sidecar response missing `result`".to_string())
    }
}

/// Wrap a Sidecar behind a tokio mutex. `None` means not spawned yet.
pub struct SidecarState {
    pub inner: tokio::sync::Mutex<Option<Sidecar>>,
}

impl SidecarState {
    pub fn new() -> Self {
        Self {
            inner: tokio::sync::Mutex::new(None),
        }
    }

    pub async fn request(&self, app: &AppHandle, kind: &str, body: Value) -> Result<Value, String> {
        let mut guard = self.inner.lock().await;
        if guard.is_none() {
            *guard = Some(Sidecar::spawn(app).await?);
        }
        let Some(sidecar) = guard.as_mut() else {
            return Err("sidecar was not initialized".to_string());
        };
        let result = sidecar.request(kind, body).await;
        if result.is_err() {
            *guard = None;
        }
        result
    }
}

/// Very small English stop-word list for FTS query cleanup. Not meant to be
/// comprehensive; we just want to avoid FTS spending its ranking budget on
/// "the", "and", etc. when the user types a whole question.
pub fn is_stop_word(w: &str) -> bool {
    matches!(
        w,
        "a" | "an"
            | "and"
            | "are"
            | "as"
            | "at"
            | "be"
            | "but"
            | "by"
            | "can"
            | "could"
            | "did"
            | "do"
            | "does"
            | "for"
            | "from"
            | "had"
            | "has"
            | "have"
            | "he"
            | "her"
            | "him"
            | "his"
            | "how"
            | "i"
            | "if"
            | "in"
            | "into"
            | "is"
            | "it"
            | "its"
            | "me"
            | "my"
            | "no"
            | "not"
            | "of"
            | "on"
            | "or"
            | "our"
            | "out"
            | "s"
            | "should"
            | "so"
            | "t"
            | "that"
            | "the"
            | "their"
            | "them"
            | "then"
            | "there"
            | "these"
            | "they"
            | "this"
            | "those"
            | "to"
            | "was"
            | "we"
            | "were"
            | "what"
            | "when"
            | "where"
            | "which"
            | "who"
            | "why"
            | "will"
            | "with"
            | "would"
            | "you"
            | "your"
    )
}

/// Turn a natural-language question into an FTS5 OR-query: extract meaningful
/// tokens and join them with ` OR `. Empty result means "no useful terms".
pub fn question_to_fts_query(question: &str) -> String {
    let tokens: Vec<String> = question
        .split(|c: char| !c.is_alphanumeric() && c != '\'' && c != '-')
        .filter_map(|w| {
            let lower = w.to_lowercase();
            if lower.is_empty() || is_stop_word(&lower) || lower.len() < 2 {
                None
            } else {
                Some(lower)
            }
        })
        .collect();
    // Deduplicate while preserving order.
    let mut seen = std::collections::HashSet::new();
    let unique: Vec<String> = tokens
        .into_iter()
        .filter(|t| seen.insert(t.clone()))
        .collect();
    unique.join(" OR ")
}

pub fn build_council_request(
    question: &str,
    evidence: Vec<Value>,
    model: &str,
    settings: Option<&crate::user_db::AppSettings>,
) -> Value {
    json!({
        "question": question,
        "evidence": evidence,
        "model": model,
        "settings": settings,
    })
}
