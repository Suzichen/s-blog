# s-blog-engine — Tauri Admin 集成指南

本文档说明如何在 Tauri Admin（或任何 Rust 项目）中将 `s-blog-engine` 作为 Cargo 依赖使用。

## 添加依赖

`s-blog-engine` 是一个独立的 Rust crate，不依赖 NAPI-RS 或 Node.js。可通过路径或 git 引用添加：

```toml
# Cargo.toml — 本地路径（monorepo 内开发时）
[dependencies]
s-blog-engine = { path = "../s-blog/crates/s-blog-engine" }

# 或 git 依赖
[dependencies]
s-blog-engine = { git = "https://github.com/user/s-blog.git" }
```

> 不要启用 `napi` feature，它仅用于 Node.js 绑定层的错误转换。

## 配置类型

引擎通过两个配置结构体驱动，与用户项目中的 JSON 文件一一对应：

```rust
use s_blog_engine::{SiteConfig, AlbumConfig, AlbumEntry};

// 对应 config.json
let site_config: SiteConfig = serde_json::from_str(&std::fs::read_to_string("config.json")?)?;

// 对应 album.config.json
let album_config: AlbumConfig = serde_json::from_str(&std::fs::read_to_string("album.config.json")?)?;
```

也可以直接构造：

```rust
let site_config = SiteConfig {
    title: "My Blog".into(),
    description: "A personal blog".into(),
    logo: "/logo.png".into(),
    favicon: "/favicon.ico".into(),
    site_url: Some("https://example.com".into()),
    author: Some("Alice".into()),
    language: Some("en".into()),
    timezone: Some("Asia/Tokyo".into()),
    base_path: Some("/".into()),
};

let album_config = AlbumConfig {
    enabled: true,
    albums: vec![
        AlbumEntry { dir: "travel".into(), name: Some("旅行".into()), cover: Some("cover.jpg".into()) },
        AlbumEntry { dir: "daily".into(), name: None, cover: None },
    ],
};
```

## API 概览

所有公开函数都返回 `Result<T, EngineError>`，使用 `?` 即可传播错误。

### 文章清单生成

扫描 Markdown 文件目录，解析 frontmatter，生成 `manifest.json` 并复制源文件。

```rust
use std::path::Path;
use s_blog_engine::posts::generate_posts_data;

let posts = generate_posts_data(
    Path::new("posts"),           // Markdown 文件目录
    Path::new("public"),          // 输出根目录
    &site_config,
)?;
// posts: Vec<PostMetadata>  — 按日期降序排列
// 写入: public/generated/manifest.json
// 复制: public/posts/*.md
```

### 相册数据生成

生成相册索引、每个相册的详情 JSON，以及 WebP 缩略图。

```rust
use s_blog_engine::albums::{generate_albums_data, generate_albums_data_with_base};

// 使用默认 basePath
let output = generate_albums_data(
    Path::new("albums"),          // 相册源目录
    Path::new("public"),          // 输出根目录
    &album_config,
)?;

// 或指定 basePath（子目录部署）
let output = generate_albums_data_with_base(
    Path::new("albums"),
    Path::new("public"),
    &album_config,
    Some("/blog"),
)?;

// output.summaries: Vec<AlbumSummary>
// output.details:   Vec<AlbumDetail>
// 写入: public/generated/albums-index.json
//       public/generated/album-{dirname}.json
// 生成: public/albums/{dirname}/thumbs/*.webp
```

### SEO 页面生成

为每篇文章生成带有完整 SEO 元数据的静态 HTML 页面。

```rust
use s_blog_engine::seo::generate_seo_pages;

let count = generate_seo_pages(
    &posts,                                // 文章清单（来自 generate_posts_data）
    Path::new("dist/index.html"),          // App Shell 模板路径
    Path::new("dist"),                     // 输出目录
    &site_config,
)?;
// count: usize — 生成的页面数
// 写入: dist/post/{slug}/index.html
```

### Sitemap 生成

```rust
use s_blog_engine::sitemap::generate_sitemap;

generate_sitemap(
    &posts,
    Path::new("dist/sitemap.xml"),
    &site_config,
)?;
// 若 site_url 未配置，会跳过生成并输出警告
```

### RSS 生成

```rust
use s_blog_engine::rss::generate_rss;

generate_rss(
    &posts,
    Path::new("dist/rss.xml"),
    &site_config,
)?;
// 若 site_url 未配置，会跳过生成并输出警告
```

### robots.txt 生成

```rust
use s_blog_engine::robots::generate_robots;

generate_robots(
    Path::new("dist/robots.txt"),
    &site_config,
)?;
```

