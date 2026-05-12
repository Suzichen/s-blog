//! Property-based tests for feed generation (Property 9).
//!
//! **Property 9 – Feed Completeness**
//!
//! *For any* set of posts, the generated `sitemap.xml` SHALL include
//! the homepage URL (priority 1.0) and all post URLs (priority 0.8).
//! The generated `rss.xml` SHALL include channel metadata and item
//! entries for all posts.
//!
//! **Validates: Requirements 2.8.2, 2.8.4**

use std::collections::HashSet;
use std::fs;

use proptest::prelude::*;
use tempfile::TempDir;

use s_blog_engine::rss::generate_rss;
use s_blog_engine::sitemap::generate_sitemap;
use s_blog_engine::{PostMetadata, SiteConfig};

// ── Strategies ─────────────────────────────────────────────────────

/// Generate a valid slug (lowercase alphanumeric + hyphens, non-empty).
fn slug_strategy() -> impl Strategy<Value = String> {
    "[a-z][a-z0-9\\-]{0,15}[a-z0-9]"
}

/// Generate a simple title (alphanumeric + spaces, no XML-special chars).
fn title_strategy() -> impl Strategy<Value = String> {
    "[A-Za-z][A-Za-z0-9 ]{2,30}"
}

/// Generate a valid ISO-ish date string.
fn date_strategy() -> impl Strategy<Value = String> {
    (2000..2030i32, 1..=12u32, 1..=28u32, 0..=23u32, 0..=59u32, 0..=59u32)
        .prop_map(|(y, mo, d, h, mi, s)| {
            format!("{:04}-{:02}-{:02}T{:02}:{:02}:{:02}", y, mo, d, h, mi, s)
        })
}

/// Generate a simple tag (lowercase alpha).
fn tag_strategy() -> impl Strategy<Value = String> {
    "[a-z]{2,10}"
}

/// Generate a list of 0-4 tags.
fn tags_strategy() -> impl Strategy<Value = Vec<String>> {
    prop::collection::vec(tag_strategy(), 0..=4)
}

/// Generate a category string.
fn category_strategy() -> impl Strategy<Value = String> {
    "[A-Z][a-z]{2,10}"
}

/// Generate a list of 0-3 categories.
fn categories_strategy() -> impl Strategy<Value = Vec<String>> {
    prop::collection::vec(category_strategy(), 0..=3)
}

/// Generate a simple summary (no XML-special chars).
fn summary_strategy() -> impl Strategy<Value = String> {
    "[A-Za-z][A-Za-z0-9 ]{5,40}"
}

/// A generated post for property testing.
#[derive(Debug, Clone)]
struct GenPost {
    slug: String,
    title: String,
    date: String,
    tags: Vec<String>,
    categories: Vec<String>,
    summary: String,
}

fn post_strategy() -> impl Strategy<Value = GenPost> {
    (
        slug_strategy(),
        title_strategy(),
        date_strategy(),
        tags_strategy(),
        categories_strategy(),
        summary_strategy(),
    )
        .prop_map(|(slug, title, date, tags, categories, summary)| GenPost {
            slug,
            title,
            date,
            tags,
            categories,
            summary,
        })
}

/// Strategy for 1-5 posts with unique slugs.
fn posts_strategy() -> impl Strategy<Value = Vec<GenPost>> {
    prop::collection::vec(post_strategy(), 1..=5).prop_map(|mut posts| {
        let mut seen = HashSet::new();
        for (i, p) in posts.iter_mut().enumerate() {
            if !seen.insert(p.slug.clone()) {
                p.slug = format!("{}-{}", p.slug, i);
            }
        }
        posts
    })
}

/// Strategy for 0-5 posts (including empty) with unique slugs.
fn posts_strategy_with_empty() -> impl Strategy<Value = Vec<GenPost>> {
    prop::collection::vec(post_strategy(), 0..=5).prop_map(|mut posts| {
        let mut seen = HashSet::new();
        for (i, p) in posts.iter_mut().enumerate() {
            if !seen.insert(p.slug.clone()) {
                p.slug = format!("{}-{}", p.slug, i);
            }
        }
        posts
    })
}

// ── Helpers ────────────────────────────────────────────────────────

fn default_config() -> SiteConfig {
    SiteConfig {
        title: "Test Blog".into(),
        description: "A test blog".into(),
        logo: "/logo.png".into(),
        favicon: "/favicon.ico".into(),
        site_url: Some("https://example.com".into()),
        author: Some("TestAuthor".into()),
        language: Some("en".into()),
        timezone: None,
        base_path: Some("/".into()),
    }
}

