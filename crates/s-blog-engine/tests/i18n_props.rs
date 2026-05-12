//! Property-based tests for i18n (Properties 1 & 2).
//!
//! **Property 1 – Filename parsing round-trip**
//!
//! *For any* valid slug (non-empty, no dots, no language-code-like suffix)
//! and any valid BCP 47 language code, constructing the filename
//! `{slug}.{lang}.md` and then parsing it with `parse_post_filename`
//! SHALL return the original `(slug, Some(lang))`. Similarly, for any
//! valid slug without a language code, constructing `{slug}.md` and
//! parsing it SHALL return `(slug, None)`.
//!
//! **Validates: Requirements 2.1, 2.3, 3.4**
//!
//! **Property 2 – Manifest i18n completeness and slug uniqueness**
//!
//! *For any* set of valid Markdown files in the posts directory
//! (including a mix of default files and localized files), the
//! generated manifest SHALL contain exactly one entry per unique slug
//! that has a default file, and each entry's `availableLanguages`
//! array SHALL contain exactly the set of language codes for which
//! localized files exist for that slug. When a slug has only a default
//! file and no localized files, `availableLanguages` SHALL be an empty
//! array. When a slug has only localized files but no default file, it
//! SHALL NOT appear in the manifest.
//!
//! **Validates: Requirements 2.2, 2.4, 3.1, 3.2, 3.3, 5.3, 6.1**

use proptest::prelude::*;

use s_blog_engine::posts::parse_post_filename;

// ── Strategies ─────────────────────────────────────────────────────

/// A valid slug: starts with an ASCII letter, followed by 0-30
/// alphanumeric characters, hyphens, or underscores.
/// Crucially, the slug must NOT end with a segment that looks like a
/// BCP 47 language tag (i.e. the part after the last dot must not be
/// a valid tag), so we avoid dots entirely in the slug for this test.
fn valid_slug() -> impl Strategy<Value = String> {
    "[a-zA-Z][a-zA-Z0-9_-]{0,30}"
}

/// A valid BCP 47 language code drawn from realistic values.
fn bcp47_lang() -> impl Strategy<Value = String> {
    prop_oneof![
        Just("en".to_string()),
        Just("zh".to_string()),
        Just("ja".to_string()),
        Just("ko".to_string()),
        Just("fr".to_string()),
        Just("de".to_string()),
        Just("es".to_string()),
        Just("pt".to_string()),
        Just("yue".to_string()),
        Just("zh-CN".to_string()),
        Just("zh-TW".to_string()),
        Just("pt-BR".to_string()),
        Just("en-US".to_string()),
        Just("en-GB".to_string()),
    ]
}

// ── Property Tests ─────────────────────────────────────────────────

proptest! {
    #![proptest_config(ProptestConfig::with_cases(200))]

    // ── P1.1: Localized filename round-trip ────────────────────────
    //
    // Feature: content-source-management-and-i18n
    // Property 1: Filename parsing round-trip (localized variant)
    //
    // For any valid slug and BCP 47 language code, constructing
    // `{slug}.{lang}.md` and parsing it should return the original
    // (slug, Some(lang)).
    //
    // Validates: Requirements 2.1, 2.3, 3.4
    #[test]
    fn filename_roundtrip_with_lang(
        slug in valid_slug(),
        lang in bcp47_lang(),
    ) {
        let filename = format!("{slug}.{lang}.md");
        let (parsed_slug, parsed_lang) = parse_post_filename(&filename);

        prop_assert_eq!(
            &parsed_slug, &slug,
            "slug mismatch for filename {:?}: expected {:?}, got {:?}",
            filename, slug, parsed_slug
        );
        prop_assert_eq!(
            parsed_lang.as_deref(),
            Some(lang.as_str()),
            "lang mismatch for filename {:?}: expected Some({:?}), got {:?}",
            filename, lang, parsed_lang
        );
    }

    // ── P1.2: Default filename round-trip ──────────────────────────
    //
    // Feature: content-source-management-and-i18n
    // Property 1: Filename parsing round-trip (default variant)
    //
    // For any valid slug (without dots), constructing `{slug}.md` and
    // parsing it should return (slug, None).
    //
    // Validates: Requirements 2.1, 2.3, 3.4
    #[test]
    fn filename_roundtrip_default(
        slug in valid_slug(),
    ) {
        let filename = format!("{slug}.md");
        let (parsed_slug, parsed_lang) = parse_post_filename(&filename);

        prop_assert_eq!(
            &parsed_slug, &slug,
            "slug mismatch for filename {:?}: expected {:?}, got {:?}",
            filename, slug, parsed_slug
        );
        prop_assert!(
            parsed_lang.is_none(),
            "lang should be None for default filename {:?}, got {:?}",
            filename, parsed_lang
        );
    }
}


