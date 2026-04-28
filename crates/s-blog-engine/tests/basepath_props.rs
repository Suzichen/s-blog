//! Property-based tests for BasePath prefixing (Property 10).
//!
//! **Property 10 – BasePath Prefixing**
//!
//! *For any* configured basePath value and any asset path, the generated
//! path SHALL be correctly prefixed with the basePath (handling trailing
//! slashes correctly).
//!
//! **Validates: Requirements 1.5.5**

use proptest::prelude::*;

use s_blog_engine::path_util::{
    build_full_url, normalize_base_path, normalize_base_path_option, prefix_with_base,
};

// ── Strategies ─────────────────────────────────────────────────────

/// Generate a base-path segment (e.g. "blog", "my-site", "docs/v2").
fn base_segment_strategy() -> impl Strategy<Value = String> {
    "[a-z][a-z0-9\\-]{0,12}[a-z0-9]"
}

/// Generate a base-path with various formats:
/// "/blog", "blog", "/blog/", "", "/", "  /blog  "
fn base_path_strategy() -> impl Strategy<Value = String> {
    prop_oneof![
        Just("/".to_string()),
        Just("".to_string()),
        Just("  ".to_string()),
        base_segment_strategy().prop_map(|s| format!("/{}", s)),
        base_segment_strategy().prop_map(|s| format!("/{}/", s)),
        base_segment_strategy().prop_map(|s| s),
        base_segment_strategy().prop_map(|s| format!("  /{}  ", s)),
    ]
}

/// Generate a relative asset path (e.g. "/posts/hello", "/albums/travel/thumb.webp").
fn asset_path_strategy() -> impl Strategy<Value = String> {
    prop_oneof![
        base_segment_strategy().prop_map(|s| format!("/{}", s)),
        (base_segment_strategy(), base_segment_strategy())
            .prop_map(|(a, b)| format!("/{}/{}", a, b)),
        (base_segment_strategy(), base_segment_strategy(), base_segment_strategy())
            .prop_map(|(a, b, c)| format!("/{}/{}/{}", a, b, c)),
    ]
}

/// Generate a relative path without leading slash.
fn asset_path_no_slash_strategy() -> impl Strategy<Value = String> {
    prop_oneof![
        base_segment_strategy(),
        (base_segment_strategy(), base_segment_strategy())
            .prop_map(|(a, b)| format!("{}/{}", a, b)),
    ]
}

/// Generate a site URL.
fn site_url_strategy() -> impl Strategy<Value = String> {
    prop_oneof![
        Just("https://example.com".to_string()),
        Just("https://example.com/".to_string()),
        base_segment_strategy().prop_map(|s| format!("https://{}.com", s)),
        base_segment_strategy().prop_map(|s| format!("https://{}.com/", s)),
    ]
}


// ── Property Tests: normalize_base_path ─────────────────────────────

proptest! {
    #![proptest_config(ProptestConfig::with_cases(100))]

    // ── P10.1: Normalized base-path always starts with `/` ─────────
    //
    // For any input string, normalize_base_path must return a string
    // that starts with `/`.
    #[test]
    fn normalized_starts_with_slash(bp in base_path_strategy()) {
        let result = normalize_base_path(&bp);
        prop_assert!(
            result.starts_with('/'),
            "normalize_base_path({:?}) = {:?} must start with '/'",
            bp,
            result
        );
    }

    // ── P10.2: Normalized base-path has no trailing slash (unless root) ──
    //
    // For any input, the result must not end with `/` unless it is
    // exactly "/".
    #[test]
    fn normalized_no_trailing_slash(bp in base_path_strategy()) {
        let result = normalize_base_path(&bp);
        if result != "/" {
            prop_assert!(
                !result.ends_with('/'),
                "normalize_base_path({:?}) = {:?} must not end with '/' (unless root)",
                bp,
                result
            );
        }
    }

    // ── P10.3: Idempotence — normalizing twice yields same result ──
    //
    // Applying normalize_base_path to its own output must be a no-op.
    #[test]
    fn normalized_is_idempotent(bp in base_path_strategy()) {
        let once = normalize_base_path(&bp);
        let twice = normalize_base_path(&once);
        prop_assert_eq!(
            &once,
            &twice,
            "normalize_base_path must be idempotent: {:?} -> {:?} -> {:?}",
            bp,
            once,
            twice
        );
    }

    // ── P10.4: Normalized result contains no whitespace ────────────
    //
    // Leading/trailing whitespace in the input must be stripped.
    #[test]
    fn normalized_no_leading_trailing_whitespace(bp in base_path_strategy()) {
        let result = normalize_base_path(&bp);
        let trimmed = result.trim().to_string();
        prop_assert_eq!(
            result,
            trimmed,
            "normalize_base_path({:?}) must have no leading/trailing whitespace",
            bp,
        );
    }
}