fn to_metadata(p: &GenPost) -> PostMetadata {
    PostMetadata {
        slug: p.slug.clone(),
        title: p.title.clone(),
        date: p.date.clone(),
        tags: p.tags.clone(),
        categories: p.categories.clone(),
        summary: p.summary.clone(),
        available_languages: vec![],
        localized_meta: std::collections::HashMap::new(),
    }
}

fn gen_sitemap(posts: &[GenPost], config: &SiteConfig) -> (TempDir, String) {
    let tmp = TempDir::new().unwrap();
    let output = tmp.path().join("sitemap.xml");
    let manifest: Vec<PostMetadata> = posts.iter().map(to_metadata).collect();
    generate_sitemap(&manifest, &output, config).unwrap();
    let content = fs::read_to_string(&output).unwrap();
    (tmp, content)
}

fn gen_rss(posts: &[GenPost], config: &SiteConfig) -> (TempDir, String) {
    let tmp = TempDir::new().unwrap();
    let output = tmp.path().join("rss.xml");
    let manifest: Vec<PostMetadata> = posts.iter().map(to_metadata).collect();
    generate_rss(&manifest, &output, config).unwrap();
    let content = fs::read_to_string(&output).unwrap();
    (tmp, content)
}

// ── Property Tests: Sitemap ─────────────────────────────────────────

proptest! {
    #![proptest_config(ProptestConfig::with_cases(50))]

    // ── P9.1: Sitemap contains homepage with priority 1.0 ─────────
    //
    // For any set of posts, the sitemap must always include the
    // homepage URL with priority 1.0.
    #[test]
    fn sitemap_contains_homepage(posts in posts_strategy_with_empty()) {
        let config = default_config();
        let (_tmp, xml) = gen_sitemap(&posts, &config);

        prop_assert!(
            xml.contains("<loc>https://example.com/</loc>"),
            "sitemap must contain homepage URL"
        );
        // Homepage priority must be 1.0
        // Find the homepage <url> block and check priority
        let homepage_block_end = xml.find("https://example.com/</loc>")
            .expect("homepage loc must exist");
        let after_homepage = &xml[homepage_block_end..];
        let next_url_end = after_homepage.find("</url>").unwrap();
        let homepage_section = &after_homepage[..next_url_end];
        prop_assert!(
            homepage_section.contains("<priority>1.0</priority>"),
            "homepage must have priority 1.0"
        );
    }

    // ── P9.2: Sitemap contains all post URLs with priority 0.8 ────
    //
    // For every post in the manifest, the sitemap must include a URL
    // entry with priority 0.8.
    #[test]
    fn sitemap_contains_all_posts(posts in posts_strategy()) {
        let config = default_config();
        let (_tmp, xml) = gen_sitemap(&posts, &config);

        for p in &posts {
            let expected_loc = format!(
                "<loc>https://example.com/post/{}</loc>",
                p.slug
            );
            prop_assert!(
                xml.contains(&expected_loc),
                "sitemap must contain URL for slug {:?}",
                p.slug
            );
        }

        // Count <priority>0.8</priority> occurrences — must equal post count
        let count_08 = xml.matches("<priority>0.8</priority>").count();
        prop_assert_eq!(
            count_08,
            posts.len(),
            "number of priority 0.8 entries must equal post count"
        );
    }

    // ── P9.3: Sitemap URL count = 1 (homepage) + N (posts) ────────
    //
    // The total number of <url> blocks must be exactly 1 + post count.
    #[test]
    fn sitemap_url_count(posts in posts_strategy_with_empty()) {
        let config = default_config();
        let (_tmp, xml) = gen_sitemap(&posts, &config);

        let url_count = xml.matches("<url>").count();
        prop_assert_eq!(
            url_count,
            1 + posts.len(),
            "sitemap must have 1 homepage + {} post URLs, got {}",
            posts.len(),
            url_count
        );
    }

    // ── P9.4: Sitemap is well-formed XML ───────────────────────────
    //
    // The sitemap must start with the XML declaration and contain the
    // proper urlset namespace.
    #[test]
    fn sitemap_well_formed(posts in posts_strategy_with_empty()) {
        let config = default_config();
        let (_tmp, xml) = gen_sitemap(&posts, &config);

        prop_assert!(
            xml.starts_with("<?xml version=\"1.0\" encoding=\"UTF-8\"?>"),
            "sitemap must start with XML declaration"
        );
        prop_assert!(
            xml.contains("<urlset xmlns=\"http://www.sitemaps.org/schemas/sitemap/0.9\">"),
            "sitemap must contain urlset namespace"
        );
        prop_assert!(
            xml.ends_with("</urlset>"),
            "sitemap must end with </urlset>"
        );
    }

    // ── P9.5: Each post URL has a lastmod date ─────────────────────
    //
    // Every post entry in the sitemap must have a <lastmod> element.
    #[test]
    fn sitemap_posts_have_lastmod(posts in posts_strategy()) {
        let config = default_config();
        let (_tmp, xml) = gen_sitemap(&posts, &config);

        // Total <lastmod> count = 1 (homepage) + N (posts)
        let lastmod_count = xml.matches("<lastmod>").count();
        prop_assert_eq!(
            lastmod_count,
            1 + posts.len(),
            "every URL entry must have a lastmod"
        );
    }
}