// ── Property 2: Manifest i18n completeness and slug uniqueness ─────
//
// Uses `generate_posts_data` with randomly generated post file
// configurations to verify:
//   - Each slug WITH a default file appears exactly once in the manifest
//   - Each slug WITHOUT a default file does NOT appear in the manifest
//   - `availableLanguages` matches the localized files for each slug
//   - `availableLanguages` is sorted alphabetically
//   - All files for slugs with a default file are copied to the output
//   - No files for slugs without a default file are copied

use std::collections::{BTreeSet, HashSet};
use std::fs;

use s_blog_engine::posts::generate_posts_data;
use s_blog_engine::SiteConfig;

/// Minimal valid SiteConfig for testing.
fn test_config() -> SiteConfig {
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

/// Describes a single post configuration for property testing.
#[derive(Debug, Clone)]
struct PostConfig {
    slug: String,
    has_default: bool,
    /// Unique, sorted language codes for localized files.
    languages: Vec<String>,
}

/// Strategy that generates a `Vec<PostConfig>` with unique slugs.
fn post_configs_strategy() -> impl Strategy<Value = Vec<PostConfig>> {
    // Generate 1..6 post configs, then deduplicate slugs.
    proptest::collection::vec(
        (
            // slug: lowercase letter + 0-8 lowercase alphanumeric/hyphens
            "[a-z][a-z0-9-]{0,8}",
            proptest::bool::ANY,
            // 0..3 languages drawn from a realistic set, deduplicated
            proptest::collection::btree_set(
                prop_oneof![
                    Just("en".to_string()),
                    Just("zh-CN".to_string()),
                    Just("ja".to_string()),
                    Just("ko".to_string()),
                    Just("fr".to_string()),
                    Just("pt-BR".to_string()),
                ],
                0..=3,
            ),
        ),
        1..6,
    )
    .prop_map(|raw| {
        let mut seen_slugs = HashSet::new();
        raw.into_iter()
            .filter_map(|(slug, has_default, lang_set)| {
                if seen_slugs.contains(&slug) {
                    return None;
                }
                seen_slugs.insert(slug.clone());
                let languages: Vec<String> = lang_set.into_iter().collect(); // BTreeSet → sorted Vec
                // Skip configs that have neither default nor localized files
                // (they produce no files at all, which is uninteresting).
                if !has_default && languages.is_empty() {
                    return None;
                }
                Some(PostConfig {
                    slug,
                    has_default,
                    languages,
                })
            })
            .collect()
    })
    // Ensure we have at least one config to test.
    .prop_filter("need at least one post config", |v: &Vec<PostConfig>| !v.is_empty())
}

/// Write Markdown files into `dir` according to the given configs.
/// Returns the set of filenames written.
fn write_post_files(dir: &std::path::Path, configs: &[PostConfig]) -> Vec<String> {
    let mut filenames = Vec::new();
    for (idx, cfg) in configs.iter().enumerate() {
        // Use idx to create unique dates so sorting is deterministic.
        let date = format!("2025-01-{:02} 00:00:00", (idx % 28) + 1);

        if cfg.has_default {
            let filename = format!("{}.md", cfg.slug);
            let content = format!(
                "---\ntitle: {title}\ndate: {date}\n---\nDefault body for {slug}.",
                title = cfg.slug,
                date = date,
                slug = cfg.slug,
            );
            fs::write(dir.join(&filename), &content).unwrap();
            filenames.push(filename);
        }

        for lang in &cfg.languages {
            let filename = format!("{}.{}.md", cfg.slug, lang);
            let content = format!(
                "---\ntitle: {slug} ({lang})\ndate: {date}\n---\nLocalized body for {slug} in {lang}.",
                slug = cfg.slug,
                lang = lang,
                date = date,
            );
            fs::write(dir.join(&filename), &content).unwrap();
            filenames.push(filename);
        }
    }
    filenames
}

proptest! {
    #![proptest_config(ProptestConfig::with_cases(100))]

    // ── P2: Manifest i18n completeness and slug uniqueness ─────────
    //
    // Feature: content-source-management-and-i18n
    // Property 2: Manifest i18n completeness and slug uniqueness
    //
    // For any randomly generated set of post files (default and/or
    // localized), running generate_posts_data should produce a manifest
    // where:
    //   1. Each slug with a default file appears exactly once
    //   2. Each slug without a default file does NOT appear
    //   3. availableLanguages matches the localized files for that slug
    //   4. availableLanguages is sorted
    //   5. All files for included slugs are copied to output
    //   6. No files for excluded slugs are copied to output
    //
    // Validates: Requirements 2.2, 2.4, 3.1, 3.2, 3.3, 5.3, 6.1
    #[test]
    fn manifest_i18n_completeness_and_slug_uniqueness(
        configs in post_configs_strategy()
    ) {
        let posts_dir = tempfile::TempDir::new().unwrap();
        let output_dir = tempfile::TempDir::new().unwrap();

        let _written = write_post_files(posts_dir.path(), &configs);

        let result = generate_posts_data(
            posts_dir.path(),
            output_dir.path(),
            &test_config(),
        ).unwrap();

        // ── Derive expected state from configs ─────────────────────

        // Slugs that have a default file should appear in the manifest.
        let expected_slugs: BTreeSet<String> = configs
            .iter()
            .filter(|c| c.has_default)
            .map(|c| c.slug.clone())
            .collect();

        // Slugs that do NOT have a default file should be absent.
        let excluded_slugs: BTreeSet<String> = configs
            .iter()
            .filter(|c| !c.has_default)
            .map(|c| c.slug.clone())
            .collect();

        // ── Assertion 1: Slug uniqueness in manifest ───────────────
        let manifest_slugs: Vec<&str> = result.iter().map(|p| p.slug.as_str()).collect();
        let manifest_slug_set: HashSet<&str> = manifest_slugs.iter().copied().collect();
        prop_assert_eq!(
            manifest_slugs.len(),
            manifest_slug_set.len(),
            "Manifest contains duplicate slugs: {:?}",
            manifest_slugs
        );

        // ── Assertion 2: Exactly the expected slugs are present ────
        let actual_slugs: BTreeSet<String> = result.iter().map(|p| p.slug.clone()).collect();
        prop_assert_eq!(
            &actual_slugs,
            &expected_slugs,
            "Manifest slugs mismatch.\n  Expected (has default): {:?}\n  Actual: {:?}\n  Configs: {:?}",
            expected_slugs, actual_slugs, configs
        );

        // ── Assertion 3: Excluded slugs are absent ─────────────────
        for slug in &excluded_slugs {
            prop_assert!(
                !actual_slugs.contains(slug),
                "Slug '{}' has no default file but appeared in manifest",
                slug
            );
        }

        // ── Assertion 4: availableLanguages correctness ────────────
        for post in &result {
            let cfg = configs.iter().find(|c| c.slug == post.slug).unwrap();

            // Expected languages: sorted list from config
            let expected_langs: Vec<String> = cfg.languages.clone(); // already sorted (from BTreeSet)
            prop_assert_eq!(
                &post.available_languages,
                &expected_langs,
                "availableLanguages mismatch for slug '{}'.\n  Expected: {:?}\n  Actual: {:?}",
                post.slug, expected_langs, post.available_languages
            );

            // Verify sorted order
            let mut sorted = post.available_languages.clone();
            sorted.sort();
            prop_assert_eq!(
                &post.available_languages,
                &sorted,
                "availableLanguages for slug '{}' is not sorted: {:?}",
                post.slug, post.available_languages
            );
        }

        // ── Assertion 5: Files for included slugs are copied ───────
        let posts_output = output_dir.path().join("posts");
        for cfg in configs.iter().filter(|c| c.has_default) {
            // Default file should be copied
            let default_file = format!("{}.md", cfg.slug);
            prop_assert!(
                posts_output.join(&default_file).exists(),
                "Default file '{}' was not copied to output",
                default_file
            );

            // Localized files should be copied
            for lang in &cfg.languages {
                let localized_file = format!("{}.{}.md", cfg.slug, lang);
                prop_assert!(
                    posts_output.join(&localized_file).exists(),
                    "Localized file '{}' was not copied to output",
                    localized_file
                );
            }
        }

        // ── Assertion 6: Files for excluded slugs are NOT copied ───
        for cfg in configs.iter().filter(|c| !c.has_default) {
            // No files for this slug should exist in output
            for lang in &cfg.languages {
                let localized_file = format!("{}.{}.md", cfg.slug, lang);
                prop_assert!(
                    !posts_output.join(&localized_file).exists(),
                    "Localized file '{}' for slug without default was copied to output",
                    localized_file
                );
            }
        }

        // ── Assertion 7: manifest.json exists and is valid ─────────
        let manifest_path = output_dir.path().join("generated/manifest.json");
        prop_assert!(
            manifest_path.exists(),
            "manifest.json was not created"
        );
        let manifest_content = fs::read_to_string(&manifest_path).unwrap();
        let parsed: Vec<serde_json::Value> = serde_json::from_str(&manifest_content).unwrap();
        prop_assert_eq!(
            parsed.len(),
            expected_slugs.len(),
            "manifest.json entry count mismatch"
        );
    }
}


// ── Property 4: Manifest localizedMeta completeness ────────────────
//
// Feature: content-source-management-and-i18n
// Property 4: Manifest localizedMeta completeness
//
// For any set of valid Markdown files in the posts directory, the
// generated manifest's `localizedMeta` keys SHALL exactly match the
// `availableLanguages` array for each entry. Each `localizedMeta`
// entry SHALL contain a non-empty `title` (falling back to the default
// file's title if the localized frontmatter lacks one) and a `summary`
// string. When `availableLanguages` is empty, `localizedMeta` SHALL
// be empty.
//
// **Validates: Requirements 3.5, 3.6, 3.7, 3.8, 5.1, 5.2**

/// Describes a single post configuration for Property 4 testing,
/// including per-language frontmatter details.
#[derive(Debug, Clone)]
struct PostConfigWithMeta {
    slug: String,
    has_default: bool,
    /// Each entry: (lang_code, has_title_in_frontmatter, has_summary_in_frontmatter)
    localized: Vec<(String, bool, bool)>,
}

/// Strategy that generates a `Vec<PostConfigWithMeta>` with unique slugs.
fn post_configs_with_meta_strategy() -> impl Strategy<Value = Vec<PostConfigWithMeta>> {
    proptest::collection::vec(
        (
            // slug: lowercase letter + 0-8 lowercase alphanumeric/hyphens
            "[a-z][a-z0-9-]{0,8}",
            proptest::bool::ANY,
            // 0..3 localized languages with frontmatter options
            proptest::collection::vec(
                (
                    prop_oneof![
                        Just("en".to_string()),
                        Just("zh-CN".to_string()),
                        Just("ja".to_string()),
                        Just("ko".to_string()),
                        Just("fr".to_string()),
                        Just("pt-BR".to_string()),
                    ],
                    proptest::bool::ANY, // has_title
                    proptest::bool::ANY, // has_summary
                ),
                0..=3,
            ),
        ),
        1..6,
    )
    .prop_map(|raw| {
        let mut seen_slugs = HashSet::new();
        raw.into_iter()
            .filter_map(|(slug, has_default, lang_entries)| {
                if seen_slugs.contains(&slug) {
                    return None;
                }
                seen_slugs.insert(slug.clone());

                // Deduplicate languages (keep first occurrence)
                let mut seen_langs = HashSet::new();
                let localized: Vec<(String, bool, bool)> = lang_entries
                    .into_iter()
                    .filter(|(lang, _, _)| {
                        if seen_langs.contains(lang) {
                            false
                        } else {
                            seen_langs.insert(lang.clone());
                            true
                        }
                    })
                    .collect();

                // Skip configs that have neither default nor localized files
                if !has_default && localized.is_empty() {
                    return None;
                }
                Some(PostConfigWithMeta {
                    slug,
                    has_default,
                    localized,
                })
            })
            .collect()
    })
    .prop_filter("need at least one post config with default", |v: &Vec<PostConfigWithMeta>| {
        v.iter().any(|c| c.has_default)
    })
}

/// Write Markdown files into `dir` according to the given configs (with meta).
fn write_post_files_with_meta(dir: &std::path::Path, configs: &[PostConfigWithMeta]) {
    for (idx, cfg) in configs.iter().enumerate() {
        let date = format!("2025-01-{:02} 00:00:00", (idx % 28) + 1);

        if cfg.has_default {
            let filename = format!("{}.md", cfg.slug);
            let content = format!(
                "---\ntitle: {title}\ndate: {date}\npreview: Default summary for {slug}\n---\nDefault body for {slug}.",
                title = cfg.slug,
                date = date,
                slug = cfg.slug,
            );
            fs::write(dir.join(&filename), &content).unwrap();
        }

        for (lang, has_title, has_summary) in &cfg.localized {
            let filename = format!("{}.{}.md", cfg.slug, lang);

            // Build frontmatter conditionally
            let mut fm_lines = vec![String::from("---")];
            if *has_title {
                fm_lines.push(format!("title: {} ({})", cfg.slug, lang));
            }
            fm_lines.push(format!("date: {}", date));
            if *has_summary {
                fm_lines.push(format!("preview: Localized summary for {} in {}", cfg.slug, lang));
            }
            fm_lines.push(String::from("---"));
            fm_lines.push(format!("Localized body for {} in {}.", cfg.slug, lang));

            let content = fm_lines.join("\n");
            fs::write(dir.join(&filename), &content).unwrap();
        }
    }
}

proptest! {
    #![proptest_config(ProptestConfig::with_cases(100))]

    // ── P4: Manifest localizedMeta completeness ────────────────────
    //
    // Feature: content-source-management-and-i18n
    // Property 4: Manifest localizedMeta completeness
    //
    // For any randomly generated set of post files (with varying
    // frontmatter in localized files), running generate_posts_data
    // should produce a manifest where:
    //   1. localizedMeta keys exactly match availableLanguages
    //   2. Each localizedMeta entry has a non-empty title
    //   3. When availableLanguages is empty, localizedMeta is empty
    //
    // Validates: Requirements 3.5, 3.6, 3.7, 3.8, 5.1, 5.2
    #[test]
    fn manifest_localized_meta_completeness(
        configs in post_configs_with_meta_strategy()
    ) {
        let posts_dir = tempfile::TempDir::new().unwrap();
        let output_dir = tempfile::TempDir::new().unwrap();

        write_post_files_with_meta(posts_dir.path(), &configs);

        let result = generate_posts_data(
            posts_dir.path(),
            output_dir.path(),
            &test_config(),
        ).unwrap();

        for post in &result {
            let cfg = configs.iter().find(|c| c.slug == post.slug).unwrap();

            // ── Assertion 1: localizedMeta keys match availableLanguages ──
            let meta_keys: BTreeSet<String> = post.localized_meta.keys().cloned().collect();
            let available_langs: BTreeSet<String> = post.available_languages.iter().cloned().collect();
            prop_assert_eq!(
                &meta_keys,
                &available_langs,
                "localizedMeta keys do not match availableLanguages for slug '{}'.\n  Meta keys: {:?}\n  Available languages: {:?}",
                post.slug, meta_keys, available_langs
            );

            // ── Assertion 2: Each localizedMeta entry has non-empty title ──
            for (lang, meta) in &post.localized_meta {
                prop_assert!(
                    !meta.title.is_empty(),
                    "localizedMeta['{}'].title is empty for slug '{}'. \
                     It should fall back to the default file's title.",
                    lang, post.slug
                );
            }

            // ── Assertion 3: When no localized files, localizedMeta is empty ──
            if post.available_languages.is_empty() {
                prop_assert!(
                    post.localized_meta.is_empty(),
                    "localizedMeta should be empty when availableLanguages is empty for slug '{}', \
                     but got: {:?}",
                    post.slug, post.localized_meta
                );
            }

            // ── Assertion 4: Verify title fallback logic ──
            // When localized file has no title in frontmatter, the title
            // should fall back to the default file's title (which is the slug).
            for (lang, has_title, _) in &cfg.localized {
                if let Some(meta) = post.localized_meta.get(lang) {
                    if *has_title {
                        // Localized file had a title → should use it
                        let expected_title = format!("{} ({})", cfg.slug, lang);
                        prop_assert_eq!(
                            &meta.title,
                            &expected_title,
                            "localizedMeta['{}'].title mismatch for slug '{}'. \
                             Expected localized title '{}'.",
                            lang, post.slug, expected_title
                        );
                    } else {
                        // Localized file had no title → should fall back to default title
                        // Default title is the slug itself (as written in write_post_files_with_meta)
                        prop_assert_eq!(
                            &meta.title,
                            &cfg.slug,
                            "localizedMeta['{}'].title should fall back to default title '{}' for slug '{}'.",
                            lang, cfg.slug, post.slug
                        );
                    }
                }
            }
        }
    }
}