// ── Property Tests: prefix_with_base ────────────────────────────────

proptest! {
    #![proptest_config(ProptestConfig::with_cases(100))]

    // ── P10.5: Root base-path is identity ──────────────────────────
    //
    // When base_path is "/", prefix_with_base must return the path
    // unchanged.
    #[test]
    fn root_base_is_identity(path in asset_path_strategy()) {
        let result = prefix_with_base("/", &path);
        prop_assert_eq!(
            &result,
            &path,
            "prefix_with_base(\"/\", {:?}) must return path unchanged, got {:?}",
            path,
            result
        );
    }

    // ── P10.6: Non-root base-path is a proper prefix ───────────────
    //
    // When base_path is not "/", the result must start with the
    // normalized base_path and contain the original path.
    #[test]
    fn non_root_base_is_prefix(
        seg in base_segment_strategy(),
        path in asset_path_strategy()
    ) {
        let bp = format!("/{}", seg);
        let result = prefix_with_base(&bp, &path);
        let normalized_bp = normalize_base_path(&bp);

        prop_assert!(
            result.starts_with(&normalized_bp),
            "prefix_with_base({:?}, {:?}) = {:?} must start with {:?}",
            bp,
            path,
            result,
            normalized_bp
        );
        prop_assert!(
            result.contains(&path.trim_start_matches('/')),
            "prefix_with_base({:?}, {:?}) = {:?} must contain the original path segment",
            bp,
            path,
            result
        );
    }

    // ── P10.7: No double slashes in prefixed result ────────────────
    //
    // The result of prefix_with_base must never contain "//".
    #[test]
    fn no_double_slashes(bp in base_path_strategy(), path in asset_path_strategy()) {
        let result = prefix_with_base(&bp, &path);
        prop_assert!(
            !result.contains("//"),
            "prefix_with_base({:?}, {:?}) = {:?} must not contain '//'",
            bp,
            path,
            result
        );
    }

    // ── P10.8: Paths without leading slash are handled correctly ────
    //
    // When the asset path has no leading slash, the result must still
    // be well-formed with a `/` separator between base and path.
    #[test]
    fn path_without_leading_slash(
        seg in base_segment_strategy(),
        path in asset_path_no_slash_strategy()
    ) {
        let bp = format!("/{}", seg);
        let result = prefix_with_base(&bp, &path);
        let expected = format!("/{}/{}", seg, path);
        prop_assert_eq!(
            &result,
            &expected,
            "prefix_with_base({:?}, {:?}) must produce {:?}",
            bp,
            path,
            expected
        );
    }
}

// ── Property Tests: normalize_base_path_option ──────────────────────

