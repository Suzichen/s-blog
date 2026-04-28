# Requirements Document

## Introduction

本文档定义了 s-blog 架构重构的需求，目标是将项目从"需要 Node/Bun 环境构建"重构为"预编译外壳 + 运行时 JSON 配置加载 + Rust 数据引擎"的新架构。

核心目标：
1. 让博客部署不再需要 Node/Bun 环境构建
2. 保留 CLI 用户的支持
3. 为后续 Tauri Admin 改造奠定基础（Admin 集成将在本次重构完成后单独规划）

重构分为两个阶段，每阶段需要手动验证后再进入下一阶段。

## Glossary

- **App_Shell**: 预编译的静态网站外壳，包含 `index.html` + `assets/*.js` + `assets/*.css`，可直接由 Web 服务器托管
- **Runtime_Config_Loader**: 运行时配置加载器，通过 `fetch()` 在浏览器中动态获取 JSON 配置文件
- **Rust_Engine**: 用 Rust 重写的数据生成引擎，负责 Markdown 解析、图片处理等核心逻辑
- **NAPI_RS_Binding**: 使用 NAPI-RS 将 Rust 引擎编译为 Node.js 原生扩展的绑定层
- **Tauri_Admin**: 基于 Tauri 的桌面客户端，用于博客管理（后续单独规划改造）
- **CLI_Tool**: 命令行工具 `@s-blog/cli`，供终端用户使用
- **NPM_Registry_Fetcher**: 从 npm registry 动态下载包的组件
- **Frontmatter_Parser**: Markdown 文件头部元数据解析器
- **Thumbnail_Generator**: 图片缩略图生成器
- **EXIF_Reader**: 图片 EXIF 元数据读取器
- **HEIC_Decoder**: HEIC 格式图片解码器

---

## Phase 1: App Shell 改造

### Requirement 1.1: 运行时配置加载

**User Story:** 作为博客用户，我希望博客能在运行时加载配置，这样我不需要 Node/Bun 环境来构建博客。

#### Acceptance Criteria

1. WHEN the App_Shell is loaded in a browser, THE Runtime_Config_Loader SHALL fetch `/config.json` and `/album.config.json` via HTTP requests
2. WHILE the configuration files are being fetched, THE App_Shell SHALL display a loading indicator
3. IF the configuration file fetch fails, THEN THE App_Shell SHALL display an error message with the HTTP status code
4. IF the configuration file contains invalid JSON, THEN THE App_Shell SHALL display a parse error message
5. WHEN both configuration files are successfully loaded, THE App_Shell SHALL initialize the SBlogApp component with the parsed configurations

### Requirement 1.2: App Shell 静态构建

**User Story:** 作为项目维护者，我希望能将 core 编译为完整的静态网站外壳，这样用户只需复制文件即可部署博客。

#### Acceptance Criteria

1. THE Vite_Build_Config SHALL produce a complete static website including `index.html`, JavaScript bundles, and CSS files
2. THE App_Shell build output SHALL NOT require any external npm dependencies at runtime
3. THE App_Shell build output SHALL be self-contained and deployable to any static file server
4. WHEN the App_Shell is built, THE output directory SHALL contain all necessary assets for the blog to function
5. THE App_Shell SHALL be published to npm as part of the `@s-blog/core` package in a `dist/shell` directory

### Requirement 1.3: 配置文件 JSON 化

**User Story:** 作为博客用户，我希望直接编辑 JSON 配置文件，这样不需要任何构建工具就能配置博客。

#### Acceptance Criteria

1. THE user project SHALL use `config.json` instead of `src/config.ts` as the site configuration file
2. THE user project SHALL use `album.config.json` instead of `src/album.config.ts` as the album configuration file
3. THE config.json file SHALL support all fields currently defined in the TypeScript `SiteConfig` type
4. THE config.json file SHALL support a `basePath` field (default: `"/"`) to enable deployment to subdirectories (e.g., `username.github.io/blog/`)
5. THE album.config.json file SHALL support all fields currently defined in the TypeScript `AlbumConfig` type
6. THE Runtime_Config_Loader SHALL validate that required fields are present in the configuration files
7. IF a required configuration field is missing, THEN THE App_Shell SHALL display a specific error message indicating the missing field

### Requirement 1.4: 数据生成脚本适配

**User Story:** 作为开发者，我希望数据生成脚本能读取 JSON 配置，这样整个流程保持一致。

#### Acceptance Criteria

