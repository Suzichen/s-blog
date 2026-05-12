---
title: 关于本博客系统
date: 2025-12-19 12:00:00
tags: [blog-system, static-site, react]
categories: [Project]
preview: 介绍本网站背后的博客系统，包括它的工作原理以及如何进行部署。
---

## 关于本页

本页面主要用于说明此 **博客系统本身**。

它解释了本站是如何构建的、内容是如何处理的，以及如何部署和维护该系统。

如果你正在真实的网站上阅读此页面，说明你已经看到了该系统在实际应用中的实例。

---

## 快速开始

使用一条命令即可创建一个新博客：

```bash
# 使用 bun
bunx create-s-blog@latest my-blog
# 或者使用 npx
npx create-s-blog@latest my-blog
```

CLI 会引导你完成一些设置（项目名称、作者、用于 SEO 的网站 URL 等），并自动配置好一切。

然后：

```bash
cd my-blog
# 使用 bun
bun run dev
# 或者使用 npm
npm run dev
```

就是这样。你的博客已经跑起来了。

---

## 撰写文章

在 `posts/` 目录下创建一个 Markdown 文件：

```markdown
---
title: 我的第一篇文章
date: 2025-01-01
# 你可以像这样单独声明此文章发表时所在的时区
# date: 2025-01-01 18:00:00+00:00
tags: [hello, blog]
categories: [General]
---

在这里写下你的内容...
```

构建系统即可自动解析此文章。

---

## 构建与部署

```bash
npm run build
# 也可以使用 bun
```

这一条命令将处理完整的构建流程：

1. **相册处理** — 生成缩略图和元数据
2. **文章处理** — 生成文章清单
3. **SEO 生成** — 为每篇文章生成对应的搜索引擎优化

输出结果是一个位于 `dist/` 目录下的纯静态网站。你可以将它部署在任何地方：

- 任何 CDN 或静态托管平台（Vercel、Netlify、Cloudflare Pages 等）
- 通过 CI/CD 部署到 GitHub Pages
- 使用 Nginx 或任何静态文件服务器进行私有化部署

构建完成后，不需要任何 Node.js 运行时或后端支持。

---

## 功能特性

### 📝 Markdown 博客
- Frontmatter 元数据支持（标题、日期、标签、分类）
- 基于 PrismJS 的语法高亮
- 自动生成章节目录
- 上一篇/下一篇导航

### 📸 相册功能
- 将照片直接放入 `albums/` 对应的目录中即可
- 自动生成缩略图
- 提取并解析照片元数据
- 全屏照片查看器
- 可通过 `album.config.json` 进行配置别名、封面等

### 🔍 SEO 优化
- 每篇文章生成独立的 HTML 页面，并包含 Open Graph 和 Twitter Card 元标签
- 结构化数据 (JSON-LD)
- 自动生成 `sitemap.xml`, `rss.xml`, 和 `robots.txt`
- 在 `config.json`　中配置　`siteUrl` 即可启用所有 SEO 功能
- LLM优化（计划中）


### 🌐 多语言 (i18n)
- 内置语言切换功能（中文、英文、日文）
- 支持同一篇文章发表不同语言版本

### ⚡ 性能优化
- 基于 React.lazy 的路由级代码分割，按需加载资源
- 纯静态网站——没有运行时服务器开销
- 使用 Vite 进行优化的资源打包

---

## 架构

S-blog 作为三个 npm 包发布：

| 包名 | 用途 |
|---------|---------|
| `@s-blog/core` | 博客框架核心 —— 包含 UI 组件、路由、Hooks 以及构建脚本 |
| `create-s-blog` | CLI 脚手架 —— 提供 `npm create s-blog` 命令 |
| `@s-blog/engine` | 基于 `rust` 实现的解析和构建引擎，未来版本将代替 `@s-blog/core` 内置脚本 |

你的项目只需要包含内容和配置（可使用CLI生成）即可：

```
my-blog/
├── albums/         # Photo album directories
├── posts/          # Your Markdown posts
├── config.json     # Site configuration
├── album.config.json # Album configuration
├── public/         # Static assets (logo, favicon, etc.)
├── index.html
└── package.json
```

所有框架代码都位于 `@s-blog/core`. 如果需要更新系统版本：

```bash
npm update @s-blog/core
```

---

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
  "timezone": "Asia/Tokyo"
}
```

### 相册配置 (`album.config.json`)

```json
{
  "enabled": true,
  "albums": [
    { "dir": "travel", "name": "旅游照片" },
    { "dir": "food", "name": "美食图集", "cover": "best-dish.jpg" }
  ]
}
```

---

## 适用人群

**非常适合:**

- 个人博客
- 技术写作
- 文档类网站
- 摄影作品集
- 重视极简性和可移植性的项目

**不适用于:**

- 多人发帖、互动的社区平台
- 需要频繁在页面上增删改查数据的动态应用
- 需要用户注册登录，或者依赖后端数据库的系统

---

## 结语

本网站既是为了发布内容，也是为了展示这套系统本身的运作效果。

静态单页应用（SPA）如何做到既极简，又不牺牲结构与 SEO？如果你对这个问题感兴趣，本项目提供了一种可能的思路。
