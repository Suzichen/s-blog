---
title: About This Blog
date: 2025-01-01 11:00:00
tags: [blog-system, about]
categories: [General]
preview: About this blog and the S-blog system that powers it.
---

## About

This blog is powered by [S-blog](https://github.com/Suzichen/s-blog), a static blog system built with React, Vite, and TypeScript.

### Features

- 📝 Markdown-based content
- 🌍 Multi-language support (English, Chinese, Japanese)
- 📸 Photo album module
- 🔍 Full-text search
- 📱 Responsive design
- 🚀 Static site generation for fast loading

### How It Works

All content is processed at build time and served as static files. There is no backend service, no database, and no runtime content processing. Once built, the site can be hosted anywhere that serves static files.

### Customization

- Edit `config.json` to change site settings
- Edit `album.config.json` to configure photo albums
- Add posts as Markdown files in `posts/`
- Add album photos in `public/albums/`
