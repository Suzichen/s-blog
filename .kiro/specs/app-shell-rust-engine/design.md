# Design Document: App Shell + Rust Engine Architecture

## Overview

本设计文档描述了 s-blog 从"需要 Node/Bun 环境构建"重构为"预编译外壳 + 运行时 JSON 配置加载 + Rust 数据引擎"的技术架构。

### 核心目标

1. **零构建部署**: 用户只需复制预编译的 App Shell + JSON 配置 + 静态资源即可部署博客
2. **CLI 兼容**: 保留 `create-s-blog` CLI 工具的完整功能，使用体验不变
3. **Tauri Admin 基础**: 为后续 Tauri Admin 桌面客户端奠定基础（Rust 引擎可直接作为 Cargo 依赖）
4. **渐进式迁移**: 分两阶段实施，每阶段可独立验证

### 架构演进

```
当前架构:
┌─────────────────────────────────────────────────────────────┐
│  用户项目                                                    │
│  ├── src/config.ts (TypeScript 配置)                        │
│  ├── src/main.tsx (入口，导入 @s-blog/core)                 │
│  ├── vite.config.ts                                         │
│  └── 需要 Node/Bun + Vite 构建                              │
└─────────────────────────────────────────────────────────────┘

目标架构:
┌─────────────────────────────────────────────────────────────┐
│  用户项目                                                    │
│  ├── config.json (JSON 配置)                                │
│  ├── album.config.json                                      │
│  ├── posts/ (Markdown 文件)                                 │
│  ├── public/ (静态资源)                                     │
│  └── dist/ (从 @s-blog/core/dist/shell 复制的预编译外壳)    │
│       ├── index.html                                        │
│       ├── assets/*.js                                       │
│       └── assets/*.css                                      │
└─────────────────────────────────────────────────────────────┘
```

---

## Architecture

### Phase 1: App Shell 改造

```mermaid
graph TB
    subgraph "构建时 (CI/发布)"
        CORE[packages/core] --> |Vite build| SHELL[dist/shell/]
        SHELL --> |npm publish| NPM[@s-blog/core]
    end
    
    subgraph "CLI 用户项目"
        NPM --> |npm install| NODE_MODULES[node_modules/@s-blog/core/dist/shell/]
        NODE_MODULES --> |本地复制| DIST_CLI[dist/]
    end
    
    subgraph "Tauri Admin"
        NPM_REGISTRY[npm registry] --> |HTTP GET tgz| ADMIN[Tauri Admin]
        ADMIN --> |解压复制| DIST_ADMIN[用户博客目录/]
    end
    
    subgraph "用户项目 (运行时)"
        CONFIG[config.json] --> LOADER[Runtime Config Loader]
        ALBUM_CONFIG[album.config.json] --> LOADER
        LOADER --> |fetch()| APP[SBlogApp]
        
        POSTS[posts/*.md] --> SCRIPTS[数据生成脚本]
        ALBUMS[public/albums/] --> SCRIPTS
        SCRIPTS --> GENERATED[public/generated/]
    end
    
    subgraph "浏览器"
        DIST_CLI --> |HTTP| BROWSER[浏览器加载]
        DIST_ADMIN --> |HTTP| BROWSER
        BROWSER --> |fetch /config.json| LOADER
    end
```

**Shell 获取方式说明**:
- **CLI 用户**: 通过 `npm install @s-blog/core` 后，Shell 已存在于 `node_modules/` 中，构建脚本直接本地复制
- **Tauri Admin**: 通过 HTTP 请求 `https://registry.npmjs.org/@s-blog/core/latest` 获取 tarball URL，下载 tgz 并解压提取 `dist/shell/` 目录

### Phase 2: Rust 引擎

