//! NAPI-RS bindings for s-blog-engine.
//!
//! Each exported function accepts JSON strings for configuration and
//! path strings for directories/files, then delegates to the core
//! `s_blog_engine` crate.  Results are returned as JSON strings (or
//! counts) so the Node.js layer stays thin.

use std::path::Path;

use napi_derive::napi;
use s_blog_engine::{AlbumConfig, PostMetadata, SiteConfig};

// ── Posts ───────────────────────────────────────────────────────────

/// Generate the posts manifest and copy Markdown files.
///
/// Returns the manifest JSON string (array of `PostMetadata`).
#[napi]
pub fn generate_posts_data(
    posts_dir: String,
    output_dir: String,
    config_json: String,
) -> napi::Result<String> {
    let config: SiteConfig = serde_json::from_str(&config_json)
        .map_err(|e| napi::Error::from_reason(format!("Invalid config JSON: {e}")))?;

    let posts = s_blog_engine::posts::generate_posts_data(
        Path::new(&posts_dir),
        Path::new(&output_dir),
        &config,
    )?;

    let json = serde_json::to_string_pretty(&posts)
        .map_err(|e| napi::Error::from_reason(format!("Failed to serialize result: {e}")))?;

    Ok(json)
}

// ── Albums ──────────────────────────────────────────────────────────

/// Generate album index and per-album detail JSON files, including
/// thumbnail generation and EXIF extraction.
///
/// Returns the albums-index JSON string.
#[napi]
pub fn generate_albums_data(
    albums_dir: String,
    output_dir: String,
    album_config_json: String,
    site_config_json: String,
) -> napi::Result<String> {
    let album_config: AlbumConfig = serde_json::from_str(&album_config_json)
        .map_err(|e| napi::Error::from_reason(format!("Invalid album config JSON: {e}")))?;

    let site_config: SiteConfig = serde_json::from_str(&site_config_json)
        .map_err(|e| napi::Error::from_reason(format!("Invalid site config JSON: {e}")))?;

    let base_path = site_config.base_path.as_deref();

    let output = s_blog_engine::albums::generate_albums_data_with_base(
        Path::new(&albums_dir),
        Path::new(&output_dir),
        &album_config,
        base_path,
    )?;

    let json = serde_json::to_string_pretty(&output.summaries)
        .map_err(|e| napi::Error::from_reason(format!("Failed to serialize result: {e}")))?;

    Ok(json)
}

// ── SEO ─────────────────────────────────────────────────────────────

/// Generate SEO HTML pages for every post in the manifest.
///
/// Returns the number of pages generated.
#[napi]
pub fn generate_seo_pages(
    manifest_json: String,
    template_path: String,
    output_dir: String,
    config_json: String,
) -> napi::Result<u32> {
    let manifest: Vec<PostMetadata> = serde_json::from_str(&manifest_json)
        .map_err(|e| napi::Error::from_reason(format!("Invalid manifest JSON: {e}")))?;

    let config: SiteConfig = serde_json::from_str(&config_json)
        .map_err(|e| napi::Error::from_reason(format!("Invalid config JSON: {e}")))?;

    let count = s_blog_engine::seo::generate_seo_pages(
        &manifest,
        Path::new(&template_path),
        Path::new(&output_dir),
        &config,
    )?;

    Ok(count as u32)
}

// ── Sitemap ─────────────────────────────────────────────────────────

/// Generate `sitemap.xml`.
#[napi]
pub fn generate_sitemap(
    manifest_json: String,
    output_path: String,
    config_json: String,
) -> napi::Result<()> {
    let manifest: Vec<PostMetadata> = serde_json::from_str(&manifest_json)
        .map_err(|e| napi::Error::from_reason(format!("Invalid manifest JSON: {e}")))?;

    let config: SiteConfig = serde_json::from_str(&config_json)
        .map_err(|e| napi::Error::from_reason(format!("Invalid config JSON: {e}")))?;

    s_blog_engine::sitemap::generate_sitemap(
        &manifest,
        Path::new(&output_path),
        &config,
    )?;

    Ok(())
}

// ── RSS ─────────────────────────────────────────────────────────────

/// Generate `rss.xml`.
#[napi]
pub fn generate_rss(
    manifest_json: String,
    output_path: String,
    config_json: String,
) -> napi::Result<()> {
    let manifest: Vec<PostMetadata> = serde_json::from_str(&manifest_json)
        .map_err(|e| napi::Error::from_reason(format!("Invalid manifest JSON: {e}")))?;

    let config: SiteConfig = serde_json::from_str(&config_json)
        .map_err(|e| napi::Error::from_reason(format!("Invalid config JSON: {e}")))?;

    s_blog_engine::rss::generate_rss(
        &manifest,
        Path::new(&output_path),
        &config,
    )?;

    Ok(())
}

// ── Robots ──────────────────────────────────────────────────────────

/// Generate `robots.txt`.
#[napi]
pub fn generate_robots(
    output_path: String,
    config_json: String,
) -> napi::Result<()> {
    let config: SiteConfig = serde_json::from_str(&config_json)
        .map_err(|e| napi::Error::from_reason(format!("Invalid config JSON: {e}")))?;

    s_blog_engine::robots::generate_robots(
        Path::new(&output_path),
        &config,
    )?;

    Ok(())
}
