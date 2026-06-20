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

/// Upper bound on how long a single sidecar request may take before we assume
/// the Node process is wedged. A full Council run (parallel voices + a
/// synthesis call, each with their own ~600s provider timeouts) can legitimately
/// run for many minutes, so this is a deadlock guard, not a UX latency budget.
const SIDECAR_REQUEST_TIMEOUT: std::time::Duration = std::time::Duration::from_secs(1800);

/// Why a sidecar request failed. The distinction decides whether the
/// long-running process is still trustworthy.
pub enum SidecarError {
    /// The Node handler returned a clean `{type:"error"}` response — the
    /// request failed, but the process itself is healthy and reusable.
    App(String),
    /// A transport or protocol failure (write/read/parse/timeout). The
    /// process may be in an unknown state and should be discarded.
    Transport(String),
}

impl SidecarError {
    fn into_message(self) -> String {
        match self {
            SidecarError::App(msg) | SidecarError::Transport(msg) => msg,
        }
    }
}

/// One classified line from the sidecar's stdout, relative to an expected id.
pub enum SidecarLine {
    /// An interleaved `council_progress` event payload.
    Progress(Value),
    /// The terminal result payload. `Null` means the result field was absent
    /// or JSON null; the read loop treats that as a transport error, since a
    /// real `council_result` always carries a result object.
    Result(Value),
    /// A clean handler error — the process stays healthy.
    AppError(String),
    /// The line's `id` did not match the in-flight request.
    IdMismatch,
    /// The line was not valid JSON.
    Malformed(String),
}

/// Pure classification of a single stdout line. No I/O; unit-tested.
pub fn classify_sidecar_line(line: &str, expected_id: &str) -> SidecarLine {
    let v: Value = match serde_json::from_str(line.trim()) {
        Ok(v) => v,
        Err(e) => return SidecarLine::Malformed(e.to_string()),
    };
    if v.get("id").and_then(Value::as_str) != Some(expected_id) {
        return SidecarLine::IdMismatch;
    }
    match v.get("type").and_then(Value::as_str) {
        Some("council_progress") => {
            SidecarLine::Progress(v.get("event").cloned().unwrap_or(Value::Null))
        }
        Some("error") => SidecarLine::AppError(
            v.get("error")
                .and_then(Value::as_str)
                .unwrap_or("unknown sidecar error")
                .to_string(),
        ),
        _ => SidecarLine::Result(v.get("result").cloned().unwrap_or(Value::Null)),
    }
}

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
    if !cfg!(debug_assertions) {
        return None;
    }
    if std::env::var("BIBLE_AI_DISABLE_PROJECT_ENV")
        .ok()
        .as_deref()
        == Some("1")
    {
        return None;
    }
    let path = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .and_then(|p| p.parent())
        .map(|p| p.join(".env"))?;
    path.exists().then_some(path)
}

fn sidecar_dir(app: &AppHandle) -> Result<PathBuf, String> {
    match app
        .path()
        .resolve("sidecar", tauri::path::BaseDirectory::Resource)
    {
        Ok(dir) => {
            if dir.join("index.mjs").exists() || !cfg!(debug_assertions) {
                Ok(dir)
            } else {
                Ok(dev_sidecar_dir())
            }
        }
        Err(e) => {
            if cfg!(debug_assertions) {
                Ok(dev_sidecar_dir())
            } else {
                Err(format!("failed to resolve bundled sidecar path: {e}"))
            }
        }
    }
}

fn missing_sidecar_hint() -> &'static str {
    if cfg!(debug_assertions) {
        "run `npm install` in app/sidecar"
    } else {
        "the bundled sidecar is missing; reinstall the app"
    }
}

fn missing_node_hint() -> &'static str {
    if cfg!(debug_assertions) {
        "Install Node.js, set BIBLE_AI_NODE, or bundle a runtime at sidecar/node"
    } else {
        "the bundled Node runtime is missing; reinstall the app"
    }
}

