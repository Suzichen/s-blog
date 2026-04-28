//! Cross-implementation verification test for `generate_posts_data`.
//!
//! Runs the Rust engine against the shared test fixtures in
//! `tests/fixtures/` and compares the generated `manifest.json`
//! against the golden file produced by the TypeScript script.
//!
//! **Validates: Requirement 2.3.6** — The Rust output SHALL match
//! the TS `generate-posts-data.ts` output for the same input fixtures.
//!
//! ## Sort-order caveat
//!
//! The TS script sorts by `new Date(b.date).getTime() - new Date(a.date).getTime()`.
//! For posts with empty/invalid dates, `new Date("")` yields `NaN` and
//! `NaN - x = NaN`, which JS sort treats as "equal" — making the
//! relative position of empty-date entries **platform-dependent**.
//! Therefore the golden file's ordering is not fully reproducible.
//!
//! The tests below verify:
//! - Every entry's **content** matches the golden file (keyed by slug).
//! - Posts with valid dates are in **descending** order.
//! - The total count matches.

use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};

use s_blog_engine::posts::generate_posts_data;
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

fn golden_manifest() -> Vec<serde_json::Value> {
    let path = golden_dir().join("manifest.json");
    let raw = fs::read_to_string(&path)
        .unwrap_or_else(|e| panic!("failed to read {}: {e}", path.display()));
    serde_json::from_str(&raw)
        .unwrap_or_else(|e| panic!("failed to parse {}: {e}", path.display()))
}

/// Build a slug → JSON value map from the golden manifest.
fn golden_by_slug() -> HashMap<String, serde_json::Value> {
    golden_manifest()
        .into_iter()
        .map(|v| {
            let slug = v["slug"].as_str().unwrap().to_string();
            (slug, v)
        })
        .collect()
}

/// Run `generate_posts_data` against the shared fixtures.
fn run_rust() -> (Vec<PostMetadata>, tempfile::TempDir) {
    let config = fixtures_config();
    let posts_dir = fixtures_dir().join("posts");
    let out = tempfile::TempDir::new().unwrap();
    let posts = generate_posts_data(&posts_dir, out.path(), &config)
        .expect("generate_posts_data should succeed");
    (posts, out)
}

/// Serialize a `PostMetadata` to a `serde_json::Value` for comparison.
fn post_to_json(p: &PostMetadata) -> serde_json::Value {
    serde_json::to_value(p).unwrap()
}

// ── Tests ──────────────────────────────────────────────────────────

/// Every entry produced by Rust matches the golden file entry with the
/// same slug (field-by-field).
#[test]
fn rust_entries_match_golden_by_slug() {
    let (posts, _out) = run_rust();
    let golden = golden_by_slug();

    assert_eq!(
        posts.len(),
        golden.len(),
        "post count mismatch: Rust={} golden={}",
        posts.len(),
        golden.len()
    );

    for p in &posts {
        let expected = golden
            .get(&p.slug)
            .unwrap_or_else(|| panic!("slug {:?} not found in golden file", p.slug));
        let actual = post_to_json(p);
        assert_eq!(
            actual, *expected,
            "entry for slug {:?} differs.\n  Rust:   {}\n  Golden: {}",
            p.slug,
            serde_json::to_string_pretty(&actual).unwrap(),
            serde_json::to_string_pretty(expected).unwrap(),
        );
    }
}

/// The on-disk `manifest.json` written by the Rust engine contains the
/// same entries as the golden file (compared by slug).
#[test]
fn rust_manifest_json_file_matches_golden_by_slug() {
    let (_posts, out) = run_rust();

    let written_path = out.path().join("generated/manifest.json");
    assert!(written_path.exists(), "manifest.json should be written to disk");

    let written: Vec<serde_json::Value> =
        serde_json::from_str(&fs::read_to_string(&written_path).unwrap()).unwrap();
    let golden = golden_by_slug();

    assert_eq!(written.len(), golden.len());

    for entry in &written {
        let slug = entry["slug"].as_str().unwrap();
        let expected = golden
            .get(slug)
            .unwrap_or_else(|| panic!("slug {slug:?} not in golden"));
        assert_eq!(
            entry, expected,
            "on-disk manifest entry for slug {slug:?} differs"
        );
    }
}

