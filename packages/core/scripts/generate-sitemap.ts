import fs from 'fs';
import path from 'path';

// Configuration paths - now using JSON files
const MANIFEST_FILE = path.join(process.cwd(), 'public/generated/manifest.json');
const CONFIG_FILE = path.join(process.cwd(), 'config.json');
const OUTPUT_FILE = path.join(process.cwd(), 'dist/sitemap.xml');

interface PostMetadata {
  slug: string;
  title: string;
  date: string;
  tags: string[];
  categories: string[];
  summary: string;
}

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
  const path = relativePath.startsWith('/') ? relativePath : '/' + relativePath;
  return `${baseUrl}${basePath}${path}`;
}

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function generateSitemap(posts: PostMetadata[], siteUrl: string, basePath: string): string {
  const now = new Date().toISOString().split('T')[0];

  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
  xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';

  // Homepage
  const homepageUrl = getFullUrl(siteUrl, basePath, '/');
  xml += '  <url>\n';
  xml += `    <loc>${escapeXml(homepageUrl)}</loc>\n`;
  xml += `    <lastmod>${now}</lastmod>\n`;
  xml += '    <changefreq>daily</changefreq>\n';
  xml += '    <priority>1.0</priority>\n';
  xml += '  </url>\n';

  // Posts
  for (const post of posts) {
    const postUrl = getFullUrl(siteUrl, basePath, `/post/${post.slug}`);
    const lastmod = post.date ? post.date.split('T')[0] : now;

    xml += '  <url>\n';
    xml += `    <loc>${escapeXml(postUrl)}</loc>\n`;
    xml += `    <lastmod>${lastmod}</lastmod>\n`;
    xml += '    <changefreq>monthly</changefreq>\n';
    xml += '    <priority>0.8</priority>\n';
    xml += '  </url>\n';
  }

  xml += '</urlset>';
  return xml;
}

function main() {
  const config = loadSiteConfig();
  const basePath = normalizeBasePath(config.basePath);

  if (!config.siteUrl) {
    console.log('⊘ Skipping sitemap.xml generation (siteUrl not configured)');
    return;
  }

  if (!fs.existsSync(MANIFEST_FILE)) {
    console.error(`Manifest file not found: ${MANIFEST_FILE}`);
    console.error('Please run the "build:posts" script first.');
    process.exit(1);
  }

  const posts: PostMetadata[] = JSON.parse(fs.readFileSync(MANIFEST_FILE, 'utf-8'));
  const sitemapContent = generateSitemap(posts, config.siteUrl, basePath);

  // Ensure output directory exists
  const outputDir = path.dirname(OUTPUT_FILE);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  fs.writeFileSync(OUTPUT_FILE, sitemapContent, 'utf-8');
  console.log(`✓ Generated sitemap.xml with ${posts.length + 1} URLs`);
  if (basePath) {
    console.log(`  BasePath: ${basePath}`);
  }
}

main();
