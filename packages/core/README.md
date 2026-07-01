> **IMPORTANT MIGRATION NOTICE**
> 
> This is the final release under the `@s-blog/core` name. The package has been officially migrated and renamed to **@s-page/core**. 
> Future updates will be published under the new `@s-page` npm organization. 
> 
> Please update your dependencies: [`@s-page/core`](https://www.npmjs.com/package/@s-page/core)

# @spage/core

The pre-built App Shell and UI framework for [spage](https://spage.me).

## What This Package Provides

- **Pre-built App Shell** — Production-ready `index.html` + hashed JS/CSS assets (React SPA)
- **UI Components** — Post list, post detail with Markdown rendering, photo albums, memo timeline (Ech0 integration), search overlay, language switcher, etc.
- **Routing** — Pre-configured React Router with code-splitting (lazy-loaded routes)
- **i18n** — Built-in internationalization (English, Chinese, Japanese)
- **JSON Schemas** — Validation schemas for `config.json` and `album.config.json`
- **Type Definitions** — TypeScript types for blog metadata, album data, and site config

## How It Works

`@spage/core` is the **frontend** half of spage. It pairs with `@spage/engine` (the **build engine**) to form the complete system:

1. `@spage/engine` builds your content (Markdown → manifest, photos → thumbnails, SEO pages)
2. `@spage/core` provides the App Shell that loads and renders that content at runtime

Users interact with both through simple npm scripts:

```bash
npm run dev    # Start dev server (powered by @spage/engine)
npm run build  # Full production build (engine copies shell from core, then processes content)
```

## Installation

> **Recommended:** Use `npm create spage@latest` to scaffold a new project. It sets up both `@spage/core` and `@spage/engine` automatically.

For manual setup or upgrading:

```bash
npm install @spage/core @spage/engine
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

All framework code is inside `node_modules/@spage/core` and `node_modules/@spage/engine`.

## Updating

```bash
npm update @spage/core @spage/engine
```

## License

MIT © Suzichen
