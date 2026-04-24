import fs from 'fs';
import path from 'path';

// Configuration paths - now using JSON files
const MANIFEST_FILE = path.join(process.cwd(), 'public/generated/manifest.json');
const CONFIG_FILE = path.join(process.cwd(), 'config.json');
const OUTPUT_FILE = path.join(process.cwd(), 'dist/rss.xml');

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
  const urlPath = relativePath.startsWith('/') ? relativePath : '/' + relativePath;
  return `${baseUrl}${basePath}${urlPath}`;
}

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function formatRFC822Date(isoDate: string): string {
  if (!isoDate) return new Date().toUTCString();
  return new Date(isoDate).toUTCString();
}

function generateRSS(posts: PostMetadata[], config: SiteConfig, basePath: string): string {
  const { title, description, siteUrl, author, language } = config;
  const now = new Date().toUTCString();

  // Get base URL with basePath
  const baseUrl = siteUrl ? getFullUrl(siteUrl, basePath, '/') : '';

  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
  xml += '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">\n';
  xml += '  <channel>\n';
  xml += `    <title>${escapeXml(title)}</title>\n`;
  xml += `    <description>${escapeXml(description)}</description>\n`;
  xml += `    <link>${escapeXml(baseUrl)}</link>\n`;
  xml += `    <language>${language || 'zh-CN'}</language>\n`;
  xml += `    <lastBuildDate>${now}</lastBuildDate>\n`;

  if (siteUrl) {
    const rssUrl = getFullUrl(siteUrl, basePath, '/rss.xml');
    xml += `    <atom:link href="${escapeXml(rssUrl)}" rel="self" type="application/rss+xml" />\n`;
  }

  // Items
  for (const post of posts) {
    const postUrl = siteUrl ? getFullUrl(siteUrl, basePath, `/post/${post.slug}`) : '';
    const pubDate = formatRFC822Date(post.date);
    const categories = [...post.categories, ...post.tags];

    xml += '    <item>\n';
    xml += `      <title>${escapeXml(post.title)}</title>\n`;
    xml += `      <description>${escapeXml(post.summary)}</description>\n`;
    if (postUrl) {
      xml += `      <link>${escapeXml(postUrl)}</link>\n`;
      xml += `      <guid isPermaLink="true">${escapeXml(postUrl)}</guid>\n`;
    }
    xml += `      <pubDate>${pubDate}</pubDate>\n`;
    if (author) {
      xml += `      <author>${escapeXml(author)}</author>\n`;
    }

    for (const category of categories) {
      xml += `      <category>${escapeXml(category)}</category>\n`;
    }

    xml += '    </item>\n';
  }

  xml += '  </channel>\n';
  xml += '</rss>';

  return xml;
}

function main() {
  const config = loadSiteConfig();
  const basePath = normalizeBasePath(config.basePath);

  if (!config.siteUrl) {
    console.log('⊘ Skipping rss.xml generation (siteUrl not configured)');
    return;
  }

  if (!fs.existsSync(MANIFEST_FILE)) {
    console.error(`Manifest file not found: ${MANIFEST_FILE}`);
    console.error('Please run the "build:posts" script first.');
    process.exit(1);
  }

  const posts: PostMetadata[] = JSON.parse(fs.readFileSync(MANIFEST_FILE, 'utf-8'));
  const rssContent = generateRSS(posts, config, basePath);

  // Ensure output directory exists
  const outputDir = path.dirname(OUTPUT_FILE);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  fs.writeFileSync(OUTPUT_FILE, rssContent, 'utf-8');
  console.log(`✓ Generated rss.xml with ${posts.length} items`);
  if (basePath) {
    console.log(`  BasePath: ${basePath}`);
  }
}

main();
