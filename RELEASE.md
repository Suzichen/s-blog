# spage 发版指南

## 包依赖关系

```
create-spage (CLI脚手架, 含 NAPI native binding)
  ├─ optionalDependencies →
  │    create-spage-darwin-arm64
  │    create-spage-linux-x64-gnu
  │    create-spage-win32-x64-msvc
  └─ 生成的项目依赖 → @s-page/core, @s-page/engine

@s-page/engine (主包)
  └─ optionalDependencies →
       @s-page/engine-darwin-arm64
       @s-page/engine-linux-x64-gnu
       @s-page/engine-win32-x64-msvc

根项目 (monorepo开发用)
  ├─ @s-page/core (workspace link)
  └─ @s-page/engine (固定版本)
```

## 版本号修改 Checklist

### 1. Engine 相关（7处）

| 文件 | 字段 |
|------|------|
| `crates/spage-engine/Cargo.toml` | `version`（Rust crate 版本，需与 `@s-page/engine` 保持一致） |
| `crates/spage-engine-napi/package.json` | `version` |
| `crates/spage-engine-napi/package.json` | `optionalDependencies` 下三个平台包版本 |
| `crates/spage-engine-napi/npm/darwin-arm64/package.json` | `version` |
| `crates/spage-engine-napi/npm/linux-x64-gnu/package.json` | `version` |
| `crates/spage-engine-napi/npm/win32-x64-msvc/package.json` | `version` |
| `crates/spage-engine-napi/package-lock.json` | `version` + `optionalDependencies` |

> ⚠️ **重点**：`npm/` 下三个平台包的 `version` 必须与主包 `optionalDependencies` 中声明的版本一致，否则 CI 发布后用户安装时版本不匹配，运行时会报 `Cannot find module '@s-page/engine-<platform>'`。
>
> ℹ️ `crates/spage-engine/Cargo.toml` 的 `version` 让直接以 Rust crate 形式引用 engine 的仓库能正确获知版本号，应与 `@s-page/engine` 的 npm 版本保持同步。改完后运行 `cargo update -p spage-engine` 同步 `Cargo.lock`。

### 2. Core（1处）

| 文件 | 字段 |
|------|------|
| `packages/core/package.json` | `version` |

### 3. Create-spage（6处）

| 文件 | 字段 |
|------|------|
| `crates/spage-scaffold/Cargo.toml` | `version`（Rust crate 版本，需与 `create-spage` 保持一致） |
| `packages/create-spage/package.json` | `version` |
| `packages/create-spage/package.json` | `optionalDependencies` 下三个平台包版本 |
| `packages/create-spage/npm/darwin-arm64/package.json` | `version` |
| `packages/create-spage/npm/linux-x64-gnu/package.json` | `version` |
| `packages/create-spage/npm/win32-x64-msvc/package.json` | `version` |
| `crates/spage-scaffold/src/lib.rs` | `@s-page/core` 和 `@s-page/engine` 的版本字符串 |

> ⚠️ **重点**：`npm/` 下三个平台包的 `version` 必须与主包 `optionalDependencies` 中声明的版本一致。
>
> ℹ️ `lib.rs` 中 `generate_package_json` 里的 `@s-page/core` 和 `@s-page/engine` 版本字符串（如 `^0.5.0`）需要更新为本次发布时的最新版本号（如 `^0.5.1`），确保新创建的项目能获得最新修复。即使 semver 范围兼容，也应更新到最新值，作为新项目的最低版本保证。
>
> ℹ️ `crates/spage-scaffold/Cargo.toml` 的 `version` 让直接以 Rust crate 形式引用 scaffold 的仓库能正确获知版本号，应与 `create-spage` 的 npm 版本保持同步。改完后运行 `cargo update -p spage-scaffold` 同步 `Cargo.lock`。

### 4. 根项目依赖（1处）

| 文件 | 字段 |
|------|------|
| `package.json` | `dependencies["@s-page/engine"]` |

> ⚠️ 改完版本号后运行 `bun install` 更新 `bun.lock`（需 engine 已发布到 npm）。

### 5. Schema（按需）

如果 `config.json` 或 `album.config.json` 的结构有变化：
- `packages/core/schemas/config.schema.json`
- `packages/core/schemas/album.config.schema.json`

## CI 发布顺序

```
1. git tag engine-v{VERSION}  →  触发 build-engine.yml
   ├─ 构建三平台 native .node 文件
   ├─ 发布 @s-page/engine-darwin-arm64
   ├─ 发布 @s-page/engine-linux-x64-gnu
   ├─ 发布 @s-page/engine-win32-x64-msvc
   └─ 发布 @s-page/engine (主包)

2. 手动触发 publish-core.yml 或按其触发条件
   └─ 发布 @s-page/core

3. git tag create-v{VERSION}  →  触发 build-create-spage.yml
   ├─ 构建三平台 native .node 文件
   ├─ 发布 create-spage-darwin-arm64
   ├─ 发布 create-spage-linux-x64-gnu
   ├─ 发布 create-spage-win32-x64-msvc
   └─ 发布 create-spage (主包)

4. push master  →  触发 deploy.yml
   └─ bun install → build → deploy to Cloudflare Pages
```

> **关键**：deploy.yml 用 `bun install`，engine 必须已发布到 npm，否则安装会失败。

## 快速操作命令

```bash
# 1. 确认所有版本改完后验证
grep -r "0\.3\." --include="*.json" --include="*.ts" --include="*.rs" | grep spage

# 2. 发布 engine
git tag engine-v0.3.15
git push origin engine-v0.3.15
# 等待 CI 完成

# 3. 发布 core
# (按 publish-core.yml 的触发条件)

# 4. 发布 create-spage
git tag create-v0.4.0
git push origin create-v0.4.0
# 等待 CI 完成

# 5. 部署博客
git push origin master
```

## 常见踩坑

1. **平台包版本未同步** — `npm/*/package.json` 的 `version` 必须改，CI 发布时读的就是这个值（engine 和 create-spage 各有一组）
2. **lock 文件未更新** — engine 发布后需 `bun install` 更新 `bun.lock`
3. **engine 子目录有独立 lock** — `crates/spage-engine-napi/package-lock.json` 也需要更新
4. **scaffold 硬编码版本** — `crates/spage-scaffold/src/lib.rs` 中 `generate_package_json` 里的 `@s-page/core` 和 `@s-page/engine` 版本字符串需要跟着改
5. **发布顺序错误** — 平台包必须先于主包可用，deploy 必须在 engine 发布成功之后
6. **create-spage 正式发布需要 optionalDependencies** — beta 测试时可以直接带 `*.node`，正式发布需要恢复 optionalDependencies 并去掉 `files` 中的 `*.node`
