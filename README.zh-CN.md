[English](./README.md) | [日本語](./README.ja-JP.md)

# S-Blog

> **声明**: 本系统中的所有代码均由 AI 生成。

**演示:**
- [官方站点](https://s-blog.me)
- [作者个人站](https://s-blog.suzichen.me/)

一个基于 React、Vite 和 TypeScript 构建的现代化静态博客系统。由 Rust 构建引擎驱动，具备原生级性能。

## 功能特性

- **技术栈**: React 19, Vite, TypeScript, Rust (构建引擎)
- **内容**: 基于 Markdown 的文章 (兼容 Hexo frontmatter)
- **功能**:
  - 即时搜索
  - 归档 (按年/月)
  - 标签和分类
  - 多语言支持 (中文、英文、日文)
  - 带 EXIF 元数据的相册
  - SEO (sitemap, RSS, Open Graph, JSON-LD)
- **样式**: 基于 Tailwind CSS 的简洁响应式设计
- **性能**: Rust 驱动的构建管线生成纯静态站点

## 快速开始

创建新博客最快捷的方式：

```bash
npm create s-blog@latest
```

> **提示:** 也可以使用 `bunx create-s-blog my-blog` 或 `pnpm create s-blog my-blog`。

CLI 会引导你完成项目设置。初始化后：

```bash
cd my-blog
npm install
npm run dev
```

### 构建生产版本

```bash
npm run build
```

这一条命令处理完整的构建流程：
1. 复制预构建的 App Shell
2. 生成文章清单并复制 Markdown 文件
3. 处理相册照片（缩略图 + EXIF 提取）
4. 生成 SEO 页面、sitemap.xml、rss.xml、robots.txt

输出是位于 `dist/` 下的纯静态站点，可部署到任何静态托管服务。

### 更新框架

```bash
npm update @s-blog/core @s-blog/engine
```

你只需要维护内容文件（`posts/`、`config.json`、`album.config.json`、`albums/`、`public/`）。框架更新通过包管理器分发。

## 架构

S-Blog 以三个 npm 包发布：

| 包名 | 用途 |
|------|------|
| `@s-blog/core` | 预构建 App Shell、UI 组件、路由、样式、JSON Schema |
| `@s-blog/engine` | Rust 驱动的构建引擎 — Markdown 解析、图片处理、SEO 生成、开发服务器 |
| `create-s-blog` | CLI 脚手架工具 — `npm create s-blog` |

你的项目只包含内容和配置：

```
my-blog/
├── posts/              # Markdown 文章
├── albums/             # 相册照片 (可选)
├── public/             # 静态资源 (logo, favicon)
├── config.json         # 站点配置
├── album.config.json   # 相册配置
└── package.json
```

## 配置

### 站点配置 (`config.json`)

```json
{
  "title": "My Blog",
  "description": "A personal blog",
  "logo": "/logo.png",
  "favicon": "/favicon.ico",
  "siteUrl": "https://example.com",
  "author": "Your Name",
  "language": "en",
  "timezone": "Asia/Tokyo",
  "github": "https://github.com/username/repo"
}
```

| 字段 | 必填 | 说明 |
|------|------|------|
| `title` | 是 | 网站标题 |
| `description` | 是 | 网站描述 |
| `logo` | 是 | Logo 图片路径 |
| `favicon` | 是 | Favicon 路径 |
| `siteUrl` | 否 | 生产环境 URL。SEO 功能（sitemap、RSS、Open Graph）必须配置此字段 |
| `author` | 否 | 作者名，用于 SEO 元数据 |
| `language` | 否 | 默认语言代码 (`en`, `zh-CN`, `ja`)。影响 i18n 回退行为 |
| `timezone` | 否 | IANA 时区标识（如 `Asia/Shanghai`）。确保在 CI 环境构建时文章日期正确 |
| `basePath` | 否 | 子目录部署路径（如 `/blog`）。默认为 `/` |
| `github` | 否 | GitHub URL。配置后在页面右上角显示 GitHub 图标链接 |

### 相册配置 (`album.config.json`)

```json
{
  "enabled": true,
  "albums": [
    { "dir": "travel-2024", "name": "2024 Travel", "cover": "cover.jpg" },
    { "dir": "日常", "cover": "best.jpg" }
  ]
}
```

| 字段 | 必填 | 说明 |
|------|------|------|
| `enabled` | 是 | 开启/关闭整个相册模块 |
| `albums[].dir` | 是 | `albums/` 下的目录名。支持字母、数字、连字符、下划线、CJK 字符 |
| `albums[].name` | 否 | 显示名称。默认使用 `dir` |
| `albums[].cover` | 否 | 封面照片文件名。默认使用第一张照片 |

## 撰写文章

在 `posts/` 目录下添加 Markdown 文件：

```yaml
---
title: 我的文章标题
date: 2024-01-01 12:00:00
tags: [技术, React]
categories: [编程]
preview: 文章摘要，用于预览列表。
---
```

### 多语言文章

使用文件名后缀发布同一篇文章的多个语言版本：

```
posts/
├── About.md          # 默认版本（匹配站点语言或英文）
├── About.zh-CN.md    # 中文版本
└── About.ja.md       # 日文版本
```

系统自动检测可用语言版本，当本地化版本不可用时显示回退提示。

## 相册

将照片放在 `albums/{dirname}/` 下。支持的格式：`.jpg`, `.jpeg`, `.png`, `.webp`

构建过程自动：
- 生成 WebP 缩略图（最大 1080px）
- 提取 EXIF 元数据（相机、镜头、光圈、快门速度、ISO）
- 生成 JSON 索引文件

缩略图增量生成 — 未更改的照片会被跳过。

## SEO

配置 `siteUrl` 后，构建会自动生成：

- **SEO HTML 页面** (`dist/post/*/index.html`) — Open Graph, Twitter Card, JSON-LD
- **sitemap.xml** — XML 站点地图
- **rss.xml** — RSS 2.0 订阅源
- **robots.txt** — 爬虫指令

## 贡献

本项目严格禁止手动编码。所有代码必须由 AI 生成。

## AI 贡献者

- Gemini 3 Pro
- Gemini 3.1 Pro
- Claude Sonnet 4.5
- Claude Opus 4.5
- Claude Opus 4.6

## Agentic 工具

- [Antigravity](https://antigravity.google/)
- [Kiro](https://kiro.dev/)
- [Gemini CLI](https://geminicli.com/)
- [Gemini CLI in Zed](https://zed.dev/acp/agent/gemini-cli)
- [Kiro CLI](https://kiro.dev/cli)
