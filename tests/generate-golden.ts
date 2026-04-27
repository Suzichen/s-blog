/**
 * Generate golden files by running the existing TS scripts against test fixtures.
 *
 * This script:
 * 1. Creates a temporary working directory (tests/.tmp/)
 * 2. Copies fixtures into the structure expected by the scripts
 * 3. Runs each TS script in sequence with cwd set to the temp dir
 * 4. Copies generated outputs to tests/golden/
 * 5. Repeats with basePath fixtures → tests/golden-basepath/
 * 6. Cleans up the temp directory
 *
 * Run: npx tsx tests/generate-golden.ts
 */
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..');
const FIXTURES_DIR = path.join(__dirname, 'fixtures');
const BASEPATH_FIXTURES_DIR = path.join(__dirname, 'fixtures-basepath');
const TMP_DIR = path.join(__dirname, '.tmp');

const SCRIPTS_DIR = path.join(PROJECT_ROOT, 'packages', 'core', 'scripts');
const SCRIPTS = {
  posts: path.join(SCRIPTS_DIR, 'generate-posts-data.ts'),
  albums: path.join(SCRIPTS_DIR, 'generate-albums-data.ts'),
  seo: path.join(SCRIPTS_DIR, 'generate-seo.ts'),
  sitemap: path.join(SCRIPTS_DIR, 'generate-sitemap.ts'),
  rss: path.join(SCRIPTS_DIR, 'generate-rss.ts'),
  robots: path.join(SCRIPTS_DIR, 'generate-robots.ts'),
};

