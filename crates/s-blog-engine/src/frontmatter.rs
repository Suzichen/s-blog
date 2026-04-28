//! Markdown YAML frontmatter parsing.
//!
//! Extracts metadata delimited by `---` markers and normalises
//! tags / categories into `Vec<String>`.

use crate::error::EngineError;
use log::warn;

/// Parsed frontmatter data from a Markdown file.
#[derive(Debug, Clone, Default, PartialEq)]
pub struct FrontmatterData {
    pub title: Option<String>,
    /// Raw date string as written in the frontmatter.
    /// `None` = field absent, `Some("")` = present but invalid.
    pub date: Option<String>,
    pub tags: Vec<String>,
    pub categories: Vec<String>,
    pub preview: Option<String>,
    pub description: Option<String>,
    pub excerpt: Option<String>,
}

/// Split a Markdown document into its YAML frontmatter block and the
/// remaining body content.
///
/// Returns `(yaml_str, body)`. If no frontmatter is found the yaml
/// portion is empty and body is the full input.
fn split_frontmatter(content: &str) -> (&str, &str) {
    let trimmed = content.trim_start();
    if !trimmed.starts_with("---") {
        return ("", content);
    }

    // Skip past the opening `---` line.
    let after_open = match trimmed.strip_prefix("---") {
        Some(rest) => rest,
        None => return ("", content),
    };

    // Consume the rest of the opening line (could be `---\n` or `---\r\n`).
    let mut after_open = after_open;
    if after_open.starts_with('\r') {
        after_open = &after_open[1..];
    }
    if after_open.starts_with('\n') {
        after_open = &after_open[1..];
    }

    // Find the closing `---`.
    // It must be at the start of a line.
    if after_open.starts_with("---") {
        let mut rest = &after_open[3..];
        if rest.starts_with('\r') {
            rest = &rest[1..];
        }
        if rest.starts_with('\n') {
            rest = &rest[1..];
        }
        ("", rest)
    } else if let Some(end) = after_open.find("\n---") {
        let yaml = &after_open[..end];
        // Strip trailing \r that precedes \n on Windows-style line endings.
        let yaml = yaml.strip_suffix('\r').unwrap_or(yaml);
        let mut rest = &after_open[end + 4..]; // skip `\n---`
        // Skip optional trailing chars on the closing `---` line.
        if rest.starts_with('\r') {
            rest = &rest[1..];
        }
        if rest.starts_with('\n') {
            rest = &rest[1..];
        }
        (yaml, rest)
    } else {
        // No closing delimiter — treat entire remainder as yaml (graceful).
        (after_open, "")
    }
}

/// Normalise a YAML value into a `Vec<String>`.
///
/// Accepts:
/// - A YAML sequence (`[a, b, c]`)
/// - A space-separated string (`"a b c"`)
/// - A comma-separated string (`"a, b, c"`)
/// - A mixed separator string (`"a, b c"`)
///
/// Empty / null values produce an empty vec.
pub fn normalize_array(value: &serde_yaml::Value) -> Vec<String> {
    match value {
        serde_yaml::Value::Sequence(seq) => seq
            .iter()
            .filter_map(|v| match v {
                serde_yaml::Value::String(s) => {
                    let s = s.trim().to_string();
                    if s.is_empty() {
                        None
                    } else {
                        Some(s)
                    }
                }
                serde_yaml::Value::Number(n) => Some(n.to_string()),
                serde_yaml::Value::Bool(b) => Some(b.to_string()),
                _ => None,
            })
            .collect(),
        serde_yaml::Value::String(s) => s
            .split(|c: char| c == ',' || c.is_whitespace())
            .map(|s| s.trim().to_string())
            .filter(|s| !s.is_empty())
            .collect(),
        serde_yaml::Value::Null => Vec::new(),
        _ => Vec::new(),
    }
}

/// Check whether `date_str` looks like a valid date.
///
/// Covers the common formats found in blog frontmatter:
/// - RFC 3339 / ISO 8601 with T separator (`2024-06-15T10:30:00+09:00`)
/// - Space-separated with offset (`2025-01-01 18:00:00+09:00`)
/// - Naive datetime (`2025-01-01 10:30:00`)
/// - Date only (`2025-01-01`)
fn is_valid_date(date_str: &str) -> bool {
    let s = date_str.trim();
    if s.is_empty() {
        return false;
    }

    // 1. RFC 3339 (e.g. 2024-06-15T10:30:00+09:00)
    if chrono::DateTime::parse_from_rfc3339(s).is_ok() {
        return true;
    }

    // 2. Formats that include a timezone offset — must use DateTime::parse_from_str
    //    because NaiveDateTime cannot handle %z / %:z.
    let offset_formats = [
        "%Y-%m-%d %H:%M:%S%:z",
        "%Y-%m-%dT%H:%M:%S%:z",
    ];
    for fmt in offset_formats {
        if chrono::DateTime::parse_from_str(s, fmt).is_ok() {
            return true;
        }
    }

    // 3. Naive (no offset) formats
    let naive_formats = [
        "%Y-%m-%d %H:%M:%S",
        "%Y-%m-%d %H:%M",
    ];
    for fmt in naive_formats {
        if chrono::NaiveDateTime::parse_from_str(s, fmt).is_ok() {
            return true;
        }
    }

    // 4. Date-only
    if chrono::NaiveDate::parse_from_str(s, "%Y-%m-%d").is_ok() {
        return true;
    }

    false
}

