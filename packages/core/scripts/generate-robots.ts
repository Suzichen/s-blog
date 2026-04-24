import fs from 'fs';
import path from 'path';

// Configuration paths - now using JSON files
const CONFIG_FILE = path.join(process.cwd(), 'config.json');
const OUTPUT_FILE = path.join(process.cwd(), 'dist/robots.txt');

interface SiteConfig {
  title: string;
  description: string;
  logo: string;
  favicon: string;
  siteUrl?: string;
  author?: string;
  language?: string;
  timezone?: string;
  basePath?: string;
}

/**
 * Load and validate site configuration from config.json
 */
function loadSiteConfig(): SiteConfig {
  if (!fs.existsSync(CONFIG_FILE)) {
    console.error(`config.json not found. Please create it in the project root.`);
    console.error(`Expected path: ${CONFIG_FILE}`);
    process.exit(1);
  }

  let configContent: string;
  try {
    configContent = fs.readFileSync(CONFIG_FILE, 'utf-8');
  } catch (err) {
    console.error(`Failed to read config.json: ${err instanceof Error ? err.message : err}`);
    process.exit(1);
  }

  let config: SiteConfig;
  try {
    config = JSON.parse(configContent);
  } catch (err) {
    console.error(`Failed to parse config.json: Invalid JSON format`);
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  }

  // Validate required fields
  const requiredFields = ['title', 'description', 'logo', 'favicon'] as const;
  for (const field of requiredFields) {
    if (!config[field]) {
      console.error(`Missing required field in config.json: ${field}`);
      process.exit(1);
    }
  }

  return config;
}

/**
 * Normalize basePath to ensure consistent format
 * - Empty or "/" returns ""
 * - "/blog" or "/blog/" returns "/blog"
 */
function normalizeBasePath(basePath?: string): string {
  if (!basePath || basePath === '/') return '';
  // Remove trailing slash, ensure leading slash
  let normalized = basePath.replace(/\/+$/, '');
  if (!normalized.startsWith('/')) {
    normalized = '/' + normalized;
  }
  return normalized;
}

/**
 * Get the full URL for a path, considering basePath
 */
function getFullUrl(siteUrl: string, basePath: string, relativePath: string): string {
  // Remove trailing slash from siteUrl
  const baseUrl = siteUrl.replace(/\/+$/, '');
  // Ensure relativePath starts with /
  const urlPath = relativePath.startsWith('/') ? relativePath : '/' + relativePath;
  return `${baseUrl}${basePath}${urlPath}`;
}

function generateRobotsTxt(siteUrl: string | undefined, basePath: string): string {
  let content = '# https://www.robotstxt.org/robotstxt.html\n';
  content += 'User-agent: *\n';
  content += 'Allow: /\n';
  content += '\n';

  if (siteUrl) {
    const sitemapUrl = getFullUrl(siteUrl, basePath, '/sitemap.xml');
    content += `Sitemap: ${sitemapUrl}\n`;
  }

  return content;
}

function main() {
  const config = loadSiteConfig();
  const basePath = normalizeBasePath(config.basePath);
  const robotsContent = generateRobotsTxt(config.siteUrl, basePath);

  // Ensure output directory exists
  const outputDir = path.dirname(OUTPUT_FILE);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  fs.writeFileSync(OUTPUT_FILE, robotsContent, 'utf-8');
  console.log('✓ Generated robots.txt');

  if (!config.siteUrl) {
    console.warn('⚠ Warning: siteUrl not configured. Sitemap reference omitted from robots.txt.');
  }
  if (basePath) {
    console.log(`  BasePath: ${basePath}`);
  }
}

main();
