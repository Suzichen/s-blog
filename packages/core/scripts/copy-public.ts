/**
 * copy-public.ts
 * 
 * Copies assets to dist/ for deployment:
 * - public/generated/ (manifest.json, albums data)
 * - albums/ (original album images) and public/albums/ (thumbnails)
 * - posts/ (markdown files)
 * - Other static assets (favicon, logo, etc.)
 * 
 * Requirements: 1.5.2, 1.5.3, 1.5.4
 * - Copy public/generated/ and public/albums/ to dist/
 * - Copy albums/ and posts/ to dist/
 * - Copy other static resources
 * - Handle directory creation and file overwrite
 * - Cross-platform compatible (Windows/Mac/Linux)
 */

import fs from 'fs';
import path from 'path';

// Resolve paths
const CWD = process.cwd();
const PUBLIC_DIR = path.join(CWD, 'public');
const DIST_DIR = path.join(CWD, 'dist');

// Directories to copy from public/
// 'albums' here copies public/albums/ (which contains generated thumbnails)
const COPY_DIRS = ['generated', 'albums'];

// Files/patterns to exclude (e.g., .DS_Store, Thumbs.db)
const EXCLUDE_PATTERNS = [
  /^\.DS_Store$/,
  /^Thumbs\.db$/,
  /^\.gitkeep$/,
  /^\.git$/,
];

/**
 * Check if a filename should be excluded
 */
function shouldExclude(filename: string): boolean {
  return EXCLUDE_PATTERNS.some(pattern => pattern.test(filename));
}

/**
 * Recursively copy a directory
 * Cross-platform compatible using Node.js fs module
 */
function copyDir(src: string, dest: string): number {
  let copiedCount = 0;

  // Create destination directory if it doesn't exist
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }

  const entries = fs.readdirSync(src, { withFileTypes: true });

  for (const entry of entries) {
    // Skip excluded files
    if (shouldExclude(entry.name)) {
      continue;
    }

    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      copiedCount += copyDir(srcPath, destPath);
    } else {
      // Copy file, overwriting if exists
      fs.copyFileSync(srcPath, destPath);
      copiedCount++;
    }
  }

  return copiedCount;
}

/**
 * Copy a single file if it exists
 */
function copyFileIfExists(src: string, dest: string): boolean {
  if (fs.existsSync(src)) {
    const destDir = path.dirname(dest);
    if (!fs.existsSync(destDir)) {
      fs.mkdirSync(destDir, { recursive: true });
    }
    fs.copyFileSync(src, dest);
    return true;
  }
  return false;
}

/**
 * Copy root-level static assets from public/
 * (files that are not in subdirectories)
 */
function copyRootAssets(): number {
  let copiedCount = 0;

  if (!fs.existsSync(PUBLIC_DIR)) {
    return copiedCount;
  }

  const entries = fs.readdirSync(PUBLIC_DIR, { withFileTypes: true });

  for (const entry of entries) {
    // Skip directories (they're handled separately) and excluded files
    if (entry.isDirectory() || shouldExclude(entry.name)) {
      continue;
    }

    const srcPath = path.join(PUBLIC_DIR, entry.name);
    const destPath = path.join(DIST_DIR, entry.name);

    fs.copyFileSync(srcPath, destPath);
    copiedCount++;
  }

  return copiedCount;
}

function main(): void {
  console.log('Copying public assets to dist/...');

  // Ensure dist directory exists
  if (!fs.existsSync(DIST_DIR)) {
    fs.mkdirSync(DIST_DIR, { recursive: true });
  }

  // Check if public directory exists
  if (!fs.existsSync(PUBLIC_DIR)) {
    console.warn(`Warning: public/ directory not found at ${PUBLIC_DIR}`);
    console.warn('Skipping public assets copy.');
    return;
  }

  let totalFiles = 0;

  // Copy specified directories from public
  for (const dir of COPY_DIRS) {
    const srcDir = path.join(PUBLIC_DIR, dir);
    const destDir = path.join(DIST_DIR, dir);

    if (fs.existsSync(srcDir)) {
      const count = copyDir(srcDir, destDir);
      console.log(`  Copied ${count} files from public/${dir}/`);
      totalFiles += count;
    } else {
      console.log(`  Skipping public/${dir}/ (not found)`);
    }
  }

  // Copy root directories (albums original photos and posts markdown)
  // Note: root 'albums' will merge into dist/albums alongside the thumbnails copied above
  const ROOT_DIRS = ['albums', 'posts'];
  for (const dir of ROOT_DIRS) {
    const srcDir = path.join(CWD, dir);
    const destDir = path.join(DIST_DIR, dir);
    if (fs.existsSync(srcDir)) {
      const count = copyDir(srcDir, destDir);
      console.log(`  Copied ${count} files from root ${dir}/`);
      totalFiles += count;
    }
  }

  // Copy root-level static assets (favicon.ico, logo.png, etc.)
  const rootAssetCount = copyRootAssets();
  if (rootAssetCount > 0) {
    console.log(`  Copied ${rootAssetCount} root-level assets`);
    totalFiles += rootAssetCount;
  }

  // Also copy config files to dist/ if they exist at project root
  const configFiles = ['config.json', 'album.config.json'];
  for (const configFile of configFiles) {
    const srcPath = path.join(CWD, configFile);
    const destPath = path.join(DIST_DIR, configFile);
    if (copyFileIfExists(srcPath, destPath)) {
      console.log(`  Copied ${configFile}`);
      totalFiles++;
    }
  }

  console.log(`Total: ${totalFiles} files copied to dist/`);
  console.log('Public assets copy complete.');
}

main();
