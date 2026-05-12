# @s-blog/engine

Rust-powered data engine for [s-blog](https://github.com/Suzichen/s-blog) — handles Markdown parsing, image processing, SEO/feed generation with native performance.

## Install

```bash
npm install @s-blog/engine
```

The correct native binary for your platform will be installed automatically.

### Supported Platforms

| OS      | Arch  | Package                          |
|---------|-------|----------------------------------|
| Windows | x64   | `@s-blog/engine-win32-x64-msvc`  |
| macOS   | ARM64 | `@s-blog/engine-darwin-arm64`    |
| Linux   | x64   | `@s-blog/engine-linux-x64-gnu`   |

> macOS Intel users: the ARM64 binary runs seamlessly via Rosetta 2.

## API

```js
const {
  generatePostsData,
  generateAlbumsData,
  generateSeoPages,
  generateSitemap,
  generateRss,
  generateRobots,
} = require('@s-blog/engine')
```

### `generatePostsData(postsDir, outputDir, configJson) → string`

Scans `postsDir` for Markdown files, parses frontmatter, generates `manifest.json`, and copies `.md` files to `outputDir/posts/`. Returns the manifest as a JSON string.

### `generateAlbumsData(albumsDir, outputDir, albumConfigJson, siteConfigJson) → string`

Generates album index and per-album detail JSON files, including WebP thumbnail generation and EXIF extraction. Returns the albums-index JSON string.

### `generateSeoPages(manifestJson, templatePath, outputDir, configJson) → number`

Generates an SEO-optimized HTML page for each post (Open Graph, Twitter Card, JSON-LD). Returns the number of pages generated.

### `generateSitemap(manifestJson, outputPath, configJson) → void`

Generates `sitemap.xml` conforming to the Sitemaps protocol.

### `generateRss(manifestJson, outputPath, configJson) → void`

Generates `rss.xml` conforming to RSS 2.0.

### `generateRobots(outputPath, configJson) → void`

Generates `robots.txt` with sitemap reference.

## Config Format

All `configJson` parameters accept a JSON string matching `config.json`:

```json
{
  "title": "My Blog",
  "description": "A personal blog",
  "logo": "/logo.png",
  "favicon": "/favicon.ico",
  "siteUrl": "https://example.com",
  "author": "Author",
  "language": "en",
  "timezone": "Asia/Tokyo",
  "basePath": "/"
}
```

## License

MIT
