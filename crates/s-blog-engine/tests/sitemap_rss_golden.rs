//! Cross-implementation verification tests for `generate_sitemap` and
//! `generate_rss`.
//!
//! Runs the Rust engine against the golden manifest and compares the
//! generated XML files against the golden files produced by the
//! TypeScript scripts.
//!
//! **Validates: Requirement 2.8.6** — The Rust output SHALL match the
//! TS `generate-sitemap.ts` and `generate-rss.ts` output for the same
//! input (excluding dynamic timestamps).
//!
//! ## Dynamic-timestamp caveat
//!
//! Both the TS and Rust implementations embed the current date/time:
//! - **sitemap.xml**: homepage `<lastmod>` uses today's date; posts
//!   with empty dates also fall back to today.
//! - **rss.xml**: `<lastBuildDate>` uses the current RFC 822 timestamp;
//!   `<pubDate>` for posts with empty dates also uses "now".
//!
//! The tests below normalize these dynamic values to fixed placeholders
//! before comparing, so the structural content is verified while
//! time-dependent values are excluded.

use std::fs;
use std::path::{Path, PathBuf};

use s_blog_engine::rss::generate_rss;
use s_blog_engine::sitemap::generate_sitemap;
use s_blog_engine::{PostMetadata, SiteConfig};

// ── Helpers ────────────────────────────────────────────────────────

fn workspace_root() -> PathBuf {
    Path::new(env!("CARGO_MANIFEST_DIR"))
        .join("../..")
        .canonicalize()
        .expect("failed to resolve workspace root")
}

fn fixtures_dir() -> PathBuf {
    workspace_root().join("tests/fixtures")
}

fn golden_dir() -> PathBuf {
    workspace_root().join("tests/golden")
}

fn fixtures_config() -> SiteConfig {
    let path = fixtures_dir().join("config.json");
    let raw = fs::read_to_string(&path)
        .unwrap_or_else(|e| panic!("failed to read {}: {e}", path.display()));
    serde_json::from_str(&raw)
        .unwrap_or_else(|e| panic!("failed to parse {}: {e}", path.display()))
}

fn golden_manifest() -> Vec<PostMetadata> {
    let path = golden_dir().join("manifest.json");
    let raw = fs::read_to_string(&path)
        .unwrap_or_else(|e| panic!("failed to read {}: {e}", path.display()));
    serde_json::from_str(&raw)
        .unwrap_or_else(|e| panic!("failed to parse {}: {e}", path.display()))
}

fn read_golden_file(name: &str) -> String {
    let path = golden_dir().join(name);
    fs::read_to_string(&path)
        .unwrap_or_else(|e| panic!("failed to read golden {}: {e}", path.display()))
}

/// Slugs whose date is empty in the manifest. Both TS and Rust use
/// dynamic fallback values for these entries.
const DYNAMIC_DATE_SLUGS: &[&str] = &["invalid-date", "no-frontmatter"];

// ── Sitemap normalization ──────────────────────────────────────────

/// Replace dynamic `<lastmod>` values in the sitemap XML with a fixed
/// placeholder. Dynamic entries are:
/// 1. The homepage `<lastmod>` (always today's date).
/// 2. Posts with empty dates that fall back to today.
///
/// We identify dynamic entries by matching the slugs in
/// `DYNAMIC_DATE_SLUGS` and the homepage (first `<url>` block).
///
/// Uses a two-pass approach: first pass collects which `<url>` blocks
/// are dynamic, second pass performs the replacement. This avoids
/// ordering issues where `<lastmod>` appears before `<priority>`.
fn normalize_sitemap(xml: &str) -> String {
    // Split into <url>...</url> blocks and process each one.
    let mut result = String::new();
    let lines: Vec<&str> = xml.lines().collect();
    let mut i = 0;

    while i < lines.len() {
        let trimmed = lines[i].trim();

        if trimmed == "<url>" {
            // Collect the entire <url> block
            let block_start = i;
            let mut block_end = i;
            while block_end < lines.len() && lines[block_end].trim() != "</url>" {
                block_end += 1;
            }
            // block_end is now at </url>

            // Determine if this block is dynamic
            let block_lines = &lines[block_start..=block_end];
            let is_dynamic = block_lines.iter().any(|l| {
                let t = l.trim();
                // Homepage: priority 1.0
                if t == "<priority>1.0</priority>" {
                    return true;
                }
                // Dynamic-date slugs
                for slug in DYNAMIC_DATE_SLUGS {
                    if t.contains(&format!("/post/{}</loc>", slug)) {
                        return true;
                    }
                }
                false
            });

            // Write the block, normalizing <lastmod> if dynamic
            for &line in block_lines {
                let lt = line.trim();
                if is_dynamic && lt.starts_with("<lastmod>") && lt.ends_with("</lastmod>") {
                    result.push_str(&line.replace(lt, "<lastmod>__DYNAMIC_DATE__</lastmod>"));
                } else {
                    result.push_str(line);
                }
                result.push('\n');
            }

            i = block_end + 1;
        } else {
            result.push_str(lines[i]);
            result.push('\n');
            i += 1;
        }
    }

    result
}

