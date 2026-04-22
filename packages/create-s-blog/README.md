# create-s-blog

The official scaffolding CLI tool for creating an **s-blog** project.

## Usage

You can create a new blog project instantly using `create-s-blog` via `npx` (which comes with npm), `yarn`, `pnpm`, or `bun`. There is no need to manually install this package globally.

```bash
# Using bun
bunx create-s-blog my-blog

# Using npx
npx create-s-blog@latest my-blog

# Using yarn
yarn create s-blog my-blog

# Using pnpm
pnpm create s-blog my-blog
```

If you want to initialize the project in your current directory, you can use `.` as the target directory:

```bash
npx create-s-blog@latest .
```

### Next Steps

After the scaffolding is complete, install the dependencies and start the development server:

```bash
cd my-blog
# If you used bun
bun install
bun run dev

# Or with npm
npm install
npm run dev
```

## Features

- **Instant Setup:** Generates a ready-to-use directory structure for your blog.
- **Pre-configured:** Comes with Markdown post support, Vite configuration, and built-in package scripts.
- **Customizable:** Generates standard templates and configuration files that are easily adjustable to fit your needs.

## License

MIT © Suzichen