// ── Property Tests: RSS ─────────────────────────────────────────────

proptest! {
    #![proptest_config(ProptestConfig::with_cases(50))]

    // ── P9.6: RSS contains channel metadata ────────────────────────
    //
    // For any set of posts, the RSS feed must include channel-level
    // title, description, link, and language.
    #[test]
    fn rss_contains_channel_metadata(posts in posts_strategy_with_empty()) {
        let config = default_config();
        let (_tmp, xml) = gen_rss(&posts, &config);

        prop_assert!(
            xml.contains("<title>Test Blog</title>"),
            "RSS must contain channel title"
        );
        prop_assert!(
            xml.contains("<description>A test blog</description>"),
            "RSS must contain channel description"
        );
        prop_assert!(
            xml.contains("<link>https://example.com/</link>"),
            "RSS must contain channel link"
        );
        prop_assert!(
            xml.contains("<language>en</language>"),
            "RSS must contain channel language"
        );
        prop_assert!(
            xml.contains("<lastBuildDate>"),
            "RSS must contain lastBuildDate"
        );
    }

    // ── P9.7: RSS contains one item per post ───────────────────────
    //
    // The number of <item> blocks must equal the number of posts.
    #[test]
    fn rss_item_count(posts in posts_strategy_with_empty()) {
        let config = default_config();
        let (_tmp, xml) = gen_rss(&posts, &config);

        let item_count = xml.matches("<item>").count();
        prop_assert_eq!(
            item_count,
            posts.len(),
            "RSS must have exactly {} items, got {}",
            posts.len(),
            item_count
        );
    }

    // ── P9.8: RSS items contain required fields ────────────────────
    //
    // Each RSS item must include title, description, link, guid, and
    // pubDate elements.
    #[test]
    fn rss_items_have_required_fields(posts in posts_strategy()) {
        let config = default_config();
        let (_tmp, xml) = gen_rss(&posts, &config);

        for p in &posts {
            let expected_title = format!("<title>{}</title>", p.title);
            prop_assert!(
                xml.contains(&expected_title),
                "RSS must contain title for slug {:?}",
                p.slug
            );

            let expected_desc = format!("<description>{}</description>", p.summary);
            prop_assert!(
                xml.contains(&expected_desc),
                "RSS must contain description for slug {:?}",
                p.slug
            );

            let expected_link = format!(
                "<link>https://example.com/post/{}</link>",
                p.slug
            );
            prop_assert!(
                xml.contains(&expected_link),
                "RSS must contain link for slug {:?}",
                p.slug
            );

            let expected_guid = format!(
                "<guid isPermaLink=\"true\">https://example.com/post/{}</guid>",
                p.slug
            );
            prop_assert!(
                xml.contains(&expected_guid),
                "RSS must contain guid for slug {:?}",
                p.slug
            );
        }

        // Every item must have a pubDate
        let pubdate_count = xml.matches("<pubDate>").count();
        prop_assert_eq!(
            pubdate_count,
            posts.len(),
            "every RSS item must have a pubDate"
        );
    }

    // ── P9.9: RSS items include categories and tags ────────────────
    //
    // Each RSS item must include <category> elements for all of the
    // post's categories and tags.
    #[test]
    fn rss_items_include_categories_and_tags(posts in posts_strategy()) {
        let config = default_config();
        let (_tmp, xml) = gen_rss(&posts, &config);

        for p in &posts {
            for cat in &p.categories {
                let expected = format!("<category>{}</category>", cat);
                prop_assert!(
                    xml.contains(&expected),
                    "RSS must contain category {:?} for slug {:?}",
                    cat,
                    p.slug
                );
            }
            for tag in &p.tags {
                let expected = format!("<category>{}</category>", tag);
                prop_assert!(
                    xml.contains(&expected),
                    "RSS must contain tag {:?} as category for slug {:?}",
                    tag,
                    p.slug
                );
            }
        }
    }

    // ── P9.10: RSS includes author when configured ─────────────────
    //
    // When author is set in config, every item must have an <author>
    // element.
    #[test]
    fn rss_items_include_author(posts in posts_strategy()) {
        let config = default_config();
        let (_tmp, xml) = gen_rss(&posts, &config);

        let author_count = xml.matches("<author>TestAuthor</author>").count();
        prop_assert_eq!(
            author_count,
            posts.len(),
            "every RSS item must have author when configured"
        );
    }

    // ── P9.11: RSS is well-formed XML ──────────────────────────────
    //
    // The RSS feed must start with the XML declaration and contain
    // proper RSS 2.0 structure.
    #[test]
    fn rss_well_formed(posts in posts_strategy_with_empty()) {
        let config = default_config();
        let (_tmp, xml) = gen_rss(&posts, &config);

        prop_assert!(
            xml.starts_with("<?xml version=\"1.0\" encoding=\"UTF-8\"?>"),
            "RSS must start with XML declaration"
        );
        prop_assert!(
            xml.contains("<rss version=\"2.0\""),
            "RSS must contain rss version 2.0"
        );
        prop_assert!(
            xml.contains("<channel>"),
            "RSS must contain channel element"
        );
        prop_assert!(
            xml.ends_with("</rss>"),
            "RSS must end with </rss>"
        );
    }

    // ── P9.12: RSS includes atom self-link ─────────────────────────
    //
    // When siteUrl is configured, the RSS must include an atom:link
    // self-reference.
    #[test]
    fn rss_includes_atom_self_link(posts in posts_strategy_with_empty()) {
        let config = default_config();
        let (_tmp, xml) = gen_rss(&posts, &config);

        prop_assert!(
            xml.contains("rel=\"self\" type=\"application/rss+xml\""),
            "RSS must contain atom self-link"
        );
        prop_assert!(
            xml.contains("href=\"https://example.com/rss.xml\""),
            "atom self-link must point to rss.xml"
        );
    }
}

