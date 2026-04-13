# @s-blog/core

The core engine and React components for **s-blog**, a lightweight, fast, and elegant static blog framework.

## Usage

> **Note:** The easiest and recommended way to get started with `s-blog` is by using the official scaffolding tool: `npx create-s-blog my-blog`.

If you are setting up manually or need to update the core engine in an existing project, you can install it via your package manager:

```bash
npm install @s-blog/core
# or
yarn add @s-blog/core
# or
pnpm add @s-blog/core
```

### Basic Integration

This package exposes the main application layout, React components, and styles needed to run your blog. You typically mount the app in your entry point (e.g., `src/main.tsx`):

```tsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import { SBlogApp } from '@s-blog/core'
import '@s-blog/core/style.css'
import { siteConfig } from './config'
import { albumConfig } from './album.config'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <SBlogApp siteConfig={siteConfig} albumConfig={albumConfig} />
  </React.StrictMode>,
)
```

## Features

- **Built-in Components:** Pre-designed layouts, post lists, markdown rendering, photo viewers, and more.
- **Routing & State:** Pre-configured React Router integration for seamless SPA navigation.
- **i18n Support:** Built-in internationalization.
- **Responsive Design:** Mobile-friendly UI right out of the box.

## License

MIT © Suzichen
