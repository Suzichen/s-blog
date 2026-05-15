# 需求文档

## 简介

为 `@s-blog/engine`（Rust NAPI 模块）新增 `build` 和 `serve` 两个开箱即用的 CLI 命令，使生成后的前端项目 `package.json` scripts 只需简单调用这两个命令即可完成全部构建和本地预览，取代当前手动编写的 `build-rust.cjs` 临时脚本。

核心架构原则：所有构建和服务逻辑实现在 Rust crate 层（`s-blog-engine`），NAPI 层仅做薄封装，CLI 层仅做参数解析后调用 NAPI。这确保未来 Tauri 2 admin 客户端可直接依赖同一 Rust crate 调用相同的 `build()` / `serve()` 函数，避免重复实现。

本次范围限定：**仅封装现有 `build-rust.cjs` 的 build 和 serve 功能，不新增任何当前脚本中不存在的逻辑。** 唯一的变更是将开发模式的中间产物输出目录从 `public/generated/` 改为 `.cache/`。

## 术语表

- **Engine**: `@s-blog/engine` npm 包，由 Rust 通过 NAPI-RS 编译的原生 Node.js 模块，提供博客数据生成的核心能力
- **Engine_Crate**: `s-blog-engine` Rust crate，包含所有构建和服务的核心逻辑，可被 NAPI 层和 Tauri 客户端等任意 Rust 消费者直接依赖
- **CLI_Runner**: Engine 包内提供的命令行入口脚本，负责解析参数并调用 Engine 的 NAPI 函数；本身是薄壳，不包含业务逻辑
- **Build_Command**: CLI 的 `build` 子命令，执行完整的生产构建流程
- **Serve_Command**: CLI 的 `serve` 子命令，集成数据生成与多目录映射的开发预览服务器（生成 manifest 和相册数据到 Cache_Dir，然后启动 HTTP 服务器映射 Cache_Dir、posts/、albums/、public/ 和 App_Shell 多个目录）
- **Site_Config**: 项目根目录的 `config.json`，包含站点标题、描述、URL 等配置
- **Album_Config**: 项目根目录的 `album.config.json`，包含相册启用状态和相册列表配置
- **App_Shell**: `@s-blog/core` 包预构建的 SPA 外壳文件（HTML/CSS/JS），位于 `node_modules/@s-blog/core/dist/shell/`
- **Manifest**: 文章元数据索引文件 `manifest.json`，包含所有文章的标题、日期、标签等信息
- **Dist_Dir**: 构建输出目录，默认为项目根目录下的 `dist/`
- **Cache_Dir**: 中间生成文件目录，默认为项目根目录下的 `.cache/`，存放开发模式下生成的 manifest 和相册数据等中间产物

## 需求

### 需求 1：CLI 入口注册

**用户故事：** 作为博客项目开发者，我希望安装 `@s-blog/engine` 后就能直接在 npm scripts 中使用 `s-blog build` 和 `s-blog serve` 命令，且在 Node.js 和 Bun 两种运行时下均可正常工作，从而无需编写额外的构建脚本。

#### 验收标准

1. THE Engine 包的 `package.json` SHALL 声明 `bin` 字段，将 `s-blog` 命令映射到 CLI_Runner 入口文件，且该入口文件的首行包含兼容 node 和 bun 的 shebang 声明（`#!/usr/bin/env node`）
2. WHEN 用户在 Node.js 环境下执行 `npx s-blog` 且未提供子命令时，THE CLI_Runner SHALL 输出帮助信息并以退出码 0 结束进程，帮助信息中须包含可用子命令名称（build、serve）及每个子命令不超过 80 字符的单行用途说明
3. WHEN 用户在 Bun 环境下执行 `bunx s-blog` 且未提供子命令时，THE CLI_Runner SHALL 输出与 Node.js 环境相同的帮助信息并以退出码 0 结束进程
4. WHEN 用户执行 `npx s-blog --version` 或 `bunx s-blog --version` 时，THE CLI_Runner SHALL 输出与 Engine 包 `package.json` 中 `version` 字段一致的语义化版本号（格式为 `MAJOR.MINOR.PATCH`），并以退出码 0 结束进程
5. WHEN 用户执行 `npx s-blog --help` 或 `bunx s-blog --help` 时，THE CLI_Runner SHALL 输出使用说明并以退出码 0 结束进程，说明中须包含所有子命令（build、serve）及全局选项（--version、--help）的名称与用途描述
6. IF 用户执行 `npx s-blog` 或 `bunx s-blog` 时提供了未识别的子命令，THEN THE CLI_Runner SHALL 输出错误信息指明该子命令不存在，并以非零退出码结束进程
7. THE CLI_Runner SHALL 不使用任何 Node.js 或 Bun 特有的运行时 API（如 Bun.file、node:test 等），仅使用两者共同支持的标准 API（process、fs、path 等），确保同一份代码在两种运行时下行为一致

