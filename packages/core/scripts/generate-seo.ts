import fs from 'fs';
import path from 'path';

// Configuration paths - now using JSON files
const MANIFEST_FILE = path.join(process.cwd(), 'public/generated/manifest.json');
const CONFIG_FILE = path.join(process.cwd(), 'config.json');
// Use App Shell's index.html as template (from dist/shell/ or dist/)
const SHELL_TEMPLATE_FILE = path.join(process.cwd(), 'dist/shell/index.html');
const LEGACY_TEMPLATE_FILE = path.join(process.cwd(), 'dist/index.html');
const OUTPUT_DIR = path.join(process.cwd(), 'dist/post');

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

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function generateSEOHtml(post: PostMetadata, config: SiteConfig, basePath: string): string {
  const { slug, title, summary, tags, categories, date } = post;
  const { siteUrl, author } = config;

  const postUrl = siteUrl ? getFullUrl(siteUrl, basePath, `/post/${slug}/`) : '';
  const keywords = [...tags, ...categories].join(', ');
  const publishDate = date || new Date().toISOString();

  // Build SEO tags imperatively to avoid spurious blank lines from
  // template-literal conditionals (e.g. when keywords or author is empty).
  let out = '';

  // --- basic meta ---
  out += `\n  <title>${escapeHtml(title)}</title>`;
  out += `\n  <meta name="title" content="${escapeHtml(title)}">`;
  out += `\n  <meta name="description" content="${escapeHtml(summary)}">`;
  if (keywords) {
    out += `\n  <meta name="keywords" content="${escapeHtml(keywords)}">`;
  }
  if (author) {
    out += `\n  <meta name="author" content="${escapeHtml(author)}">`;
  }
  out += `\n  <meta name="robots" content="index, follow">`;
  if (postUrl) {
    out += `\n  <link rel="canonical" href="${postUrl}">`;
  }

  // --- Open Graph + Twitter (only when siteUrl is set) ---
  if (siteUrl) {
    out += `\n\n  <meta property="og:type" content="article">`;
    out += `\n  <meta property="og:url" content="${postUrl}">`;
    out += `\n  <meta property="og:title" content="${escapeHtml(title)}">`;
    out += `\n  <meta property="og:description" content="${escapeHtml(summary)}">`;
    out += `\n  <meta property="og:site_name" content="${escapeHtml(config.title)}">`;
    out += `\n  <meta property="article:published_time" content="${publishDate}">`;
    if (author) {
      out += `\n  <meta property="article:author" content="${escapeHtml(author)}">`;
    }
    for (const tag of tags) {
      out += `\n  <meta property="article:tag" content="${escapeHtml(tag)}">`;
    }

    out += `\n\n  <meta name="twitter:card" content="summary">`;
    out += `\n  <meta name="twitter:url" content="${postUrl}">`;
    out += `\n  <meta name="twitter:title" content="${escapeHtml(title)}">`;
    out += `\n  <meta name="twitter:description" content="${escapeHtml(summary)}">`;
  }

  // --- JSON-LD (only when siteUrl is set) ---
  if (siteUrl) {
    const jsonLd = {
      "@context": "https://schema.org",
      "@type": "Article",
      "headline": title,
      "description": summary,
      "author": {
        "@type": "Person",
        "name": author || "Anonymous"
      },
      "datePublished": publishDate,
      "url": postUrl,
      "keywords": keywords
    };
    out += `\n\n  <script type="application/ld+json">\n${JSON.stringify(jsonLd, null, 2)}\n  </script>`;
  }

  return out;
}

function main() {
  if (!fs.existsSync(MANIFEST_FILE)) {
    console.error(`Manifest file not found: ${MANIFEST_FILE}`);
    console.error('Please run the "build:posts" script first.');
    process.exit(1);
  }

  // Try to find the template file - prefer App Shell template
  let templateFile = SHELL_TEMPLATE_FILE;
  if (!fs.existsSync(templateFile)) {
    templateFile = LEGACY_TEMPLATE_FILE;
    if (!fs.existsSync(templateFile)) {
      console.error(`Template file not found.`);
      console.error(`Tried: ${SHELL_TEMPLATE_FILE}`);
      console.error(`Tried: ${LEGACY_TEMPLATE_FILE}`);
      console.error('Please run the "build" or "build:shell" script first.');
      process.exit(1);
    }
  }

  const config = loadSiteConfig();
  const basePath = normalizeBasePath(config.basePath);
  const posts: PostMetadata[] = JSON.parse(fs.readFileSync(MANIFEST_FILE, 'utf-8'));
  const template = fs.readFileSync(templateFile, 'utf-8');

  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  let generated = 0;
  for (const post of posts) {
    const seoTags = generateSEOHtml(post, config, basePath);

    let htmlContent = template;
    
    // Convert relative paths to absolute paths for assets
    // SEO pages are in /post/{slug}/, so relative paths like ./assets/ won't work
    // Need to convert to absolute paths (considering basePath)
    const assetBasePath = basePath || '';
    htmlContent = htmlContent.replace(/href="\.\/assets\//g, `href="${assetBasePath}/assets/`);
    htmlContent = htmlContent.replace(/src="\.\/assets\//g, `src="${assetBasePath}/assets/`);
    htmlContent = htmlContent.replace(/href="\.\/favicon/g, `href="${assetBasePath}/favicon`);
    htmlContent = htmlContent.replace(/src="\.\/favicon/g, `src="${assetBasePath}/favicon`);
    
    htmlContent = htmlContent.replace(/<title>.*?<\/title>/, '');
    htmlContent = htmlContent.replace('</head>', `${seoTags}\n</head>`);

    const postDir = path.join(OUTPUT_DIR, post.slug);
    if (!fs.existsSync(postDir)) {
      fs.mkdirSync(postDir, { recursive: true });
    }

    const outputFile = path.join(postDir, 'index.html');
    fs.writeFileSync(outputFile, htmlContent, 'utf-8');
    generated++;
  }

  console.log(`✓ Generated ${generated} SEO HTML files in dist/post/`);
  if (!config.siteUrl) {
    console.warn('⚠ Warning: siteUrl not configured. Some SEO features are limited.');
  }
  if (basePath) {
    console.log(`  BasePath: ${basePath}`);
  }
}

main();
