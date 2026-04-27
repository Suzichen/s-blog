---
title: "New Feature: Album Module"
date: 2026-04-09 12:00:00
tags: [blog-system, album, photo-gallery]
categories: [Project]
preview: The blog system now includes a built-in album module for organizing and displaying photos — fully static, with auto-generated thumbnails, EXIF metadata, and a full-screen photo viewer.
---

## What's New

The blog system now has a built-in **album module** — a photo gallery feature that lets you organize photos into albums, with auto-generated thumbnails, EXIF metadata extraction, and a full-screen photo viewer.

Like everything else in this system, the album module is **purely static**. All processing happens at build time, and the frontend consumes static JSON and image files. No backend required.

---

## How It Works

The album module consists of three layers:

1. **Configuration** (`album.config.json`) — Define your albums
2. **Build Script** (`npm run build:albums`) — Process photos at build time
3. **Frontend Pages** — Browse albums and view photos

### 1. Configure Albums

Albums are defined in a single config file:

```json
{
  "enabled": true,
  "albums": [
    { "dir": "travel-2024", "name": "2024 Travel", "cover": "cover.jpg" },
    { "dir": "日常写真" }
  ]
}
```

- **`dir`** — Directory name under `albums/`. Supports letters, numbers, hyphens, underscores, and CJK characters. No spaces or path separators.
- **`name`** (optional) — Display name. Defaults to `dir` if not set.
- **`cover`** (optional) — Cover photo filename. Falls back to the first photo.
- **`enabled`** — Toggle the entire module on/off. When disabled, album routes redirect to home and the nav link is hidden.

### 2. Prepare Your Photos

Place original photos in `albums/{dirname}/`:

```
albums/travel-2024/
  photo-01.jpg
  photo-02.jpg
  photo-03.png
```

Supported formats: `.jpg`, `.jpeg`, `.png`, `.webp`, `.heic`

### 3. Build Album Data

```bash
npm run build:albums
```

The build script does the following for each album:

- **Scans** the directory for photo files (direct children only, no recursion)
- **Generates WebP thumbnails** (max 1080px long side, aspect ratio preserved) in a `thumbs/` subdirectory
- **Extracts EXIF metadata** — camera make/model, focal length, aperture, shutter speed, ISO
- **Outputs JSON** index files to `public/generated/`

The process is **incremental** — thumbnails are only regenerated when the source photo has been modified. This makes repeated builds fast.

The `build:albums` step is also included in the main `npm run build` command, so album data is always up to date in production builds.

---

## Photo Directory Structure

After running `build:albums`, the directory structure looks like this:

```
public/
  albums/
    travel-2024/
      photo-01.jpg          ← Original photos (placed by you)
      photo-02.jpg
      thumbs/               ← Thumbnails (auto-generated, gitignored)
        photo-01.webp
        photo-02.webp
    日常写真/
      img-001.jpg
      thumbs/
        img-001.webp
  generated/                ← JSON index files (auto-generated, gitignored)
    albums-index.json
    album-travel-2024.json
    album-日常写真.json
```

Both `thumbs/` directories and `public/generated/` are gitignored since they are build artifacts that can be regenerated at any time.

---

## Frontend Features

### Album List Page (`/albums`)

Displays all albums in a responsive grid with cover thumbnails, album names, and photo counts. Supports i18n — the entire UI adapts to Chinese, English, and Japanese.

### Album Detail Page (`/albums/:dirname`)

Shows all photos in a grid. Click any thumbnail to open the full-screen viewer.

### Photo Viewer

The photo viewer provides an immersive browsing experience:

- **Full-screen overlay** with semi-transparent dark backdrop
- **Progressive loading** — shows the thumbnail as a blurred placeholder while the original loads
- **EXIF data display** — camera info, focal length, aperture, shutter speed, ISO (only non-null fields shown)
- **Keyboard navigation** — `←` previous, `→` next, `Esc` close
- **Click backdrop to close**
- **Scroll lock** — page background doesn't scroll while the viewer is open

---

## Design Decisions

### Why build-time processing?

Consistent with the blog's philosophy: all heavy work at build time, zero runtime dependencies. The frontend just fetches static JSON and images.

### Why WebP thumbnails?

WebP offers significantly smaller file sizes than JPEG at comparable quality, resulting in faster page loads. The long side is capped at 1080px — large enough for previews, small enough for fast loading.

### Why are thumbnails and JSON gitignored?

They are deterministic build outputs. Given the same source photos and config, `build:albums` always produces the same result. Keeping them out of version control keeps the repo clean and avoids large binary diffs.

---

## Summary

The album module adds a fully static photo gallery to the blog system with minimal complexity. No new runtime dependencies, no backend changes, no database — just a build script and a few React components.