## 完整构建流程示例

以下展示 Tauri Admin 中执行完整博客构建的典型流程：

```rust
use std::path::Path;
use s_blog_engine::{SiteConfig, AlbumConfig};

fn build_blog(
    project_dir: &Path,
    output_dir: &Path,
) -> Result<(), Box<dyn std::error::Error>> {
    // 1. 读取配置
    let site_config: SiteConfig =
        serde_json::from_str(&std::fs::read_to_string(project_dir.join("config.json"))?)?;
    let album_config: AlbumConfig =
        serde_json::from_str(&std::fs::read_to_string(project_dir.join("album.config.json"))?)?;

    let public_dir = output_dir.join("public");

    // 2. 生成文章清单
    let posts = s_blog_engine::posts::generate_posts_data(
        &project_dir.join("posts"),
        &public_dir,
        &site_config,
    )?;

    // 3. 生成相册数据 + 缩略图
    s_blog_engine::albums::generate_albums_data_with_base(
        &project_dir.join("albums"),
        &public_dir,
        &album_config,
        site_config.base_path.as_deref(),
    )?;

    // 4. 生成 SEO 页面
    let dist_dir = output_dir.join("dist");
    s_blog_engine::seo::generate_seo_pages(
        &posts,
        &dist_dir.join("index.html"),  // App Shell 模板
        &dist_dir,
        &site_config,
    )?;

    // 5. 生成 sitemap + RSS + robots.txt
    s_blog_engine::sitemap::generate_sitemap(
        &posts,
        &dist_dir.join("sitemap.xml"),
        &site_config,
    )?;
    s_blog_engine::rss::generate_rss(
        &posts,
        &dist_dir.join("rss.xml"),
        &site_config,
    )?;
    s_blog_engine::robots::generate_robots(
        &dist_dir.join("robots.txt"),
        &site_config,
    )?;

    Ok(())
}
```

## 错误处理

所有函数返回 `Result<T, s_blog_engine::EngineError>`。主要错误变体：

| 变体 | 触发场景 |
|------|----------|
| `DirectoryNotFound` | posts/albums 目录不存在 |
| `FrontmatterParse` | Markdown frontmatter 解析失败 |
| `InvalidDate` | 日期格式无效 |
| `InvalidTimezone` | 时区标识符无效 |
| `ImageDecode` | 图片解码失败 |
| `InvalidAlbumName` | 相册目录名包含非法字符 |
| `Config` | 配置错误 |
| `Io` | 文件系统 I/O 错误 |
| `Json` | JSON 序列化/反序列化错误 |

```rust
use s_blog_engine::EngineError;

match result {
    Err(EngineError::DirectoryNotFound(path)) => {
        eprintln!("目录不存在: {}", path.display());
    }
    Err(e) => {
        eprintln!("构建失败: {e}");
    }
    Ok(_) => {}
}
```

## 底层模块

如需更细粒度的控制，可直接使用底层模块：

| 模块 | 用途 |
|------|------|
| `s_blog_engine::frontmatter` | Markdown frontmatter 解析 |
| `s_blog_engine::timezone` | 日期时区转换 |
| `s_blog_engine::image_proc` | 缩略图生成、尺寸计算 |
| `s_blog_engine::exif` | EXIF 元数据读取 |
| `s_blog_engine::path_util` | basePath 规范化、URL 构建 |

```rust
// 示例：单独解析 frontmatter
use s_blog_engine::frontmatter::parse_frontmatter;

let content = std::fs::read_to_string("posts/hello.md")?;
let (frontmatter, body) = parse_frontmatter(&content, "hello.md")?;
println!("标题: {:?}", frontmatter.title);
println!("标签: {:?}", frontmatter.tags);

// 示例：单独生成缩略图
use s_blog_engine::image_proc::generate_thumbnail;

generate_thumbnail(
    Path::new("photo.jpg"),
    Path::new("thumbs/photo.webp"),
)?;

// 示例：读取 EXIF
use s_blog_engine::exif::read_exif;

let exif = read_exif(Path::new("photo.jpg"));
println!("相机: {:?} {:?}", exif.camera_make, exif.camera_model);
```

## 注意事项

- 所有路径输出统一使用 `/` 作为分隔符，跨平台兼容
- 缩略图生成支持增量构建（已存在且较新的缩略图会跳过）
- 日志通过 `log` crate 输出，Tauri 项目中可用 `env_logger` 或 `tauri-plugin-log` 接收
- `SiteConfig` 使用 `#[serde(rename_all = "camelCase")]`，可直接从 camelCase JSON 反序列化
