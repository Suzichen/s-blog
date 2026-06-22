//! Core scaffold logic for s-blog — template copying and config injection.
//!
//! This crate is consumed by:
//! - `packages/create-s-blog` (via NAPI bindings) for the CLI
//! - `s-blog-admin` (Tauri) directly as a Rust dependency

use std::fs;
use std::path::Path;

use serde::{Deserialize, Serialize};
use thiserror::Error;

#[derive(Debug, Error)]
pub enum ScaffoldError {
    #[error("Target directory already exists: {0}")]
    DirectoryExists(String),
    #[error("Template directory not found: {0}")]
    TemplateNotFound(String),
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),
    #[error("JSON error: {0}")]
    Json(#[from] serde_json::Error),
}

/// Input parameters for scaffolding a new blog project.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScaffoldInput {
    pub target_dir: String,
    pub template_dir: String,
    pub name: String,
    pub description: String,
    pub author: String,
    pub site_url: Option<String>,
    pub timezone: Option<String>,
}

/// Scaffold a new s-blog project.
///
/// 1. Validates target doesn't exist, template exists
/// 2. Recursively copies template to target
/// 3. Renames `_gitignore` → `.gitignore`
/// 4. Generates customized `package.json`
/// 5. Generates `config.json` (JSONC with comments)
/// 6. Generates `album.config.json` (JSONC with comments)
/// 7. Generates `memo.config.json` (JSONC with comments, disabled by default)
pub fn scaffold(input: &ScaffoldInput) -> Result<(), ScaffoldError> {
    let target = Path::new(&input.target_dir);
    let template = Path::new(&input.template_dir);

    if target.exists() {
        return Err(ScaffoldError::DirectoryExists(input.target_dir.clone()));
    }
    if !template.is_dir() {
        return Err(ScaffoldError::TemplateNotFound(input.template_dir.clone()));
    }

    // Copy template
    copy_dir_recursive(template, target)?;

    // Rename _gitignore → .gitignore
    let gitignore_src = target.join("_gitignore");
    if gitignore_src.exists() {
        fs::rename(&gitignore_src, target.join(".gitignore"))?;
    }

    // Rename _env.example → .env.example
    let env_example_src = target.join("_env.example");
    if env_example_src.exists() {
        fs::rename(&env_example_src, target.join(".env.example"))?;
    }

    // Generate package.json
    let package_json = generate_package_json(input);
    fs::write(target.join("package.json"), package_json + "\n")?;

    // Generate config.json
    let config_json = generate_config_json(input);
    fs::write(target.join("config.json"), config_json + "\n")?;

    // Generate album.config.json
    let album_config = generate_album_config_json();
    fs::write(target.join("album.config.json"), album_config + "\n")?;

    // Generate memo.config.json
    let memo_config = generate_memo_config_json();
    fs::write(target.join("memo.config.json"), memo_config + "\n")?;

    Ok(())
}

/// Clean up a failed scaffold attempt.
pub fn cleanup(target_dir: &str) {
    let target = Path::new(target_dir);
    if target.exists() {
        let _ = fs::remove_dir_all(target);
    }
}

fn copy_dir_recursive(src: &Path, dest: &Path) -> Result<(), ScaffoldError> {
    fs::create_dir_all(dest)?;
    for entry in fs::read_dir(src)? {
        let entry = entry?;
        let src_path = entry.path();
        let dest_path = dest.join(entry.file_name());
        if src_path.is_dir() {
            copy_dir_recursive(&src_path, &dest_path)?;
        } else {
            fs::copy(&src_path, &dest_path)?;
        }
    }
    Ok(())
}

fn generate_package_json(input: &ScaffoldInput) -> String {
    let mut lines = Vec::new();
    lines.push("{".to_string());
    lines.push(format!("  \"name\": {},", serde_json::to_string(&input.name).unwrap()));
    lines.push("  \"private\": true,".to_string());
    lines.push("  \"version\": \"0.0.0\",".to_string());
    lines.push("  \"type\": \"module\",".to_string());
    lines.push(format!("  \"description\": {},", serde_json::to_string(&input.description).unwrap()));
    if !input.author.is_empty() {
        lines.push(format!("  \"author\": {},", serde_json::to_string(&input.author).unwrap()));
    }
    lines.push("  \"scripts\": {".to_string());
    lines.push("    \"dev\": \"s-blog serve\",".to_string());
    lines.push("    \"build\": \"s-blog build\",".to_string());
    lines.push("    \"sync\": \"s-blog sync --media\"".to_string());
    lines.push("  },".to_string());
    lines.push("  \"dependencies\": {".to_string());
    lines.push("    \"@s-blog/core\": \"^0.5.0\",".to_string());
    lines.push("    \"@s-blog/engine\": \"^0.5.0\"".to_string());
    lines.push("  }".to_string());
    lines.push("}".to_string());
    lines.join("\n")
}

