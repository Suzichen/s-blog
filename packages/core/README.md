# @s-blog/core

The pre-built App Shell and UI framework for [S-Blog](https://s-blog.me).

## What This Package Provides

- **Pre-built App Shell** — Production-ready `index.html` + hashed JS/CSS assets (React SPA)
- **UI Components** — Post list, post detail with Markdown rendering, photo albums, search overlay, language switcher, etc.
- **Routing** — Pre-configured React Router with code-splitting (lazy-loaded routes)
- **i18n** — Built-in internationalization (English, Chinese, Japanese)
- **JSON Schemas** — Validation schemas for `config.json` and `album.config.json`
- **Type Definitions** — TypeScript types for blog metadata, album data, and site config

## How It Works

`@s-blog/core` is the **frontend** half of S-Blog. It pairs with `@s-blog/engine` (the **build engine**) to form the complete system:

1. `@s-blog/engine` builds your content (Markdown → manifest, photos → thumbnails, SEO pages)
2. `@s-blog/core` provides the App Shell that loads and renders that content at runtime

Users interact with both through simple npm scripts:

```bash
npm run dev    # Start dev server (powered by @s-blog/engine)
npm run build  # Full production build (engine copies shell from core, then processes content)
```

## Installation

> **Recommended:** Use `npm create s-blog@latest` to scaffold a new project. It sets up both `@s-blog/core` and `@s-blog/engine` automatically.

For manual setup or upgrading:

```bash
npm install @s-blog/core @s-blog/engine
```

## Project Structure (User's Project)

After scaffolding, a user's project contains only content:

```
my-blog/
├── posts/              # Markdown posts
├── albums/             # Photo albums (optional)
├── public/             # Static assets (logo, favicon)
├── config.json         # Site configuration
├── album.config.json   # Album configuration
└── package.json        # scripts: { dev, build }
```

All framework code is inside `node_modules/@s-blog/core` and `node_modules/@s-blog/engine`.

## Updating

```bash
npm update @s-blog/core @s-blog/engine
```

## Advanced: Internal Scripts

The build engine (`@s-blog/engine`) handles everything automatically. However, the underlying TypeScript scripts are still available inside this package for advanced use cases or debugging:

```
node_modules/@s-blog/core/scripts/
├── copy-shell.ts           # Copy App Shell to dist/
├── generate-posts-data.ts  # Generate manifest.json + copy .md files
├── generate-albums-data.ts # Process photos, generate thumbnails + JSON
├── generate-seo.ts         # Generate per-post SEO HTML pages
├── generate-sitemap.ts     # Generate sitemap.xml
├── generate-rss.ts         # Generate rss.xml
├── generate-robots.ts      # Generate robots.txt
└── copy-public.ts          # Copy public/ assets to dist/
```

## License

MIT © Suzichen
