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

If you just want to get the system running, this is all you need.

### 1. Install dependencies

```bash
npm install
```

### 2. Start the development server

```bash
npm run dev
```

Open your browser at the local address shown in the terminal.

### 3. Write a post

Create a Markdown file under: `src/posts/`
Use any Markdown editor you like.
Each post is a simple Markdown file with frontmatter metadata.

### 4. Build for production

```bash
npm run build
```

The output is a fully static site.

### 5. Deploy

Deploy the generated files to any static hosting environment,
or pull the build output on your server and serve it with a standard web server.

---

## What This Blog System Is

This is a **static blog system** built with:

- React
- Vite
- TypeScript
- Markdown-based content

The system is designed around a simple idea:

> All content is processed at build time and served as static files.

There is no backend service, no database, and no runtime content processing.  
Once the site is built, it can be hosted anywhere that can serve static files.

---

## How Content Works

### Markdown as Source Files

All posts are written as Markdown files under:
src/posts/

These files use frontmatter metadata (title, date, tags, categories, summary) and are treated as **source material**, not runtime content.

### Build-Time Data Generation

During the build process:

- Markdown files are parsed
- A posts manifest (`manifest.json`) is generated
- SEO-related files are created when configured:
  - `sitemap.xml`
  - `rss.xml`
  - `robots.txt`
  - Pre-rendered SEO HTML for posts

At runtime, the site does **not** read Markdown files.  
It only consumes the generated static data.

### What Gets Deployed

Only static assets are deployed:

- HTML
- CSS
- JavaScript
- Generated metadata and SEO files

No Node.js runtime or server-side logic is required after build.

---

## The Role of This Blog

This site is an **independent deployment** of the blog system.

All articles published here are related to the system itself—its design, usage, and evolution.  
Personal writing and unrelated content live elsewhere and are intentionally kept separate.

---

## Deployment Overview

Because the system is purely static, deployment is intentionally flexible.

### One Practical Deployment Approach

One simple and effective setup looks like this:

- The site is built locally or in CI
- The generated output is managed as a separate Git repository
- A server pulls updates via `git pull`
- A standard web server (such as Nginx) serves the static files
- SPA routing is handled at the web server level

This approach allows updates without rebuilding on the server and keeps runtime dependencies minimal.

### Other Common Options

Depending on preference, the same site can also be deployed using:

- GitHub Actions + static hosting
- Any CDN-backed static hosting service
- Self-hosted static file servers

Since there is no backend, none of these options require platform-specific features.

---

## Why It Is Built This Way

This system favors:

- Predictable builds
- Minimal runtime complexity
- Easy migration between hosting providers
- Long-term maintainability

By keeping all logic at build time, deployment remains simple and resilient.

---

## Who This System Is For

**Good fit for:**

- Personal blogs
- Technical writing
- Documentation-style sites
- Projects that value simplicity and portability

**Not intended for:**

- User-generated content platforms
- Applications requiring runtime data mutation
- Systems that depend on authentication or server-side state

---

## Closing Note

This blog exists not only to publish content, but also to document the system that publishes it.

If you are interested in how static sites can remain simple without sacrificing structure or SEO, this project is one possible answer.
