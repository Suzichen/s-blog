//! Cross-platform path utilities.
//!
//! All public helpers normalise paths to use `/` as the separator so that
//! generated artifacts are identical on Windows, macOS and Linux.

use std::path::Path;

/// Normalize a [`std::path::Path`] to a string that always uses `/` separators.
///
/// This is the single canonical place where platform-specific path separators
/// are converted so that every generated JSON / HTML / XML file contains
/// forward-slash paths regardless of the build OS.
pub fn normalize_path(p: &Path) -> String {
    p.to_string_lossy().replace('\\', "/")
}

/// Join `base` and `rel` and return a forward-slash string.
pub fn join_and_normalize(base: &Path, rel: &str) -> String {
    base.join(rel).to_string_lossy().replace('\\', "/")
}

/// Ensure a base-path string has a leading `/` and no trailing `/`
/// (unless it *is* just `"/"`).
pub fn normalize_base_path(bp: &str) -> String {
    let mut s = bp.trim().to_string();
    if s.is_empty() {
        return "/".to_string();
    }
    if !s.starts_with('/') {
        s.insert(0, '/');
    }
    if s.len() > 1 && s.ends_with('/') {
        s.pop();
    }
    s
}

/// Prefix `path` with `base_path`, handling double-slash edge cases.
pub fn prefix_with_base(base_path: &str, path: &str) -> String {
    let base = normalize_base_path(base_path);
    if base == "/" {
        return path.to_string();
    }
    if path.starts_with('/') {
        format!("{}{}", base, path)
    } else {
        format!("{}/{}", base, path)
    }
}

/// Normalize an `Option<&str>` base-path into a URL prefix string.
///
/// Returns `""` for `None`, `Some("")`, or `Some("/")`.
/// Returns a leading-slash, no-trailing-slash string like `"/blog"` otherwise.
///
/// This is the single canonical helper that all modules (seo, sitemap,
/// rss, albums, robots) should use instead of duplicating the logic.
pub fn normalize_base_path_option(base_path: Option<&str>) -> String {
    match base_path {
        None => String::new(),
        Some(bp) => {
            let normalized = normalize_base_path(bp);
            if normalized == "/" {
                String::new()
            } else {
                normalized
            }
        }
    }
}

/// Build a full URL: `{site_url}{base_path}{relative_path}`.
///
/// - `site_url` trailing slashes are stripped.
/// - `relative_path` gets a leading `/` if it doesn't have one.
pub fn build_full_url(site_url: &str, base_path: &str, relative_path: &str) -> String {
    let base_url = site_url.trim_end_matches('/');
    let path = if relative_path.starts_with('/') {
        relative_path.to_string()
    } else {
        format!("/{}", relative_path)
    };
    format!("{}{}{}", base_url, base_path, path)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn normalize_base_path_default() {
        assert_eq!(normalize_base_path("/"), "/");
        assert_eq!(normalize_base_path(""), "/");
    }

    #[test]
    fn normalize_base_path_strips_trailing_slash() {
        assert_eq!(normalize_base_path("/blog/"), "/blog");
    }

    #[test]
    fn normalize_base_path_adds_leading_slash() {
        assert_eq!(normalize_base_path("blog"), "/blog");
    }

    #[test]
    fn prefix_with_base_root() {
        assert_eq!(prefix_with_base("/", "/posts/hello"), "/posts/hello");
    }

    #[test]
    fn prefix_with_base_subdir() {
        assert_eq!(
            prefix_with_base("/blog", "/posts/hello"),
            "/blog/posts/hello"
        );
    }

    #[test]
    fn normalize_base_path_option_none() {
        assert_eq!(normalize_base_path_option(None), "");
    }

    #[test]
    fn normalize_base_path_option_root() {
        assert_eq!(normalize_base_path_option(Some("/")), "");
        assert_eq!(normalize_base_path_option(Some("")), "");
    }

    #[test]
    fn normalize_base_path_option_subdir() {
        assert_eq!(normalize_base_path_option(Some("/blog")), "/blog");
        assert_eq!(normalize_base_path_option(Some("/blog/")), "/blog");
    }

    #[test]
    fn build_full_url_basic() {
        assert_eq!(
            build_full_url("https://example.com", "", "/post/hello"),
            "https://example.com/post/hello"
        );
    }

    #[test]
    fn build_full_url_with_base_path() {
        assert_eq!(
            build_full_url("https://example.com", "/blog", "/post/hello"),
            "https://example.com/blog/post/hello"
        );
    }

    #[test]
    fn build_full_url_strips_trailing_slash() {
        assert_eq!(
            build_full_url("https://example.com/", "", "/post/hello"),
            "https://example.com/post/hello"
        );
    }

    #[test]
    fn build_full_url_adds_leading_slash() {
        assert_eq!(
            build_full_url("https://example.com", "", "post/hello"),
            "https://example.com/post/hello"
        );
    }
}
