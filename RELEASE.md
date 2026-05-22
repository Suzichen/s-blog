# S-Blog 发版指南

## 包依赖关系

```
create-s-blog (CLI脚手架)
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

### 3. Create-s-blog（2处）

| 文件 | 字段 |
|------|------|
| `packages/create-s-blog/package.json` | `version` |
| `packages/create-s-blog/src/scaffold.ts` | `'@s-blog/core'` 和 `'@s-blog/engine'` 的版本字符串 |

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

3. 手动发布 create-s-blog
   └─ cd packages/create-s-blog && npm publish

4. push master  →  触发 deploy.yml
   └─ npm ci → build → deploy to Cloudflare Pages
```

> **关键**：deploy.yml 用 `npm ci`，要求 `package-lock.json` 与 `package.json` 完全同步。engine 必须已发布到 npm，否则 `npm ci` 会失败。

## 快速操作命令

```bash
# 1. 确认所有版本改完后验证
grep -r "0\.3\." --include="*.json" --include="*.ts" | grep s-blog

# 2. 发布 engine
git tag engine-v0.3.10
git push origin engine-v0.3.10
# 等待 CI 完成

# 3. 发布 core
# (按 publish-core.yml 的触发条件)

# 4. 发布 create-s-blog
cd packages/create-s-blog
npm publish
cd ../..

# 5. 部署博客
git push origin master
```

## 常见踩坑

1. **平台包版本未同步** — `npm/*/package.json` 的 `version` 必须改，CI 发布时读的就是这个值
2. **lock 文件未更新** — `npm ci` 严格校验 lock 与 package.json 的一致性
3. **engine 子目录有独立 lock** — `crates/s-blog-engine-napi/package-lock.json` 也需要更新
4. **scaffold.ts 硬编码版本** — CLI 生成新项目时写入的依赖版本，需要跟着改
5. **发布顺序错误** — 平台包必须先于主包可用，deploy 必须在 engine 发布成功之后