proptest! {
    #![proptest_config(ProptestConfig::with_cases(100))]

    // ── P10.9: None and root produce empty string ──────────────────
    //
    // normalize_base_path_option(None), Some("/"), and Some("") must
    // all return "".
    #[test]
    fn option_root_variants_are_empty(
        bp in prop_oneof![
            Just(None::<String>),
            Just(Some("/".to_string())),
            Just(Some("".to_string())),
        ]
    ) {
        let result = normalize_base_path_option(bp.as_deref());
        prop_assert_eq!(
            &result,
            "",
            "normalize_base_path_option({:?}) must be empty",
            bp
        );
    }

    // ── P10.10: Non-root option produces leading slash, no trailing ─
    //
    // For any non-root base-path, the result must start with `/` and
    // not end with `/`.
    #[test]
    fn option_non_root_format(seg in base_segment_strategy()) {
        let bp = format!("/{}", seg);
        let result = normalize_base_path_option(Some(&bp));
        prop_assert!(
            result.starts_with('/'),
            "normalize_base_path_option(Some({:?})) = {:?} must start with '/'",
            bp,
            result
        );
        prop_assert!(
            !result.ends_with('/'),
            "normalize_base_path_option(Some({:?})) = {:?} must not end with '/'",
            bp,
            result
        );
    }
}

// ── Property Tests: build_full_url ──────────────────────────────────

proptest! {
    #![proptest_config(ProptestConfig::with_cases(100))]

    // ── P10.11: Full URL starts with site URL (no trailing slash) ──
    //
    // The result must always start with the site URL (trailing slash
    // stripped).
    #[test]
    fn full_url_starts_with_site(
        site_url in site_url_strategy(),
        bp in prop_oneof![Just("".to_string()), base_segment_strategy().prop_map(|s| format!("/{}", s))],
        path in asset_path_strategy()
    ) {
        let result = build_full_url(&site_url, &bp, &path);
        let expected_prefix = site_url.trim_end_matches('/');
        prop_assert!(
            result.starts_with(expected_prefix),
            "build_full_url({:?}, {:?}, {:?}) = {:?} must start with {:?}",
            site_url,
            bp,
            path,
            result,
            expected_prefix
        );
    }

    // ── P10.12: Full URL contains base-path and relative path ──────
    //
    // The result must contain both the base-path and the relative path
    // segments.
    #[test]
    fn full_url_contains_segments(
        seg in base_segment_strategy(),
        path_seg in base_segment_strategy()
    ) {
        let bp = format!("/{}", seg);
        let path = format!("/{}", path_seg);
        let result = build_full_url("https://example.com", &bp, &path);

        prop_assert!(
            result.contains(&seg),
            "build_full_url must contain base segment {:?}, got {:?}",
            seg,
            result
        );
        prop_assert!(
            result.contains(&path_seg),
            "build_full_url must contain path segment {:?}, got {:?}",
            path_seg,
            result
        );
    }

    // ── P10.13: Full URL with empty base-path ──────────────────────
    //
    // When base_path is empty, the result must be site_url + path.
    #[test]
    fn full_url_empty_base(path in asset_path_strategy()) {
        let result = build_full_url("https://example.com", "", &path);
        let expected = format!("https://example.com{}", path);
        prop_assert_eq!(
            &result,
            &expected,
            "build_full_url with empty base must be site + path"
        );
    }

    // ── P10.14: Full URL adds leading slash to relative path ───────
    //
    // When the relative path has no leading slash, the result must
    // still include a `/` before the path.
    #[test]
    fn full_url_adds_leading_slash(path in asset_path_no_slash_strategy()) {
        let result = build_full_url("https://example.com", "", &path);
        let expected = format!("https://example.com/{}", path);
        prop_assert_eq!(
            &result,
            &expected,
            "build_full_url must add leading slash to relative path"
        );
    }

    // ── P10.15: Full URL no double slashes after scheme ────────────
    //
    // The result must not contain "//" except in the "https://" scheme.
    #[test]
    fn full_url_no_double_slashes(
        bp in prop_oneof![Just("".to_string()), base_segment_strategy().prop_map(|s| format!("/{}", s))],
        path in asset_path_strategy()
    ) {
        let result = build_full_url("https://example.com", &bp, &path);
        // Strip the scheme prefix, then check for no "//"
        let after_scheme = result.strip_prefix("https://").unwrap_or(&result);
        prop_assert!(
            !after_scheme.contains("//"),
            "build_full_url({:?}, {:?}) = {:?} must not contain '//' after scheme",
            bp,
            path,
            result
        );
    }
}