```mermaid
graph TB
    subgraph "Rust Engine Crate"
        CORE_LIB[s-blog-engine<br/>核心库]
        CORE_LIB --> |pub fn| POSTS_GEN[generate_posts_data]
        CORE_LIB --> |pub fn| ALBUMS_GEN[generate_albums_data]
        CORE_LIB --> |pub fn| SEO_GEN[generate_seo_pages]
        CORE_LIB --> |pub fn| SITEMAP_GEN[generate_sitemap]
        CORE_LIB --> |pub fn| RSS_GEN[generate_rss]
    end
    
    subgraph "NAPI-RS Bindings"
        NAPI[napi-rs 绑定层]
        CORE_LIB --> NAPI
        NAPI --> |npm publish| NPM_WIN[@s-blog/engine-win32-x64]
        NAPI --> |npm publish| NPM_MAC[@s-blog/engine-darwin-arm64]
        NAPI --> |npm publish| NPM_LINUX[@s-blog/engine-linux-x64]
    end
    
    subgraph "消费者"
        CLI[Node CLI] --> |require| NAPI
        TAURI[Tauri Admin] --> |Cargo dep| CORE_LIB
    end
```

---

## Components and Interfaces

### Phase 1 组件

#### 1.1 Runtime Config Loader

运行时配置加载器，在浏览器中通过 `fetch()` 加载 JSON 配置。

```typescript
// packages/core/src/RuntimeConfigLoader.tsx
interface RuntimeConfigLoaderProps {
  configPath?: string;        // 默认: "/config.json"
  albumConfigPath?: string;   // 默认: "/album.config.json"
  children: React.ReactNode;
}

interface LoadingState {
  status: 'loading' | 'error' | 'ready';
  error?: {
    type: 'fetch' | 'parse' | 'validation';
    message: string;
    statusCode?: number;
    missingField?: string;
  };
}

// 导出的组件
export const RuntimeConfigLoader: React.FC<RuntimeConfigLoaderProps>;
```

**实现要点**:
- 使用 `Promise.all` 并行加载两个配置文件
- 加载中显示 loading indicator
- 错误时显示具体错误信息（HTTP 状态码、JSON 解析错误、缺失字段）
- 支持 `basePath` 配置，用于子目录部署

#### 1.2 App Shell Entry Point

新的入口点，用于预编译的 App Shell。

```typescript
// packages/core/src/shell-entry.tsx
import { RuntimeConfigLoader } from './RuntimeConfigLoader';
import { SBlogApp } from './index';

// 这是 App Shell 的入口，会被 Vite 打包
const ShellApp: React.FC = () => (
  <RuntimeConfigLoader>
    {(siteConfig, albumConfig) => (
      <SBlogApp siteConfig={siteConfig} albumConfig={albumConfig} />
    )}
  </RuntimeConfigLoader>
);

createRoot(document.getElementById('root')!).render(<ShellApp />);
```

#### 1.3 Vite Shell Build Configuration

新增 Shell 构建配置。

```typescript
// packages/core/vite.shell.config.ts
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist/shell',
    rollupOptions: {
      input: 'src/shell-entry.tsx',
    },
    // 不使用 lib 模式，生成完整的静态网站
  },
  base: './', // 相对路径，支持任意部署位置
});
```

#### 1.4 JSON Configuration Schema

配置文件 JSON 化，并提供 JSON Schema 支持编辑器智能提示。

```typescript
// config.json
interface ConfigJson {
  $schema?: string;           // JSON Schema URL，用于编辑器提示
  title: string;
  description: string;
  logo: string;
  favicon: string;
  siteUrl?: string;
  author?: string;
  language?: string;
  timezone?: string;
  basePath?: string;  // 新增：子目录部署路径，默认 "/"
}

// album.config.json
interface AlbumConfigJson {
  $schema?: string;           // JSON Schema URL
  enabled: boolean;
  albums: Array<{
    dir: string;
    name?: string;
    cover?: string;
  }>;
}
```

**JSON Schema 文件**:

```json
// packages/core/schemas/config.schema.json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "S-Blog Site Configuration",
  "type": "object",
  "required": ["title", "description", "logo", "favicon"],
  "properties": {
    "$schema": { "type": "string" },
    "title": { "type": "string", "description": "博客标题" },
    "description": { "type": "string", "description": "博客描述" },
    "logo": { "type": "string", "description": "Logo 图片路径" },
    "favicon": { "type": "string", "description": "Favicon 路径" },
    "siteUrl": { "type": "string", "format": "uri", "description": "站点 URL（用于 SEO）" },
    "author": { "type": "string", "description": "作者名称" },
    "language": { "type": "string", "description": "语言代码，如 en, zh-CN" },
    "timezone": { "type": "string", "description": "IANA 时区标识符，如 Asia/Tokyo" },
    "basePath": { "type": "string", "default": "/", "description": "子目录部署路径" }
  }
}
```

