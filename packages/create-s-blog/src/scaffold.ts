import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { UserInput } from './prompts.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEMPLATE_DIR = path.resolve(__dirname, '../template');

/**
 * Generate a customized package.json object for the user's project.
 * 
 * New App Shell architecture:
 * - No Vite/React dependencies (App Shell is pre-built)
 * - Only tsx for running data generation scripts
 * - Simplified build process: copy shell + generate data + copy public
 */
export function generatePackageJson(input: UserInput): Record<string, unknown> {
  // Helper to get the script runner command
  const runner = input.packageManager === 'bun' ? 'bun' : 'npx tsx';
  const scriptsPath = 'node_modules/@s-blog/core/scripts';

  return {
    name: input.name,
    private: true,
    version: '0.0.0',
    type: 'module',
    description: input.description,
    author: input.author,
    scripts: {
      // Dev: generate data then serve with a simple HTTP server
      dev: `${input.packageManager} run build && ${input.packageManager} run serve`,
      // Serve the dist folder for local preview
      serve: `${runner} ${scriptsPath}/serve.ts`,
      // Build steps
      'build:shell': `${runner} ${scriptsPath}/copy-shell.ts`,
      'build:posts': `${runner} ${scriptsPath}/generate-posts-data.ts`,
      'build:albums': `${runner} ${scriptsPath}/generate-albums-data.ts`,
      'build:public': `${runner} ${scriptsPath}/copy-public.ts`,
      'build:seo': `${runner} ${scriptsPath}/generate-seo.ts && ${runner} ${scriptsPath}/generate-sitemap.ts && ${runner} ${scriptsPath}/generate-rss.ts && ${runner} ${scriptsPath}/generate-robots.ts`,
      // Full build: shell -> data generation -> copy public -> SEO
      build: `${input.packageManager} run build:shell && ${input.packageManager} run build:posts && ${input.packageManager} run build:albums && ${input.packageManager} run build:public && ${input.packageManager} run build:seo`,
    },
    dependencies: {
      '@s-blog/core': '^0.2.0',
    },
    devDependencies: {
      'tsx': '^4.21.0',
    },
  };
}

/**
 * Inject user-provided values into the config.json template content.
 * Replaces placeholders with actual values and handles optional fields.
 */
export function injectConfigValues(template: string, input: UserInput): string {
  // Parse the JSON template
  const config = JSON.parse(template);

  // Replace the $schema placeholder
  config['$schema'] = 'https://unpkg.com/@s-blog/core/schemas/config.schema.json';
  delete config['__SCHEMA__'];

  // Set required fields
  config.title = input.name;
  config.description = input.description;

  // Handle optional siteUrl
  delete config['__SITEURL__'];
  if (input.siteUrl) {
    config.siteUrl = input.siteUrl;
  }

  // Handle optional author
  delete config['__AUTHOR__'];
  if (input.author) {
    config.author = input.author;
  }

  // Handle optional timezone
  if (input.timezone) {
    config.timezone = input.timezone;
  }

  return JSON.stringify(config, null, 2);
}

/**
 * Inject schema URL into album.config.json template.
 */
export function injectAlbumConfigSchema(template: string): string {
  const config = JSON.parse(template);
  config['$schema'] = 'https://unpkg.com/@s-blog/core/schemas/album.config.schema.json';
  delete config['__SCHEMA__'];
  return JSON.stringify(config, null, 2);
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