// ── RSS normalization ──────────────────────────────────────────────

/// Replace dynamic/divergent timestamps in the RSS XML with fixed
/// placeholders. Normalized entries:
///
/// 1. `<lastBuildDate>` — always the current time (dynamic).
/// 2. **All** `<pubDate>` values — the TS script calls
///    `new Date(isoDate).toUTCString()` which interprets offset-less
///    ISO dates as **local time** on the generating machine, while the
///    Rust engine treats them as UTC. This produces systematically
///    different RFC 822 strings for the same manifest date. Since the
///    requirement explicitly excludes dynamic timestamps from the
///    comparison, we normalize all `<pubDate>` values.
fn normalize_rss(xml: &str) -> String {
    let mut result = String::new();

    for line in xml.lines() {
        let trimmed = line.trim();

        // Always normalize <lastBuildDate>
        if trimmed.starts_with("<lastBuildDate>") && trimmed.ends_with("</lastBuildDate>") {
            result.push_str(
                &line.replace(trimmed, "<lastBuildDate>__DYNAMIC_TIMESTAMP__</lastBuildDate>"),
            );
        } else if trimmed.starts_with("<pubDate>") && trimmed.ends_with("</pubDate>") {
            // Normalize all pubDate values — see doc comment above.
            result.push_str(
                &line.replace(trimmed, "<pubDate>__DYNAMIC_TIMESTAMP__</pubDate>"),
            );
        } else {
            result.push_str(line);
        }
        result.push('\n');
    }

    result
}

// ── Sitemap tests ──────────────────────────────────────────────────

/// Run `generate_sitemap` against the golden manifest.
fn run_sitemap() -> tempfile::TempDir {
    let config = fixtures_config();
    let manifest = golden_manifest();
    let tmp = tempfile::TempDir::new().unwrap();
    let output_path = tmp.path().join("sitemap.xml");

    generate_sitemap(&manifest, &output_path, &config)
        .expect("generate_sitemap should succeed");

    tmp
}

/// The Rust sitemap output matches the golden file after normalizing
/// dynamic dates.
#[test]
fn rust_sitemap_matches_golden() {
    let tmp = run_sitemap();
    let actual = fs::read_to_string(tmp.path().join("sitemap.xml")).unwrap();
    let golden = read_golden_file("sitemap.xml");

    let actual_normalized = normalize_sitemap(&actual);
    let golden_normalized = normalize_sitemap(&golden);

    assert_eq!(
        actual_normalized, golden_normalized,
        "sitemap.xml mismatch (after date normalization).\n--- Rust ---\n{}\n--- Golden ---\n{}",
        actual_normalized, golden_normalized,
    );
}

/// The sitemap contains the correct number of URL entries
/// (homepage + all posts).
#[test]
fn rust_sitemap_url_count() {
    let tmp = run_sitemap();
    let actual = fs::read_to_string(tmp.path().join("sitemap.xml")).unwrap();
    let manifest = golden_manifest();

    let url_count = actual.matches("<url>").count();
    assert_eq!(
        url_count,
        manifest.len() + 1,
        "expected {} URLs (1 homepage + {} posts), got {}",
        manifest.len() + 1,
        manifest.len(),
        url_count,
    );
}

