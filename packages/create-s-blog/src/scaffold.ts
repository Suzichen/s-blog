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
      '@s-blog/core': '^0.3.5',
      '@s-blog/engine': '^0.3.9',
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
