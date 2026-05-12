---
title: About This Blog System
date: 2025-12-19 12:00:00
tags: [blog-system, static-site, react]
categories: [Project]
preview: An introduction to the blog system behind this site, including how it works and how it can be deployed.
---

## What This Page Is

This page documents **the blog system itself**.

It explains how this site is built, how content is handled, and how the system can be deployed and maintained.

If you are reading this page on the live site, you are already looking at a real instance of this system in use.

---

## Quick Start

Create a new blog in one command:

```bash
# Using bun
bunx create-s-blog my-blog
# Or using npx
npx create-s-blog@latest my-blog
```

The CLI will walk you through a few prompts (project name, author, site URL for SEO, etc.) and set up everything automatically.

Then:

```bash
cd my-blog
# Using bun
bun run dev
# Or using npm
npm run dev
```

That's it. Your blog is running.

---

## Writing Posts

Create a Markdown file under `posts/`:

```markdown
---
title: My First Post
date: 2025-01-01
# You can bypass global settings and declare the time zone
# date: 2025-01-01 18:00:00+00:00
tags: [hello, blog]
categories: [General]
---

Your content here...
```

Posts are automatically picked up by the build system — no manual registration needed.

---

## Building & Deploying

```bash
npm run build
```

This single command handles the full pipeline:

1. **Album processing** — generates thumbnails and metadata
2. **Posts processing** — generates the posts manifest and copies files
3. **SEO generation** — creates per-post HTML, sitemap.xml, rss.xml, robots.txt

The output is a fully static site in `dist/`. Deploy it anywhere:

- Any CDN or static hosting (Vercel, Netlify, Cloudflare Pages, etc.)
- GitHub Pages via CI/CD
- Self-hosted with Nginx or any static file server

No Node.js runtime or backend required after build.

---

## Features

### 📝 Markdown Blogging
- Frontmatter metadata (title, date, tags, categories)
- Syntax highlighting with PrismJS
- Table of contents generation
- Previous/next post navigation

### 📸 Photo Albums
- Drop photos into `albums/` directories
- Auto-generated WebP thumbnails
- EXIF metadata extraction
- Full-screen photo viewer
- Configurable via `album.config.json`

### 🔍 SEO Optimization
- Per-post HTML pages with Open Graph and Twitter Card meta tags
- Structured data (JSON-LD)
- Auto-generated `sitemap.xml`, `rss.xml`, and `robots.txt`
- Configure `siteUrl` in `config.json` to enable all SEO features

### 🌐 i18n
- Built-in language switcher (Chinese, English, Japanese)
- Support the publication of different language versions of the same article

### ⚡ Performance
- Route-level code splitting via React.lazy
- Static site — no runtime server overhead
- Optimized asset bundling with Vite

---

## Architecture

S-blog is published as three npm packages:

| Package | Purpose |
|---------|---------|
| `@s-blog/core` | The blog framework — UI components, routing, hooks, build scripts |
| `create-s-blog` | The CLI scaffold — `npm create s-blog` |
| `@s-blog/engine` | A parsing and build engine implemented in `rust`, which will replace the built-in scripts of `@s-blog/core` in future versions. |


Your project only contains your content and configuration:

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

All framework code lives in `@s-blog/core`. To update the framework:

```bash
npm update @s-blog/core
```

---

## Configuration

### Site Config (`config.json`)

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

### Album Config (`album.config.json`)

```json
{
  "enabled": true,
  "albums": [
    { "dir": "travel", "name": "Travel Photos" },
    { "dir": "food", "name": "Food Gallery", "cover": "best-dish.jpg" }
  ]
}
```

---

## Who This System Is For

**Good fit for:**

- Personal blogs
- Technical writing
- Documentation-style sites
- Photo portfolios
- Projects that value simplicity and portability

**Not intended for:**

- User-generated content platforms
- Applications requiring runtime data mutation
- Systems that depend on authentication or server-side state

---

## Closing Note

This blog exists not only to publish content, but also to document the system that publishes it.

If you are interested in how static sites can remain simple without sacrificing structure or SEO, this project is one possible answer.