### 需求 2：Build 命令 — 生产构建

**用户故事：** 作为博客项目开发者，我希望执行一条 `s-blog build` 命令就能完成从清理输出目录到生成所有静态资源的完整构建流程，从而简化部署流程。

#### 验收标准

1. WHEN 用户执行 `s-blog build` 时，THE Build_Command SHALL 按以下固定顺序执行完整构建流程：清理 Dist_Dir → 复制 App_Shell → 生成文章数据 → 生成相册数据 → 生成 SEO 页面及 sitemap/rss/robots → 复制静态资源（`albums/` 原始图片、`public/` 根目录文件、`posts/` 目录）和配置文件（`config.json`、`album.config.json`）
2. WHEN 构建开始时，THE Build_Command SHALL 删除已有的 Dist_Dir 并重新创建空目录
3. WHEN 复制 App_Shell 时，THE Build_Command SHALL 将 `index.html` 中以 `./` 开头的资源引用（href 和 src 属性）修正为基于 Site_Config 中 `basePath` 的绝对路径
4. IF 构建过程中任一步骤执行失败，THEN THE Build_Command SHALL 输出包含失败步骤名称和错误原因的错误信息，并以非零退出码终止，不再执行后续步骤
5. WHEN 构建成功完成时，THE Build_Command SHALL 输出每个步骤的执行摘要（包含该步骤处理的文件数量）和构建总耗时（精确到毫秒）
6. WHERE 用户通过 `--output` 选项指定自定义输出目录时，THE Build_Command SHALL 将构建产物输出到该指定目录而非默认的 `dist/`
7. THE Build_Command SHALL 从当前工作目录读取 `config.json` 和 `album.config.json` 作为构建配置
8. IF 当前工作目录中不存在 `config.json`，THEN THE Build_Command SHALL 输出指明缺失文件名的错误信息并以非零退出码终止
9. IF `config.json` 或 `album.config.json` 内容不是合法 JSON 格式，THEN THE Build_Command SHALL 输出指明文件名和解析错误原因的错误信息并以非零退出码终止

### 需求 3：~~Build 命令 — 开发模式~~ （已合并至 Serve 命令）

> **注意：** 此需求的功能已集成到 Serve 命令中。`s-blog serve` 启动时会自动执行数据生成（manifest + 相册数据），无需单独的 `build --dev` 步骤。保留此节仅作历史参考。

**用户故事：** 作为博客项目开发者，我希望在开发阶段能快速生成数据文件到 `.cache/` 隐藏目录，从而配合开发服务器实现预览，同时不污染用户工作目录。

#### 验收标准

1. WHEN 用户执行 `s-blog serve` 时，THE Serve_Command SHALL 在启动 HTTP 服务器之前，自动生成文章 Manifest（`.cache/manifest.json`）和相册数据（`.cache/albums-index.json` 及各相册详情文件）到 Cache_Dir 目录
2. WHEN Cache_Dir 不存在时，THE Serve_Command SHALL 自动创建 `.cache/` 目录及其所需的子目录

### 需求 4：Serve 命令 — 开发预览服务器

**用户故事：** 作为博客项目开发者，我希望执行 `s-blog serve` 就能启动一个集成数据生成和多目录映射的开发服务器，从而无需先执行 build 即可实时预览文章效果。

#### 验收标准

