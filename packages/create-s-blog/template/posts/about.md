---
title: About This Blog
date: 2025-01-01 11:00:00
tags: [blog-system, about]
categories: [General]
preview: About this blog and the S-Blog system that powers it.
---

## About

This blog is powered by [S-Blog](https://github.com/Suzichen/s-blog), a static blog system built with React, Vite, TypeScript, and a Rust build engine.

### Features

- 📝 Markdown-based content with frontmatter metadata
- 🌍 Multi-language support (English, Chinese, Japanese)
- 📸 Photo album module with auto-generated thumbnails and EXIF data
- 🔍 Full-text search
- 📱 Responsive design
- 🚀 Rust-powered build engine for fast static site generation
- 🔎 SEO — per-post HTML pages, sitemap, RSS, Open Graph

### How It Works

All content is processed at build time by the Rust engine and served as static files. There is no backend service, no database, and no runtime content processing. Once built, the site can be hosted anywhere that serves static files.

### Customization

- Edit `config.json` to change site settings (title, description, language, links, social links, etc.)
- Edit `album.config.json` to configure photo albums
- Add posts as Markdown files in `posts/`
- Add album photos in `albums/`
