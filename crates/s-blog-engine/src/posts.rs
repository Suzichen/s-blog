//! Blog post manifest generation.
//!
//! Scans a posts directory, parses frontmatter, and produces
//! `manifest.json` sorted by date descending. Optionally copies
//! Markdown source files to an output directory.

use std::fs;
use std::path::Path;

use log::warn;

use crate::error::EngineError;
use crate::frontmatter::parse_frontmatter;
use crate::timezone::{format_date_with_tz, resolve_timezone};
use crate::PostMetadata;
use crate::SiteConfig;

// ── Summary extraction ─────────────────────────────────────────────

/// Strip common Markdown syntax and return plain text.
///
/// Procedural implementation that avoids pulling in the `regex` crate.
/// Mirrors the TypeScript `getSummary` helper: images, links, code
/// blocks, headings, bold, italic are removed and newlines collapsed.
fn strip_markdown(body: &str) -> String {
    let mut result = String::with_capacity(body.len());
    let chars: Vec<char> = body.chars().collect();
    let len = chars.len();
    let mut i = 0;

    while i < len {
        // --- Fenced code blocks: ```...``` ---
        if i + 2 < len && chars[i] == '`' && chars[i + 1] == '`' && chars[i + 2] == '`' {
            // Skip to closing ```
            i += 3;
            loop {
                if i + 2 < len && chars[i] == '`' && chars[i + 1] == '`' && chars[i + 2] == '`' {
                    i += 3;
                    break;
                }
                if i >= len {
                    break;
                }
                i += 1;
            }
            continue;
        }

        // --- Inline code: `...` ---
        if chars[i] == '`' {
            i += 1;
            while i < len && chars[i] != '`' {
                i += 1;
            }
            if i < len {
                i += 1; // skip closing `
            }
            continue;
        }

        // --- Images: ![alt](url) ---
        if chars[i] == '!' && i + 1 < len && chars[i + 1] == '[' {
            // Skip ![...](...) entirely
            i += 2;
            // skip to ]
            while i < len && chars[i] != ']' {
                i += 1;
            }
            if i < len {
                i += 1; // skip ]
            }
            // skip (...)
            if i < len && chars[i] == '(' {
                i += 1;
                while i < len && chars[i] != ')' {
                    i += 1;
                }
                if i < len {
                    i += 1; // skip )
                }
            }
            continue;
        }

        // --- Links: [text](url) → keep text ---
        if chars[i] == '[' {
            let start = i + 1;
            i += 1;
            while i < len && chars[i] != ']' {
                i += 1;
            }
            let text_end = i;
            if i < len {
                i += 1; // skip ]
            }
            if i < len && chars[i] == '(' {
                // It's a link — emit the text portion
                let link_text: String = chars[start..text_end].iter().collect();
                result.push_str(&link_text);
                i += 1;
                while i < len && chars[i] != ')' {
                    i += 1;
                }
                if i < len {
                    i += 1; // skip )
                }
                continue;
            } else {
                // Not a link, emit the [ and text
                result.push('[');
                let text: String = chars[start..text_end].iter().collect();
                result.push_str(&text);
                // i is already past ]
                continue;
            }
        }

        // --- Headings at start of line: # ... ---
        if chars[i] == '#' {
            // Check if at start of string or after newline
            let at_line_start = i == 0 || chars[i - 1] == '\n';
            if at_line_start {
                while i < len && chars[i] == '#' {
                    i += 1;
                }
                // skip space after #
                if i < len && chars[i] == ' ' {
                    i += 1;
                }
                continue;
            }
        }

        // --- Bold: **text** or __text__ ---
        // Only strip if a matching closing marker exists (mirrors TS
        // regex which simply doesn't match unclosed markers).
        if i + 1 < len
            && ((chars[i] == '*' && chars[i + 1] == '*')
                || (chars[i] == '_' && chars[i + 1] == '_'))
        {
            let marker = chars[i];
            // Look ahead for closing marker pair.
            let mut j = i + 2;
            let mut found_close = false;
            while j + 1 < len {
                if chars[j] == marker && chars[j + 1] == marker {
                    found_close = true;
                    break;
                }
                j += 1;
            }
            if found_close {
                // Emit inner text, skip both marker pairs.
                let inner: String = chars[i + 2..j].iter().collect();
                result.push_str(&inner);
                i = j + 2;
                continue;
            }
            // No closing marker — emit the opening markers literally
            // (TS regex would not match, leaving them in place).
            result.push(marker);
            result.push(marker);
            i += 2;
            continue;
        }

        // --- Italic: *text* or _text_ (single) ---
        // Same principle: only strip when a closing marker exists.
        if (chars[i] == '*' || chars[i] == '_')
            && i + 1 < len
            && chars[i + 1] != ' '
            && chars[i + 1] != chars[i]
        {
            let marker = chars[i];
            // Look ahead for closing marker.
            let mut j = i + 1;
            let mut found_close = false;
            while j < len {
                if chars[j] == marker {
                    found_close = true;
                    break;
                }
                j += 1;
            }
            if found_close {
                let inner: String = chars[i + 1..j].iter().collect();
                result.push_str(&inner);
                i = j + 1;
                continue;
            }
            // No closing marker — emit literally.
            result.push(marker);
            i += 1;
            continue;
        }

        // --- Newlines → space ---
        // Match TS behaviour: `.replace(/\n+/g, ' ')` only collapses
        // `\n` runs into a single space; `\r` is left as-is so that
        // Windows `\r\n` produces `\r ` (same as the TS golden output).
        if chars[i] == '\n' {
            while i < len && chars[i] == '\n' {
                i += 1;
            }
            result.push(' ');
            continue;
        }

        result.push(chars[i]);
        i += 1;
    }

    result
}