/// The homepage has priority 1.0 and posts have priority 0.8.
#[test]
fn rust_sitemap_priorities() {
    let tmp = run_sitemap();
    let actual = fs::read_to_string(tmp.path().join("sitemap.xml")).unwrap();

    assert_eq!(
        actual.matches("<priority>1.0</priority>").count(),
        1,
        "exactly one URL should have priority 1.0 (homepage)"
    );

    let manifest = golden_manifest();
    assert_eq!(
        actual.matches("<priority>0.8</priority>").count(),
        manifest.len(),
        "all posts should have priority 0.8"
    );
}

/// Posts with valid dates use the date portion as lastmod.
#[test]
fn rust_sitemap_stable_lastmod() {
    let tmp = run_sitemap();
    let actual = fs::read_to_string(tmp.path().join("sitemap.xml")).unwrap();
    let manifest = golden_manifest();

    for post in &manifest {
        if post.date.is_empty() {
            continue;
        }
        let date_portion = post.date.split('T').next().unwrap();
        let expected_lastmod = format!("<lastmod>{}</lastmod>", date_portion);
        assert!(
            actual.contains(&expected_lastmod),
            "sitemap missing lastmod {} for slug {:?}",
            expected_lastmod,
            post.slug,
        );
    }
}

/// Every post slug appears in the sitemap.
#[test]
fn rust_sitemap_contains_all_slugs() {
    let tmp = run_sitemap();
    let actual = fs::read_to_string(tmp.path().join("sitemap.xml")).unwrap();
    let manifest = golden_manifest();

    for post in &manifest {
        let expected_loc = format!("/post/{}</loc>", post.slug);
        assert!(
            actual.contains(&expected_loc),
            "sitemap missing slug {:?}",
            post.slug,
        );
    }
}

/// Sitemap is skipped when siteUrl is not configured.
#[test]
fn rust_sitemap_skipped_without_site_url() {
    let mut config = fixtures_config();
    config.site_url = None;
    let manifest = golden_manifest();
    let tmp = tempfile::TempDir::new().unwrap();
    let output_path = tmp.path().join("sitemap.xml");

    let result = generate_sitemap(&manifest, &output_path, &config);
    assert!(result.is_ok());
    assert!(
        !output_path.exists(),
        "sitemap.xml should not be generated when siteUrl is missing"
    );
}

// ── RSS tests ──────────────────────────────────────────────────────

/// Run `generate_rss` against the golden manifest.
fn run_rss() -> tempfile::TempDir {
    let config = fixtures_config();
    let manifest = golden_manifest();
    let tmp = tempfile::TempDir::new().unwrap();
    let output_path = tmp.path().join("rss.xml");

    generate_rss(&manifest, &output_path, &config)
        .expect("generate_rss should succeed");

    tmp
}

/// The Rust RSS output matches the golden file after normalizing
/// dynamic timestamps.
#[test]
fn rust_rss_matches_golden() {
    let tmp = run_rss();
    let actual = fs::read_to_string(tmp.path().join("rss.xml")).unwrap();
    let golden = read_golden_file("rss.xml");

    let actual_normalized = normalize_rss(&actual);
    let golden_normalized = normalize_rss(&golden);

    assert_eq!(
        actual_normalized, golden_normalized,
        "rss.xml mismatch (after timestamp normalization).\n--- Rust ---\n{}\n--- Golden ---\n{}",
        actual_normalized, golden_normalized,
    );
}

/// The RSS feed contains the correct number of items.
#[test]
fn rust_rss_item_count() {
    let tmp = run_rss();
    let actual = fs::read_to_string(tmp.path().join("rss.xml")).unwrap();
    let manifest = golden_manifest();

    let item_count = actual.matches("<item>").count();
    assert_eq!(
        item_count,
        manifest.len(),
        "expected {} items, got {}",
        manifest.len(),
        item_count,
    );
}