/** Recursively copy a directory */
function copyDirSync(src: string, dest: string): void {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirSync(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

function rmDirSync(dir: string): void {
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

function runScript(name: string, scriptPath: string): boolean {
  console.log(`  Running ${name}...`);
  try {
    const output = execSync(`npx tsx "${scriptPath}"`, {
      cwd: TMP_DIR,
      stdio: 'pipe',
      env: { ...process.env, NODE_ENV: 'production' },
      timeout: 120_000,
    });
    const text = output.toString().trim();
    if (text) console.log(`    ${text.replace(/\n/g, '\n    ')}`);
    return true;
  } catch (err: any) {
    const stderr = err.stderr?.toString() || '';
    const stdout = err.stdout?.toString() || '';
    console.warn(`  [WARN] ${name} failed:`);
    if (stdout) console.warn('    stdout:', stdout);
    if (stderr) console.warn('    stderr:', stderr);
    return false;
  }
}

function copyToGolden(goldenDir: string, tmpRelPath: string, goldenRelPath?: string): boolean {
  const src = path.join(TMP_DIR, tmpRelPath);
  const dest = path.join(goldenDir, goldenRelPath ?? tmpRelPath);
  if (!fs.existsSync(src)) {
    console.warn(`  [WARN] Expected output not found: ${tmpRelPath}`);
    return false;
  }
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
  return true;
}

function copyDirToGolden(goldenDir: string, tmpRelPath: string, goldenRelPath: string): boolean {
  const src = path.join(TMP_DIR, tmpRelPath);
  if (!fs.existsSync(src)) {
    console.warn(`  [WARN] Expected output dir not found: ${tmpRelPath}`);
    return false;
  }
  copyDirSync(src, path.join(goldenDir, goldenRelPath));
  return true;
}

const SHELL_TEMPLATE = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Test Blog</title>
  <link rel="icon" href="./favicon.ico">
  <link rel="stylesheet" href="./assets/index.css">
</head>
<body>
  <div id="root"></div>
  <script type="module" src="./assets/index.js"></script>
</body>
</html>`;

/**
 * Set up the temp directory with fixtures.
 * @param configDir - directory containing config.json (default or basepath)
 */
function setupTmp(configDir: string): void {
  rmDirSync(TMP_DIR);
  fs.mkdirSync(TMP_DIR, { recursive: true });

  fs.copyFileSync(path.join(configDir, 'config.json'), path.join(TMP_DIR, 'config.json'));
  fs.copyFileSync(path.join(FIXTURES_DIR, 'album.config.json'), path.join(TMP_DIR, 'album.config.json'));
  copyDirSync(path.join(FIXTURES_DIR, 'posts'), path.join(TMP_DIR, 'posts'));
  copyDirSync(path.join(FIXTURES_DIR, 'albums'), path.join(TMP_DIR, 'albums'));

  fs.mkdirSync(path.join(TMP_DIR, 'public', 'generated'), { recursive: true });
  fs.mkdirSync(path.join(TMP_DIR, 'dist', 'shell'), { recursive: true });
  fs.mkdirSync(path.join(TMP_DIR, 'dist', 'post'), { recursive: true });

  fs.writeFileSync(path.join(TMP_DIR, 'dist', 'shell', 'index.html'), SHELL_TEMPLATE, 'utf-8');
}

function generateForVariant(label: string, configDir: string, goldenDir: string): void {
  console.log(`\n=== Generating golden files: ${label} ===\n`);

  rmDirSync(goldenDir);
  fs.mkdirSync(goldenDir, { recursive: true });
  setupTmp(configDir);

  // a) generate-posts-data
  const postsOk = runScript('generate-posts-data', SCRIPTS.posts);
  if (postsOk) {
    copyToGolden(goldenDir, 'public/generated/manifest.json', 'manifest.json');
  }

  // b) generate-albums-data
  const albumsOk = runScript('generate-albums-data', SCRIPTS.albums);
  if (albumsOk) {
    copyToGolden(goldenDir, 'public/generated/albums-index.json', 'albums-index.json');
    const generatedDir = path.join(TMP_DIR, 'public', 'generated');
    if (fs.existsSync(generatedDir)) {
      for (const file of fs.readdirSync(generatedDir)) {
        if (file.startsWith('album-') && file.endsWith('.json')) {
          copyToGolden(goldenDir, `public/generated/${file}`, file);
        }
      }
    }
  }

  // c) generate-seo (requires manifest.json)
  if (postsOk) {
    const seoOk = runScript('generate-seo', SCRIPTS.seo);
    if (seoOk) {
      copyDirToGolden(goldenDir, 'dist/post', 'seo');
    }
  }

  // d) generate-sitemap
  if (postsOk) {
    const sitemapOk = runScript('generate-sitemap', SCRIPTS.sitemap);
    if (sitemapOk) {
      copyToGolden(goldenDir, 'dist/sitemap.xml', 'sitemap.xml');
    }
  }

  // e) generate-rss
  if (postsOk) {
    const rssOk = runScript('generate-rss', SCRIPTS.rss);
    if (rssOk) {
      copyToGolden(goldenDir, 'dist/rss.xml', 'rss.xml');
    }
  }

  // f) generate-robots
  const robotsOk = runScript('generate-robots', SCRIPTS.robots);
  if (robotsOk) {
    copyToGolden(goldenDir, 'dist/robots.txt', 'robots.txt');
  }

  // Summary
  const files = listFilesRecursive(goldenDir);
  console.log(`\n  Generated ${files.length} golden files for ${label}`);
}

function listFilesRecursive(dir: string): string[] {
  const results: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...listFilesRecursive(fullPath));
    } else {
      results.push(fullPath);
    }
  }
  return results;
}

function main() {
  console.log('=== Golden File Generator ===');

  // Default fixtures (basePath: "/")
  const goldenDir = path.join(__dirname, 'golden');
  generateForVariant('default (basePath: "/")', FIXTURES_DIR, goldenDir);

  // BasePath fixtures (basePath: "/blog")
  const basepathGoldenDir = path.join(__dirname, 'golden-basepath');
  generateForVariant('basepath (basePath: "/blog")', BASEPATH_FIXTURES_DIR, basepathGoldenDir);

  // Cleanup
  rmDirSync(TMP_DIR);
  console.log('\n=== Done ===');
}

main();