/// Parse the YAML frontmatter of a Markdown document.
///
/// Returns the parsed [`FrontmatterData`] and the body content after
/// the frontmatter block.
///
/// # Errors
///
/// Returns [`EngineError::FrontmatterParse`] when the YAML block
/// cannot be parsed.
pub fn parse_frontmatter<'a>(
    content: &'a str,
    file_name: &str,
) -> Result<(FrontmatterData, &'a str), EngineError> {
    let (yaml_str, body) = split_frontmatter(content);

    if yaml_str.is_empty() {
        return Ok((FrontmatterData::default(), body));
    }

    let mapping: serde_yaml::Value =
        serde_yaml::from_str(yaml_str).map_err(|e| EngineError::FrontmatterParse {
            file: file_name.to_string(),
            reason: e.to_string(),
        })?;

    let map = match &mapping {
        serde_yaml::Value::Mapping(m) => m,
        _ => return Ok((FrontmatterData::default(), body)),
    };

    let get_str = |key: &str| -> Option<String> {
        map.get(serde_yaml::Value::String(key.to_string()))
            .and_then(|v| match v {
                serde_yaml::Value::String(s) => Some(s.clone()),
                serde_yaml::Value::Number(n) => Some(n.to_string()),
                serde_yaml::Value::Bool(b) => Some(b.to_string()),
                _ => None,
            })
    };

    let get_array = |key: &str| -> Vec<String> {
        map.get(serde_yaml::Value::String(key.to_string()))
            .map(|v| normalize_array(v))
            .unwrap_or_default()
    };

    // For the date field, preserve the raw string exactly as written so
    // that downstream timezone logic can inspect the original format.
    let raw_date = map
        .get(serde_yaml::Value::String("date".to_string()))
        .and_then(|v| match v {
            serde_yaml::Value::String(s) => Some(s.clone()),
            serde_yaml::Value::Number(n) => Some(n.to_string()),
            _ => {
                // For tagged or other complex types, try to render them.
                serde_yaml::to_string(v)
                    .ok()
                    .map(|s| s.trim().to_string())
            }
        });

    let date = match raw_date {
        Some(d) if is_valid_date(&d) => Some(d),
        Some(d) => {
            warn!("Invalid date format in {}: {}", file_name, d);
            Some(String::new())
        }
        None => None,
    };

    let data = FrontmatterData {
        title: get_str("title"),
        date,
        tags: get_array("tags"),
        categories: get_array("categories"),
        preview: get_str("preview"),
        description: get_str("description"),
        excerpt: get_str("excerpt"),
    };

    Ok((data, body))
}

// ── Tests ──────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parse_basic_frontmatter() {
        let md = r#"---
title: Hello World
date: 2025-01-15 10:30:00
tags: [intro, blog]
categories: [General]
preview: My first post
---