**使用方式**:
```json
// 用户的 config.json
{
  "$schema": "https://unpkg.com/@s-blog/core/schemas/config.schema.json",
  "title": "My Blog",
  "description": "A personal blog",
  "logo": "/logo.png",
  "favicon": "/favicon.ico"
}
```

编辑器（VS Code 等）会自动提供字段提示、类型校验和描述信息。

#### 1.5 Build Helper Scripts

构建辅助脚本。

```typescript
// packages/core/scripts/copy-shell.ts
// 复制 @s-blog/core/dist/shell/* 到 dist/

// packages/core/scripts/copy-public.ts
// 复制 public/generated/, public/posts/, public/albums/ 到 dist/
```

#### 1.6 Updated Data Generation Scripts

更新数据生成脚本以读取 JSON 配置。

```typescript
// 所有脚本的配置读取方式变更
// Before: import from 'src/config.ts'
// After:  JSON.parse(fs.readFileSync('config.json'))

// 路径处理需考虑 basePath
function getAssetPath(path: string, basePath: string): string {
  const base = basePath.endsWith('/') ? basePath.slice(0, -1) : basePath;
  return base + path;
}
```

### Phase 2 组件

#### 2.1 Rust Engine Core Library

```rust
// crates/s-blog-engine/src/lib.rs

/// 站点配置
#[derive(Debug, Clone, Deserialize)]
pub struct SiteConfig {
    pub title: String,
    pub description: String,
    pub logo: String,
    pub favicon: String,
    pub site_url: Option<String>,
    pub author: Option<String>,
    pub language: Option<String>,
    pub timezone: Option<String>,
    pub base_path: Option<String>,
}

/// 相册配置
#[derive(Debug, Clone, Deserialize)]
pub struct AlbumConfig {
    pub enabled: bool,
    pub albums: Vec<AlbumEntry>,
}

/// 文章元数据
#[derive(Debug, Clone, Serialize)]
pub struct PostMetadata {
    pub slug: String,
    pub title: String,
    pub date: String,
    pub tags: Vec<String>,
    pub categories: Vec<String>,
    pub summary: String,
}

/// 生成文章数据
pub fn generate_posts_data(
    posts_dir: &Path,
    output_dir: &Path,
    config: &SiteConfig,
) -> Result<Vec<PostMetadata>, EngineError>;

/// 生成相册数据
pub fn generate_albums_data(
    albums_dir: &Path,
    output_dir: &Path,
    config: &AlbumConfig,
) -> Result<AlbumsOutput, EngineError>;

/// 生成 SEO 页面
pub fn generate_seo_pages(
    manifest: &[PostMetadata],
    template_path: &Path,
    output_dir: &Path,
    config: &SiteConfig,
) -> Result<usize, EngineError>;

/// 生成 Sitemap
pub fn generate_sitemap(
    manifest: &[PostMetadata],
    output_path: &Path,
    config: &SiteConfig,
) -> Result<(), EngineError>;

/// 生成 RSS
pub fn generate_rss(
    manifest: &[PostMetadata],
    output_path: &Path,
    config: &SiteConfig,
) -> Result<(), EngineError>;
```

#### 2.2 Frontmatter Parser Module

```rust
// crates/s-blog-engine/src/frontmatter.rs

/// 解析 Markdown frontmatter
pub fn parse_frontmatter(content: &str) -> Result<(FrontmatterData, &str), ParseError>;

/// Frontmatter 数据结构
#[derive(Debug, Clone)]
pub struct FrontmatterData {
    pub title: Option<String>,
    pub date: Option<String>,
    pub tags: Vec<String>,
    pub categories: Vec<String>,
    pub preview: Option<String>,
    pub description: Option<String>,
    pub excerpt: Option<String>,
}

/// 规范化标签/分类数组
/// 支持空格分隔、逗号分隔、数组格式
pub fn normalize_array(input: &serde_yaml::Value) -> Vec<String>;
```

#### 2.3 Timezone Handler Module

```rust
// crates/s-blog-engine/src/timezone.rs

/// 转换日期到指定时区
pub fn convert_to_timezone(
    date_str: &str,
    timezone: &str,
) -> Result<String, TimezoneError>;

/// 检查日期字符串是否包含时区信息
pub fn has_timezone_offset(date_str: &str) -> bool;
```

