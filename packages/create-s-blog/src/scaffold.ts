import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { UserInput } from './prompts.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEMPLATE_DIR = path.resolve(__dirname, '../template');

/**
 * Generate a customized package.json object for the user's project.
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
      dev: 'npm run build:albums && npm run build:posts && vite',
      'build:posts': 'npx tsx node_modules/@s-blog/core/scripts/generate-posts-data.ts',
      'build:albums': 'npx tsx node_modules/@s-blog/core/scripts/generate-albums-data.ts',
      'build:seo': 'npx tsx node_modules/@s-blog/core/scripts/generate-seo.ts && npx tsx node_modules/@s-blog/core/scripts/generate-sitemap.ts && npx tsx node_modules/@s-blog/core/scripts/generate-rss.ts && npx tsx node_modules/@s-blog/core/scripts/generate-robots.ts',
      build: 'npm run build:albums && npm run build:posts && tsc && vite build && npm run build:seo',
      preview: 'vite preview',
    },
    dependencies: {
      '@s-blog/core': '^0.1.0',
      'react': '^19.2.1',
      'react-dom': '^19.2.1',
    },
    devDependencies: {
      '@types/react': '^19.2.7',
      '@types/react-dom': '^19.2.3',
      '@vitejs/plugin-react': '^5.1.1',
      'autoprefixer': '^10.4.23',
      'postcss': '^8.5.6',
      'tailwindcss': '^3.4.17',
      'tsx': '^4.21.0',
      'typescript': '~5.9.3',
      'vite': '^7.2.4',
    },
  };
}

/**
 * Inject user-provided values into the config.ts template content.
 * Replaces __TITLE__, __DESCRIPTION__, __AUTHOR__, __SITEURL__ placeholders.
 */
export function injectConfigValues(template: string, input: UserInput): string {
  let result = template
    .replace('__TITLE__', input.name)
    .replace('__DESCRIPTION__', input.description)
    .replace('__AUTHOR__', input.author);

  // If siteUrl is empty, remove the entire siteUrl line to avoid SEO scripts picking up an empty string
  if (input.siteUrl) {
    result = result.replace('__SITEURL__', input.siteUrl);
  } else {
    result = result.replace(/\s*siteUrl:.*__SITEURL__.*,?\n/, '\n');
  }

  return result;
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

    // Inject user config values into src/config.ts
    const configPath = path.join(targetDir, 'src', 'config.ts');
    if (fs.existsSync(configPath)) {
      const configTemplate = fs.readFileSync(configPath, 'utf-8');
      const configContent = injectConfigValues(configTemplate, input);
      fs.writeFileSync(configPath, configContent);
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
