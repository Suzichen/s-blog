# Implementation Plan: App Shell + Rust Engine Architecture

## Overview

本实现计划将 s-blog 从"需要 Node/Bun 环境构建"重构为"预编译外壳 + 运行时 JSON 配置加载 + Rust 数据引擎"。分为两个阶段实施，每阶段需手动验证后再进入下一阶段。

---

## Phase 1: App Shell 改造

- [x] 1. RuntimeConfigLoader 组件开发
  - [x] 1.1 创建 RuntimeConfigLoader React 组件
    - 实现 `fetch()` 并行加载 `/config.json` 和 `/album.config.json`
    - 实现 loading 状态显示
    - 实现错误处理（HTTP 状态码、JSON 解析错误、缺失字段）
    - 支持 `basePath` 配置用于子目录部署
    - _Requirements: 1.1.1, 1.1.2, 1.1.3, 1.1.4, 1.1.5, 1.3.6, 1.3.7_

  - [x] 1.2 编写 RuntimeConfigLoader 单元测试
    - 测试配置文件加载成功场景
    - 测试 HTTP 错误处理
    - 测试 JSON 解析错误处理
    - 测试必填字段验证
    - _Requirements: 1.1.1, 1.1.3, 1.1.4, 1.3.6, 1.3.7_

- [x] 2. Shell 入口和 Vite 构建配置
  - [x] 2.1 创建 shell-entry.tsx 入口文件
    - 使用 RuntimeConfigLoader 包装 SBlogApp
    - 配置 React 渲染入口
    - _Requirements: 1.2.1, 1.2.2_

  - [x] 2.2 创建 vite.shell.config.ts 构建配置
    - 配置输出目录为 `dist/shell`
    - 使用相对路径 `base: './'` 支持任意部署位置
    - 配置 rollup input 为 shell-entry.tsx
    - _Requirements: 1.2.1, 1.2.3, 1.2.4_

  - [x] 2.3 更新 package.json 添加 shell 构建脚本
    - 添加 `build:shell` 脚本
    - 确保 `dist/shell` 目录包含在 npm 发布中
    - _Requirements: 1.2.5_

- [x] 3. JSON Schema 文件创建
  - [x] 3.1 创建 config.schema.json
    - 定义所有站点配置字段的 JSON Schema
    - 包含字段描述用于编辑器智能提示
    - _Requirements: 1.3.1, 1.3.3, 1.3.4_

  - [x] 3.2 创建 album.config.schema.json
    - 定义相册配置字段的 JSON Schema
    - _Requirements: 1.3.2, 1.3.5_

- [x] 4. 数据生成脚本适配
  - [x] 4.1 修改 generate-posts-data.ts 读取 JSON 配置
    - 从 `config.json` 读取 timezone 配置
    - 添加 basePath 路径处理
    - 添加配置文件缺失/无效的错误处理
    - _Requirements: 1.4.1, 1.4.5, 1.5.5_

  - [x] 4.2 修改 generate-albums-data.ts 读取 JSON 配置
    - 从 `album.config.json` 读取相册配置
    - 添加错误处理
    - _Requirements: 1.4.2, 1.4.5_

  - [x] 4.3 修改 generate-seo.ts 读取 JSON 配置
    - 从 `config.json` 读取站点配置
    - 使用 App Shell 的 `index.html` 作为模板
    - 添加 basePath 路径处理
    - _Requirements: 1.4.3, 1.5.5_

  - [x] 4.4 修改 generate-sitemap.ts 和 generate-rss.ts
    - 从 `config.json` 读取站点配置
    - 添加 basePath 路径处理
    - _Requirements: 1.4.4, 1.5.5_

- [x] 5. 构建辅助脚本
  - [x] 5.1 创建 copy-shell.ts 脚本
    - 复制 `@s-blog/core/dist/shell/*` 到 `dist/`
    - 处理目录创建和文件覆盖
    - 跨平台兼容（Windows/Mac/Linux）
    - _Requirements: 1.5.1, 1.5.3, 1.5.4_

  - [x] 5.2 创建 copy-public.ts 脚本
    - 复制 `public/generated/`, `public/posts/`, `public/albums/` 到 `dist/`
    - 复制其他静态资源
    - _Requirements: 1.5.2, 1.5.3, 1.5.4_

