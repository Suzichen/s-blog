//! Shell (app shell) utilities for the build pipeline.
//!
//! The primary function here is [`rewrite_base_path`], which rewrites
//! relative `./` asset references in HTML `href` and `src` attributes
//! to use the configured `basePath`.

use regex::Regex;

/// Normalize a base-path string for use in HTML attribute rewriting.
///
/// Rules:
/// 1. Trim whitespace
/// 2. Strip trailing slashes
/// 3. Ensure leading slash (unless result would be just `"/"`)
/// 4. If input is `"/"` or empty after trimming, return `""` (empty string)
///
/// This differs from [`crate::path_util::normalize_base_path`] in that
/// root paths produce an empty string rather than `"/"`, which is needed
/// so that `href="./assets/style.css"` becomes `href="/assets/style.css"`
/// (not `href="//assets/style.css"`).
pub fn normalize_base_path(base_path: &str) -> String {
    let mut s = base_path.trim().to_string();

    // Strip trailing slashes
    while s.ends_with('/') {
        s.pop();
    }

    // Empty after stripping means root — return empty string
    if s.is_empty() {
        return String::new();
    }

    // Ensure leading slash
    if !s.starts_with('/') {
        s.insert(0, '/');
    }

    // If result is just "/" (shouldn't happen after stripping above, but guard)
    if s == "/" {
        return String::new();
    }

    s
}

