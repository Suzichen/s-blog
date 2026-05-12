//! RSS 2.0 feed generation.
//!
//! Produces an `rss.xml` with channel metadata and post items.
//! The implementation mirrors the TypeScript `generate-rss.ts` script
//! so that both produce compatible output for the same inputs.

use std::fs;
use std::path::Path;

use log::warn;

use crate::error::EngineError;
use crate::path_util::{normalize_base_path_option, build_full_url};
use crate::{PostMetadata, SiteConfig};

// ── XML escaping ───────────────────────────────────────────────────

/// Escape special characters for safe embedding in XML.
fn escape_xml(text: &str) -> String {
    text.replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
        .replace('\'', "&apos;")
}

// ── URL helpers ────────────────────────────────────────────────────

/// Build a full URL: `{siteUrl}{basePath}{relativePath}`
fn get_full_url(site_url: &str, base_path: &str, relative_path: &str) -> String {
    build_full_url(site_url, base_path, relative_path)
}

// ── Date formatting ────────────────────────────────────────────────

/// Format an ISO date string to RFC 822 format for RSS `pubDate`.
///
/// Matches the TS behaviour: `new Date(isoDate).toUTCString()`.
/// If the date is empty or unparseable, falls back to `now_rfc822`.
fn format_rfc822_date(iso_date: &str, now_rfc822: &str) -> String {
    if iso_date.is_empty() {
        return now_rfc822.to_string();
    }

    // Try parsing as a full ISO 8601 datetime (with or without timezone)
    if let Ok(dt) = chrono::DateTime::parse_from_rfc3339(iso_date) {
        return dt.to_utc().format("%a, %d %b %Y %H:%M:%S GMT").to_string();
    }

    // Try parsing as "YYYY-MM-DDTHH:MM:SS" (no timezone → treat as UTC)
    if let Ok(naive) = chrono::NaiveDateTime::parse_from_str(iso_date, "%Y-%m-%dT%H:%M:%S") {
        let dt = naive.and_utc();
        return dt.format("%a, %d %b %Y %H:%M:%S GMT").to_string();
    }

    // Try parsing as "YYYY-MM-DD" only
    if let Ok(naive_date) = chrono::NaiveDate::parse_from_str(iso_date, "%Y-%m-%d") {
        let dt = naive_date
            .and_hms_opt(0, 0, 0)
            .unwrap()
            .and_utc();
        return dt.format("%a, %d %b %Y %H:%M:%S GMT").to_string();
    }

    // Fallback: use the JS-style Date constructor behaviour.
    // The TS code does `new Date(isoDate).toUTCString()` which is lenient.
    // We just return now as fallback.
    now_rfc822.to_string()
}

// ── RSS XML generation ─────────────────────────────────────────────