#### 2.4 Image Processing Module

```rust
// crates/s-blog-engine/src/image.rs

/// 生成缩略图
pub fn generate_thumbnail(
    src_path: &Path,
    dest_path: &Path,
    max_size: u32,
) -> Result<(), ImageError>;

/// 读取 EXIF 数据
pub fn read_exif(path: &Path) -> ExifData;

/// EXIF 数据结构
#[derive(Debug, Clone, Serialize)]
pub struct ExifData {
    pub camera_make: Option<String>,
    pub camera_model: Option<String>,
    pub focal_length: Option<String>,
    pub aperture: Option<String>,
    pub shutter_speed: Option<String>,
    pub iso: Option<String>,
}
```

#### 2.5 NAPI-RS Bindings

```rust
// crates/s-blog-engine-napi/src/lib.rs

use napi_derive::napi;
use s_blog_engine as engine;

#[napi]
pub fn generate_posts_data(
    posts_dir: String,
    output_dir: String,
    config_json: String,
) -> napi::Result<String>;

#[napi]
pub fn generate_albums_data(
    albums_dir: String,
    output_dir: String,
    config_json: String,
) -> napi::Result<String>;

#[napi]
pub fn generate_seo_pages(
    manifest_json: String,
    template_path: String,
    output_dir: String,
    config_json: String,
) -> napi::Result<u32>;

#[napi]
pub fn generate_sitemap(
    manifest_json: String,
    output_path: String,
    config_json: String,
) -> napi::Result<()>;

#[napi]
pub fn generate_rss(
    manifest_json: String,
    output_path: String,
    config_json: String,
) -> napi::Result<()>;
```

---

## Data Models

### Configuration Models

```typescript
// config.json 完整结构（带 JSON Schema 支持）
{
  "$schema": "https://unpkg.com/@s-blog/core/schemas/config.schema.json",
  "title": "My Blog",
  "description": "A personal blog",
  "logo": "/logo.png",
  "favicon": "/favicon.ico",
  "siteUrl": "https://example.com",
  "author": "John Doe",
  "language": "en",
  "timezone": "Asia/Tokyo",
  "basePath": "/"
}

// album.config.json 完整结构
{
  "$schema": "https://unpkg.com/@s-blog/core/schemas/album.config.schema.json",
  "enabled": true,
  "albums": [
    { "dir": "travel", "name": "旅行", "cover": "cover.jpg" },
    { "dir": "daily" }
  ]
}
```

### Generated Data Models

```typescript
// public/generated/manifest.json
[
  {
    "slug": "hello-world",
    "title": "Hello World",
    "date": "2024-01-15T10:30:00",
    "tags": ["intro", "blog"],
    "categories": ["General"],
    "summary": "This is my first post..."
  }
]

// public/generated/albums-index.json
[
  {
    "dirname": "travel",
    "name": "旅行",
    "cover": "/albums/travel/thumbs/cover.webp",
    "photoCount": 42
  }
]

// public/generated/album-{dirname}.json
{
  "dirname": "travel",
  "name": "旅行",
  "photos": [
    {
      "filename": "DSC_0001.jpg",
      "thumbnailUrl": "/albums/travel/thumbs/DSC_0001.webp",
      "originalUrl": "/albums/travel/DSC_0001.jpg",
      "exif": {
        "cameraMake": "NIKON",
        "cameraModel": "D850",
        "focalLength": "50",
        "aperture": "1.8",
        "shutterSpeed": "1/250",
        "iso": "100"
      }
    }
  ]
}
```

### Test Fixtures Structure

```
tests/fixtures/
├── posts/
│   ├── simple.md           # 基本文章
│   ├── with-tags.md        # 带标签/分类
│   ├── with-timezone.md    # 带时区日期
│   └── invalid-date.md     # 无效日期
├── albums/
│   ├── test-album/
│   │   ├── photo1.jpg
│   │   ├── photo2.png
│   │   └── photo3.heic
│   └── empty-album/
├── config.json
├── album.config.json
└── expected/
    ├── manifest.json
    ├── albums-index.json
    └── album-test-album.json
```

---


## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

基于需求分析，本项目的核心逻辑适合进行属性测试，特别是：
- Frontmatter 解析（round-trip）
- 时区转换
- 数据生成（manifest、albums）
- 路径处理（basePath）