/// Build a plain-text summary from the Markdown body.
///
/// Truncation uses **character count** (not byte count) to match the
/// TypeScript `plainText.substring(0, length)` behaviour. JS
/// `substring` counts UTF-16 code units, which for all BMP characters
/// (including CJK) equals the Unicode scalar count that Rust's
/// `chars()` iterator produces.
fn build_summary(body: &str, max_chars: usize) -> String {
    let plain = strip_markdown(body);
    let trimmed = plain.trim();
    let char_count = trimmed.chars().count();
    if char_count > max_chars {
        let truncated: String = trimmed.chars().take(max_chars).collect();
        format!("{}...", truncated)
    } else {
        trimmed.to_string()
    }
}


// ── Public API ─────────────────────────────────────────────────────

/// Generate the posts manifest and optionally copy Markdown files.
///
/// # Arguments
///
/// * `posts_dir`  – Directory containing `*.md` files.
/// * `output_dir` – Root output directory. Manifest is written to
///   `{output_dir}/generated/manifest.json` and Markdown files are
///   copied to `{output_dir}/posts/`.
/// * `config`     – Site configuration (used for timezone).
///
/// # Errors
///
/// Returns [`EngineError::DirectoryNotFound`] if `posts_dir` does not
/// exist.
pub fn generate_posts_data(
    posts_dir: &Path,
    output_dir: &Path,
    config: &SiteConfig,
) -> Result<Vec<PostMetadata>, EngineError> {
    if !posts_dir.exists() {
        return Err(EngineError::DirectoryNotFound(posts_dir.to_path_buf()));
    }

    // Pre-resolve timezone once for the whole loop.
    let tz = config
        .timezone
        .as_deref()
        .and_then(resolve_timezone);

    // Collect .md files
    let mut md_files: Vec<String> = Vec::new();
    for entry in fs::read_dir(posts_dir)? {
        let entry = entry?;
        let name = entry.file_name().to_string_lossy().to_string();
        if name.ends_with(".md") {
            md_files.push(name);
        }
    }
    md_files.sort(); // deterministic iteration order

    let mut posts: Vec<PostMetadata> = Vec::with_capacity(md_files.len());

    for file_name in &md_files {
        let file_path = posts_dir.join(file_name);
        let content = fs::read_to_string(&file_path).map_err(|e| {
            warn!("Failed to read {}: {}", file_name, e);
            e
        })?;

        let slug = file_name.strip_suffix(".md").unwrap_or(file_name).to_string();

        let (fm, body) = match parse_frontmatter(&content, file_name) {
            Ok(pair) => pair,
            Err(e) => {
                warn!("Skipping {} due to frontmatter error: {}", file_name, e);
                continue;
            }
        };

        // Format date using timezone module
        let date_str = match &fm.date {
            Some(d) => format_date_with_tz(d, tz),
            None => String::new(),
        };

        // Summary: prefer frontmatter preview/description/excerpt, fall back to body
        let summary = fm
            .preview
            .or(fm.description)
            .or(fm.excerpt)
            .unwrap_or_else(|| build_summary(body, 140));

        let title = fm.title.unwrap_or_else(|| slug.clone());

        posts.push(PostMetadata {
            slug,
            title,
            date: date_str,
            tags: fm.tags,
            categories: fm.categories,
            summary,
        });
    }

    // Sort by date descending (lexicographic on ISO strings works fine).
    posts.sort_by(|a, b| b.date.cmp(&a.date));

    // Write manifest.json
    let manifest_dir = output_dir.join("generated");
    fs::create_dir_all(&manifest_dir)?;
    let manifest_path = manifest_dir.join("manifest.json");
    let json = serde_json::to_string_pretty(&posts)?;
    fs::write(&manifest_path, &json)?;

    // Copy markdown files to output_dir/posts/
    let posts_output = output_dir.join("posts");
    fs::create_dir_all(&posts_output)?;
    for file_name in &md_files {
        let src = posts_dir.join(file_name);
        let dst = posts_output.join(file_name);
        fs::copy(&src, &dst)?;
    }

    Ok(posts)
}