/// Build the RSS 2.0 XML string.
///
/// `now_rfc822` is the current time in RFC 822 format, used for
/// `lastBuildDate` and as a fallback for posts without dates.
fn build_rss_xml(
    posts: &[PostMetadata],
    config: &SiteConfig,
    base_path: &str,
    now_rfc822: &str,
) -> String {
    let site_url = config.site_url.as_deref().unwrap_or("");
    let title = &config.title;
    let description = &config.description;
    let author = config.author.as_deref();
    let language = config.language.as_deref().unwrap_or("zh-CN");

    let base_url = if site_url.is_empty() {
        String::new()
    } else {
        get_full_url(site_url, base_path, "/")
    };

    let mut xml = String::new();
    xml.push_str("<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n");
    xml.push_str("<rss version=\"2.0\" xmlns:atom=\"http://www.w3.org/2005/Atom\">\n");
    xml.push_str("  <channel>\n");
    xml.push_str(&format!("    <title>{}</title>\n", escape_xml(title)));
    xml.push_str(&format!(
        "    <description>{}</description>\n",
        escape_xml(description)
    ));
    xml.push_str(&format!("    <link>{}</link>\n", escape_xml(&base_url)));
    xml.push_str(&format!("    <language>{}</language>\n", language));
    xml.push_str(&format!("    <lastBuildDate>{}</lastBuildDate>\n", now_rfc822));

    if !site_url.is_empty() {
        let rss_url = get_full_url(site_url, base_path, "/rss.xml");
        xml.push_str(&format!(
            "    <atom:link href=\"{}\" rel=\"self\" type=\"application/rss+xml\" />\n",
            escape_xml(&rss_url)
        ));
    }

    // Items
    for post in posts {
        let post_url = if site_url.is_empty() {
            String::new()
        } else {
            get_full_url(site_url, base_path, &format!("/post/{}", post.slug))
        };
        let pub_date = format_rfc822_date(&post.date, now_rfc822);
        let categories: Vec<&str> = post
            .categories
            .iter()
            .chain(post.tags.iter())
            .map(|s| s.as_str())
            .collect();

        xml.push_str("    <item>\n");
        xml.push_str(&format!(
            "      <title>{}</title>\n",
            escape_xml(&post.title)
        ));
        xml.push_str(&format!(
            "      <description>{}</description>\n",
            escape_xml(&post.summary)
        ));
        if !post_url.is_empty() {
            xml.push_str(&format!("      <link>{}</link>\n", escape_xml(&post_url)));
            xml.push_str(&format!(
                "      <guid isPermaLink=\"true\">{}</guid>\n",
                escape_xml(&post_url)
            ));
        }
        xml.push_str(&format!("      <pubDate>{}</pubDate>\n", pub_date));
        if let Some(a) = author {
            xml.push_str(&format!("      <author>{}</author>\n", escape_xml(a)));
        }
        for cat in &categories {
            xml.push_str(&format!("      <category>{}</category>\n", escape_xml(cat)));
        }
        xml.push_str("    </item>\n");
    }

    xml.push_str("  </channel>\n");
    xml.push_str("</rss>");
    xml
}

// ── Public API ─────────────────────────────────────────────────────