1. WHEN 用户执行 `s-blog serve` 时，THE Serve_Command SHALL 先生成开发数据（manifest + 相册数据）到 Cache_Dir，然后启动 HTTP 服务器，按以下优先级映射多个目录的文件：Cache_Dir → `posts/` → `albums/` → `public/` → App_Shell
2. THE Serve_Command SHALL 默认监听 `localhost:3000` 端口
3. WHERE 用户通过 `--port` 选项指定端口号时，THE Serve_Command SHALL 监听该指定端口；端口号的有效范围为 1 至 65535 的整数
4. IF `--port` 指定的值不是 1–65535 范围内的整数，THEN THE Serve_Command SHALL 输出错误信息指明有效端口范围，并以非零退出码终止
5. WHEN 请求的路径对应一个存在的静态文件时，THE Serve_Command SHALL 返回该文件内容，并根据文件扩展名设置对应的 MIME 类型响应头（未识别的扩展名使用 `application/octet-stream`）
6. WHEN 请求的路径不带文件扩展名且不对应任何已有文件时，THE Serve_Command SHALL 返回 App_Shell 的 `index.html` 内容以支持 SPA 客户端路由（SPA 回退）
7. WHEN 请求的路径带文件扩展名但不对应任何已有文件时，THE Serve_Command SHALL 返回 HTTP 404 状态码（避免浏览器将 HTML 误解析为 JS/CSS）
8. IF App_Shell 目录（`node_modules/@s-blog/core/dist/shell`）不存在，THEN THE Serve_Command SHALL 输出错误提示（建议确认 `@s-blog/core` 已安装）并以非零退出码终止
9. WHEN 服务器成功启动时，THE Serve_Command SHALL 在标准输出中输出包含协议、主机名和端口号的完整访问地址（如 `http://localhost:3000/`）
10. THE Serve_Command SHALL 不缓存文件内容，每次请求从磁盘读取最新文件，使用户修改 Markdown 后刷新浏览器即可看到更新
11. IF 指定端口已被占用导致监听失败，THEN THE Serve_Command SHALL 输出错误信息指明端口冲突，并以非零退出码终止
12. WHEN Site_Config 中配置了非根 `basePath`（如 `/blog`）时，THE Serve_Command SHALL 自动剥离请求路径中的 basePath 前缀后再进行文件查找，确保客户端带 basePath 前缀的资源请求能正确映射到实际文件

### 需求 5：package.json scripts 兼容性

**用户故事：** 作为博客项目开发者，我希望迁移到 CLI 命令后，项目 `package.json` 的 scripts 只需 `build` 和 `serve` 两个入口，且构建产物与当前 `build-rust.cjs` 完全一致，从而可以安全删除临时脚本。

#### 验收标准

1. WHEN 用户执行 `s-blog build` 完成后，THE Build_Command SHALL 产出与当前 `node build-rust.cjs` 生产模式相同的 dist/ 目录结构和文件内容，使 `build-rust.cjs` 可从项目中删除且不影响构建产物
2. THE Engine 包 SHALL 通过 npm package 的 bin 字段将 `s-blog` 命令注册到 node_modules/.bin/，使项目 package.json 的 scripts 中可直接引用 `s-blog build` 和 `s-blog serve` 而无需指定完整路径

### 需求 6：CLI 实现方式 — 薄壳架构

**用户故事：** 作为 Engine 包的维护者，我希望 CLI 入口脚本仅作为参数解析的薄壳，所有核心逻辑均在 Rust crate 层实现，从而保持包体积小、启动速度快，并确保 Tauri admin 客户端可复用同一套核心逻辑。

#### 验收标准

1. THE CLI_Runner SHALL 使用 Node.js/Bun 兼容脚本实现（非 Rust 编译的独立二进制），通过 `require('@s-blog/engine')` 调用 NAPI 绑定函数
2. THE CLI_Runner SHALL 不引入额外的第三方 CLI 框架依赖（如 commander、yargs），仅使用 Node.js 内置的 `process.argv` 解析参数
3. THE CLI_Runner 的入口文件 SHALL 使用 CommonJS 格式（`.cjs` 或无后缀 `.js` 配合 `"type": "commonjs"`），确保与 NAPI 原生模块的 `require` 加载方式兼容
4. THE CLI_Runner 入口文件的首行 SHALL 包含 shebang 声明 `#!/usr/bin/env node`，确保在 Unix 系统上可直接执行，且 Bun 运行时同样识别该 shebang
5. THE CLI_Runner 入口文件（不含 shebang 行和注释）SHALL 不超过 200 行代码，且文件体积不超过 10 KB
6. IF `require('@s-blog/engine')` 加载失败，THEN THE CLI_Runner SHALL 向 stderr 输出包含失败原因的错误信息，并以非零退出码（exit code 1）终止进程
7. WHEN CLI_Runner 执行完成时，THE CLI_Runner SHALL 在成功时以退出码 0 退出，在任何运行时错误时以退出码 1 退出
8. THE CLI_Runner SHALL 仅负责参数解析和结果格式化输出，所有构建逻辑（文件复制、数据生成、SEO 生成等）和服务逻辑（HTTP 服务器）SHALL 由 NAPI 层暴露的函数完成
9. THE CLI_Runner SHALL 不包含任何文件系统操作逻辑（如 `fs.mkdirSync`、`fs.copyFileSync`），所有文件操作 SHALL 由 Engine_Crate 通过 NAPI 函数内部完成