/// Rewrite relative `./` asset references in HTML `href` and `src` attributes
/// to use the given `base_path`.
///
/// Only matches HTML attribute contexts: `href="./..."` and `src="./..."`.
/// Text content outside attributes, HTML comments, and script/style blocks
/// are not touched (because the regex only matches the attribute pattern).
///
/// This function is **idempotent**: applying it twice produces the same result,
/// because after the first rewrite no `./` remains in href/src attributes.
///
/// # Examples
///
/// ```
/// use s_blog_engine::shell::rewrite_base_path;
///
/// let html = r#"<link href="./assets/style.css">"#;
/// let result = rewrite_base_path(html, "/blog");
/// assert_eq!(result, r#"<link href="/blog/assets/style.css">"#);
///
/// // Idempotent: second application is a no-op
/// let again = rewrite_base_path(&result, "/blog");
/// assert_eq!(again, result);
/// ```
pub fn rewrite_base_path(html: &str, base_path: &str) -> String {
    let pattern = Regex::new(r#"(href|src)="\./"#).unwrap();
    let base = normalize_base_path(base_path);
    let replacement = format!(r#"${{1}}="{base}/"#);
    pattern.replace_all(html, replacement.as_str()).into_owned()
}

#[cfg(test)]
mod tests {
    use super::*;
    use proptest::prelude::*;

    // ── normalize_base_path tests ──────────────────────────────────

    #[test]
    fn normalize_empty_returns_empty() {
        assert_eq!(normalize_base_path(""), "");
    }

    #[test]
    fn normalize_root_returns_empty() {
        assert_eq!(normalize_base_path("/"), "");
    }

    #[test]
    fn normalize_strips_trailing_slash() {
        assert_eq!(normalize_base_path("/blog/"), "/blog");
    }

    #[test]
    fn normalize_ensures_leading_slash() {
        assert_eq!(normalize_base_path("blog"), "/blog");
    }

    #[test]
    fn normalize_trims_whitespace() {
        assert_eq!(normalize_base_path("  /blog  "), "/blog");
    }

    #[test]
    fn normalize_complex_path() {
        assert_eq!(normalize_base_path("/docs/v2/"), "/docs/v2");
    }

    #[test]
    fn normalize_multiple_trailing_slashes() {
        assert_eq!(normalize_base_path("/blog///"), "/blog");
    }

    // ── rewrite_base_path tests ────────────────────────────────────

    #[test]
    fn rewrite_href_with_base() {
        let html = r#"<link href="./assets/style.css">"#;
        let result = rewrite_base_path(html, "/blog");
        assert_eq!(result, r#"<link href="/blog/assets/style.css">"#);
    }

    #[test]
    fn rewrite_src_with_base() {
        let html = r#"<script src="./js/app.js"></script>"#;
        let result = rewrite_base_path(html, "/blog");
        assert_eq!(result, r#"<script src="/blog/js/app.js"></script>"#);
    }

    #[test]
    fn rewrite_root_base_path() {
        let html = r#"<link href="./assets/style.css">"#;
        let result = rewrite_base_path(html, "/");
        assert_eq!(result, r#"<link href="/assets/style.css">"#);
    }

    #[test]
    fn rewrite_empty_base_path() {
        let html = r#"<link href="./assets/style.css">"#;
        let result = rewrite_base_path(html, "");
        assert_eq!(result, r#"<link href="/assets/style.css">"#);
    }

    #[test]
    fn rewrite_multiple_attributes() {
        let html = r#"<link href="./css/a.css"><script src="./js/b.js"></script>"#;
        let result = rewrite_base_path(html, "/blog");
        assert_eq!(
            result,
            r#"<link href="/blog/css/a.css"><script src="/blog/js/b.js"></script>"#
        );
    }

    #[test]
    fn rewrite_does_not_touch_text_content() {
        let html = r#"<p>See ./readme for details</p><link href="./style.css">"#;
        let result = rewrite_base_path(html, "/blog");
        // Text content "./readme" is untouched, only href is rewritten
        assert_eq!(
            result,
            r#"<p>See ./readme for details</p><link href="/blog/style.css">"#
        );
    }

    #[test]
    fn rewrite_does_not_touch_non_relative_paths() {
        let html = r#"<link href="/absolute/style.css"><link href="./relative/style.css">"#;
        let result = rewrite_base_path(html, "/blog");
        assert_eq!(
            result,
            r#"<link href="/absolute/style.css"><link href="/blog/relative/style.css">"#
        );
    }

    #[test]
    fn rewrite_idempotent() {
        let html = r#"<link href="./assets/style.css"><script src="./js/app.js"></script>"#;
        let first = rewrite_base_path(html, "/blog");
        let second = rewrite_base_path(&first, "/blog");
        assert_eq!(first, second, "rewrite_base_path must be idempotent");
    }

    #[test]
    fn rewrite_idempotent_root() {
        let html = r#"<link href="./assets/style.css">"#;
        let first = rewrite_base_path(html, "/");
        let second = rewrite_base_path(&first, "/");
        assert_eq!(first, second, "rewrite_base_path must be idempotent for root");
    }

    // Feature: engine-cli-commands, Property 1: basePath HTML rewrite
    proptest! {
        #[test]
        fn prop_no_dot_slash_remains_in_attributes(
            base in "[a-z]{1,5}(/[a-z]{1,5}){0,3}",
            file_path in "[a-z]{1,8}\\.[a-z]{2,4}",
        ) {
            let html = format!(r#"<link href="./{file_path}"><script src="./{file_path}"></script>"#);
            let result = rewrite_base_path(&html, &base);
            // No href="./ or src="./ should remain
            assert!(!result.contains(r#"href="./"#), "href still contains ./ : {result}");
            assert!(!result.contains(r#"src="./"#), "src still contains ./ : {result}");
        }

        #[test]
        fn prop_text_outside_attributes_unchanged(
            base in "[a-z]{1,5}(/[a-z]{1,5}){0,2}",
            text in "[a-zA-Z0-9 ./]{1,30}",
            file_path in "[a-z]{1,8}\\.[a-z]{2,4}",
        ) {
            let html = format!(r#"<p>{text}</p><link href="./{file_path}">"#);
            let result = rewrite_base_path(&html, &base);
            // Text content must be preserved exactly
            assert!(result.contains(&format!("<p>{text}</p>")), "text was modified: {result}");
        }

        #[test]
        fn prop_idempotent(
            base in "[a-z]{1,5}(/[a-z]{1,5}){0,2}",
            file_path in "[a-z]{1,8}\\.[a-z]{2,4}",
        ) {
            let html = format!(r#"<link href="./{file_path}"><script src="./{file_path}"></script>"#);
            let first = rewrite_base_path(&html, &base);
            let second = rewrite_base_path(&first, &base);
            prop_assert_eq!(&first, &second, "rewrite must be idempotent");
        }
    }
}