// ── Tests ──────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use tempfile::TempDir;

    /// Helper: create a temp posts dir with given files.
    fn setup_posts(files: &[(&str, &str)]) -> TempDir {
        let dir = TempDir::new().unwrap();
        for (name, content) in files {
            fs::write(dir.path().join(name), content).unwrap();
        }
        dir
    }

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

    #[test]
    fn generates_manifest_for_single_post() {
        let posts = setup_posts(&[(
            "hello.md",
            "---\ntitle: Hello World\ndate: 2025-01-15 10:30:00\ntags: [intro]\ncategories: [General]\npreview: My first post\n---\nBody here.",
        )]);
        let out = TempDir::new().unwrap();

        let result = generate_posts_data(posts.path(), out.path(), &default_config()).unwrap();

        assert_eq!(result.len(), 1);
        assert_eq!(result[0].slug, "hello");
        assert_eq!(result[0].title, "Hello World");
        assert_eq!(result[0].date, "2025-01-15T10:30:00");
        assert_eq!(result[0].tags, vec!["intro"]);
        assert_eq!(result[0].categories, vec!["General"]);
        assert_eq!(result[0].summary, "My first post");

        // manifest.json should exist
        let manifest = out.path().join("generated/manifest.json");
        assert!(manifest.exists());

        // Markdown file should be copied
        let copied = out.path().join("posts/hello.md");
        assert!(copied.exists());
    }

    #[test]
    fn sorts_posts_by_date_descending() {
        let posts = setup_posts(&[
            (
                "old.md",
                "---\ntitle: Old\ndate: 2024-01-01 00:00:00\n---\n",
            ),
            (
                "new.md",
                "---\ntitle: New\ndate: 2025-06-01 00:00:00\n---\n",
            ),
            (
                "mid.md",
                "---\ntitle: Mid\ndate: 2025-01-01 00:00:00\n---\n",
            ),
        ]);
        let out = TempDir::new().unwrap();

        let result = generate_posts_data(posts.path(), out.path(), &default_config()).unwrap();

        assert_eq!(result[0].slug, "new");
        assert_eq!(result[1].slug, "mid");
        assert_eq!(result[2].slug, "old");
    }

    #[test]
    fn uses_slug_as_title_when_missing() {
        let posts = setup_posts(&[("no-title.md", "---\ndate: 2025-01-01\n---\nBody")]);
        let out = TempDir::new().unwrap();

        let result = generate_posts_data(posts.path(), out.path(), &default_config()).unwrap();

        assert_eq!(result[0].title, "no-title");
    }

    #[test]
    fn returns_error_for_missing_directory() {
        let out = TempDir::new().unwrap();
        let missing = Path::new("/tmp/nonexistent_posts_dir_12345");

        let result = generate_posts_data(missing, out.path(), &default_config());

        assert!(result.is_err());
        match result.unwrap_err() {
            EngineError::DirectoryNotFound(_) => {}
            other => panic!("Expected DirectoryNotFound, got: {:?}", other),
        }
    }

    #[test]
    fn handles_empty_posts_directory() {
        let posts = setup_posts(&[]);
        let out = TempDir::new().unwrap();

        let result = generate_posts_data(posts.path(), out.path(), &default_config()).unwrap();

        assert!(result.is_empty());
        // manifest.json should still be created (empty array)
        let manifest = out.path().join("generated/manifest.json");
        assert!(manifest.exists());
        let content = fs::read_to_string(manifest).unwrap();
        assert_eq!(content.trim(), "[]");
    }

    #[test]
    fn ignores_non_md_files() {
        let posts = setup_posts(&[
            ("post.md", "---\ntitle: Post\ndate: 2025-01-01\n---\n"),
            ("readme.txt", "not a post"),
            ("image.png", "binary data"),
        ]);
        let out = TempDir::new().unwrap();

        let result = generate_posts_data(posts.path(), out.path(), &default_config()).unwrap();

        assert_eq!(result.len(), 1);
        assert_eq!(result[0].slug, "post");
    }

    #[test]
    fn applies_timezone_conversion() {
        let posts = setup_posts(&[(
            "tz.md",
            "---\ntitle: TZ Post\ndate: 2025-01-01T09:00:00+00:00\n---\n",
        )]);
        let out = TempDir::new().unwrap();

        let mut config = default_config();
        config.timezone = Some("Asia/Tokyo".into());

        let result = generate_posts_data(posts.path(), out.path(), &config).unwrap();

        assert_eq!(result[0].date, "2025-01-01T18:00:00");
    }

    #[test]
    fn summary_falls_back_to_body() {
        let posts = setup_posts(&[(
            "no-preview.md",
            "---\ntitle: No Preview\ndate: 2025-01-01\n---\nThis is the body content of the post.",
        )]);
        let out = TempDir::new().unwrap();

        let result = generate_posts_data(posts.path(), out.path(), &default_config()).unwrap();

        assert!(result[0].summary.contains("This is the body content"));
    }

    #[test]
    fn prefers_preview_over_description() {
        let posts = setup_posts(&[(
            "both.md",
            "---\ntitle: Both\ndate: 2025-01-01\npreview: The preview\ndescription: The description\n---\nBody",
        )]);
        let out = TempDir::new().unwrap();

        let result = generate_posts_data(posts.path(), out.path(), &default_config()).unwrap();

        assert_eq!(result[0].summary, "The preview");
    }

    #[test]
    fn uses_description_when_no_preview() {
        let posts = setup_posts(&[(
            "desc.md",
            "---\ntitle: Desc\ndate: 2025-01-01\ndescription: The description\n---\nBody",
        )]);
        let out = TempDir::new().unwrap();

        let result = generate_posts_data(posts.path(), out.path(), &default_config()).unwrap();

        assert_eq!(result[0].summary, "The description");
    }

    // ── strip_markdown tests ───────────────────────────────────────

    #[test]
    fn strip_markdown_removes_headings() {
        let input = "## Hello\nWorld";
        let result = strip_markdown(input);
        assert!(result.contains("Hello"));
        assert!(result.contains("World"));
        assert!(!result.contains("##"));
    }

    #[test]
    fn strip_markdown_removes_images() {
        let input = "Before ![alt](url) After";
        let result = strip_markdown(input);
        assert!(result.contains("Before"));
        assert!(result.contains("After"));
        assert!(!result.contains("alt"));
        assert!(!result.contains("url"));
    }

    #[test]
    fn strip_markdown_keeps_link_text() {
        let input = "Click [here](https://example.com) now";
        let result = strip_markdown(input);
        assert!(result.contains("here"));
        assert!(!result.contains("https://example.com"));
    }

    #[test]
    fn strip_markdown_removes_bold() {
        let input = "This is **bold** text";
        let result = strip_markdown(input);
        assert!(result.contains("bold"));
        assert!(!result.contains("**"));
    }

    #[test]
    fn strip_markdown_removes_code_blocks() {
        let input = "Before\n```\ncode here\n```\nAfter";
        let result = strip_markdown(input);
        assert!(result.contains("Before"));
        assert!(result.contains("After"));
        assert!(!result.contains("code here"));
    }

    #[test]
    fn build_summary_truncates_long_text() {
        let long_body = "A".repeat(200);
        let summary = build_summary(&long_body, 140);
        assert!(summary.ends_with("..."));
        // 140 chars + "..."
        assert_eq!(summary.chars().count(), 143);
    }

    #[test]
    fn build_summary_truncates_by_char_not_byte() {
        // Each CJK character is 3 bytes in UTF-8 but 1 char.
        // TS substring(0, 140) would keep 140 CJK characters.
        let cjk_body = "你".repeat(200);
        let summary = build_summary(&cjk_body, 140);
        assert!(summary.ends_with("..."));
        // Should be exactly 140 CJK chars + "..."
        assert_eq!(summary.chars().count(), 143);
        // And NOT truncated at 140 bytes (which would be ~46 chars).
        let without_dots = summary.trim_end_matches("...");
        assert_eq!(without_dots.chars().count(), 140);
    }

    #[test]
    fn build_summary_no_truncation_for_short_text() {
        let summary = build_summary("Short body", 140);
        assert_eq!(summary, "Short body");
        assert!(!summary.contains("..."));
    }

    // ── unclosed marker tests ──────────────────────────────────────

    #[test]
    fn strip_markdown_unclosed_bold_preserved() {
        // TS regex /(\*\*|__)(.*?)\1/g won't match unclosed **
        let input = "This is **unclosed bold";
        let result = strip_markdown(input);
        assert!(result.contains("**"), "unclosed ** should be preserved, got: {}", result);
        assert!(result.contains("unclosed bold"));
    }

    #[test]
    fn strip_markdown_unclosed_italic_preserved() {
        let input = "This is *unclosed italic";
        let result = strip_markdown(input);
        assert!(result.contains("*"), "unclosed * should be preserved, got: {}", result);
        assert!(result.contains("unclosed italic"));
    }
}
