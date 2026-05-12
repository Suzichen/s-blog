//! Property-based tests for SEO page generation (Property 8).
//!
//! **Property 8 – SEO Page Completeness**
//!
//! *For any* post in the manifest, the generated SEO HTML page SHALL
//! include: title tag, meta description, meta keywords, canonical link,
//! Open Graph tags (`og:title`, `og:description`, `og:url`, `og:type`),
//! Twitter Card tags, and JSON-LD Article schema.
//!
//! **Validates: Requirements 2.7.1, 2.7.2, 2.7.3, 2.7.4, 2.7.5**

use std::collections::HashSet;
use std::fs;

use proptest::prelude::*;
use tempfile::TempDir;

use s_blog_engine::seo::generate_seo_pages;
use s_blog_engine::{PostMetadata, SiteConfig};

// ── Strategies ─────────────────────────────────────────────────────

/// Generate a valid slug (lowercase alphanumeric + hyphens, non-empty).
fn slug_strategy() -> impl Strategy<Value = String> {
    "[a-z][a-z0-9\\-]{0,15}[a-z0-9]"
}

/// Generate a simple title (alphanumeric + spaces, no special HTML chars
/// to keep assertions straightforward).
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

/// Generate a list of 1-4 tags (at least one so keywords meta is present).
fn tags_strategy() -> impl Strategy<Value = Vec<String>> {
    prop::collection::vec(tag_strategy(), 1..=4)
}

/// Generate a category string.
fn category_strategy() -> impl Strategy<Value = String> {
    "[A-Z][a-z]{2,10}"
}

/// Generate a list of 0-3 categories.
fn categories_strategy() -> impl Strategy<Value = Vec<String>> {
    prop::collection::vec(category_strategy(), 0..=3)
}

/// Generate a simple summary (no special HTML chars).
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

