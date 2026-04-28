//! robots.txt generation.
//!
//! Produces a `robots.txt` with optional Sitemap reference.
//! The implementation mirrors the TypeScript `generate-robots.ts` script
//! so that both produce identical output for the same inputs.

use std::fs;
use std::path::Path;

use log::warn;

use crate::error::EngineError;
use crate::path_util::{build_full_url, normalize_base_path_option};
use crate::SiteConfig;

// ── robots.txt generation ──────────────────────────────────────────

/// Build the robots.txt content string.
fn build_robots_txt(site_url: Option<&str>, base_path: &str) -> String {
    let mut content = String::new();
    content.push_str("# https://www.robotstxt.org/robotstxt.html\n");
    content.push_str("User-agent: *\n");
    content.push_str("Allow: /\n");
    content.push('\n');

    if let Some(url) = site_url {
        if !url.is_empty() {
            let sitemap_url = build_full_url(url, base_path, "/sitemap.xml");
            content.push_str(&format!("Sitemap: {}\n", sitemap_url));
        }
    }

    content
}

// ── Public API ─────────────────────────────────────────────────────

/// Generate a `robots.txt` file at `output_path`.
///
/// Creates parent directories if they don't exist.
pub fn generate_robots(
    output_path: &Path,
    config: &SiteConfig,
) -> Result<(), EngineError> {
    let base_path = normalize_base_path_option(config.base_path.as_deref());
    let content = build_robots_txt(config.site_url.as_deref(), &base_path);

    if let Some(parent) = output_path.parent() {
        fs::create_dir_all(parent)?;
    }

    fs::write(output_path, &content)?;

    log::info!("Generated robots.txt");
    if config.site_url.is_none() {
        warn!("siteUrl not configured. Sitemap reference omitted from robots.txt.");
    }
    if !base_path.is_empty() {
        log::info!("  BasePath: {}", base_path);
    }

    Ok(())
}

// ── Tests ──────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    fn sample_config() -> SiteConfig {
        SiteConfig {
            title: "My Blog".to_string(),
            description: "A personal blog".to_string(),
            logo: "/logo.png".to_string(),
            favicon: "/favicon.ico".to_string(),
            site_url: Some("https://example.com".to_string()),
            author: Some("Alice".to_string()),
            language: Some("en".to_string()),
            timezone: None,
            base_path: Some("/".to_string()),
        }
    }

    #[test]
    fn basic_robots_txt() {
        let content = build_robots_txt(Some("https://example.com"), "");
        assert!(content.contains("User-agent: *"));
        assert!(content.contains("Allow: /"));
        assert!(content.contains("Sitemap: https://example.com/sitemap.xml"));
    }

    #[test]
    fn robots_txt_without_site_url() {
        let content = build_robots_txt(None, "");
        assert!(content.contains("User-agent: *"));
        assert!(content.contains("Allow: /"));
        assert!(!content.contains("Sitemap:"));
    }

    #[test]
    fn robots_txt_with_base_path() {
        let content = build_robots_txt(Some("https://example.com"), "/blog");
        assert!(content.contains("Sitemap: https://example.com/blog/sitemap.xml"));
    }

    #[test]
    fn robots_txt_empty_site_url() {
        let content = build_robots_txt(Some(""), "");
        assert!(!content.contains("Sitemap:"));
    }

    #[test]
    fn writes_robots_file() {
        let tmp = TempDir::new().unwrap();
        let output = tmp.path().join("dist/robots.txt");
        let config = sample_config();

        let result = generate_robots(&output, &config);
        assert!(result.is_ok());
        assert!(output.exists());

        let content = fs::read_to_string(&output).unwrap();
        assert!(content.contains("User-agent: *"));
        assert!(content.contains("Sitemap: https://example.com/sitemap.xml"));
    }

    #[test]
    fn creates_parent_directories() {
        let tmp = TempDir::new().unwrap();
        let output = tmp.path().join("deep/nested/robots.txt");
        let config = sample_config();

        let result = generate_robots(&output, &config);
        assert!(result.is_ok());
        assert!(output.exists());
    }

    #[test]
    fn handles_base_path() {
        let tmp = TempDir::new().unwrap();
        let output = tmp.path().join("robots.txt");
        let mut config = sample_config();
        config.base_path = Some("/blog".to_string());

        generate_robots(&output, &config).unwrap();

        let content = fs::read_to_string(&output).unwrap();
        assert!(content.contains("Sitemap: https://example.com/blog/sitemap.xml"));
    }

    #[test]
    fn no_site_url_omits_sitemap() {
        let tmp = TempDir::new().unwrap();
        let output = tmp.path().join("robots.txt");
        let mut config = sample_config();
        config.site_url = None;

        generate_robots(&output, &config).unwrap();

        let content = fs::read_to_string(&output).unwrap();
        assert!(!content.contains("Sitemap:"));
    }

    #[test]
    fn matches_golden_format() {
        // Verify the exact format matches the TS script output
        let content = build_robots_txt(Some("https://test-blog.example.com"), "");
        let expected = "# https://www.robotstxt.org/robotstxt.html\n\
                        User-agent: *\n\
                        Allow: /\n\
                        \n\
                        Sitemap: https://test-blog.example.com/sitemap.xml\n";
        assert_eq!(content, expected);
    }

    #[test]
    fn matches_golden_format_with_base_path() {
        let content = build_robots_txt(Some("https://test-blog.example.com"), "/blog");
        let expected = "# https://www.robotstxt.org/robotstxt.html\n\
                        User-agent: *\n\
                        Allow: /\n\
                        \n\
                        Sitemap: https://test-blog.example.com/blog/sitemap.xml\n";
        assert_eq!(content, expected);
    }
}