### Property 1: Frontmatter Round-Trip

*For any* valid Markdown frontmatter containing title, date, tags, categories, and summary fields, parsing the frontmatter then serializing it back to YAML then parsing again SHALL produce equivalent metadata.

**Validates: Requirements 2.1.1, 2.1.2, 2.1.5**

### Property 2: Tag/Category Normalization

*For any* tags or categories input (whether provided as an array, space-separated string, or comma-separated string), the Frontmatter_Parser SHALL normalize it to an array of strings.

**Validates: Requirements 2.1.3**

### Property 3: Timezone Conversion Correctness

*For any* valid date string with timezone offset and any valid IANA timezone identifier, converting the date to the target timezone SHALL produce a correctly converted ISO 8601 date string (without timezone suffix).

**Validates: Requirements 2.2.1, 2.2.4**

### Property 4: Manifest Generation Completeness

*For any* set of valid Markdown files in the posts directory, the generated manifest.json SHALL contain exactly one entry per file, with all required fields (slug, title, date, tags, categories, summary) present, sorted by date in descending order.

**Validates: Requirements 2.3.1, 2.3.2, 2.3.3**

### Property 5: Thumbnail Size Constraint

*For any* input image, the generated thumbnail SHALL have its longest side not exceeding 1080 pixels while preserving the original aspect ratio.

**Validates: Requirements 2.4.1, 2.4.2**

### Property 6: EXIF Formatting

*For any* ExposureTime value less than 1 second, the EXIF_Reader SHALL format it as a fraction (e.g., "1/250"). *For any* FocalLength value, the EXIF_Reader SHALL round it to the nearest integer.

**Validates: Requirements 2.5.2, 2.5.3**

### Property 7: Album Data Completeness

*For any* set of valid album directories, the generated albums-index.json SHALL contain exactly one summary entry per album with all required fields (dirname, name, cover, photoCount), and each album SHALL have a corresponding album-{dirname}.json detail file.

**Validates: Requirements 2.6.1, 2.6.2, 2.6.3**

### Property 8: SEO Page Completeness

*For any* post in the manifest, the generated SEO HTML page SHALL include: title tag, meta description, meta keywords, canonical link, Open Graph tags (og:title, og:description, og:url, og:type), Twitter Card tags, and JSON-LD Article schema.

**Validates: Requirements 2.7.1, 2.7.2, 2.7.3, 2.7.4, 2.7.5**

### Property 9: Feed Completeness

*For any* set of posts, the generated sitemap.xml SHALL include the homepage URL (priority 1.0) and all post URLs (priority 0.8). The generated rss.xml SHALL include channel metadata and item entries for all posts.

**Validates: Requirements 2.8.2, 2.8.4**

### Property 10: BasePath Prefixing

*For any* configured basePath value and any asset path, the generated path SHALL be correctly prefixed with the basePath (handling trailing slashes correctly).

**Validates: Requirements 1.5.5**

### Property 11: Config Validation

*For any* configuration object missing a required field (title, description, logo, favicon), the Runtime_Config_Loader SHALL reject it with an error message specifying the missing field.

**Validates: Requirements 1.3.6, 1.3.7**

---

## Error Handling

### Phase 1 错误处理

| 场景 | 错误类型 | 处理方式 |
|------|----------|----------|
| config.json 不存在 | FetchError | 显示 "Failed to load config.json: 404 Not Found" |
| config.json 无效 JSON | ParseError | 显示 "Failed to parse config.json: Unexpected token..." |
| 缺少必填字段 | ValidationError | 显示 "Missing required field: {fieldName}" |
| album.config.json 加载失败 | FetchError | 同上 |
| 脚本找不到配置文件 | FileNotFoundError | 退出并显示 "config.json not found. Please create it in the project root." |

### Phase 2 错误处理

| 场景 | 错误类型 | 处理方式 |
|------|----------|----------|
| posts 目录不存在 | DirectoryNotFoundError | 返回 Err("Posts directory not found: {path}") |
| Markdown 解析失败 | ParseError | 警告并跳过该文件 |
| 无效日期格式 | DateParseError | 警告并使用空字符串 |
| 无效时区标识符 | TimezoneError | 警告并回退到 UTC |
| 图片解码失败 | ImageDecodeError | 警告并跳过该文件 |
| HEIC 解码失败 | HeicDecodeError | 警告并跳过（HEIC 为可选支持） |
| 无效相册目录名 | ValidationError | 错误并跳过该相册 |
| siteUrl 未配置 | ConfigWarning | 警告并跳过 sitemap/RSS 生成 |

