/**
 * copy-shell.ts
 * 
 * Copies the pre-built App Shell from @s-blog/core/dist/shell/* to dist/
 * This script is used by CLI users to set up the App Shell for deployment.
 * 
 * Requirements: 1.5.1, 1.5.3, 1.5.4, 1.5.5
 * - Copy @s-blog/core/dist/shell/* to dist/
 * - Handle directory creation and file overwrite
 * - Cross-platform compatible (Windows/Mac/Linux)
 * - Convert relative paths to absolute paths (with basePath support)
 */

import fs from 'fs';
import path from 'path';

// Resolve paths
const CWD = process.cwd();
const DIST_DIR = path.join(CWD, 'dist');
const CONFIG_FILE = path.join(CWD, 'config.json');

interface SiteConfig {
  basePath?: string;
  [key: string]: unknown;
}

/**
 * Load basePath from config.json
 */
function loadBasePath(): string {
  if (!fs.existsSync(CONFIG_FILE)) {
    // No config file, use root path
    return '';
  }

  try {
    const configContent = fs.readFileSync(CONFIG_FILE, 'utf-8');
    const config: SiteConfig = JSON.parse(configContent);
    
    // Normalize basePath
    let basePath = config.basePath || '/';
    if (basePath === '/') return '';
    
    // Remove trailing slash, ensure leading slash
    basePath = basePath.replace(/\/+$/, '');
    if (!basePath.startsWith('/')) {
      basePath = '/' + basePath;
    }
    
    return basePath;
  } catch {
    // Failed to read/parse config, use root path
    return '';
  }
}

/**
 * Find the shell directory from @s-blog/core package
 * Searches in node_modules and handles various installation scenarios
 */
function findShellDir(): string {
  // Primary location: node_modules/@s-blog/core/dist/shell
  const primaryPath = path.join(CWD, 'node_modules', '@s-blog', 'core', 'dist', 'shell');
  if (fs.existsSync(primaryPath)) {
    return primaryPath;
  }

  // Monorepo scenario: packages/core/dist/shell (relative to workspace root)
  const monoRepoPath = path.join(CWD, '..', '..', 'packages', 'core', 'dist', 'shell');
  if (fs.existsSync(monoRepoPath)) {
    return monoRepoPath;
  }

  // Alternative: Check if we're in the core package itself (for development)
  const localPath = path.join(CWD, 'dist', 'shell');
  if (fs.existsSync(localPath)) {
    return localPath;
  }

  console.error('Error: Could not find @s-blog/core/dist/shell directory.');
  console.error('Searched locations:');
  console.error(`  - ${primaryPath}`);
  console.error(`  - ${monoRepoPath}`);
  console.error(`  - ${localPath}`);
  console.error('');
  console.error('Please ensure @s-blog/core is installed and built:');
  console.error('  npm install @s-blog/core');
  console.error('  # or if in monorepo: npm run build:shell');
  process.exit(1);
}

/**
 * Recursively copy a directory
 * Cross-platform compatible using Node.js fs module
 */
function copyDir(src: string, dest: string): void {
  // Create destination directory if it doesn't exist
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }

  const entries = fs.readdirSync(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      // Copy file, overwriting if exists
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

/**
 * Count files in a directory recursively
 */
function countFiles(dir: string): number {
  let count = 0;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  
  for (const entry of entries) {
    if (entry.isDirectory()) {
      count += countFiles(path.join(dir, entry.name));
    } else {
      count++;
    }
  }
  
  return count;
}

function main(): void {
  console.log('Copying App Shell to dist/...');

  const shellDir = findShellDir();
  console.log(`Found shell at: ${shellDir}`);

  // Ensure dist directory exists
  if (!fs.existsSync(DIST_DIR)) {
    fs.mkdirSync(DIST_DIR, { recursive: true });
  }

  // Copy all files from shell directory to dist
  copyDir(shellDir, DIST_DIR);

  const fileCount = countFiles(shellDir);
  console.log(`Copied ${fileCount} files from App Shell to dist/`);

  // Fix asset paths in index.html
  // The shell uses relative paths (./assets/) which don't work for SPA routing
  // Convert to absolute paths with basePath support
  const indexHtmlPath = path.join(DIST_DIR, 'index.html');
  if (fs.existsSync(indexHtmlPath)) {
    const basePath = loadBasePath();
    let htmlContent = fs.readFileSync(indexHtmlPath, 'utf-8');
    
    // Convert relative paths to absolute paths with basePath
    htmlContent = htmlContent.replace(/href="\.\/assets\//g, `href="${basePath}/assets/`);
    htmlContent = htmlContent.replace(/src="\.\/assets\//g, `src="${basePath}/assets/`);
    htmlContent = htmlContent.replace(/href="\.\/favicon/g, `href="${basePath}/favicon`);
    htmlContent = htmlContent.replace(/src="\.\/favicon/g, `src="${basePath}/favicon`);
    
    fs.writeFileSync(indexHtmlPath, htmlContent, 'utf-8');
    
    if (basePath) {
      console.log(`Fixed asset paths with basePath: ${basePath}`);
    } else {
      console.log('Fixed asset paths to use absolute paths');
    }
  }

  console.log('App Shell copy complete.');
}

main();