- [x] 6. CLI 模板改造
  - [x] 6.1 更新 create-s-blog 模板结构
    - 移除 Vite/React 相关文件（`src/main.tsx`, `vite.config.ts`, `postcss.config.js`, `tailwind.config.js`）
    - 将 `src/posts/` 移动到根目录 `posts/`
    - _Requirements: 1.6.1, 1.6.3_

  - [x] 6.2 添加 JSON 配置文件模板
    - 创建 `config.json` 模板（带 $schema 引用）
    - 创建 `album.config.json` 模板
    - _Requirements: 1.6.2_

  - [x] 6.3 更新模板 package.json
    - 更新构建脚本为新流程
    - 精简依赖（仅保留 `tsx` 用于运行脚本）
    - 确保 `npm run dev` 和 `npm run build` 行为一致
    - _Requirements: 1.6.4, 1.6.5_

- [x] 7. 文档更新
  - [x] 7.1 更新 README 文档
    - 更新 README.md, README.zh-CN.md, README.ja-JP.md
    - 添加 JSON 配置示例
    - 更新构建/部署说明
    - _Requirements: 1.7.1, 1.7.2, 1.7.3_

  - [x] 7.2 更新 create-s-blog README
    - 反映简化后的项目结构
    - _Requirements: 1.7.4_

- [x] 8. Phase 1 端到端验证检查点
  - 验证 Core 修改后的脚本能成功驱动 App Shell 生成可部署博客
  - 验证 `npx create-s-blog` 创建的新项目能正常构建运行
  - 验证首页、文章页、相册页、SEO 页面都能正确渲染
  - 验证构建输出可部署到 Netlify/Vercel/任意静态托管
  - Ensure all tests pass, ask the user if questions arise.
  - _Requirements: 1.8.1, 1.8.2, 1.8.3, 1.8.4_

- [x] 9. Phase 1 遗留修复（Phase 2 前置）
  - [x] 9.1 修复 `@s-blog/core` npm 发布 `files` 字段
    - 当前 `files` 为 `["dist/", "scripts/"]`，缺少 `schemas/` 目录
    - 用户通过 `$schema` 引用 unpkg 上的 schema 文件时会 404
    - 将 `schemas/` 加入 `files` 数组

---

## Phase 2: Rust 引擎开发

- [x] 10. 测试基础设施搭建
  - [x] 10.1 创建测试 fixtures 目录结构
    - 创建 `tests/fixtures/posts/` 包含各类测试 Markdown 文件
    - 创建 `tests/fixtures/albums/` 包含测试图片
    - 创建 `tests/fixtures/config.json` 和 `album.config.json`
    - ⚠️ fixtures 中的 config.json / album.config.json 必须与 Phase 1 改造后的 JSON 格式一致（脚本已改为读取 JSON 配置），确保字段名和结构匹配
    - _Requirements: 2.0.1, 2.0.2_

  - [x] 10.2 运行 TS 脚本生成 golden files
    - 使用 fixtures 运行所有 TS 脚本
    - 将输出保存到 `tests/golden/` 目录
    - _Requirements: 2.0.3_

  - [x] 10.3 创建跨实现验证测试框架
    - 设置 `npm test` 命令运行验证测试
    - 实现 Rust 输出与 TS 输出的比对逻辑
    - _Requirements: 2.0.4, 2.0.5_

- [x] 11. Rust 项目初始化
  - [x] 11.1 创建 Rust workspace 和 crate 结构
    - 创建 `crates/s-blog-engine/` 核心库
    - 创建 `crates/s-blog-engine-napi/` NAPI 绑定层
    - 配置 Cargo.toml 依赖
    - ⚠️ 所有路径处理须使用跨平台规范化（Windows 反斜杠 vs Unix 正斜杠），建议统一使用 `/` 作为路径分隔符输出，内部使用 `std::path::Path` 处理
    - _Requirements: 2.10.1, 2.10.5_

- [x] 12. Frontmatter 解析模块
  - [x] 12.1 实现 frontmatter.rs 模块
    - 实现 YAML frontmatter 解析（`---` 分隔符）
    - 解析 title, date, tags, categories, preview, description, excerpt 字段
    - 实现 tags/categories 数组规范化（支持空格/逗号分隔）
    - 处理无效日期格式（警告并使用空字符串）
    - _Requirements: 2.1.1, 2.1.2, 2.1.3, 2.1.4_

  - [x]* 12.2 编写 Frontmatter 单元测试
    - 测试各种 frontmatter 格式
    - 测试边界情况和错误处理
    - _Requirements: 2.1.6_

  - [x]* 12.3 编写 Frontmatter Round-Trip 属性测试
    - **Property 1: Frontmatter Round-Trip**
    - **Validates: Requirements 2.1.1, 2.1.2, 2.1.5**

  - [x]* 12.4 编写 Tag/Category 规范化属性测试
    - **Property 2: Tag/Category Normalization**
    - **Validates: Requirements 2.1.3**

