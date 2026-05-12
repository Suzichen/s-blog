# 需求文档

## 简介

本功能旨在解决博客系统中的两个核心问题：

1. **消除输出目录中的源文件副本**：重构构建流程，使 Markdown 源文件不再被复制到 `public/` 中间目录，而是在生产构建时直接写入 `dist/`，从根本上消除用户误编辑副本的可能性
2. **多语言文档支持（i18n）**：支持 Markdown 文件的多语言版本，根据用户界面语言自动选择对应语言的文档

## 术语表

- **Source_Directory**：内容源文件所在的目录，包括 `posts/`（文章）和 `albums/`（相册）
- **Output_Directory**：最终构建输出目录 `dist/`
- **Intermediate_Directory**：当前构建流程中的中间目录 `public/`，本次改造的目标是消除其中的源文件副本
- **Rust_Engine**：基于 Rust 实现的博客构建引擎（@s-blog/engine），通过 NAPI 绑定供 Node.js 调用
- **Build_Script**：构建脚本 `build-rust.cjs`，调用 Rust_Engine 生成静态资源
- **Vite_Plugin**：Vite 开发服务器中的 `serveSBlogData` 插件，在开发环境下直接从 Source_Directory 提供文件
- **Language_Code**：语言标识符，如 `zh-CN`、`en`、`ja`
- **Localized_File**：带有语言后缀的文件，如 `about.zh-CN.md`
- **Default_File**：不带语言后缀的默认文件，如 `about.md`
- **Current_Language**：用户当前选择的界面语言，由 i18next 管理
- **Manifest**：文章元数据清单文件 `manifest.json`

## 需求

### 需求 1：消除输出目录中的源文件副本

**用户故事**：作为内容作者，我希望构建流程不在 `public/` 目录中产生 Markdown 源文件的副本，以从根本上消除误编辑副本文件的风险。

#### 验收标准

1. WHEN 执行生产构建时，THE Rust_Engine SHALL 将 Manifest 直接写入 Output_Directory（`dist/generated/manifest.json`），跳过 Intermediate_Directory
2. WHEN 执行生产构建时，THE Build_Script SHALL 直接从 Source_Directory（`posts/`）复制 Markdown 文件到 Output_Directory（`dist/posts/`），跳过 Intermediate_Directory
3. WHEN 生产构建完成后，THE Intermediate_Directory（`public/`）SHALL 不包含 `posts/` 子目录、`generated/` 子目录和 `albums/` 子目录
4. WHILE 开发环境运行时，THE Vite_Plugin SHALL 继续直接从 Source_Directory 提供 `posts/` 和 `albums/` 文件（包括缩略图），无需依赖 Intermediate_Directory 中的副本
5. WHEN 执行生产构建时，THE Rust_Engine SHALL 将相册缩略图直接生成到 Output_Directory（`dist/albums/{dir}/thumbs/`），跳过 Intermediate_Directory
6. WHILE 开发环境运行时，THE Rust_Engine SHALL 将相册缩略图生成到项目根目录的 `albums/{dir}/thumbs/`，由 Vite_Plugin 通过拦截 `/albums/` 请求直接提供服务
7. WHEN 构建完成后，THE Intermediate_Directory（`public/`）SHALL 仅保留真正的静态资源文件（如 favicon、logo、`_redirects` 等），不包含任何构建生成的内容
8. WHEN 构建完成后，THE 前端 SHALL 能够通过 `fetch('/posts/{slug}.md')` 正常加载文章内容，与改造前行为一致

### 需求 2：多语言文件命名规范

**用户故事**：作为内容作者，我希望能够为同一篇文章创建多个语言版本，以便为不同语言的读者提供本地化内容。

#### 验收标准

1. THE Rust_Engine SHALL 支持以下多语言文件命名格式：`{slug}.{language_code}.md`，其中 Language_Code 遵循 BCP 47 标准（如 `zh-CN`、`en`、`ja`）
2. THE Rust_Engine SHALL 将同一 slug 的不同语言版本识别为同一篇文章的多语言变体
3. WHEN 扫描 Source_Directory 时，THE Rust_Engine SHALL 正确解析文件名，提取 slug 和 Language_Code
4. THE Rust_Engine SHALL 在 Manifest 中为每篇文章记录可用的语言版本列表 `availableLanguages` 字段

