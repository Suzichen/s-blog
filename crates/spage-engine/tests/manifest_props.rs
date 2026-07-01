//! Property-based tests for manifest generation (Property 4).
//!
//! **Property 4 – Manifest Generation Completeness**
//!
//! *For any* set of valid Markdown files in the posts directory, the
//! generated `manifest.json` SHALL contain exactly one entry per file,
//! with all required fields (`slug`, `title`, `date`, `tags`,
//! `categories`, `summary`) present, sorted by date in descending order.
//!
//! **Validates: Requirements 2.3.1, 2.3.2, 2.3.3**

use std::collections::HashSet;
use std::fs;

use proptest::prelude::*;
use tempfile::TempDir;

use spage_engine::posts::generate_posts_data;
use spage_engine::SiteConfig;

// ── Strategies ─────────────────────────────────────────────────────

/// Generate a valid slug (lowercase alphanumeric + hyphens, non-empty).
fn slug_strategy() -> impl Strategy<Value = String> {
    "[a-z][a-z0-9\\-]{0,20}[a-z0-9]"
}

/// Generate a valid ISO-ish date string (YYYY-MM-DD HH:MM:SS).
fn date_strategy() -> impl Strategy<Value = String> {
    (2000..2030i32, 1..=12u32, 1..=28u32, 0..=23u32, 0..=59u32, 0..=59u32)
        .prop_map(|(y, mo, d, h, mi, s)| {
            format!("{:04}-{:02}-{:02} {:02}:{:02}:{:02}", y, mo, d, h, mi, s)
        })
}

/// Generate a simple tag (lowercase alpha, 1-10 chars).
fn tag_strategy() -> impl Strategy<Value = String> {
    "[a-z]{1,10}"
}

/// Generate a list of 0-4 tags.
fn tags_strategy() -> impl Strategy<Value = Vec<String>> {
    prop::collection::vec(tag_strategy(), 0..=4)
}

/// Generate a category string.
fn category_strategy() -> impl Strategy<Value = String> {
    "[A-Z][a-z]{1,10}"
}

/// Generate a list of 0-3 categories.
fn categories_strategy() -> impl Strategy<Value = Vec<String>> {
    prop::collection::vec(category_strategy(), 0..=3)
}

/// A single generated post with frontmatter fields.
#[derive(Debug, Clone)]
struct GenPost {
    slug: String,
    title: String,
    date: String,
    tags: Vec<String>,
    categories: Vec<String>,
    body: String,
}

/// Strategy for a single post.
fn post_strategy() -> impl Strategy<Value = GenPost> {
    (
        slug_strategy(),
        "[A-Za-z ]{3,30}",   // title
        date_strategy(),
        tags_strategy(),
        categories_strategy(),
        "[A-Za-z ]{10,60}",  // body
    )
        .prop_map(|(slug, title, date, tags, categories, body)| GenPost {
            slug,
            title,
            date,
            tags,
            categories,
            body,
        })
}

