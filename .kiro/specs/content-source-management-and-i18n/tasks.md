# 实施计划：Content Source Management & i18n

## 概述

本实施计划将设计文档拆分为可增量执行的编码任务，分为两条主线：
1. **Rust 引擎扩展**：多语言文件名解析、PostMetadata i18n 字段、generate_posts_data 分组逻辑
2. **构建流程改造 + 前端适配**：消除 public/ 中间副本、前端语言感知加载、文章级语言切换组件

每个任务在前一个任务的基础上递增构建，最终完成端到端集成。

## Tasks

- [x] 1. Rust 引擎：多语言文件名解析与 BCP 47 验证
  - [x] 1.1 实现 `parse_post_filename` 和 `is_bcp47_language_tag` 函数
    - 在 `crates/s-blog-engine/src/posts.rs` 中新增 `parse_post_filename(filename: &str) -> (String, Option<String>)` 公开函数
    - 新增 `is_bcp47_language_tag(s: &str) -> bool` 内部辅助函数
    - 解析规则：去掉 `.md` 后缀，从最后一个 `.` 分割，检查后半部分是否为有效 BCP 47 语言标签
    - 无效语言代码（如数字后缀 `about.123.md`）应将整个 stem 作为 slug，lang 返回 None
    - 在 `crates/s-blog-engine/src/posts.rs` 的 `mod tests` 中添加单元测试：默认文件、带语言文件、数字后缀、含点号 slug 等场景
    - _需求: 2.1, 2.3, 3.4_

  - [x] 1.2 编写属性测试：文件名解析往返一致性（Property 1）
    - 创建 `crates/s-blog-engine/tests/i18n_props.rs`
    - **Property 1: Filename parsing round-trip**
    - 测试 1：对任意有效 slug 和 BCP 47 语言代码，构造 `{slug}.{lang}.md` 后解析应返回原始 `(slug, Some(lang))`
    - 测试 2：对任意有效 slug，构造 `{slug}.md` 后解析应返回 `(slug, None)`
    - 使用 `proptest` 库，最少 100 次迭代
    - **验证: 需求 2.1, 2.3, 3.4**

- [x] 2. Rust 引擎：PostMetadata 扩展与 generate_posts_data i18n 改造
  - [x] 2.1 为 PostMetadata 添加 `available_languages` 字段
    - 在 `crates/s-blog-engine/src/lib.rs` 的 `PostMetadata` 结构体中新增 `#[serde(default)] pub available_languages: Vec<String>` 字段
    - 添加 `#[serde(rename_all = "camelCase")]` 属性确保 JSON 序列化为 `availableLanguages`
    - 更新所有现有测试中构造 `PostMetadata` 的代码，补充 `available_languages: vec![]` 字段
    - _需求: 2.4, 3.1_

  - [x] 2.2 改造 `generate_posts_data` 支持多语言分组
    - 在 `crates/s-blog-engine/src/posts.rs` 中引入 `PostGroup` 和 `PostFileInfo` 内部结构体
    - 改造 `generate_posts_data` 函数：扫描文件 → 调用 `parse_post_filename` → 按 slug 分组到 `HashMap<String, PostGroup>`
    - 每个 `PostGroup` 包含 `default_file: Option<PostFileInfo>` 和 `localized_files: Vec<(String, PostFileInfo)>`
    - 使用默认文件的 frontmatter 作为 manifest 主元数据，`available_languages` 为所有本地化文件的语言代码列表（排序后）
    - 仅有本地化文件而无默认文件的 slug：输出 `warn!` 日志并跳过（不纳入 manifest，不复制到输出目录）
    - 同一 slug 同时存在默认文件和 `.en.md` 等本地化文件：输出 `warn!` 命名冲突日志，继续构建
    - 所有 `.md` 文件（默认 + 本地化）均复制到 `output_dir/posts/`
    - 在 `mod tests` 中添加单元测试：无本地化文件、有本地化文件、仅本地化无默认文件、命名冲突等场景
    - _需求: 2.2, 3.1, 3.2, 3.3, 5.3, 6.1, 6.2_

  - [x] 2.3 编写属性测试：Manifest i18n 完整性与 slug 唯一性（Property 2）
    - 在 `crates/s-blog-engine/tests/i18n_props.rs` 中新增属性测试
    - **Property 2: Manifest i18n completeness and slug uniqueness**
    - 随机生成文章文件配置（slug、是否有默认文件、本地化语言列表），构建临时目录，运行 `generate_posts_data`
    - 验证：有默认文件的 slug 在 manifest 中恰好出现一次；无默认文件的 slug 不出现在 manifest 中；`availableLanguages` 与实际本地化文件匹配
    - 使用 `proptest` 库，最少 100 次迭代
    - **验证: 需求 2.2, 2.4, 3.1, 3.2, 3.3, 5.3, 6.1**