fn node_command_for(dir: &std::path::Path) -> Result<String, String> {
    let bundled_node = if cfg!(windows) {
        dir.join("node").join("node.exe")
    } else {
        dir.join("node").join("bin").join("node")
    };
    if bundled_node.exists() {
        return Ok(bundled_node.display().to_string());
    }
    if !cfg!(debug_assertions) {
        return Err(format!(
            "{} at {}",
            missing_node_hint(),
            bundled_node.display()
        ));
    }
    Ok(std::env::var("BIBLE_AI_NODE").unwrap_or_else(|_| "node".to_string()))
}

impl Sidecar {
    pub async fn spawn(app: &AppHandle) -> Result<Self, String> {
        let dir = sidecar_dir(app)?;
        let entry = dir.join("index.mjs");
        if !entry.exists() {
            return Err(format!(
                "sidecar entry not found at {} - {}",
                entry.display(),
                missing_sidecar_hint()
            ));
        }

        let node_command = node_command_for(&dir)?;
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
                    "failed to spawn sidecar with `{node_command}` from {}. {}: {e}",
                    dir.display(),
                    missing_node_hint()
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

    /// Send a request and read interleaved progress lines until the terminal
    /// result/error. `on_progress` is called for each `council_progress` event.
    /// It runs synchronously inside the read loop, so it must do only cheap work
    /// (e.g. pushing to a Tauri Channel) — it must not block or `.await`.
    pub async fn request_streaming<F: FnMut(Value)>(
        &mut self,
        kind: &str,
        mut body: Value,
        mut on_progress: F,
    ) -> Result<Value, SidecarError> {
        self.next_id += 1;
        let id = format!("r{}", self.next_id);
        body["id"] = Value::String(id.clone());
        body["type"] = Value::String(kind.to_string());

        let line = serde_json::to_string(&body)
            .map_err(|e| SidecarError::Transport(format!("sidecar request encode: {e}")))?;
        self.stdin
            .write_all(line.as_bytes())
            .await
            .map_err(|e| SidecarError::Transport(format!("sidecar stdin write: {e}")))?;
        self.stdin
            .write_all(b"\n")
            .await
            .map_err(|e| SidecarError::Transport(format!("sidecar stdin newline: {e}")))?;
        self.stdin
            .flush()
            .await
            .map_err(|e| SidecarError::Transport(format!("sidecar stdin flush: {e}")))?;

        loop {
            let mut buf = String::new();
            let n = self
                .reader
                .read_line(&mut buf)
                .await
                .map_err(|e| SidecarError::Transport(format!("sidecar stdout read: {e}")))?;
            if n == 0 {
                return Err(SidecarError::Transport(
                    "sidecar closed stdout before responding".to_string(),
                ));
            }
            match classify_sidecar_line(buf.trim(), &id) {
                SidecarLine::Progress(event) => {
                    on_progress(event);
                    continue;
                }
                SidecarLine::AppError(msg) => return Err(SidecarError::App(msg)),
                SidecarLine::IdMismatch => {
                    return Err(SidecarError::Transport(format!(
                        "sidecar response id mismatch: {}",
                        buf.trim()
                    )));
                }
                SidecarLine::Malformed(e) => {
                    return Err(SidecarError::Transport(format!(
                        "sidecar: malformed response `{}`: {e}",
                        buf.trim()
                    )));
                }
                SidecarLine::Result(Value::Null) => {
                    return Err(SidecarError::Transport(
                        "sidecar response missing `result`".to_string(),
                    ));
                }
                SidecarLine::Result(v) => return Ok(v),
            }
        }
    }

    /// Non-streaming request: ignores progress events.
    pub async fn request(&mut self, kind: &str, body: Value) -> Result<Value, SidecarError> {
        self.request_streaming(kind, body, |_| {}).await
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
        // Invariant: `guard` is Some here — set above or we returned early.
        let Some(sidecar) = guard.as_mut() else {
            return Err("sidecar was not initialized".to_string());
        };
        match tokio::time::timeout(SIDECAR_REQUEST_TIMEOUT, sidecar.request(kind, body)).await {
            Ok(Ok(value)) => Ok(value),
            // Clean handler error — keep the long-running process warm.
            Ok(Err(err @ SidecarError::App(_))) => Err(err.into_message()),
            // Transport failure — the process may be unusable; discard it so
            // the next request spawns a fresh one.
            Ok(Err(err @ SidecarError::Transport(_))) => {
                *guard = None;
                Err(err.into_message())
            }
            // No response within the deadline — assume the process is wedged.
            Err(_) => {
                *guard = None;
                Err(format!(
                    "sidecar request `{kind}` timed out after {}s",
                    SIDECAR_REQUEST_TIMEOUT.as_secs()
                ))
            }
        }
    }

    // wired into ask_council in the next task
    #[allow(dead_code)]
    pub async fn request_streaming<F: FnMut(Value)>(
        &self,
        app: &AppHandle,
        kind: &str,
        body: Value,
        on_progress: F,
    ) -> Result<Value, String> {
        let mut guard = self.inner.lock().await;
        if guard.is_none() {
            *guard = Some(Sidecar::spawn(app).await?);
        }
        // Invariant: `guard` is Some here — set above or we returned early.
        let Some(sidecar) = guard.as_mut() else {
            return Err("sidecar was not initialized".to_string());
        };
        match tokio::time::timeout(
            SIDECAR_REQUEST_TIMEOUT,
            sidecar.request_streaming(kind, body, on_progress),
        )
        .await
        {
            Ok(Ok(value)) => Ok(value),
            Ok(Err(err @ SidecarError::App(_))) => Err(err.into_message()),
            Ok(Err(err @ SidecarError::Transport(_))) => {
                *guard = None;
                Err(err.into_message())
            }
            Err(_) => {
                *guard = None;
                Err(format!(
                    "sidecar request `{kind}` timed out after {}s",
                    SIDECAR_REQUEST_TIMEOUT.as_secs()
                ))
            }
        }
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

#[cfg(test)]
mod classify_tests {
    use super::{classify_sidecar_line, SidecarLine};
    use serde_json::Value;

    #[test]
    fn progress_line_is_progress() {
        let line =
            r#"{"id":"r1","type":"council_progress","event":{"kind":"voice_started","seq":1}}"#;
        match classify_sidecar_line(line, "r1") {
            SidecarLine::Progress(ev) => {
                assert_eq!(
                    ev.get("kind").and_then(|v: &Value| v.as_str()),
                    Some("voice_started")
                );
            }
            _ => panic!("expected Progress"),
        }
    }

    #[test]
    fn result_line_is_result() {
        let line = r#"{"id":"r1","type":"council_result","result":{"ok":true}}"#;
        match classify_sidecar_line(line, "r1") {
            SidecarLine::Result(v) => {
                assert_eq!(v.get("ok").and_then(|x| x.as_bool()), Some(true));
            }
            _ => panic!("expected Result"),
        }
    }

    #[test]
    fn result_line_missing_result_is_null() {
        let line = r#"{"id":"r1","type":"council_result"}"#;
        assert!(matches!(
            classify_sidecar_line(line, "r1"),
            SidecarLine::Result(serde_json::Value::Null)
        ));
    }

    #[test]
    fn error_line_is_app_error() {
        let line = r#"{"id":"r1","type":"error","error":"boom"}"#;
        match classify_sidecar_line(line, "r1") {
            SidecarLine::AppError(m) => assert_eq!(m, "boom"),
            _ => panic!("expected AppError"),
        }
    }

    #[test]
    fn wrong_id_is_mismatch() {
        let line = r#"{"id":"r2","type":"council_result","result":{}}"#;
        assert!(matches!(
            classify_sidecar_line(line, "r1"),
            SidecarLine::IdMismatch
        ));
    }

    #[test]
    fn bad_json_is_malformed() {
        assert!(matches!(
            classify_sidecar_line("not json", "r1"),
            SidecarLine::Malformed(_)
        ));
    }
}
