# S-Blog 发版指南

## 包依赖关系

```
create-s-blog (CLI脚手架, 含 NAPI native binding)
  ├─ optionalDependencies →
  │    create-s-blog-darwin-arm64
  │    create-s-blog-linux-x64-gnu
  │    create-s-blog-win32-x64-msvc
  └─ 生成的项目依赖 → @s-blog/core, @s-blog/engine

@s-blog/engine (主包)
  └─ optionalDependencies →
       @s-blog/engine-darwin-arm64
       @s-blog/engine-linux-x64-gnu
       @s-blog/engine-win32-x64-msvc

根项目 (monorepo开发用)
  ├─ @s-blog/core (workspace link)
  └─ @s-blog/engine (固定版本)
```

## 版本号修改 Checklist

### 1. Engine 相关（6处）

| 文件 | 字段 |
|------|------|
| `crates/s-blog-engine-napi/package.json` | `version` |
| `crates/s-blog-engine-napi/package.json` | `optionalDependencies` 下三个平台包版本 |
| `crates/s-blog-engine-napi/npm/darwin-arm64/package.json` | `version` |
| `crates/s-blog-engine-napi/npm/linux-x64-gnu/package.json` | `version` |
| `crates/s-blog-engine-napi/npm/win32-x64-msvc/package.json` | `version` |
| `crates/s-blog-engine-napi/package-lock.json` | `version` + `optionalDependencies` |

> ⚠️ **重点**：`npm/` 下三个平台包的 `version` 必须与主包 `optionalDependencies` 中声明的版本一致，否则 CI 发布后用户安装时版本不匹配，运行时会报 `Cannot find module '@s-blog/engine-<platform>'`。

### 2. Core（1处）

| 文件 | 字段 |
|------|------|
| `packages/core/package.json` | `version` |

### 3. Create-s-blog（5处）

| 文件 | 字段 |
|------|------|
| `packages/create-s-blog/package.json` | `version` |
| `packages/create-s-blog/package.json` | `optionalDependencies` 下三个平台包版本 |
| `packages/create-s-blog/npm/darwin-arm64/package.json` | `version` |
| `packages/create-s-blog/npm/linux-x64-gnu/package.json` | `version` |
| `packages/create-s-blog/npm/win32-x64-msvc/package.json` | `version` |
| `crates/s-blog-scaffold/src/lib.rs` | `@s-blog/core` 和 `@s-blog/engine` 的版本字符串 |

> ⚠️ **重点**：`npm/` 下三个平台包的 `version` 必须与主包 `optionalDependencies` 中声明的版本一致。

### 4. 根项目依赖（2处）

| 文件 | 字段 |
|------|------|
| `package.json` | `dependencies["@s-blog/engine"]` |
| `package-lock.json` | 所有 `@s-blog/engine*` 相关的 `version` 和 `resolved` |

### 5. Schema（按需）

如果 `config.json` 或 `album.config.json` 的结构有变化：
- `packages/core/schemas/config.schema.json`
- `packages/core/schemas/album.config.schema.json`

## CI 发布顺序

```
1. git tag engine-v{VERSION}  →  触发 build-engine.yml
   ├─ 构建三平台 native .node 文件
   ├─ 发布 @s-blog/engine-darwin-arm64
   ├─ 发布 @s-blog/engine-linux-x64-gnu
   ├─ 发布 @s-blog/engine-win32-x64-msvc
   └─ 发布 @s-blog/engine (主包)

2. 手动触发 publish-core.yml 或按其触发条件
   └─ 发布 @s-blog/core

3. git tag create-v{VERSION}  →  触发 build-create-s-blog.yml
   ├─ 构建三平台 native .node 文件
   ├─ 发布 create-s-blog-darwin-arm64
   ├─ 发布 create-s-blog-linux-x64-gnu
   ├─ 发布 create-s-blog-win32-x64-msvc
   └─ 发布 create-s-blog (主包)

4. push master  →  触发 deploy.yml
   └─ npm ci → build → deploy to Cloudflare Pages
```

> **关键**：deploy.yml 用 `npm ci`，要求 `package-lock.json` 与 `package.json` 完全同步。engine 必须已发布到 npm，否则 `npm ci` 会失败。

## 快速操作命令

```bash
# 1. 确认所有版本改完后验证
grep -r "0\.3\." --include="*.json" --include="*.ts" --include="*.rs" | grep s-blog

# 2. 发布 engine
git tag engine-v0.3.15
git push origin engine-v0.3.15
# 等待 CI 完成

# 3. 发布 core
# (按 publish-core.yml 的触发条件)

# 4. 发布 create-s-blog
git tag create-v0.4.0
git push origin create-v0.4.0
# 等待 CI 完成

# 5. 部署博客
git push origin master
```

## 常见踩坑

1. **平台包版本未同步** — `npm/*/package.json` 的 `version` 必须改，CI 发布时读的就是这个值（engine 和 create-s-blog 各有一组）
2. **lock 文件未更新** — `npm ci` 严格校验 lock 与 package.json 的一致性
3. **engine 子目录有独立 lock** — `crates/s-blog-engine-napi/package-lock.json` 也需要更新
4. **scaffold 硬编码版本** — `crates/s-blog-scaffold/src/lib.rs` 中 `generate_package_json` 里的 `@s-blog/core` 和 `@s-blog/engine` 版本字符串需要跟着改
5. **发布顺序错误** — 平台包必须先于主包可用，deploy 必须在 engine 发布成功之后
6. **create-s-blog 正式发布需要 optionalDependencies** — beta 测试时可以直接带 `*.node`，正式发布需要恢复 optionalDependencies 并去掉 `files` 中的 `*.node`