/// Strategy for a set of 1-8 posts with unique slugs.
fn posts_strategy() -> impl Strategy<Value = Vec<GenPost>> {
    prop::collection::vec(post_strategy(), 1..=8).prop_map(|mut posts| {
        // Deduplicate slugs by appending index.
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
        title: "Test".into(),
        description: "Test blog".into(),
        logo: "/logo.png".into(),
        favicon: "/favicon.ico".into(),
        site_url: None,
        author: None,
        language: None,
        timezone: None,
        base_path: Some("/".into()),
    }
}

/// Render a `GenPost` to Markdown with YAML frontmatter.
fn render_markdown(p: &GenPost) -> String {
    let tags_yaml: Vec<String> = p.tags.iter().map(|t| format!("\"{}\"", t)).collect();
    let cats_yaml: Vec<String> = p.categories.iter().map(|c| format!("\"{}\"", c)).collect();
    format!(
        "---\ntitle: \"{}\"\ndate: {}\ntags: [{}]\ncategories: [{}]\n---\n{}",
        p.title,
        p.date,
        tags_yaml.join(", "),
        cats_yaml.join(", "),
        p.body,
    )
}

/// Write posts to a temp directory and return it.
fn write_posts(posts: &[GenPost]) -> TempDir {
    let dir = TempDir::new().unwrap();
    for p in posts {
        let filename = format!("{}.md", p.slug);
        fs::write(dir.path().join(&filename), render_markdown(p)).unwrap();
    }
    dir
}

// ── Property Tests ─────────────────────────────────────────────────

proptest! {
    #![proptest_config(ProptestConfig::with_cases(100))]

    // ── P4.1: One manifest entry per Markdown file ─────────────────
    //
    // The manifest must contain exactly as many entries as there are
    // .md files, with a 1:1 slug correspondence.
    #[test]
    fn one_entry_per_file(posts in posts_strategy()) {
        let posts_dir = write_posts(&posts);
        let out = TempDir::new().unwrap();

        let result = generate_posts_data(posts_dir.path(), out.path(), &default_config()).unwrap();

        // Count must match.
        prop_assert_eq!(
            result.len(),
            posts.len(),
            "manifest entry count ({}) != input file count ({})",
            result.len(),
            posts.len()
        );

        // Every input slug must appear exactly once.
        let result_slugs: HashSet<&str> = result.iter().map(|p| p.slug.as_str()).collect();
        for p in &posts {
            prop_assert!(
                result_slugs.contains(p.slug.as_str()),
                "slug {:?} missing from manifest",
                p.slug
            );
        }
    }

    // ── P4.2: All required fields are present and non-absent ───────
    //
    // Every manifest entry must have slug, title, date, tags,
    // categories, and summary fields populated (not missing).
    #[test]
    fn all_required_fields_present(posts in posts_strategy()) {
        let posts_dir = write_posts(&posts);
        let out = TempDir::new().unwrap();

        let result = generate_posts_data(posts_dir.path(), out.path(), &default_config()).unwrap();

        for entry in &result {
            // slug is non-empty (derived from filename).
            prop_assert!(!entry.slug.is_empty(), "slug must not be empty");

            // title is non-empty (from frontmatter or fallback to slug).
            prop_assert!(!entry.title.is_empty(), "title must not be empty for slug={}", entry.slug);

            // date is a string (may be empty for invalid dates, but the
            // field itself must exist — which it always does as a String).
            // For our generated posts with valid dates, it should be non-empty.
            prop_assert!(!entry.date.is_empty(), "date must not be empty for slug={}", entry.slug);

            // tags and categories are Vec (always present, may be empty).
            // Just verify they serialize correctly.
            let json = serde_json::to_value(entry).unwrap();
            prop_assert!(json.get("slug").is_some(), "slug field missing in JSON");
            prop_assert!(json.get("title").is_some(), "title field missing in JSON");
            prop_assert!(json.get("date").is_some(), "date field missing in JSON");
            prop_assert!(json.get("tags").is_some(), "tags field missing in JSON");
            prop_assert!(json.get("categories").is_some(), "categories field missing in JSON");
            prop_assert!(json.get("summary").is_some(), "summary field missing in JSON");
        }
    }

    // ── P4.3: Posts sorted by date descending ──────────────────────
    //
    // All entries with non-empty dates must appear in descending
    // lexicographic order (ISO 8601 strings sort correctly).
    #[test]
    fn sorted_by_date_descending(posts in posts_strategy()) {
        let posts_dir = write_posts(&posts);
        let out = TempDir::new().unwrap();

        let result = generate_posts_data(posts_dir.path(), out.path(), &default_config()).unwrap();

        let dated: Vec<&str> = result
            .iter()
            .filter(|p| !p.date.is_empty())
            .map(|p| p.date.as_str())
            .collect();

        for window in dated.windows(2) {
            prop_assert!(
                window[0] >= window[1],
                "dates not in descending order: {:?} before {:?}",
                window[0],
                window[1]
            );
        }
    }

    // ── P4.4: Manifest JSON file is written to disk ────────────────
    //
    // The on-disk manifest.json must be valid JSON containing the same
    // number of entries as the returned Vec.
    #[test]
    fn manifest_json_written_to_disk(posts in posts_strategy()) {
        let posts_dir = write_posts(&posts);
        let out = TempDir::new().unwrap();

        let result = generate_posts_data(posts_dir.path(), out.path(), &default_config()).unwrap();

        let manifest_path = out.path().join("generated/manifest.json");
        prop_assert!(manifest_path.exists(), "manifest.json must be written");

        let raw = fs::read_to_string(&manifest_path).unwrap();
        let parsed: Vec<serde_json::Value> = serde_json::from_str(&raw).unwrap();

        prop_assert_eq!(
            parsed.len(),
            result.len(),
            "on-disk manifest entry count must match returned Vec"
        );
    }

    // ── P4.5: Markdown files are copied to output ──────────────────
    //
    // Every input .md file must be copied to output/posts/ with
    // identical content.
    #[test]
    fn markdown_files_copied(posts in posts_strategy()) {
        let posts_dir = write_posts(&posts);
        let out = TempDir::new().unwrap();

        generate_posts_data(posts_dir.path(), out.path(), &default_config()).unwrap();

        let posts_output = out.path().join("posts");
        prop_assert!(posts_output.exists(), "posts/ output dir must exist");

        for p in &posts {
            let filename = format!("{}.md", p.slug);
            let src = fs::read_to_string(posts_dir.path().join(&filename)).unwrap();
            let dst_path = posts_output.join(&filename);
            prop_assert!(dst_path.exists(), "copied file {} must exist", filename);
            let dst = fs::read_to_string(&dst_path).unwrap();
            prop_assert_eq!(src, dst, "copied file {} must have identical content", filename);
        }
    }

    // ── P4.6: Title matches frontmatter ────────────────────────────
    //
    // For posts with a title in frontmatter, the manifest entry's
    // title must match.
    #[test]
    fn title_matches_frontmatter(posts in posts_strategy()) {
        let posts_dir = write_posts(&posts);
        let out = TempDir::new().unwrap();

        let result = generate_posts_data(posts_dir.path(), out.path(), &default_config()).unwrap();

        for gen_post in &posts {
            let entry = result.iter().find(|e| e.slug == gen_post.slug).unwrap();
            prop_assert_eq!(
                &entry.title,
                &gen_post.title,
                "title mismatch for slug={}",
                gen_post.slug
            );
        }
    }

    // ── P4.7: Tags and categories match frontmatter ────────────────
    //
    // The manifest entry's tags and categories must match the input.
    #[test]
    fn tags_and_categories_match(posts in posts_strategy()) {
        let posts_dir = write_posts(&posts);
        let out = TempDir::new().unwrap();

        let result = generate_posts_data(posts_dir.path(), out.path(), &default_config()).unwrap();

        for gen_post in &posts {
            let entry = result.iter().find(|e| e.slug == gen_post.slug).unwrap();
            prop_assert_eq!(
                &entry.tags,
                &gen_post.tags,
                "tags mismatch for slug={}",
                gen_post.slug
            );
            prop_assert_eq!(
                &entry.categories,
                &gen_post.categories,
                "categories mismatch for slug={}",
                gen_post.slug
            );
        }
    }
}

// ── Edge-case: empty directory ─────────────────────────────────────

#[test]
fn empty_directory_produces_empty_manifest() {
    let posts_dir = TempDir::new().unwrap();
    let out = TempDir::new().unwrap();

    let result = generate_posts_data(posts_dir.path(), out.path(), &default_config()).unwrap();

    assert!(result.is_empty());
    let manifest_path = out.path().join("generated/manifest.json");
    assert!(manifest_path.exists());
    let raw = fs::read_to_string(manifest_path).unwrap();
    assert_eq!(raw.trim(), "[]");
}