### 错误消息格式

```rust
// Rust 错误类型
#[derive(Debug, thiserror::Error)]
pub enum EngineError {
    #[error("Directory not found: {0}")]
    DirectoryNotFound(PathBuf),
    
    #[error("Failed to parse frontmatter in {file}: {reason}")]
    FrontmatterParse { file: String, reason: String },
    
    #[error("Invalid date format in {file}: {date}")]
    InvalidDate { file: String, date: String },
    
    #[error("Invalid timezone: {0}")]
    InvalidTimezone(String),
    
    #[error("Failed to decode image {file}: {reason}")]
    ImageDecode { file: String, reason: String },
    
    #[error("Invalid album directory name: {0}")]
    InvalidAlbumName(String),
    
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),
}
```

---

## Testing Strategy

### 测试方法概述

本项目采用双重测试策略：
1. **单元测试**: 验证具体示例、边界情况和错误处理
2. **属性测试**: 验证跨所有输入的通用属性

### Phase 1 测试

#### 单元测试

```typescript
// RuntimeConfigLoader 测试
describe('RuntimeConfigLoader', () => {
  it('should fetch both config files on load');
  it('should show loading indicator while fetching');
  it('should display error with HTTP status code on fetch failure');
  it('should display parse error on invalid JSON');
  it('should validate required fields');
  it('should initialize SBlogApp with parsed configs');
});

// 脚本测试
describe('generate-posts-data', () => {
  it('should read timezone from config.json');
  it('should generate manifest.json with correct structure');
  it('should copy markdown files to public/posts/');
});
```

#### 集成测试

```typescript
// 端到端测试
describe('Phase 1 E2E', () => {
  it('should build App Shell successfully');
  it('should serve blog with runtime config loading');
  it('should handle basePath for subdirectory deployment');
});
```

### Phase 2 测试

#### 测试驱动迁移基础设施

```
tests/
├── fixtures/                    # 固定测试数据
│   ├── posts/
│   ├── albums/
│   ├── config.json
│   └── album.config.json
├── golden/                      # 期望输出（由 TS 脚本生成）
│   ├── manifest.json
│   ├── albums-index.json
│   └── ...
├── ts/                          # TS 脚本测试
│   └── generate-posts-data.test.ts
└── rust/                        # Rust 测试
    └── src/
        ├── frontmatter_test.rs
        ├── timezone_test.rs
        └── ...
```

#### 属性测试配置

```rust
// Rust 属性测试使用 proptest
use proptest::prelude::*;

proptest! {
    #![proptest_config(ProptestConfig::with_cases(100))]
    
    // Feature: app-shell-rust-engine, Property 1: Frontmatter Round-Trip
    #[test]
    fn frontmatter_round_trip(fm in valid_frontmatter()) {
        let yaml = serialize_frontmatter(&fm);
        let parsed = parse_frontmatter(&yaml).unwrap();
        prop_assert_eq!(fm, parsed);
    }
    
    // Feature: app-shell-rust-engine, Property 2: Tag/Category Normalization
    #[test]
    fn tag_normalization(input in tag_input_strategy()) {
        let result = normalize_array(&input);
        prop_assert!(result.is_array());
        prop_assert!(result.iter().all(|s| !s.is_empty()));
    }
    
    // Feature: app-shell-rust-engine, Property 3: Timezone Conversion
    #[test]
    fn timezone_conversion(
        date in valid_date_with_offset(),
        tz in valid_timezone()
    ) {
        let result = convert_to_timezone(&date, &tz);
        prop_assert!(result.is_ok());
        let output = result.unwrap();
        // Verify ISO 8601 format without suffix
        prop_assert!(output.matches(r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$"));
    }
    
    // Feature: app-shell-rust-engine, Property 5: Thumbnail Size Constraint
    #[test]
    fn thumbnail_size_constraint(
        width in 1u32..10000,
        height in 1u32..10000
    ) {
        let (tw, th) = calculate_thumbnail_size(width, height);
        prop_assert!(tw.max(th) <= 1080);
        // Aspect ratio preserved (within rounding tolerance)
        let original_ratio = width as f64 / height as f64;
        let thumb_ratio = tw as f64 / th as f64;
        prop_assert!((original_ratio - thumb_ratio).abs() < 0.01);
    }
}
```

