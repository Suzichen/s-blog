import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { UserInput } from './prompts.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEMPLATE_DIR = path.resolve(__dirname, '../template');

/**
 * Generate a customized package.json object for the user's project.
 * 
 * Uses @s-blog/engine CLI for build and serve — no TS scripts needed.
 */
export function generatePackageJson(input: UserInput): Record<string, unknown> {
  return {
    name: input.name,
    private: true,
    version: '0.0.0',
    type: 'module',
    description: input.description,
    author: input.author,
    scripts: {
      dev: 's-blog serve',
      build: 's-blog build',
    },
    dependencies: {
      '@s-blog/core': '^0.3.8',
      '@s-blog/engine': '^0.3.14',
    },
  };
}

/**
 * Generate config.json as JSONC with inline comments.
 * Template file is no longer used — output is built directly from user input.
 */
export function injectConfigValues(_template: string, input: UserInput): string {
  const lines: string[] = [];
  lines.push('{');
  lines.push('  "$schema": "./node_modules/@s-blog/core/schemas/config.schema.json",');
  lines.push('  // Site title displayed in header and browser tab');
  lines.push(`  "title": ${JSON.stringify(input.name)},`);
  lines.push('  // Site description for SEO meta tags');
  lines.push(`  "description": ${JSON.stringify(input.description)},`);
  lines.push('  "logo": "/logo.png",');
  lines.push('  "favicon": "/favicon.ico",');

  if (input.siteUrl) {
    lines.push('  // Production URL — required for sitemap, RSS, Open Graph');
    lines.push(`  "siteUrl": ${JSON.stringify(input.siteUrl)},`);
  } else {
    lines.push('  // Production URL — required for sitemap, RSS, Open Graph');
    lines.push('  // "siteUrl": "https://example.com",');
  }

  if (input.author) {
    lines.push(`  "author": ${JSON.stringify(input.author)},`);
  } else {
    lines.push('  // "author": "Your Name",');
  }

  lines.push('  // Default language: "en", "zh-CN", or "ja"');
  lines.push('  "language": "en",');

  if (input.timezone) {
    lines.push('  // IANA timezone — ensures correct post dates on CI builds');
    lines.push(`  "timezone": ${JSON.stringify(input.timezone)},`);
  } else {
    lines.push('  // IANA timezone — ensures correct post dates on CI builds');
    lines.push('  // "timezone": "Asia/Tokyo",');
  }

  lines.push('  // Sub-directory deployment path (e.g., "/blog"). Defaults to "/"');
  lines.push('  // "basePath": "/blog",');
  lines.push('  "links": {');
  lines.push('    "enabled": true,');
  lines.push('    "items": {');
  lines.push('      "S-Blog": "https://s-blog.me"');
  lines.push('    }');
  lines.push('  },');
  lines.push('  // Built-in platforms: github, rss, x, twitter, weibo, zhihu, bilibili, email, facebook, instagram, tiktok');
  lines.push('  "socialLinks": {');
  lines.push('    "enabled": true,');
  lines.push('    "items": [');
  lines.push('      { "platform": "rss" },');
  lines.push('      { "platform": "github", "url": "https://github.com/Suzichen/s-blog" }');
  lines.push('    ]');
  lines.push('  }');
  lines.push('}');
  return lines.join('\n');
}

/**
 * Generate album.config.json as JSONC with inline comments.
 * Template file is no longer used — output is built directly.
 */
export function injectAlbumConfigSchema(_template: string): string {
  const lines: string[] = [];
  lines.push('{');
  lines.push('  "$schema": "./node_modules/@s-blog/core/schemas/album.config.schema.json",');
  lines.push('  // Set to false to disable the album feature entirely');
  lines.push('  "enabled": true,');
  lines.push('  "albums": [');
  lines.push('    // "dir": folder name under albums/, "name": display name (optional), "cover": cover photo filename (optional)');
  lines.push('    { "dir": "blog" }');
  lines.push('  ]');
  lines.push('}');
  return lines.join('\n');
}

/**
 * Recursively copy a directory.
 */
function copyDir(src: string, dest: string): void {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    // Rename _gitignore to .gitignore (npm strips .gitignore during publish)
    const destName = entry.name === '_gitignore' ? '.gitignore' : entry.name;
    const destPath = path.join(dest, destName);
    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

/**
 * Copy template files to the target directory and generate customized files.
 * Throws if the target directory already exists.
 */
export async function copyTemplate(targetDir: string, input: UserInput): Promise<void> {
  // Check if target directory already exists
  if (fs.existsSync(targetDir)) {
    throw new Error(`DIRECTORY_EXISTS:${path.basename(targetDir)}`);
  }

  try {
    // Create target directory
    fs.mkdirSync(targetDir, { recursive: true });

    // Copy all template files
    copyDir(TEMPLATE_DIR, targetDir);

    // Generate and write customized package.json
    const packageJson = generatePackageJson(input);
    fs.writeFileSync(
      path.join(targetDir, 'package.json'),
      JSON.stringify(packageJson, null, 2) + '\n',
    );

    // Inject user config values into config.json
    const configPath = path.join(targetDir, 'config.json');
    if (fs.existsSync(configPath)) {
      const configTemplate = fs.readFileSync(configPath, 'utf-8');
      const configContent = injectConfigValues(configTemplate, input);
      fs.writeFileSync(configPath, configContent + '\n');
    }

    // Inject schema URL into album.config.json
    const albumConfigPath = path.join(targetDir, 'album.config.json');
    if (fs.existsSync(albumConfigPath)) {
      const albumConfigTemplate = fs.readFileSync(albumConfigPath, 'utf-8');
      const albumConfigContent = injectAlbumConfigSchema(albumConfigTemplate);
      fs.writeFileSync(albumConfigPath, albumConfigContent + '\n');
    }

    // Remove the empty src directory if it exists (no longer needed)
    const srcDir = path.join(targetDir, 'src');
    if (fs.existsSync(srcDir)) {
      fs.rmSync(srcDir, { recursive: true, force: true });
    }
  } catch (err) {
    // Clean up on failure (unless it was a directory exists error)
    if (err instanceof Error && err.message.startsWith('DIRECTORY_EXISTS:')) {
      throw err;
    }
    // Attempt cleanup
    cleanup(targetDir);
    throw new Error('COPY_FAILED');
  }
}

/**
 * Remove the target directory and all its contents.
 */
export function cleanup(targetDir: string): void {
  try {
    if (fs.existsSync(targetDir)) {
      fs.rmSync(targetDir, { recursive: true, force: true });
    }
  } catch {
    // Best-effort cleanup, ignore errors
  }
}
