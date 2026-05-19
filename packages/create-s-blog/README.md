# create-s-blog

The official scaffolding CLI for creating an [S-Blog](https://s-blog.me) project.

## Usage

```bash
# npm
npm create s-blog@latest my-blog

# bun
bunx create-s-blog my-blog

# pnpm
pnpm create s-blog my-blog

# yarn
yarn create s-blog my-blog
```

To initialize in the current directory:

```bash
npm create s-blog@latest .
```

The CLI prompts for project name, description, author, site URL, and timezone — then generates everything you need.

## What Gets Generated

```
my-blog/
├── posts/
│   ├── hello-world.md    # Sample welcome post
│   └── about.md          # Sample about page
├── albums/
│   └── blog/             # Sample album directory
├── public/
│   ├── logo.png
│   ├── logomax.png
│   ├── favicon.ico
│   └── _redirects
├── config.json           # Site configuration (with your answers filled in)
├── album.config.json     # Album configuration
├── package.json          # { "dev": "s-blog serve", "build": "s-blog build" }
└── .gitignore
```

### Generated `package.json`

```json
{
  "name": "my-blog",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "s-blog serve",
    "build": "s-blog build"
  },
  "dependencies": {
    "@s-blog/core": "^0.3.2",
    "@s-blog/engine": "^0.3.7"
  }
}
```

## After Scaffolding

```bash
cd my-blog
npm install
npm run dev      # Start development server (localhost:3000)
npm run build    # Build for production → dist/
```

## Configuration

### `config.json`

| Field | Required | Description |
|-------|----------|-------------|
| `title` | Yes | Site title |
| `description` | Yes | Site description |
| `logo` | Yes | Logo image path |
| `favicon` | Yes | Favicon path |
| `siteUrl` | No | Production URL (enables SEO features) |
| `author` | No | Author name |
| `language` | No | Default language (`en`, `zh-CN`, `ja`) |
| `timezone` | No | IANA timezone for correct post dates |
| `basePath` | No | Sub-directory path (e.g., `/blog`) |
| `github` | No | GitHub URL (shows icon in top-right) |

### `album.config.json`

```json
{
  "enabled": true,
  "albums": [
    { "dir": "blog", "name": "Blog Photos" }
  ]
}
```

## License

MIT © Suzichen