### 需求 7：Rust 库函数层 API 设计

**用户故事：** 作为 Tauri admin 客户端的开发者，我希望 `s-blog-engine` Rust crate 将 `build` 和 `serve` 作为公开库函数暴露，从而可以直接在 Rust 代码中调用同一套构建和服务逻辑，无需通过 NAPI 或 CLI 中转。

#### 验收标准

1. THE Engine_Crate SHALL 暴露公开的 `build()` 函数，接受结构化的 `BuildOptions` 参数（包含工作目录路径、输出目录路径、是否为开发模式等字段），返回 `Result<BuildResult, EngineError>`
2. THE Engine_Crate SHALL 暴露公开的 `serve()` 函数，接受结构化的 `ServeOptions` 参数（包含服务目录路径、端口号等字段），返回 `Result<ServeHandle, EngineError>`
3. THE `BuildOptions` 结构体 SHALL 使用 `#[derive(Default)]` 并为所有可选字段提供合理默认值（输出目录默认 `dist/`、开发模式默认 `false`、缓存目录默认 `.cache/`），使调用方可通过 `BuildOptions::default()` 获取最小配置
4. THE `ServeOptions` 结构体 SHALL 使用 `#[derive(Default)]` 并为所有可选字段提供合理默认值（端口默认 3000、工作目录默认 `.`、缓存目录默认 `.cache`、App_Shell 目录默认 `node_modules/@s-blog/core/dist/shell`），使调用方可通过 `ServeOptions::default()` 获取最小配置
5. THE Engine_Crate 的 `build()` 函数 SHALL 包含与 CLI `s-blog build` 完全相同的构建流程逻辑（清理目录、复制 Shell、生成数据、生成 SEO 等），确保 CLI 和 Tauri 客户端调用结果一致
6. THE Engine_Crate 的 `serve()` 函数 SHALL 包含与 CLI `s-blog serve` 完全相同的 HTTP 服务逻辑（静态文件服务、SPA fallback、MIME 类型），确保 CLI 和 Tauri 客户端调用结果一致
7. THE NAPI 层 SHALL 仅作为 Engine_Crate `build()` 和 `serve()` 函数的薄封装，负责 JSON 字符串与 Rust 结构体之间的序列化/反序列化转换，不包含额外业务逻辑
8. THE `BuildResult` 结构体 SHALL 包含构建摘要信息（各步骤处理的文件数量、总耗时），使调用方可获取构建结果而无需解析标准输出
9. IF `build()` 函数执行过程中任一步骤失败，THEN THE Engine_Crate SHALL 返回包含失败步骤名称和错误原因的 `EngineError`，调用方可据此决定错误处理策略
10. THE Engine_Crate SHALL 在 `Cargo.toml` 中将 `build()`、`serve()` 及相关类型标记为公开 API，并提供 Rust doc 注释说明用法示例

### 需求 8：构建产物目录隔离

**用户故事：** 作为博客内容创作者，我希望构建过程不会在项目根目录下产生除 `.cache/` 和 `dist/` 之外的额外文件或目录，从而保持工作目录整洁。

#### 验收标准

1. WHEN `s-blog serve` 生成中间文件时，THE Serve_Command SHALL 将所有中间产物写入 `.cache/` 隐藏目录，不在项目根目录或其他位置创建中间文件
2. THE Build_Command SHALL 不在项目根目录下创建除 `.cache/`（开发模式）和 `dist/`（生产模式）之外的任何目录或文件作为构建产物