fn minimal_template() -> String {
    r#"<!DOCTYPE html>
<html>
<head>
  <title>App Shell</title>
  <link rel="icon" href="./favicon.ico">
  <script type="module" src="./assets/index.js"></script>
  <link rel="stylesheet" href="./assets/index.css">
</head>
<body>
  <div id="root"></div>
</body>
</html>"#
        .to_string()
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

/// Run generate_seo_pages and return the generated HTML for each slug.
fn run_seo(posts: &[GenPost], config: &SiteConfig) -> (TempDir, Vec<PostMetadata>) {
    let tmp = TempDir::new().unwrap();
    let template_path = tmp.path().join("index.html");
    fs::write(&template_path, minimal_template()).unwrap();

    let output_dir = tmp.path().join("dist");
    let manifest: Vec<PostMetadata> = posts.iter().map(to_metadata).collect();

    generate_seo_pages(&manifest, &template_path, &output_dir, config).unwrap();

    (tmp, manifest)
}

fn read_seo_html(tmp: &TempDir, slug: &str) -> String {
    let path = tmp.path().join(format!("dist/post/{}/index.html", slug));
    fs::read_to_string(path).expect("SEO page should exist")
}

// ── Property Tests ─────────────────────────────────────────────────

proptest! {
    #![proptest_config(ProptestConfig::with_cases(50))]

    // ── P8.1: One SEO page per post ────────────────────────────────
    //
    // For every post in the manifest, a corresponding
    // dist/post/{slug}/index.html must be generated.
    #[test]
    fn one_page_per_post(posts in posts_strategy()) {
        let config = default_config();
        let (tmp, manifest) = run_seo(&posts, &config);

        for post in &manifest {
            let page_path = tmp.path().join(format!("dist/post/{}/index.html", post.slug));
            prop_assert!(
                page_path.exists(),
                "SEO page must exist for slug {:?}",
                post.slug
            );
        }
    }

    // ── P8.2: Title tag present ────────────────────────────────────
    //
    // Each generated page must contain a <title> tag with the post title.
    #[test]
    fn title_tag_present(posts in posts_strategy()) {
        let config = default_config();
        let (tmp, _) = run_seo(&posts, &config);

        for p in &posts {
            let html = read_seo_html(&tmp, &p.slug);
            prop_assert!(
                html.contains(&format!("<title>{}</title>", p.title)),
                "page for {:?} must contain <title>{}</title>",
                p.slug,
                p.title
            );
        }
    }

    // ── P8.3: Meta description present ─────────────────────────────
    //
    // Each page must have a <meta name="description"> with the summary.
    #[test]
    fn meta_description_present(posts in posts_strategy()) {
        let config = default_config();
        let (tmp, _) = run_seo(&posts, &config);

        for p in &posts {
            let html = read_seo_html(&tmp, &p.slug);
            prop_assert!(
                html.contains(&format!("name=\"description\" content=\"{}\"", p.summary)),
                "page for {:?} must contain meta description",
                p.slug
            );
        }
    }

    // ── P8.4: Meta keywords present ────────────────────────────────
    //
    // Each page must have a <meta name="keywords"> containing all tags
    // and categories.
    #[test]
    fn meta_keywords_present(posts in posts_strategy()) {
        let config = default_config();
        let (tmp, _) = run_seo(&posts, &config);

        for p in &posts {
            let html = read_seo_html(&tmp, &p.slug);
            let keywords: String = p
                .tags
                .iter()
                .chain(p.categories.iter())
                .cloned()
                .collect::<Vec<_>>()
                .join(", ");
            prop_assert!(
                html.contains(&format!("name=\"keywords\" content=\"{}\"", keywords)),
                "page for {:?} must contain meta keywords: {}",
                p.slug,
                keywords
            );
        }
    }

    // ── P8.5: Canonical link present ───────────────────────────────
    //
    // When siteUrl is configured, each page must have a canonical link
    // containing the post slug.
    #[test]
    fn canonical_link_present(posts in posts_strategy()) {
        let config = default_config();
        let (tmp, _) = run_seo(&posts, &config);

        for p in &posts {
            let html = read_seo_html(&tmp, &p.slug);
            let expected_url = format!(
                "https://example.com/post/{}/",
                p.slug
            );
            prop_assert!(
                html.contains(&format!("rel=\"canonical\" href=\"{}\"", expected_url)),
                "page for {:?} must contain canonical link",
                p.slug
            );
        }
    }

    // ── P8.6: Open Graph tags present ──────────────────────────────
    //
    // When siteUrl is configured, each page must include og:type,
    // og:url, og:title, and og:description.
    #[test]
    fn open_graph_tags_present(posts in posts_strategy()) {
        let config = default_config();
        let (tmp, _) = run_seo(&posts, &config);

        for p in &posts {
            let html = read_seo_html(&tmp, &p.slug);

            prop_assert!(
                html.contains("property=\"og:type\" content=\"article\""),
                "page for {:?} must contain og:type",
                p.slug
            );
            prop_assert!(
                html.contains(&format!(
                    "property=\"og:url\" content=\"https://example.com/post/{}/\"",
                    p.slug
                )),
                "page for {:?} must contain og:url",
                p.slug
            );
            prop_assert!(
                html.contains(&format!(
                    "property=\"og:title\" content=\"{}\"",
                    p.title
                )),
                "page for {:?} must contain og:title",
                p.slug
            );
            prop_assert!(
                html.contains(&format!(
                    "property=\"og:description\" content=\"{}\"",
                    p.summary
                )),
                "page for {:?} must contain og:description",
                p.slug
            );
        }
    }

    // ── P8.7: Twitter Card tags present ────────────────────────────
    //
    // When siteUrl is configured, each page must include twitter:card,
    // twitter:url, twitter:title, and twitter:description.
    #[test]
    fn twitter_card_tags_present(posts in posts_strategy()) {
        let config = default_config();
        let (tmp, _) = run_seo(&posts, &config);

        for p in &posts {
            let html = read_seo_html(&tmp, &p.slug);

            prop_assert!(
                html.contains("name=\"twitter:card\" content=\"summary\""),
                "page for {:?} must contain twitter:card",
                p.slug
            );
            prop_assert!(
                html.contains(&format!(
                    "name=\"twitter:url\" content=\"https://example.com/post/{}/\"",
                    p.slug
                )),
                "page for {:?} must contain twitter:url",
                p.slug
            );
            prop_assert!(
                html.contains(&format!(
                    "name=\"twitter:title\" content=\"{}\"",
                    p.title
                )),
                "page for {:?} must contain twitter:title",
                p.slug
            );
            prop_assert!(
                html.contains(&format!(
                    "name=\"twitter:description\" content=\"{}\"",
                    p.summary
                )),
                "page for {:?} must contain twitter:description",
                p.slug
            );
        }
    }

    // ── P8.8: JSON-LD Article schema present ───────────────────────
    //
    // When siteUrl is configured, each page must include a JSON-LD
    // script block with Article schema containing headline, description,
    // author, datePublished, url, and keywords.
    #[test]
    fn json_ld_article_schema_present(posts in posts_strategy()) {
        let config = default_config();
        let (tmp, _) = run_seo(&posts, &config);

        for p in &posts {
            let html = read_seo_html(&tmp, &p.slug);

            prop_assert!(
                html.contains("application/ld+json"),
                "page for {:?} must contain JSON-LD script block",
                p.slug
            );
            prop_assert!(
                html.contains("\"@context\": \"https://schema.org\""),
                "page for {:?} must contain schema.org context",
                p.slug
            );
            prop_assert!(
                html.contains("\"@type\": \"Article\""),
                "page for {:?} must contain Article type",
                p.slug
            );
            prop_assert!(
                html.contains(&format!("\"headline\": \"{}\"", p.title)),
                "page for {:?} must contain headline in JSON-LD",
                p.slug
            );
            prop_assert!(
                html.contains(&format!("\"description\": \"{}\"", p.summary)),
                "page for {:?} must contain description in JSON-LD",
                p.slug
            );
            prop_assert!(
                html.contains(&format!("\"datePublished\": \"{}\"", p.date)),
                "page for {:?} must contain datePublished in JSON-LD",
                p.slug
            );
            prop_assert!(
                html.contains(&format!(
                    "\"url\": \"https://example.com/post/{}/\"",
                    p.slug
                )),
                "page for {:?} must contain url in JSON-LD",
                p.slug
            );
            prop_assert!(
                html.contains("\"name\": \"TestAuthor\""),
                "page for {:?} must contain author name in JSON-LD",
                p.slug
            );
        }
    }

    // ── P8.9: Original template title removed ──────────────────────
    //
    // The original <title>App Shell</title> from the template must be
    // replaced by the post-specific title.
    #[test]
    fn original_title_removed(posts in posts_strategy()) {
        let config = default_config();
        let (tmp, _) = run_seo(&posts, &config);

        for p in &posts {
            let html = read_seo_html(&tmp, &p.slug);
            prop_assert!(
                !html.contains("App Shell"),
                "page for {:?} must not contain original template title",
                p.slug
            );
        }
    }

    // ── P8.10: Relative asset paths rewritten ──────────────────────
    //
    // No generated page should contain relative `./assets/` or
    // `./favicon` references — they must be rewritten to absolute.
    #[test]
    fn relative_paths_rewritten(posts in posts_strategy()) {
        let config = default_config();
        let (tmp, _) = run_seo(&posts, &config);

        for p in &posts {
            let html = read_seo_html(&tmp, &p.slug);
            prop_assert!(
                !html.contains("\"./assets/"),
                "page for {:?} must not contain relative ./assets/ paths",
                p.slug
            );
            prop_assert!(
                !html.contains("\"./favicon"),
                "page for {:?} must not contain relative ./favicon paths",
                p.slug
            );
        }
    }
}

// ── Edge-case: no siteUrl skips OG/Twitter/JSON-LD ─────────────────

#[test]
fn no_site_url_omits_og_twitter_jsonld() {
    let mut config = default_config();
    config.site_url = None;

    let posts = vec![GenPost {
        slug: "test-post".into(),
        title: "Test".into(),
        date: "2024-01-01T00:00:00".into(),
        tags: vec!["tag".into()],
        categories: vec![],
        summary: "A test".into(),
    }];

    let (tmp, _) = run_seo(&posts, &config);
    let html = read_seo_html(&tmp, "test-post");

    // Basic meta should still be present
    assert!(html.contains("<title>Test</title>"));
    assert!(html.contains("name=\"description\""));

    // OG, Twitter, JSON-LD should be absent
    assert!(!html.contains("og:type"));
    assert!(!html.contains("twitter:card"));
    assert!(!html.contains("application/ld+json"));
    assert!(!html.contains("rel=\"canonical\""));
}

// ── Edge-case: empty manifest produces no pages ────────────────────

#[test]
fn empty_manifest_no_pages() {
    let tmp = TempDir::new().unwrap();
    let template_path = tmp.path().join("index.html");
    fs::write(&template_path, minimal_template()).unwrap();

    let output_dir = tmp.path().join("dist");
    let config = default_config();

    let count = generate_seo_pages(&[], &template_path, &output_dir, &config).unwrap();
    assert_eq!(count, 0);
}