fn generate_config_json(input: &ScaffoldInput) -> String {
    let mut lines = Vec::new();
    lines.push("{".to_string());
    lines.push(r#"  "$schema": "./node_modules/@s-blog/core/schemas/config.schema.json","#.to_string());
    lines.push("  // Site title displayed in header and browser tab".to_string());
    lines.push(format!("  \"title\": {},", serde_json::to_string(&input.name).unwrap()));
    lines.push("  // Site description for SEO meta tags".to_string());
    lines.push(format!("  \"description\": {},", serde_json::to_string(&input.description).unwrap()));
    lines.push(r#"  "logo": "/logo.png","#.to_string());
    lines.push(r#"  "favicon": "/favicon.ico","#.to_string());

    match &input.site_url {
        Some(url) if !url.is_empty() => {
            lines.push("  // Production URL — required for sitemap, RSS, Open Graph".to_string());
            lines.push(format!("  \"siteUrl\": {},", serde_json::to_string(url).unwrap()));
        }
        _ => {
            lines.push("  // Production URL — required for sitemap, RSS, Open Graph".to_string());
            lines.push("  // \"siteUrl\": \"https://example.com\",".to_string());
        }
    }

    if !input.author.is_empty() {
        lines.push(format!("  \"author\": {},", serde_json::to_string(&input.author).unwrap()));
    } else {
        lines.push("  // \"author\": \"Your Name\",".to_string());
    }

    lines.push("  // Default language: \"en\", \"zh-CN\", or \"ja\"".to_string());
    lines.push(r#"  "language": "en","#.to_string());

    match &input.timezone {
        Some(tz) if !tz.is_empty() => {
            lines.push("  // IANA timezone — ensures correct post dates on CI builds".to_string());
            lines.push(format!("  \"timezone\": {},", serde_json::to_string(tz).unwrap()));
        }
        _ => {
            lines.push("  // IANA timezone — ensures correct post dates on CI builds".to_string());
            lines.push("  // \"timezone\": \"Asia/Tokyo\",".to_string());
        }
    }

    lines.push("  // Sub-directory deployment path (e.g., \"/blog\"). Defaults to \"/\"".to_string());
    lines.push("  // \"basePath\": \"/blog\",".to_string());
    lines.push(r#"  "links": {"#.to_string());
    lines.push(r#"    "enabled": true,"#.to_string());
    lines.push(r#"    "items": {"#.to_string());
    lines.push(r#"      "S-Blog": "https://s-blog.me""#.to_string());
    lines.push("    }".to_string());
    lines.push("  },".to_string());
    lines.push("  // Built-in platforms: github, rss, x, twitter, weibo, zhihu, bilibili, email, facebook, instagram, tiktok".to_string());
    lines.push(r#"  "socialLinks": {"#.to_string());
    lines.push(r#"    "enabled": true,"#.to_string());
    lines.push(r#"    "items": ["#.to_string());
    lines.push(r#"      { "platform": "rss" },"#.to_string());
    lines.push(r#"      { "platform": "github", "url": "https://github.com/Suzichen/s-blog" }"#.to_string());
    lines.push("    ]".to_string());
    lines.push("  }".to_string());
    lines.push("}".to_string());
    lines.join("\n")
}

fn generate_album_config_json() -> String {
    let mut lines = Vec::new();
    lines.push("{".to_string());
    lines.push(r#"  "$schema": "./node_modules/@s-blog/core/schemas/album.config.schema.json","#.to_string());
    lines.push("  // Set to false to disable the album feature entirely".to_string());
    lines.push(r#"  "enabled": true,"#.to_string());
    lines.push(r#"  "albums": ["#.to_string());
    lines.push("    // \"dir\": folder name under albums/, \"name\": display name (optional), \"cover\": cover photo filename (optional)".to_string());
    lines.push(r#"    { "dir": "blog" }"#.to_string());
    lines.push("  ]".to_string());
    lines.push("}".to_string());
    lines.join("\n")
}

fn generate_memo_config_json() -> String {
    let mut lines = Vec::new();
    lines.push("{".to_string());
    lines.push(r#"  "$schema": "./node_modules/@s-blog/core/schemas/memo.config.schema.json","#.to_string());
    lines.push("  // Set to true and configure serverUrl to enable the Memo module".to_string());
    lines.push(r#"  "enabled": false,"#.to_string());
    lines.push("  // Data provider — currently only \"ech0\" is supported".to_string());
    lines.push(r#"  "provider": "ech0","#.to_string());
    lines.push("  // Your Ech0 instance URL (e.g., https://ech0.example.com)".to_string());
    lines.push(r#"  "serverUrl": "https://your-ech0-instance.com","#.to_string());
    lines.push("  // Number of memos to load per page".to_string());
    lines.push(r#"  "pageSize": 20"#.to_string());
    lines.push("  // Custom page title (optional, falls back to i18n default)".to_string());
    lines.push("  // \"title\": \"Memo\"".to_string());
    lines.push("}".to_string());
    lines.join("\n")
}