- [x] 13. 时区处理模块
  - [x] 13.1 实现 timezone.rs 模块
    - 实现日期时区转换
    - 处理无时区偏移的日期（视为 UTC）
    - 处理无效时区标识符（警告并回退到 UTC）
    - 输出 ISO 8601 格式（无时区后缀）
    - _Requirements: 2.2.1, 2.2.2, 2.2.3, 2.2.4_

  - [x] 13.2 编写时区转换属性测试
    - **Property 3: Timezone Conversion Correctness**
    - **Validates: Requirements 2.2.1, 2.2.4**

- [x] 14. 文章清单生成模块
  - [x] 14.1 实现 posts.rs 模块
    - 扫描 posts 目录生成 manifest.json
    - 包含 slug, title, date, tags, categories, summary
    - 按日期降序排序
    - 复制 Markdown 文件到 public/posts/
    - 处理目录不存在错误
    - _Requirements: 2.3.1, 2.3.2, 2.3.3, 2.3.4, 2.3.5_

  - [x] 14.2 编写文章清单生成测试
    - 验证输出与 TS 脚本一致
    - _Requirements: 2.3.6_

  - [x] 14.3 编写 Manifest 完整性属性测试
    - **Property 4: Manifest Generation Completeness**
    - **Validates: Requirements 2.3.1, 2.3.2, 2.3.3**

- [x] 15. Checkpoint - Rust 核心解析模块验证
  - 验证 Frontmatter、时区、文章清单模块通过所有测试
  - 验证 Rust 输出与 TS golden files 一致
  - 验证根项目 `npm run dev` / `npm run build` 仍能正常工作（防止回归）
  - Ensure all tests pass, ask the user if questions arise.

- [x] 16. 图片处理模块
  - [x] 16.1 实现 image_proc.rs 缩略图生成模块
    - 生成 WebP 缩略图（最长边不超过 1080px）
    - 保持原始宽高比
    - 支持 JPEG, PNG, WebP 输入格式
    - 实现增量构建（跳过已存在且较新的缩略图）
    - 处理解码失败（警告并跳过）
    - _Requirements: 2.4.1, 2.4.2, 2.4.3, 2.4.5, 2.4.6_

  - [x] 16.2 编写缩略图尺寸约束属性测试
    - **Property 5: Thumbnail Size Constraint**
    - **Validates: Requirements 2.4.1, 2.4.2**

- [x] 17. EXIF 读取模块
  - [x] 17.1 实现 exif.rs 模块
    - 提取 Make, Model, FocalLength, FNumber, ExposureTime, ISO
    - 格式化 ExposureTime 为分数（如 1/250）
    - FocalLength 四舍五入到整数
    - 处理无法读取 EXIF 的情况（返回 null）
    - _Requirements: 2.5.1, 2.5.2, 2.5.3, 2.5.4_

  - [x] 17.2 编写 EXIF 格式化属性测试
    - **Property 6: EXIF Formatting**
    - **Validates: Requirements 2.5.2, 2.5.3**

- [x] 18. 相册数据生成模块
  - [x] 18.1 实现 albums.rs 模块
    - 生成 albums-index.json（所有相册摘要）
    - 为每个相册生成 album-{dirname}.json
    - 包含 dirname, name, cover, photoCount
    - 处理无效目录名（错误并跳过）
    - 处理相册模块禁用（生成空 albums-index.json）
    - _Requirements: 2.6.1, 2.6.2, 2.6.3, 2.6.4, 2.6.5_

  - [x] 18.2 编写相册数据生成测试
    - 验证输出与 TS 脚本一致
    - _Requirements: 2.6.6_

  - [x] 18.3 编写相册数据完整性属性测试
    - **Property 7: Album Data Completeness**
    - **Validates: Requirements 2.6.1, 2.6.2, 2.6.3**

- [x] 19. Checkpoint - Rust 图片处理模块验证
  - 验证图片处理、EXIF、相册模块通过所有测试
  - 验证 Rust 输出与 TS golden files 一致
  - 验证根项目 `npm run dev` / `npm run build` 仍能正常工作（防止回归）
  - Ensure all tests pass, ask the user if questions arise.