// ── Edge-case: no siteUrl skips generation ─────────────────────────

#[test]
fn no_site_url_skips_sitemap() {
    let tmp = TempDir::new().unwrap();
    let output = tmp.path().join("sitemap.xml");
    let mut config = default_config();
    config.site_url = None;

    let manifest = vec![PostMetadata {
        slug: "test".into(),
        title: "Test".into(),
        date: "2024-01-01T00:00:00".into(),
        tags: vec![],
        categories: vec![],
        summary: "A test".into(),
        available_languages: vec![],
        localized_meta: std::collections::HashMap::new(),
    }];

    generate_sitemap(&manifest, &output, &config).unwrap();
    assert!(!output.exists(), "sitemap must not be generated without siteUrl");
}

#[test]
fn no_site_url_skips_rss() {
    let tmp = TempDir::new().unwrap();
    let output = tmp.path().join("rss.xml");
    let mut config = default_config();
    config.site_url = None;

    let manifest = vec![PostMetadata {
        slug: "test".into(),
        title: "Test".into(),
        date: "2024-01-01T00:00:00".into(),
        tags: vec![],
        categories: vec![],
        summary: "A test".into(),
        available_languages: vec![],
        localized_meta: std::collections::HashMap::new(),
    }];

    generate_rss(&manifest, &output, &config).unwrap();
    assert!(!output.exists(), "RSS must not be generated without siteUrl");
}

// ── Edge-case: empty manifest ──────────────────────────────────────

#[test]
fn empty_manifest_sitemap_has_homepage_only() {
    let tmp = TempDir::new().unwrap();
    let output = tmp.path().join("sitemap.xml");
    let config = default_config();

    generate_sitemap(&[], &output, &config).unwrap();
    let xml = fs::read_to_string(&output).unwrap();

    assert_eq!(xml.matches("<url>").count(), 1, "only homepage URL expected");
    assert!(xml.contains("<priority>1.0</priority>"));
    assert!(!xml.contains("<priority>0.8</priority>"));
}

#[test]
fn empty_manifest_rss_has_no_items() {
    let tmp = TempDir::new().unwrap();
    let output = tmp.path().join("rss.xml");
    let config = default_config();

    generate_rss(&[], &output, &config).unwrap();
    let xml = fs::read_to_string(&output).unwrap();

    assert_eq!(xml.matches("<item>").count(), 0, "no items expected");
    assert!(xml.contains("<channel>"), "channel metadata must still be present");
    assert!(xml.contains("<title>Test Blog</title>"));
}