- [x] 3. 检查点 — 确保 Rust 引擎所有测试通过
  - 运行 `cargo test`，确保所有现有测试和新增测试通过，如有问题请询问用户。

- [x] 3A. Rust 引擎：Manifest 增加 localizedMeta 字段
  - [x] 3A.1 为 PostMetadata 添加 `LocalizedPostMeta` 结构体和 `localized_meta` 字段
    - 在 `crates/s-blog-engine/src/lib.rs` 中新增 `LocalizedPostMeta` 结构体，包含 `title: String` 和 `summary: String` 字段
    - 在 `PostMetadata` 中新增 `#[serde(default, skip_serializing_if = "HashMap::is_empty")] pub localized_meta: HashMap<String, LocalizedPostMeta>` 字段
    - JSON 序列化为 `localizedMeta`（已有 `rename_all = "camelCase"`）
    - 更新所有现有测试中构造 `PostMetadata` 的代码，补充 `localized_meta: HashMap::new()` 字段
    - _需求: 3.5, 3.6_

  - [x] 3A.2 改造 `generate_posts_data` 提取本地化文件的 title/summary 到 `localized_meta`
    - 在 `crates/s-blog-engine/src/posts.rs` 的 `generate_posts_data` 函数中，遍历 `group.localized_files` 时提取每个本地化文件的 frontmatter title 和 summary
    - title 回退逻辑：本地化文件 frontmatter 无 title 时，使用默认文件的 title
    - summary 回退逻辑：本地化文件 frontmatter 无 preview/description/excerpt 时，使用本地化文件 body 的前 140 字符摘要；如果 body 也为空，使用默认文件的 summary
    - 构建 `HashMap<String, LocalizedPostMeta>` 并赋值给 `PostMetadata.localized_meta`
    - 在 `mod tests` 中添加单元测试：本地化文件有 title/summary、本地化文件缺 title 回退默认、无本地化文件时 localized_meta 为空
    - _需求: 3.5, 3.6, 3.7, 3.8, 5.1, 5.2_

  - [x] 3A.3 编写属性测试：localizedMeta 完整性（Property 4）
    - 在 `crates/s-blog-engine/tests/i18n_props.rs` 中新增属性测试
    - **Property 4: Manifest localizedMeta completeness**
    - 随机生成文章文件配置（slug、是否有默认文件、本地化语言列表及各自的 frontmatter），构建临时目录，运行 `generate_posts_data`
    - 验证：`localizedMeta` 的键集合与 `availableLanguages` 完全一致；每个 `localizedMeta` 条目的 `title` 非空；无本地化文件时 `localizedMeta` 为空
    - 使用 `proptest` 库，最少 100 次迭代
    - **验证: 需求 3.5, 3.6, 3.7, 3.8, 5.1, 5.2**

- [x] 3B. 检查点 — 确保 Rust 引擎所有测试通过（含 localizedMeta）
  - 验证 `About.zh-CN.md ` 在构建后是否符合预期。
  - 运行 `cargo test`，确保所有现有测试和新增测试通过，如有问题请询问用户。