1. THE `generate-posts-data.ts` script SHALL be modified to read timezone from `config.json` instead of `src/config.ts`
2. THE `generate-albums-data.ts` script SHALL be modified to read album configuration from `album.config.json` instead of `src/album.config.ts`
3. THE `generate-seo.ts` script SHALL be modified to read site configuration from `config.json` and use App_Shell's `index.html` as template
4. THE `generate-sitemap.ts` and `generate-rss.ts` scripts SHALL be modified to read site configuration from `config.json`
5. ALL scripts SHALL provide clear error messages if the JSON configuration files are missing or invalid

### Requirement 1.5: 构建辅助脚本与路径处理

**User Story:** 作为用户，我希望有脚本来自动化复制 Shell 和静态资源，并正确处理子目录部署的路径。

#### Acceptance Criteria

1. A new script `copy-shell.ts` SHALL be added to copy `@s-blog/core/dist/shell/*` to `dist/`
2. A new script `copy-public.ts` SHALL be added to copy `public/generated/`, `public/posts/`, `public/albums/`, and other static assets to `dist/`
3. THE scripts SHALL handle directory creation and overwrite existing files
4. THE scripts SHALL be cross-platform compatible (Windows/Mac/Linux)
5. WHEN `basePath` is configured in `config.json`, ALL generated asset paths (in SEO pages, sitemap, RSS) SHALL be prefixed with the basePath
6. THE App_Shell SHALL read `basePath` from config and use it for all internal routing and asset references

### Requirement 1.6: CLI 同步改造

**User Story:** 作为 CLI 用户，我希望 `create-s-blog` 创建的项目能直接使用 App Shell 模式，且使用体验与之前完全一致。

#### Acceptance Criteria

1. THE `create-s-blog` template SHALL be updated to remove all Vite/React related files (`src/main.tsx`, `vite.config.ts`, `postcss.config.js`, `tailwind.config.js`)
2. THE template SHALL use `config.json` and `album.config.json` instead of TypeScript configuration files
3. THE template SHALL retain `posts/` directory (moved from `src/posts/` to root) and `public/` directory
4. THE generated `package.json` SHALL have updated scripts for the new build process and minimal dependencies (only `tsx` for running scripts)
5. THE user commands (`npm run dev`, `npm run build`) SHALL continue to work with the same behavior

### Requirement 1.7: 文档同步更新

**User Story:** 作为用户，我希望所有文档都反映新的配置方式，这样我不会被过时的文档误导。

#### Acceptance Criteria

1. THE `README.md` files (root, zh-CN, ja-JP) SHALL be updated to reflect JSON configuration instead of TypeScript
2. THE documentation SHALL include examples of `config.json` and `album.config.json` format
3. THE documentation SHALL update the build/deploy instructions for the new workflow
4. THE `create-s-blog` README SHALL be updated to reflect the simplified project structure
5. THE documentation updates SHALL be completed after manual verification of Phase 1 functionality

### Requirement 1.8: Phase 1 端到端验证

**User Story:** 作为开发者，我希望 Phase 1 完成后能验证 Core 和 CLI 都正常工作。

#### Acceptance Criteria

1. FOR Core: THE modified scripts SHALL successfully drive the App_Shell to produce a deployable blog
2. FOR CLI: A newly created project via `npx create-s-blog` SHALL build and run without errors
3. THE verification SHALL confirm that homepage, post pages, album pages, and SEO pages all render correctly
4. THE verification SHALL confirm that the build output is deployable to Netlify/Vercel/any static host

---

## Phase 2: Rust 引擎开发

### Requirement 2.0: 测试驱动迁移基础设施

**User Story:** 作为开发者，我希望在 Rust 迁移前先建立测试用例，这样每迁移完一个功能就能验证其正确性。

#### Acceptance Criteria

1. A test suite SHALL be created that captures the current behavior of all TS scripts (`generate-posts-data.ts`, `generate-albums-data.ts`, `generate-seo.ts`, `generate-sitemap.ts`, `generate-rss.ts`)
2. THE test suite SHALL use a fixed set of test fixtures (sample Markdown files, images, configurations) to ensure reproducible results
3. THE test suite SHALL compare the output of TS scripts against expected results (golden files)
4. FOR EACH Rust module migration, THE same test fixtures SHALL be used to verify the Rust output matches the TS output exactly
5. THE test suite SHALL be runnable via `npm test` and report pass/fail status for each script/module

### Requirement 2.1: Markdown Frontmatter 解析

