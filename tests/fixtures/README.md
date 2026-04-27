# Test Fixtures

Fixed test data for verifying TS scripts and (later) Rust engine output.

## Structure

```
fixtures/
├── config.json              # Site config (basePath: "/")
├── album.config.json        # Album config (3 albums)
├── posts/                   # Markdown test files
│   ├── simple.md                  # Minimal frontmatter (title + date only)
│   ├── with-tags.md               # Tags and categories as YAML arrays
│   ├── with-timezone.md           # Date with explicit timezone offset (+09:00)
│   ├── invalid-date.md            # Invalid date format (error handling)
│   ├── space-separated-tags.md    # Tags as space-separated string
│   ├── comma-separated-tags.md    # Tags as comma-separated string
│   ├── with-preview.md            # Explicit preview field
│   ├── with-description.md        # Explicit description field (priority test)
│   ├── with-excerpt.md            # Explicit excerpt field (priority test)
│   └── no-frontmatter.md          # No frontmatter at all (edge case)
└── albums/
    ├── test-album/                # Minimal valid JPEG files (no EXIF)
    │   ├── photo1.jpg
    │   └── photo2.jpg
    ├── sakura-exif/               # Real photos with EXIF data
    │   ├── DSC_1464.JPG
    │   ├── DSC_1666.jpg
    │   └── DSC_1754.jpg
    └── empty-album/               # Empty directory (edge case)

fixtures-basepath/
└── config.json              # Same as fixtures/config.json but basePath: "/blog"
```

## Summary Priority Coverage

The posts test the full summary fallback chain:
- `with-preview.md` → uses `preview` field
- `with-description.md` → uses `description` field (no preview)
- `with-excerpt.md` → uses `excerpt` field (no preview or description)
- `simple.md` → auto-generates from body content

## ⚠️ Empty Date Handling (Task 14 注意)

`invalid-date.md` 和 `no-frontmatter.md` 在 manifest 中的 `date` 为空字符串 `""`。
这会影响多个下游脚本的行为，Rust 实现时需要特别注意：

- **manifest 排序**: 空日期的 `new Date("")` 为 Invalid Date，`getTime()` 返回 `NaN`，
  在 TS 的 sort 比较中这些条目会沉到数组末尾。Rust 需要复现相同的排序行为。
- **sitemap.xml**: 空日期的文章 `<lastmod>` 回退为当天日期（`new Date().toISOString().split('T')[0]`）。
- **rss.xml**: 空日期的文章 `<pubDate>` 回退为 `new Date().toUTCString()`（当前时间）。
- **SEO HTML**: 空日期的文章 `datePublished` 回退为 `new Date().toISOString()`（带毫秒和 Z 后缀）。

测试中这些动态时间戳通过 `normalizeSitemapTimestamps` / `normalizeRssTimestamps` /
`normalizeSeoTimestamps` 函数统一替换为固定占位符后再比对。

## Config Formats

- `config.json` matches `packages/core/schemas/config.schema.json`
- `album.config.json` matches `packages/core/schemas/album.config.schema.json`

## Regenerating Album Images

Minimal test images (test-album) can be regenerated:

```bash
npx tsx tests/create-album-fixtures.ts
```

The sakura-exif photos are real images copied from `albums/Sakura/`.