/// Generate an `rss.xml` file at `output_path`.
///
/// If `config.site_url` is `None` or empty, logs a warning and returns
/// `Ok(())` without writing any file (matching the TS behaviour).
///
/// Creates parent directories if they don't exist.
pub fn generate_rss(
    manifest: &[PostMetadata],
    output_path: &Path,
    config: &SiteConfig,
) -> Result<(), EngineError> {
    let site_url = match config.site_url.as_deref() {
        Some(url) if !url.is_empty() => url,
        _ => {
            warn!("Skipping rss.xml generation (siteUrl not configured)");
            return Ok(());
        }
    };

    let _ = site_url; // used via config in build_rss_xml

    let base_path = normalize_base_path_option(config.base_path.as_deref());
    let now_rfc822 = chrono::Utc::now()
        .format("%a, %d %b %Y %H:%M:%S GMT")
        .to_string();

    let xml = build_rss_xml(manifest, config, &base_path, &now_rfc822);

    // Ensure parent directory exists
    if let Some(parent) = output_path.parent() {
        fs::create_dir_all(parent)?;
    }

    fs::write(output_path, &xml)?;

    log::info!("Generated rss.xml with {} items", manifest.len());
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
            language: Some("zh-CN".to_string()),
            timezone: None,
            base_path: Some("/".to_string()),
        }
    }

    fn sample_post() -> PostMetadata {
        PostMetadata {
            slug: "hello-world".to_string(),
            title: "Hello World".to_string(),
            date: "2024-01-15T10:30:00".to_string(),
            tags: vec!["intro".to_string(), "blog".to_string()],
            categories: vec!["General".to_string()],
            summary: "This is my first post".to_string(),
            available_languages: vec![],
            localized_meta: std::collections::HashMap::new(),
        }
    }

    #[test]
    fn generates_valid_rss_xml() {
        let xml = build_rss_xml(
            &[sample_post()],
            &sample_config(),
            "",
            "Mon, 01 Jan 2024 00:00:00 GMT",
        );

        assert!(xml.starts_with("<?xml version=\"1.0\" encoding=\"UTF-8\"?>"));
        assert!(xml.contains("<rss version=\"2.0\" xmlns:atom=\"http://www.w3.org/2005/Atom\">"));
        assert!(xml.ends_with("</rss>"));
    }

    #[test]
    fn includes_channel_metadata() {
        let xml = build_rss_xml(
            &[],
            &sample_config(),
            "",
            "Mon, 01 Jan 2024 00:00:00 GMT",
        );

        assert!(xml.contains("<title>My Blog</title>"));
        assert!(xml.contains("<description>A personal blog</description>"));
        assert!(xml.contains("<link>https://example.com/</link>"));
        assert!(xml.contains("<language>zh-CN</language>"));
        assert!(xml.contains("<lastBuildDate>Mon, 01 Jan 2024 00:00:00 GMT</lastBuildDate>"));
    }

    #[test]
    fn includes_atom_self_link() {
        let xml = build_rss_xml(
            &[],
            &sample_config(),
            "",
            "Mon, 01 Jan 2024 00:00:00 GMT",
        );

        assert!(xml.contains(
            "<atom:link href=\"https://example.com/rss.xml\" rel=\"self\" type=\"application/rss+xml\" />"
        ));
    }

    #[test]
    fn includes_post_items() {
        let xml = build_rss_xml(
            &[sample_post()],
            &sample_config(),
            "",
            "Mon, 01 Jan 2024 00:00:00 GMT",
        );

        assert!(xml.contains("<title>Hello World</title>"));
        assert!(xml.contains("<description>This is my first post</description>"));
        assert!(xml.contains("<link>https://example.com/post/hello-world</link>"));
        assert!(xml.contains("<guid isPermaLink=\"true\">https://example.com/post/hello-world</guid>"));
        assert!(xml.contains("<pubDate>Mon, 15 Jan 2024 10:30:00 GMT</pubDate>"));
        assert!(xml.contains("<author>Alice</author>"));
    }

    #[test]
    fn includes_categories_and_tags() {
        let xml = build_rss_xml(
            &[sample_post()],
            &sample_config(),
            "",
            "Mon, 01 Jan 2024 00:00:00 GMT",
        );

        // Categories come first, then tags (matching TS: [...categories, ...tags])
        assert!(xml.contains("<category>General</category>"));
        assert!(xml.contains("<category>intro</category>"));
        assert!(xml.contains("<category>blog</category>"));
    }

    #[test]
    fn default_language_is_zh_cn() {
        let mut config = sample_config();
        config.language = None;

        let xml = build_rss_xml(
            &[],
            &config,
            "",
            "Mon, 01 Jan 2024 00:00:00 GMT",
        );

        assert!(xml.contains("<language>zh-CN</language>"));
    }

    #[test]
    fn handles_base_path() {
        let mut config = sample_config();
        config.base_path = Some("/blog".to_string());

        let xml = build_rss_xml(
            &[sample_post()],
            &config,
            "/blog",
            "Mon, 01 Jan 2024 00:00:00 GMT",
        );

        assert!(xml.contains("<link>https://example.com/blog/</link>"));
        assert!(xml.contains("<atom:link href=\"https://example.com/blog/rss.xml\""));
        assert!(xml.contains("<link>https://example.com/blog/post/hello-world</link>"));
    }

    #[test]
    fn escapes_special_characters() {
        let post = PostMetadata {
            slug: "special".to_string(),
            title: "A <b>bold</b> & \"quoted\" title".to_string(),
            date: "2024-01-01T00:00:00".to_string(),
            tags: vec![],
            categories: vec![],
            summary: "Summary with <script>alert('xss')</script>".to_string(),
            available_languages: vec![],
            localized_meta: std::collections::HashMap::new(),
        };

        let xml = build_rss_xml(
            &[post],
            &sample_config(),
            "",
            "Mon, 01 Jan 2024 00:00:00 GMT",
        );

        assert!(xml.contains("<title>A &lt;b&gt;bold&lt;/b&gt; &amp; &quot;quoted&quot; title</title>"));
        assert!(xml.contains("<description>Summary with &lt;script&gt;alert(&apos;xss&apos;)&lt;/script&gt;</description>"));
    }

    #[test]
    fn no_author_omits_author_tag() {
        let mut config = sample_config();
        config.author = None;

        let xml = build_rss_xml(
            &[sample_post()],
            &config,
            "",
            "Mon, 01 Jan 2024 00:00:00 GMT",
        );

        assert!(!xml.contains("<author>"));
    }

    #[test]
    fn post_without_date_uses_now() {
        let post = PostMetadata {
            slug: "no-date".to_string(),
            title: "No Date".to_string(),
            date: String::new(),
            tags: vec![],
            categories: vec![],
            summary: "No date".to_string(),
            available_languages: vec![],
            localized_meta: std::collections::HashMap::new(),
        };

        let now = "Mon, 01 Jan 2024 00:00:00 GMT";
        let xml = build_rss_xml(&[post], &sample_config(), "", now);

        assert!(xml.contains(&format!("<pubDate>{}</pubDate>", now)));
    }

    #[test]
    fn skips_generation_when_site_url_not_configured() {
        let tmp = TempDir::new().unwrap();
        let output = tmp.path().join("rss.xml");
        let mut config = sample_config();
        config.site_url = None;

        let result = generate_rss(&[sample_post()], &output, &config);
        assert!(result.is_ok());
        assert!(!output.exists());
    }

    #[test]
    fn skips_generation_when_site_url_empty() {
        let tmp = TempDir::new().unwrap();
        let output = tmp.path().join("rss.xml");
        let mut config = sample_config();
        config.site_url = Some(String::new());

        let result = generate_rss(&[sample_post()], &output, &config);
        assert!(result.is_ok());
        assert!(!output.exists());
    }

    #[test]
    fn writes_rss_file() {
        let tmp = TempDir::new().unwrap();
        let output = tmp.path().join("dist/rss.xml");
        let config = sample_config();

        let result = generate_rss(&[sample_post()], &output, &config);
        assert!(result.is_ok());
        assert!(output.exists());

        let content = fs::read_to_string(&output).unwrap();
        assert!(content.contains("<?xml version=\"1.0\" encoding=\"UTF-8\"?>"));
        assert!(content.contains("<rss version=\"2.0\""));
        assert!(content.contains("Hello World"));
    }

    #[test]
    fn creates_parent_directories() {
        let tmp = TempDir::new().unwrap();
        let output = tmp.path().join("deep/nested/dir/rss.xml");
        let config = sample_config();

        let result = generate_rss(&[sample_post()], &output, &config);
        assert!(result.is_ok());
        assert!(output.exists());
    }

    #[test]
    fn format_rfc822_date_iso_datetime() {
        let result = format_rfc822_date("2024-01-15T10:30:00", "fallback");
        assert_eq!(result, "Mon, 15 Jan 2024 10:30:00 GMT");
    }

    #[test]
    fn format_rfc822_date_date_only() {
        let result = format_rfc822_date("2024-01-15", "fallback");
        assert_eq!(result, "Mon, 15 Jan 2024 00:00:00 GMT");
    }

    #[test]
    fn format_rfc822_date_empty_uses_fallback() {
        let result = format_rfc822_date("", "Mon, 01 Jan 2024 00:00:00 GMT");
        assert_eq!(result, "Mon, 01 Jan 2024 00:00:00 GMT");
    }

    #[test]
    fn multiple_posts_in_rss() {
        let posts = vec![
            sample_post(),
            PostMetadata {
                slug: "second-post".to_string(),
                title: "Second Post".to_string(),
                date: "2024-02-01T12:00:00".to_string(),
                tags: vec!["rust".to_string()],
                categories: vec![],
                summary: "Another post".to_string(),
                available_languages: vec![],
                localized_meta: std::collections::HashMap::new(),
            },
        ];

        let xml = build_rss_xml(
            &posts,
            &sample_config(),
            "",
            "Mon, 01 Jan 2024 00:00:00 GMT",
        );

        assert_eq!(xml.matches("<item>").count(), 2);
        assert!(xml.contains("<title>Hello World</title>"));
        assert!(xml.contains("<title>Second Post</title>"));
    }

    #[test]
    fn base_path_normalization() {
        use crate::path_util::normalize_base_path_option;
        assert_eq!(normalize_base_path_option(Some("/")), "");
        assert_eq!(normalize_base_path_option(None), "");
        assert_eq!(normalize_base_path_option(Some("")), "");
        assert_eq!(normalize_base_path_option(Some("/blog/")), "/blog");
        assert_eq!(normalize_base_path_option(Some("/blog")), "/blog");
    }
}
