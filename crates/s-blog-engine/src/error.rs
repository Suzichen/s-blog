//! Unified error types for the engine.
//!
//! Includes a `From<EngineError>` impl for `napi::Error` so that the
//! NAPI binding layer can use `?` directly without boilerplate conversions.

use std::path::PathBuf;

/// All errors that the engine can produce.
#[derive(Debug, thiserror::Error)]
pub enum EngineError {
    #[error("Directory not found: {0}")]
    DirectoryNotFound(PathBuf),

    #[error("Failed to parse frontmatter in {file}: {reason}")]
    FrontmatterParse { file: String, reason: String },

    #[error("Invalid date format in {file}: {date}")]
    InvalidDate { file: String, date: String },

    #[error("Invalid timezone: {0}")]
    InvalidTimezone(String),

    #[error("Failed to decode image {file}: {reason}")]
    ImageDecode { file: String, reason: String },

    #[error("Invalid album directory name: {0}")]
    InvalidAlbumName(String),

    #[error("Configuration error: {0}")]
    Config(String),

    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),

    #[error("JSON error: {0}")]
    Json(#[from] serde_json::Error),

    #[error("YAML error: {0}")]
    Yaml(#[from] serde_yaml::Error),

    #[error("Configuration file not found: {0}")]
    ConfigNotFound(PathBuf),

    #[error("Build step '{step}' failed: {reason}")]
    BuildStepFailed { step: String, reason: String },

    #[error("Port {port} is already in use")]
    PortInUse { port: u16 },

    #[error("Serve directory not found: {0}\nHint: run `s-blog build` first")]
    ServeDirNotFound(PathBuf),
}

// ── NAPI conversion ────────────────────────────────────────────────

/// When the `napi` feature is enabled, `EngineError` can be converted
/// directly into `napi::Error` via `?` in binding functions.
#[cfg(feature = "napi")]
impl From<EngineError> for napi::Error {
    fn from(e: EngineError) -> Self {
        napi::Error::from_reason(e.to_string())
    }
}