- [x] 20. SEO 页面生成模块
  - [x] 20.1 实现 seo.rs 模块
    - 为每篇文章生成 `dist/post/{slug}/index.html`
    - 注入 title, meta description, meta keywords, canonical link
    - 注入 Open Graph 标签
    - 注入 Twitter Card 标签
    - 注入 JSON-LD Article schema
    - 使用 App Shell 的 index.html 作为模板
    - _Requirements: 2.7.1, 2.7.2, 2.7.3, 2.7.4, 2.7.5, 2.7.6_

  - [x] 20.2 编写 SEO 页面生成测试
    - 验证输出与 TS 脚本一致
    - _Requirements: 2.7.7_

  - [x] 20.3 编写 SEO 页面完整性属性测试
    - **Property 8: SEO Page Completeness**
    - **Validates: Requirements 2.7.1, 2.7.2, 2.7.3, 2.7.4, 2.7.5**

- [x] 21. Sitemap 和 RSS 生成模块
  - [x] 21.1 实现 sitemap.rs 模块
    - 生成符合 Sitemaps 协议的 sitemap.xml
    - 首页 URL priority 1.0，文章 URL priority 0.8
    - _Requirements: 2.8.1, 2.8.2_

  - [x] 21.2 实现 rss.rs 模块
    - 生成符合 RSS 2.0 规范的 rss.xml
    - 包含 channel 元数据和所有文章 item
    - 处理 siteUrl 未配置（警告并跳过）
    - _Requirements: 2.8.3, 2.8.4, 2.8.5_

  - [x] 21.3 编写 Sitemap/RSS 生成测试
    - 验证输出与 TS 脚本一致（排除动态时间戳）
    - _Requirements: 2.8.6_

  - [x] 21.4 编写 Feed 完整性属性测试
    - **Property 9: Feed Completeness**
    - **Validates: Requirements 2.8.2, 2.8.4**

- [x] 22. BasePath 路径处理
  - [x] 22.1 实现 basePath 路径前缀处理
    - 在所有生成的资源路径中正确添加 basePath 前缀
    - 正确处理尾部斜杠
    - _Requirements: 1.5.5_

  - [x] 22.2 编写 BasePath 前缀属性测试
    - **Property 10: BasePath Prefixing**
    - **Validates: Requirements 1.5.5**

- [x] 23. Checkpoint - Rust SEO/Feed 模块验证
  - 验证 SEO、Sitemap、RSS 模块通过所有测试
  - 验证 Rust 输出与 TS golden files 一致
  - 验证根项目 `npm run dev` / `npm run build` 仍能正常工作（防止回归）
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 24. NAPI-RS 绑定层
  - [ ] 24.1 实现 NAPI-RS 绑定
    - 暴露 generatePostsData, generateAlbumsData, generateSeoPages, generateSitemap, generateRss 函数
    - 实现 JSON 字符串参数传递
    - _Requirements: 2.9.1_

  - [ ] 24.2 配置多平台构建
    - 配置 GitHub Actions 构建 Windows/Mac/Linux 二进制
    - 发布平台特定 npm 包
    - _Requirements: 2.9.2, 2.9.3, 2.9.4_

  - [ ] 24.3 生成 TypeScript 类型定义
    - 为所有导出函数生成 .d.ts 文件
    - _Requirements: 2.9.5_

- [ ] 25. Tauri Admin 集成说明
  - [ ] 25.1 编写 Rust 引擎集成文档
    - 说明如何作为 Cargo 依赖使用
    - 提供 API 使用示例
    - _Requirements: 2.10.2, 2.10.3, 2.10.4_

- [ ] 26. Phase 2 最终验证检查点
  - 运行完整测试套件 `npm test`
  - 验证所有 Rust 模块输出与 TS 脚本一致
  - 验证 NAPI-RS 绑定在 Node.js 中正常工作
  - 验证根项目 `npm run dev` / `npm run build` 仍能正常工作（防止回归）
  - Ensure all tests pass, ask the user if questions arise.
  - _Requirements: 2.0.5_

---

## Notes

- 标记 `*` 的任务为可选任务，可跳过以加快 MVP 进度
- 每个任务都引用了具体的需求条款以确保可追溯性
- Checkpoint 任务确保增量验证
- 属性测试验证通用正确性属性
- 单元测试验证具体示例和边界情况
- Phase 1 和 Phase 2 之间需要手动验证后再继续
