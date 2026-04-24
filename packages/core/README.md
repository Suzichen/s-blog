# @s-blog/core

The core engine and pre-built App Shell for **s-blog**, a lightweight, fast, and elegant static blog framework.

## Usage

> **Note:** The easiest and recommended way to get started with `s-blog` is by using the official scaffolding tool: `bunx create-s-blog my-blog` or `npx create-s-blog my-blog`.

If you are setting up manually or need to update the core engine in an existing project, you can install it via your package manager:

```bash
npm install @s-blog/core
# or
yarn add @s-blog/core
# or
pnpm add @s-blog/core
```

### Architecture

Starting with the App Shell architecture, `@s-blog/core` provides a pre-built React frontend and data generation scripts. Instead of compiling React yourself via Vite, you only need to provide `config.json`, `album.config.json`, and Markdown posts. The core engine will load your configurations at runtime.

### Basic Scripts

You can use the built-in scripts to generate static data and prepare the App Shell for your blog:

```bash
# Copy the pre-built App Shell to your dist folder
npx tsx node_modules/@s-blog/core/scripts/copy-shell.ts

# Generate posts manifest and copy markdown files
npx tsx node_modules/@s-blog/core/scripts/generate-posts-data.ts

# Process photos and generate albums metadata
npx tsx node_modules/@s-blog/core/scripts/generate-albums-data.ts
```

## Features

- **Built-in App Shell:** Pre-designed layouts, post lists, markdown rendering, photo viewers, and more.
- **Runtime Configuration:** JSON-based setup without frontend build tools.
- **Routing & State:** Pre-configured React Router integration for seamless SPA navigation.
- **i18n Support:** Built-in internationalization.
- **Responsive Design:** Mobile-friendly UI right out of the box.

## License

MIT © Suzichen