/// Posts with valid (non-empty) dates are in descending order.
#[test]
fn rust_valid_dates_sorted_descending() {
    let (posts, _out) = run_rust();

    let dated: Vec<&str> = posts
        .iter()
        .filter(|p| !p.date.is_empty())
        .map(|p| p.date.as_str())
        .collect();

    for w in dated.windows(2) {
        assert!(
            w[0] >= w[1],
            "dates not in descending order: {:?} before {:?}",
            w[0],
            w[1]
        );
    }
}

/// All `.md` files from the fixtures are copied to `output/posts/`.
#[test]
fn rust_copies_markdown_files_to_output() {
    let (_posts, out) = run_rust();
    let posts_dir = fixtures_dir().join("posts");

    let mut fixture_mds: Vec<String> = fs::read_dir(&posts_dir)
        .unwrap()
        .filter_map(|e| {
            let name = e.ok()?.file_name().to_string_lossy().to_string();
            if name.ends_with(".md") { Some(name) } else { None }
        })
        .collect();
    fixture_mds.sort();

    let posts_output = out.path().join("posts");
    assert!(posts_output.exists(), "posts/ output directory should exist");

    let mut copied_mds: Vec<String> = fs::read_dir(&posts_output)
        .unwrap()
        .filter_map(|e| {
            let name = e.ok()?.file_name().to_string_lossy().to_string();
            if name.ends_with(".md") { Some(name) } else { None }
        })
        .collect();
    copied_mds.sort();

    assert_eq!(fixture_mds, copied_mds, "all .md files should be copied");

    for md in &fixture_mds {
        let src = fs::read_to_string(posts_dir.join(md)).unwrap();
        let dst = fs::read_to_string(posts_output.join(md)).unwrap();
        assert_eq!(src, dst, "copied file {md} should have identical content");
    }
}

/// Summary priority: preview > description > excerpt > auto-generated.
#[test]
fn rust_preview_priority_chain() {
    let (posts, _out) = run_rust();
    let find = |slug: &str| posts.iter().find(|p| p.slug == slug).unwrap();

    assert_eq!(
        find("with-preview").summary,
        "This is a custom preview text that should be used instead of auto-generated summary."
    );
    assert_eq!(
        find("with-description").summary,
        "This summary comes from the description field, not preview or body content."
    );
    assert_eq!(
        find("with-excerpt").summary,
        "This summary comes from the excerpt field, the lowest priority custom field."
    );

    let simple = find("simple");
    assert!(
        simple.summary.contains("simple test post"),
        "auto-generated summary should contain body text, got: {}",
        simple.summary
    );
}

/// Timezone conversion matches the golden file for the `with-timezone` post.
#[test]
fn rust_timezone_conversion_matches_golden() {
    let (posts, _out) = run_rust();
    let golden = golden_by_slug();

    let tz_post = posts.iter().find(|p| p.slug == "with-timezone").unwrap();
    let golden_date = golden["with-timezone"]["date"].as_str().unwrap();

    assert_eq!(
        tz_post.date, golden_date,
        "timezone-converted date should match golden file"
    );
}

/// Invalid date produces an empty string.
#[test]
fn rust_invalid_date_produces_empty_string() {
    let (posts, _out) = run_rust();
    let invalid = posts.iter().find(|p| p.slug == "invalid-date").unwrap();
    assert_eq!(invalid.date, "", "invalid date should produce empty string");
}

/// Post with no frontmatter uses slug as title.
#[test]
fn rust_no_frontmatter_uses_slug_as_title() {
    let (posts, _out) = run_rust();
    let no_fm = posts.iter().find(|p| p.slug == "no-frontmatter").unwrap();
    assert_eq!(no_fm.title, "no-frontmatter");
    assert_eq!(no_fm.date, "");
    assert!(no_fm.tags.is_empty());
    assert!(no_fm.categories.is_empty());
}

/// Tag/category normalization: YAML arrays, comma-separated, space-separated.
#[test]
fn rust_tag_normalization_formats() {
    let (posts, _out) = run_rust();
    let find = |slug: &str| posts.iter().find(|p| p.slug == slug).unwrap();

    let with_tags = find("with-tags");
    assert_eq!(with_tags.tags, vec!["javascript", "typescript", "testing"]);
    assert_eq!(with_tags.categories, vec!["Development", "Tutorial"]);

    let comma = find("comma-separated-tags");
    assert_eq!(comma.tags, vec!["python", "rust", "go"]);
    assert_eq!(comma.categories, vec!["Backend", "Systems"]);

    let space = find("space-separated-tags");
    assert_eq!(space.tags, vec!["react", "vue", "angular"]);
    assert_eq!(space.categories, vec!["Frontend"]);
}