Body content here.
"#;
        let (fm, body) = parse_frontmatter(md, "test.md").unwrap();
        assert_eq!(fm.title.as_deref(), Some("Hello World"));
        assert_eq!(fm.date.as_deref(), Some("2025-01-15 10:30:00"));
        assert_eq!(fm.tags, vec!["intro", "blog"]);
        assert_eq!(fm.categories, vec!["General"]);
        assert_eq!(fm.preview.as_deref(), Some("My first post"));
        assert!(body.contains("Body content here."));
    }

    #[test]
    fn parse_space_separated_tags() {
        let md = "---\ntags: intro blog rust\n---\n";
        let (fm, _) = parse_frontmatter(md, "test.md").unwrap();
        assert_eq!(fm.tags, vec!["intro", "blog", "rust"]);
    }

    #[test]
    fn parse_comma_separated_tags() {
        let md = "---\ntags: intro, blog, rust\n---\n";
        let (fm, _) = parse_frontmatter(md, "test.md").unwrap();
        assert_eq!(fm.tags, vec!["intro", "blog", "rust"]);
    }

    #[test]
    fn parse_mixed_separator_tags() {
        let md = "---\ntags: intro, blog rust\n---\n";
        let (fm, _) = parse_frontmatter(md, "test.md").unwrap();
        assert_eq!(fm.tags, vec!["intro", "blog", "rust"]);
    }

    #[test]
    fn parse_no_frontmatter() {
        let md = "Just some markdown content.";
        let (fm, body) = parse_frontmatter(md, "test.md").unwrap();
        assert_eq!(fm, FrontmatterData::default());
        assert_eq!(body, md);
    }

    #[test]
    fn parse_empty_frontmatter() {
        let md = "---\n---\nBody";
        let (fm, body) = parse_frontmatter(md, "test.md").unwrap();
        assert_eq!(fm, FrontmatterData::default());
        assert_eq!(body, "Body");
    }

    #[test]
    fn parse_invalid_date_warns_and_empty() {
        let md = "---\ntitle: Bad Date\ndate: not-a-date\n---\n";
        let (fm, _) = parse_frontmatter(md, "test.md").unwrap();
        assert_eq!(fm.date.as_deref(), Some(""));
    }

    #[test]
    fn parse_missing_fields_default_to_none() {
        let md = "---\ntitle: Only Title\n---\n";
        let (fm, _) = parse_frontmatter(md, "test.md").unwrap();
        assert_eq!(fm.title.as_deref(), Some("Only Title"));
        assert!(fm.date.is_none());
        assert!(fm.tags.is_empty());
        assert!(fm.categories.is_empty());
        assert!(fm.preview.is_none());
        assert!(fm.description.is_none());
        assert!(fm.excerpt.is_none());
    }

    #[test]
    fn parse_description_and_excerpt() {
        let md = "---\ndescription: A desc\nexcerpt: An excerpt\n---\n";
        let (fm, _) = parse_frontmatter(md, "test.md").unwrap();
        assert_eq!(fm.description.as_deref(), Some("A desc"));
        assert_eq!(fm.excerpt.as_deref(), Some("An excerpt"));
    }

    #[test]
    fn parse_quoted_title() {
        let md = "---\ntitle: \"New Feature: Album Module\"\n---\n";
        let (fm, _) = parse_frontmatter(md, "test.md").unwrap();
        assert_eq!(fm.title.as_deref(), Some("New Feature: Album Module"));
    }

    #[test]
    fn parse_date_with_timezone_offset() {
        let md = "---\ndate: 2025-01-01T18:00:00+09:00\n---\n";
        let (fm, _) = parse_frontmatter(md, "test.md").unwrap();
        assert_eq!(fm.date.as_deref(), Some("2025-01-01T18:00:00+09:00"));
    }

    #[test]
    fn normalize_array_from_null() {
        let v = serde_yaml::Value::Null;
        assert!(normalize_array(&v).is_empty());
    }

    #[test]
    fn normalize_array_from_sequence() {
        let v: serde_yaml::Value = serde_yaml::from_str("[a, b, c]").unwrap();
        assert_eq!(normalize_array(&v), vec!["a", "b", "c"]);
    }

    #[test]
    fn normalize_array_filters_empty_strings() {
        let v: serde_yaml::Value = serde_yaml::from_str("[a, '', b]").unwrap();
        assert_eq!(normalize_array(&v), vec!["a", "b"]);
    }

    #[test]
    fn normalize_array_from_string_spaces() {
        let v = serde_yaml::Value::String("a b c".to_string());
        assert_eq!(normalize_array(&v), vec!["a", "b", "c"]);
    }

    #[test]
    fn normalize_array_from_string_commas() {
        let v = serde_yaml::Value::String("a, b, c".to_string());
        assert_eq!(normalize_array(&v), vec!["a", "b", "c"]);
    }

    #[test]
    fn split_frontmatter_handles_rn() {
        let md = "---\r\ntitle: test\r\n---\r\nBody";
        let (yaml, body) = split_frontmatter(md);
        assert_eq!(yaml, "title: test");
        assert_eq!(body, "Body");
    }

    // ── Edge-case tests added during review ────────────────────────

    #[test]
    fn pure_numeric_date_is_invalid() {
        let md = "---\ndate: 42\n---\n";
        let (fm, _) = parse_frontmatter(md, "test.md").unwrap();
        assert_eq!(fm.date.as_deref(), Some(""), "pure numbers should not be treated as valid dates");
    }

    #[test]
    fn space_separated_date_with_tz_offset() {
        // Common blog format: space instead of T, with timezone offset
        let md = "---\ndate: 2025-01-01 18:00:00+09:00\n---\n";
        let (fm, _) = parse_frontmatter(md, "test.md").unwrap();
        assert_eq!(fm.date.as_deref(), Some("2025-01-01 18:00:00+09:00"));
    }

    #[test]
    fn date_none_vs_invalid_distinction() {
        // No date field at all → None
        let md = "---\ntitle: No Date\n---\n";
        let (fm, _) = parse_frontmatter(md, "test.md").unwrap();
        assert!(fm.date.is_none(), "absent date should be None");

        // Date field present but invalid → Some("")
        let md = "---\ndate: garbage\n---\n";
        let (fm, _) = parse_frontmatter(md, "test.md").unwrap();
        assert_eq!(fm.date, Some(String::new()), "invalid date should be Some(\"\")");
    }

    #[test]
    fn date_only_format() {
        let md = "---\ndate: 2025-06-15\n---\n";
        let (fm, _) = parse_frontmatter(md, "test.md").unwrap();
        assert_eq!(fm.date.as_deref(), Some("2025-06-15"));
    }
}