#### 跨实现验证测试

```typescript
// 验证 Rust 输出与 TS 输出一致
describe('Cross-implementation verification', () => {
  const fixtures = loadFixtures();
  
  it('generate-posts-data: Rust output matches TS output', async () => {
    const tsOutput = await runTsScript('generate-posts-data', fixtures);
    const rustOutput = await runRustEngine('generate_posts_data', fixtures);
    expect(rustOutput).toEqual(tsOutput);
  });
  
  it('generate-albums-data: Rust output matches TS output', async () => {
    const tsOutput = await runTsScript('generate-albums-data', fixtures);
    const rustOutput = await runRustEngine('generate_albums_data', fixtures);
    expect(rustOutput).toEqual(tsOutput);
  });
  
  // ... 其他脚本
});
```

### 测试命令

```bash
# Phase 1 测试
npm run test:unit          # 单元测试
npm run test:e2e           # 端到端测试

# Phase 2 测试
npm run test:ts            # TS 脚本测试（生成 golden files）
cargo test                 # Rust 单元测试 + 属性测试
npm run test:cross         # 跨实现验证测试
npm test                   # 运行所有测试
```

---

## Implementation Notes

### Phase 1 实施顺序

1. **创建 RuntimeConfigLoader 组件**
   - 实现 fetch 逻辑
   - 实现加载状态和错误处理
   - 实现配置验证

2. **创建 Shell 入口和构建配置**
   - 创建 shell-entry.tsx
   - 创建 vite.shell.config.ts
   - 更新 package.json 添加 shell 构建脚本

3. **更新数据生成脚本**
   - 修改所有脚本读取 JSON 配置
   - 添加 basePath 支持
   - 添加错误处理

4. **创建构建辅助脚本**
   - copy-shell.ts
   - copy-public.ts

5. **更新 CLI 模板**
   - 移除 Vite/React 文件
   - 添加 JSON 配置文件
   - 更新 package.json 脚本

6. **更新文档**

### Phase 2 实施顺序

1. **建立测试基础设施**
   - 创建测试 fixtures
   - 运行 TS 脚本生成 golden files
   - 设置跨实现验证测试

2. **实现 Rust 核心库**
   - frontmatter.rs (Frontmatter 解析)
   - timezone.rs (时区处理)
   - posts.rs (文章清单生成)
   - image.rs (缩略图生成)
   - exif.rs (EXIF 读取)
   - albums.rs (相册数据生成)
   - seo.rs (SEO 页面生成)
   - sitemap.rs (Sitemap 生成)
   - rss.rs (RSS 生成)

3. **实现 NAPI-RS 绑定**
   - 创建绑定层
   - 设置多平台构建
   - 发布到 npm

### 依赖选择

#### Rust 依赖

```toml
[dependencies]
# Frontmatter/YAML 解析
serde = { version = "1.0", features = ["derive"] }
serde_yaml = "0.9"
serde_json = "1.0"

# 时区处理
chrono = { version = "0.4", features = ["serde"] }
chrono-tz = "0.8"

# 图片处理
image = "0.24"
webp = "0.2"
kamadak-exif = "0.5"

# HEIC 支持 (可选)
libheif-rs = { version = "0.18", optional = true }

# 错误处理
thiserror = "1.0"
anyhow = "1.0"

# NAPI-RS (仅绑定层)
napi = { version = "2", features = ["napi4"] }
napi-derive = "2"
```

#### 平台特定构建

```yaml
# .github/workflows/build.yml
jobs:
  build:
    strategy:
      matrix:
        include:
          - os: windows-latest
            target: x86_64-pc-windows-msvc
            npm-package: "@s-blog/engine-win32-x64"
          - os: macos-latest
            target: aarch64-apple-darwin
            npm-package: "@s-blog/engine-darwin-arm64"
          - os: ubuntu-latest
            target: x86_64-unknown-linux-gnu
            npm-package: "@s-blog/engine-linux-x64"
```