**User Story:** 作为博客用户，我希望 Rust 引擎能解析 Markdown 文件的 frontmatter，这样我的文章元数据能被正确提取。

#### Acceptance Criteria

1. WHEN a Markdown file is provided, THE Frontmatter_Parser SHALL extract YAML frontmatter delimited by `---` markers
2. THE Frontmatter_Parser SHALL parse the `title`, `date`, `tags`, `categories`, `preview`, `description`, and `excerpt` fields
3. THE Frontmatter_Parser SHALL normalize `tags` and `categories` fields that are provided as space-separated or comma-separated strings into arrays
4. IF the frontmatter contains an invalid date format, THEN THE Frontmatter_Parser SHALL log a warning and use an empty string for the date
5. FOR ALL valid Markdown files with frontmatter, parsing then serializing then parsing SHALL produce equivalent metadata (round-trip property)
6. THE Rust implementation SHALL pass all test cases that were validated against the TS `generate-posts-data.ts` script

### Requirement 2.2: 时区处理

**User Story:** 作为博客用户，我希望文章日期能根据我配置的时区正确显示，这样读者看到的时间是准确的。

#### Acceptance Criteria

1. WHEN a timezone is configured and the date string contains a timezone offset, THE Rust_Engine SHALL convert the date to the configured timezone
2. WHEN a timezone is configured but the date string lacks a timezone offset, THE Rust_Engine SHALL treat the date as UTC
3. IF an invalid timezone identifier is provided, THEN THE Rust_Engine SHALL log a warning and fall back to UTC
4. THE date output format SHALL be ISO 8601 format without timezone suffix (`YYYY-MM-DDTHH:mm:ss`)

### Requirement 2.3: 文章清单生成

**User Story:** 作为博客用户，我希望 Rust 引擎能生成文章清单 JSON，这样前端能获取所有文章的元数据。

#### Acceptance Criteria

1. WHEN the posts directory is scanned, THE Rust_Engine SHALL generate a `manifest.json` file containing metadata for all Markdown files
2. THE manifest.json SHALL include `slug`, `title`, `date`, `tags`, `categories`, and `summary` for each post
3. THE posts in manifest.json SHALL be sorted by date in descending order
4. THE Rust_Engine SHALL copy all Markdown files to the `public/posts/` directory
5. IF the posts directory does not exist, THEN THE Rust_Engine SHALL return an error with a descriptive message
6. THE Rust output SHALL be byte-for-byte identical to the TS `generate-posts-data.ts` output for the same input fixtures

### Requirement 2.4: 图片缩略图生成

**User Story:** 作为博客用户，我希望 Rust 引擎能为相册图片生成缩略图，这样相册页面加载更快。

#### Acceptance Criteria

1. WHEN a photo file is processed, THE Thumbnail_Generator SHALL create a WebP thumbnail with the longest side not exceeding 1080 pixels
2. THE Thumbnail_Generator SHALL preserve the aspect ratio of the original image
3. THE Thumbnail_Generator SHALL support JPEG, PNG, and WebP input formats as required formats
4. THE Thumbnail_Generator SHALL support HEIC input format as optional; IF HEIC decoding proves too complex to implement reliably, it MAY be deferred or dropped without blocking the release
5. IF the thumbnail already exists and is newer than the source file, THEN THE Thumbnail_Generator SHALL skip regeneration (incremental build)
6. IF a file fails to decode, THEN THE Thumbnail_Generator SHALL log a warning and skip that file

### Requirement 2.5: EXIF 元数据读取

**User Story:** 作为博客用户，我希望相册能显示照片的拍摄参数，这样访客能了解摄影设置。

#### Acceptance Criteria

1. WHEN a photo file is processed, THE EXIF_Reader SHALL extract `Make`, `Model`, `FocalLength`, `FNumber`, `ExposureTime`, and `ISO` fields
2. THE EXIF_Reader SHALL format `ExposureTime` as a fraction (e.g., `1/250`) when the value is less than 1 second
3. THE EXIF_Reader SHALL round `FocalLength` to the nearest integer
4. IF EXIF data cannot be read, THEN THE EXIF_Reader SHALL return null values for all EXIF fields

### Requirement 2.6: 相册数据生成

**User Story:** 作为博客用户，我希望 Rust 引擎能生成相册索引和详情 JSON，这样前端能展示相册内容。

#### Acceptance Criteria

