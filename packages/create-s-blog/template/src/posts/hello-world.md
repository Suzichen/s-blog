---
title: Welcome to S-blog
date: 2025-01-01 12:00:00
tags: [blog, getting-started]
categories: [General]
preview: Your first post! This article introduces S-blog and how to get started with writing.
---

## Welcome! 🎉

Congratulations on setting up your new **S-blog** project!

This is your first sample post. You can edit or delete it, and start writing your own content.

---

## Quick Guide

### Writing a Post

Create a new Markdown file in the `src/posts/` directory. Each post needs frontmatter metadata:

```markdown
---
title: My First Post
date: 2025-01-01 12:00:00
tags: [example, hello]
categories: [Blog]
preview: A short summary of your post.
---

Your post content goes here...
```

### Running Development Server

```bash
npm run dev
```

### Building for Production

```bash
npm run build
```

### Updating the Framework

```bash
npm update @s-blog/core
```

---

## What's Next?

- Edit `src/config.ts` to customize your site title, description, and other settings
- Add your own posts to `src/posts/`
- Enable the album feature in `src/album.config.ts` if you want a photo gallery
- Deploy your built site to any static hosting service

Happy blogging! ✍️