- [ ] 4. 构建脚本改造：消除 public/ 中间副本
  - [~] 4.1 改造 `build-rust.cjs` 输出目录
    - 修改 `testes/S-blog-rustEngine12/build-rust.cjs` 中的 `generatePostsData` 调用，将 `output_dir` 从 `'public'` 改为 `'dist'`
    - 修改 `generateAlbumsData` 调用，将 `output_dir` 从 `'public'` 改为 `'dist'`
    - 移除 Step 5 中从 `public/generated` 和 `public/albums` 复制到 `dist/` 的逻辑（不再需要）
    - 保留从项目根目录 `posts/` 和 `albums/` 复制到 `dist/` 的逻辑（由 Rust 引擎直接处理 posts，albums 仍需复制原图）
    - 保留 `public/` 根目录静态资源文件（favicon、logo、`_redirects` 等）的复制逻辑
    - _需求: 1.1, 1.2, 1.3, 1.5, 1.7, 6.3_

  - [ ]* 4.2 编写构建输出验证测试
    - 创建 `testes/S-blog-rustEngine12/test-build-output.js` 脚本
    - 验证 `dist/generated/manifest.json` 存在且包含 `availableLanguages` 字段
    - 验证 `dist/posts/` 包含所有 Markdown 文件
    - 验证 `public/` 不包含 `posts/`、`generated/`、`albums/` 子目录
    - _需求: 1.1, 1.2, 1.3, 1.7_

- [ ] 5. 前端类型更新与 URL 解析工具函数
  - [~] 5.1 更新 `PostMetadata` TypeScript 类型
    - 在 `packages/core/src/types/blog.ts` 中新增 `LocalizedPostMeta` 接口，包含 `title: string` 和 `summary: string`
    - 在 `PostMetadata` 接口中新增 `availableLanguages: string[]` 和 `localizedMeta?: Record<string, LocalizedPostMeta>` 字段
    - _需求: 3.1, 3.5_

  - [~] 5.2 实现 `resolvePostUrl` 工具函数
    - 在 `packages/core/src/hooks/usePost.ts` 中新增（或单独创建 `packages/core/src/utils/resolvePostUrl.ts`）纯函数 `resolvePostUrl(slug: string, availableLanguages: string[], currentLang: string): string`
    - 逻辑：如果 `currentLang` 在 `availableLanguages` 中，返回 `/posts/${slug}.${currentLang}.md`；否则返回 `/posts/${slug}.md`
    - _需求: 4.1, 4.2_

  - [ ]* 5.3 编写属性测试：前端文章 URL 解析（Property 3）
    - 创建 `packages/core/src/__tests__/resolvePostUrl.prop.test.ts`
    - **Property 3: Frontend article URL resolution**
    - 使用 `fast-check` 库，随机生成 slug、availableLanguages、currentLang 组合
    - 验证：currentLang 在 availableLanguages 中时返回本地化 URL，否则返回默认 URL
    - 最少 100 次迭代
    - **验证: 需求 4.1, 4.2**

- [ ] 6. 前端 Hook 改造：语言感知文章加载
  - [~] 6.1 改造 `usePost` Hook 支持语言感知加载
    - 修改 `packages/core/src/hooks/usePost.ts`
    - 引入 `useTranslation` 获取 `i18n.resolvedLanguage`
    - 使用 `resolvePostUrl` 函数根据 `post.availableLanguages` 和当前语言决定 fetch URL
    - 当语言变化时（`currentLang` 作为 `useEffect` 依赖），自动重新加载文章内容
    - 添加 404 回退逻辑：本地化文件 404 时回退加载默认文件 `/posts/${slug}.md`
    - _需求: 4.1, 4.2, 4.3, 4.4_

  - [ ]* 6.2 编写 `usePost` Hook 单元测试
    - 创建 `packages/core/src/hooks/__tests__/usePost.test.ts`
    - 测试场景：加载本地化文件、回退到默认文件、两者都 404 时显示错误、语言切换时重新加载
    - _需求: 4.1, 4.2, 4.3, 4.4_