1. WHEN album processing is triggered, THE Rust_Engine SHALL generate `albums-index.json` containing summary information for all albums
2. FOR EACH album, THE Rust_Engine SHALL generate an `album-{dirname}.json` file containing photo details
3. THE album summary SHALL include `dirname`, `name`, `cover` thumbnail URL, and `photoCount`
4. IF an album directory name contains invalid characters, THEN THE Rust_Engine SHALL log an error and skip that album
5. IF the album module is disabled in configuration, THEN THE Rust_Engine SHALL generate an empty `albums-index.json`
6. THE Rust JSON output SHALL match the TS `generate-albums-data.ts` output structure exactly for the same input fixtures

### Requirement 2.7: SEO 静态页面生成

**User Story:** 作为博客用户，我希望 Rust 引擎能为每篇文章生成带有完整 SEO 元数据的 HTML 页面，这样搜索引擎能正确索引我的内容。

#### Acceptance Criteria

1. WHEN SEO generation is triggered, THE Rust_Engine SHALL generate a `dist/post/{slug}/index.html` file for each post
2. THE generated HTML SHALL include `<title>`, `<meta name="description">`, `<meta name="keywords">`, and `<link rel="canonical">` tags
3. THE generated HTML SHALL include Open Graph meta tags (`og:title`, `og:description`, `og:url`, `og:type`)
4. THE generated HTML SHALL include Twitter Card meta tags (`twitter:card`, `twitter:title`, `twitter:description`)
5. THE generated HTML SHALL include a JSON-LD script block with Article schema markup
6. THE Rust_Engine SHALL use the App_Shell's `index.html` as the template and inject SEO tags into the `<head>` section
7. THE Rust output SHALL match the TS `generate-seo.ts` output for the same input fixtures

### Requirement 2.8: Sitemap 和 RSS 生成

**User Story:** 作为博客用户，我希望 Rust 引擎能生成 sitemap.xml 和 rss.xml，这样搜索引擎和 RSS 阅读器能发现我的内容。

#### Acceptance Criteria

1. WHEN sitemap generation is triggered, THE Rust_Engine SHALL generate a `dist/sitemap.xml` file conforming to the Sitemaps protocol
2. THE sitemap.xml SHALL include the homepage URL with priority 1.0 and all post URLs with priority 0.8
3. WHEN RSS generation is triggered, THE Rust_Engine SHALL generate a `dist/rss.xml` file conforming to RSS 2.0 specification
4. THE rss.xml SHALL include channel metadata (title, description, link, language) and item entries for all posts
5. IF siteUrl is not configured, THEN THE Rust_Engine SHALL skip sitemap and RSS generation with a warning message
6. THE Rust output SHALL match the TS `generate-sitemap.ts` and `generate-rss.ts` output for the same input (excluding dynamic timestamps)

### Requirement 2.9: NAPI-RS 绑定发布（Node CLI 调用）

**User Story:** 作为 CLI 用户，我希望能通过 npm 安装 Rust 引擎，这样我可以在命令行中使用高性能的数据生成功能。

#### Acceptance Criteria

1. THE NAPI_RS_Binding SHALL expose `generatePostsData`, `generateAlbumsData`, `generateSeoPages`, `generateSitemap`, and `generateRss` functions to Node.js
2. THE NAPI_RS_Binding SHALL be published as platform-specific npm packages (`@s-blog/engine-win32-x64`, `@s-blog/engine-darwin-arm64`, `@s-blog/engine-linux-x64`)
3. THE main `@s-blog/engine` package SHALL declare platform-specific packages as `optionalDependencies`
4. WHEN installed via npm, THE package manager SHALL automatically download only the binary for the current platform
5. THE NAPI_RS_Binding SHALL provide TypeScript type definitions for all exported functions

### Requirement 2.10: Rust 引擎架构（Tauri Admin 调用）

**User Story:** 作为 Tauri Admin 开发者，我希望能直接在 Rust 代码中调用引擎功能，这样可以获得最佳性能且无需额外的 IPC 开销。

#### Acceptance Criteria

1. THE Rust_Engine SHALL be structured as an independent Rust crate (`s-blog-engine`) that can be used as a library
2. THE crate SHALL expose public functions for all data generation operations (`generate_posts_data`, `generate_albums_data`, `generate_seo_pages`, etc.)
3. THE Tauri_Admin project SHALL be able to add the engine as a Cargo dependency (`s-blog-engine = { path = "..." }` or git dependency)
4. THE engine functions SHALL accept configuration structs and return Result types for proper error handling
5. THE NAPI-RS bindings SHALL be a separate layer that wraps the core library, NOT embedded in the core logic