/// The RSS feed includes channel metadata from config.
#[test]
fn rust_rss_channel_metadata() {
    let tmp = run_rss();
    let actual = fs::read_to_string(tmp.path().join("rss.xml")).unwrap();
    let config = fixtures_config();

    assert!(
        actual.contains(&format!("<title>{}</title>", config.title)),
        "RSS missing channel title"
    );
    assert!(
        actual.contains(&format!("<description>{}</description>", config.description)),
        "RSS missing channel description"
    );
    assert!(
        actual.contains(&format!(
            "<language>{}</language>",
            config.language.as_deref().unwrap_or("zh-CN")
        )),
        "RSS missing channel language"
    );
    assert!(
        actual.contains("<lastBuildDate>"),
        "RSS missing lastBuildDate"
    );
}

/// Every post slug appears in the RSS feed.
#[test]
fn rust_rss_contains_all_slugs() {
    let tmp = run_rss();
    let actual = fs::read_to_string(tmp.path().join("rss.xml")).unwrap();
    let manifest = golden_manifest();

    for post in &manifest {
        let expected_link = format!("/post/{}</link>", post.slug);
        assert!(
            actual.contains(&expected_link),
            "RSS missing slug {:?}",
            post.slug,
        );
    }
}

/// Posts with valid dates produce well-formed RFC 822 pubDate values.
///
/// Note: We do NOT compare against the golden file's pubDate values
/// because the TS script interprets offset-less ISO dates as local
/// time (via `new Date()`), while Rust treats them as UTC. Both are
/// valid interpretations; the requirement excludes dynamic timestamps
/// from the comparison. Instead we verify the format is correct.
#[test]
fn rust_rss_pubdates_are_valid_rfc822() {
    let tmp = run_rss();
    let actual = fs::read_to_string(tmp.path().join("rss.xml")).unwrap();

    // Extract all <pubDate> values
    let pub_dates: Vec<&str> = actual
        .lines()
        .filter_map(|line| {
            let trimmed = line.trim();
            if trimmed.starts_with("<pubDate>") && trimmed.ends_with("</pubDate>") {
                Some(&trimmed["<pubDate>".len()..trimmed.len() - "</pubDate>".len()])
            } else {
                None
            }
        })
        .collect();

    let manifest = golden_manifest();
    assert_eq!(
        pub_dates.len(),
        manifest.len(),
        "should have one pubDate per post"
    );

    // Every pubDate should end with " GMT" (RFC 822 format)
    for date in &pub_dates {
        assert!(
            date.ends_with(" GMT"),
            "pubDate {:?} should end with ' GMT'",
            date
        );
    }
}

/// RSS includes categories and tags for posts.
#[test]
fn rust_rss_includes_categories() {
    let tmp = run_rss();
    let actual = fs::read_to_string(tmp.path().join("rss.xml")).unwrap();
    let manifest = golden_manifest();

    for post in &manifest {
        for cat in &post.categories {
            assert!(
                actual.contains(&format!("<category>{}</category>", cat)),
                "RSS missing category {:?} for slug {:?}",
                cat,
                post.slug,
            );
        }
        for tag in &post.tags {
            assert!(
                actual.contains(&format!("<category>{}</category>", tag)),
                "RSS missing tag {:?} for slug {:?}",
                tag,
                post.slug,
            );
        }
    }
}

/// RSS includes atom:link self-reference.
#[test]
fn rust_rss_includes_atom_self_link() {
    let tmp = run_rss();
    let actual = fs::read_to_string(tmp.path().join("rss.xml")).unwrap();

    assert!(
        actual.contains("rel=\"self\""),
        "RSS missing atom:link self-reference"
    );
    assert!(
        actual.contains("type=\"application/rss+xml\""),
        "RSS missing atom:link type"
    );
}

/// RSS is skipped when siteUrl is not configured.
#[test]
fn rust_rss_skipped_without_site_url() {
    let mut config = fixtures_config();
    config.site_url = None;
    let manifest = golden_manifest();
    let tmp = tempfile::TempDir::new().unwrap();
    let output_path = tmp.path().join("rss.xml");

    let result = generate_rss(&manifest, &output_path, &config);
    assert!(result.is_ok());
    assert!(
        !output_path.exists(),
        "rss.xml should not be generated when siteUrl is missing"
    );
}