- [ ] 7. 前端组件：文章级语言切换器
  - [~] 7.1 创建 `PostLanguageSwitcher` 组件
    - 创建 `packages/core/src/components/PostLanguageSwitcher.tsx`
    - 接收 props: `availableLanguages: string[]`、`currentLanguage: string`、`onLanguageChange: (lang: string) => void`
    - 仅当 `availableLanguages.length > 0` 时渲染
    - 显示可用语言按钮，高亮当前语言，样式与现有 `LanguageSwitcher` 组件保持一致
    - _需求: 4.5_

  - [~] 7.2 在 `PostDetail` 页面集成 `PostLanguageSwitcher`
    - 修改 `packages/core/src/pages/PostDetail.tsx`
    - 在文章标题下方渲染 `PostLanguageSwitcher`，传入 `post.availableLanguages` 和当前语言
    - 语言切换时调用 `i18n.changeLanguage` 触发重新加载
    - _需求: 4.5_

  - [ ]* 7.3 编写 `PostLanguageSwitcher` 组件单元测试
    - 创建 `packages/core/src/components/__tests__/PostLanguageSwitcher.test.tsx`
    - 测试场景：无本地化版本时不渲染、有本地化版本时渲染按钮、点击按钮触发回调
    - _需求: 4.5_

- [~] 8. 检查点 — 确保所有测试通过
  - 运行 `cargo test` 确保 Rust 测试通过
  - 运行 `npx vitest --run` 确保 TypeScript 测试通过
  - 如有问题请询问用户。

- [ ] 9. 端到端集成与收尾
  - [~] 9.1 改造 `usePosts` Hook 支持语言感知文章列表
    - 修改 `packages/core/src/hooks/usePosts.ts`
    - 引入 `useTranslation` 获取 `i18n.resolvedLanguage`
    - 对每篇文章检查 `post.localizedMeta?.[currentLang]`，如果存在则使用其 `title` 和 `summary` 替代顶层字段
    - 如果不存在则回退使用顶层的 `title` 和 `summary`（默认文件的元数据）
    - 文章列表天然不会重复（Rust 引擎已按 slug 去重），无需额外去重逻辑
    - _需求: 5.1, 5.2, 5.3_

  - [~] 9.2 确保 Vite 开发插件兼容多语言文件
    - 检查 `vite.config.ts` 中的 `serveSBlogData` 插件，确认请求 `/posts/{slug}.{lang}.md` 时能正确映射到 `posts/{slug}.{lang}.md` 源文件
    - 现有插件已通过路径拼接实现，理论上无需改动，但需验证
    - _需求: 1.4, 1.6_

  - [~] 9.3 确保 NAPI 绑定兼容新 PostMetadata 字段
    - 检查 `crates/s-blog-engine-napi/src/lib.rs`，确认 `generate_posts_data` 返回的 JSON 包含 `availableLanguages` 字段
    - NAPI 函数签名不变（已接受 `output_dir` 参数），仅需确认序列化输出正确
    - _需求: 6.3_

- [~] 10. 最终检查点 — 确保所有测试通过
  - 运行 `cargo test` 确保 Rust 测试通过
  - 运行 `npx vitest --run` 确保 TypeScript 测试通过
  - 确保所有测试通过，如有问题请询问用户。

## 备注

- 标记 `*` 的任务为可选任务，可跳过以加速 MVP 交付
- 每个任务引用了具体的需求编号，确保可追溯性
- 检查点任务确保增量验证，及早发现问题
- 属性测试验证通用正确性属性，单元测试验证具体场景和边界情况
- Rust 使用 `proptest` 库，TypeScript 使用 `fast-check` 库进行属性测试
