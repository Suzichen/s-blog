//! s-blog-engine — core data engine for s-blog.
//!
//! This crate provides Markdown frontmatter parsing, timezone handling,
//! image thumbnail generation, EXIF reading, and static-site artifact
//! generation (manifest, albums, SEO pages, sitemap, RSS).
//!
//! All path output uses forward slashes (`/`) regardless of platform.

pub mod error;
pub mod frontmatter;
pub mod timezone;
pub mod posts;
pub mod image_proc;
pub mod exif;
pub mod albums;
pub mod seo;
pub mod sitemap;
pub mod rss;
pub mod robots;
pub mod path_util;
pub mod shell;
pub mod mime;
pub mod build;
pub mod serve;

// Re-export primary types for convenience.
pub use error::EngineError;
pub use path_util::normalize_path;

use std::collections::HashMap;
use serde::{Deserialize, Serialize};

// ── Configuration types ────────────────────────────────────────────

/// Site-level configuration (mirrors `config.json`).
#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SiteConfig {
    pub title: String,
    pub description: String,
    pub logo: String,
    pub favicon: String,
    #[serde(default)]
    pub site_url: Option<String>,
    #[serde(default)]
    pub author: Option<String>,
    #[serde(default)]
    pub language: Option<String>,
    #[serde(default)]
    pub timezone: Option<String>,
    #[serde(default = "default_base_path")]
    pub base_path: Option<String>,
}

fn default_base_path() -> Option<String> {
    Some("/".to_string())
}

/// Album-level configuration (mirrors `album.config.json`).
#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct AlbumConfig {
    pub enabled: bool,
    pub albums: Vec<AlbumEntry>,
}

/// A single album entry inside [`AlbumConfig`].
#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct AlbumEntry {
    pub dir: String,
    #[serde(default)]
    pub name: Option<String>,
    #[serde(default)]
    pub cover: Option<String>,
}

// ── Output types ───────────────────────────────────────────────────

/// Localized metadata for a single blog post (title and summary in a specific language).
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LocalizedPostMeta {
    pub title: String,
    pub summary: String,
}

/// Metadata for a single blog post (written to `manifest.json`).
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PostMetadata {
    pub slug: String,
    pub title: String,
    pub date: String,
    pub tags: Vec<String>,
    pub categories: Vec<String>,
    pub summary: String,
    #[serde(default)]
    pub available_languages: Vec<String>,
    #[serde(default, skip_serializing_if = "HashMap::is_empty")]
    pub localized_meta: HashMap<String, LocalizedPostMeta>,
}