### 需求 3：多语言文章清单生成

**用户故事**：作为前端开发者，我希望 Manifest 包含多语言信息，以便前端能够根据用户语言选择正确的文章版本。

#### 验收标准

1. THE Rust_Engine SHALL 生成的 Manifest 中每篇文章包含 `availableLanguages` 数组，列出该文章所有可用的语言版本
2. WHEN 文章仅有 Default_File 而无 Localized_File 时，THE Rust_Engine SHALL 将 `availableLanguages` 设为空数组
3. WHEN Localized_File 存在但对应的 Default_File 不存在时，THE Rust_Engine SHALL 输出警告日志并跳过这些本地化文件（不纳入 Manifest）
4. FOR ALL 有效的多语言文章配置，解析文件名后重新生成文件名 SHALL 产生等价的文件名（往返属性）
5. THE Rust_Engine SHALL 生成的 Manifest 中每篇文章包含 `localizedMeta` 对象，键为 Language_Code，值为该语言版本的 `title` 和 `summary`
6. WHEN Localized_File 的 frontmatter 中包含 `title` 和/或 `summary`（或 `preview`/`description`/`excerpt`）时，THE Rust_Engine SHALL 将其记录到 `localizedMeta` 对应语言的条目中
7. WHEN Localized_File 的 frontmatter 中缺少 `title` 时，THE Rust_Engine SHALL 使用 Default_File 的 `title` 作为该语言的回退值
8. FOR ALL Manifest 中的文章条目，`localizedMeta` 的键集合 SHALL 与 `availableLanguages` 数组完全一致

### 需求 4：前端语言感知文章加载

**用户故事**：作为博客读者，我希望系统能够根据我选择的界面语言自动显示对应语言的文章，以获得更好的阅读体验。

#### 验收标准

1. WHEN 用户访问文章详情页时，THE Frontend SHALL 优先加载与 Current_Language 匹配的 Localized_File
2. IF 对应语言的 Localized_File 不存在，THEN THE Frontend SHALL 回退加载 Default_File
3. IF Default_File 也不存在，THEN THE Frontend SHALL 显示文章未找到的错误信息
4. WHEN Current_Language 变更时，THE Frontend SHALL 自动重新加载当前文章的对应语言版本
5. THE Frontend SHALL 在文章详情页显示可用语言切换选项，仅当文章存在多个语言版本时

### 需求 5：前端语言感知文章列表

**用户故事**：作为博客读者，我希望文章列表能够根据我的语言偏好显示对应语言的标题和摘要。

#### 验收标准

1. WHEN 渲染文章列表时，THE Frontend SHALL 检查 Manifest 中 `localizedMeta` 是否包含 Current_Language 对应的条目，如果包含则优先显示该条目的 `title` 和 `summary`
2. IF `localizedMeta` 中不存在 Current_Language 对应的条目，THEN THE Frontend SHALL 回退显示 Default_File 的 `title` 和 `summary`（即 Manifest 顶层字段）
3. THE Frontend SHALL 确保同一篇文章的多语言版本在列表中仅显示一次，而非重复显示
4. FOR ALL 文章列表渲染，切换语言后再切换回原语言 SHALL 显示相同的文章列表（幂等性）

### 需求 6：构建脚本兼容性

**用户故事**：作为开发者，我希望现有的构建流程能够无缝支持多语言功能和新的直接输出机制，无需大幅修改构建配置。

#### 验收标准

1. THE Build_Script SHALL 保持向后兼容，对于不使用多语言功能的项目，构建行为与之前一致（文章仍可正常访问）
2. WHEN Source_Directory 中同时存在 Default_File 和 Localized_File 时，THE Build_Script SHALL 将所有文件复制到 Output_Directory
3. THE Rust_Engine SHALL 接受 Output_Directory 参数，支持直接写入 `dist/` 而非 `public/`
4. IF 构建过程中检测到文件命名冲突（如 `about.md` 和 `about.en.md` 同时存在但内容不一致），THEN THE Build_Script SHALL 输出警告日志但继续构建
