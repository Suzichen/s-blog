import fs from 'fs';
import path from 'path';

const MANIFEST_FILE = path.join(process.cwd(), 'src/generated/manifest.json');
const CONFIG_FILE = path.join(process.cwd(), 'src/config.ts');
const OUTPUT_DIR = path.join(process.cwd(), 'dist/posts');

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
  siteUrl?: string;
  author?: string;
  language?: string;
}

// Parse config from TypeScript file (simple extraction)
function getSiteConfig(): SiteConfig {
  const configContent = fs.readFileSync(CONFIG_FILE, 'utf-8');
  
  // Extract values using regex (simple parser)
  const titleMatch = configContent.match(/title:\s*["'](.+?)["']/);
  const descMatch = configContent.match(/description:\s*["'](.+?)["']/);
  const urlMatch = configContent.match(/siteUrl:\s*["'](.+?)["']/);
  const authorMatch = configContent.match(/author:\s*["'](.+?)["']/);
  const langMatch = configContent.match(/language:\s*["'](.+?)["']/);
  
  return {
    title: titleMatch?.[1] || 'Blog',
    description: descMatch?.[1] || '',
    siteUrl: urlMatch?.[1],
    author: authorMatch?.[1],
    language: langMatch?.[1] || 'zh-CN',
  };
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function generateSEOHtml(post: PostMetadata, config: SiteConfig): string {
  const { slug, title, summary, tags, categories, date } = post;
  const { siteUrl, author, language } = config;
  
  const postUrl = siteUrl ? `${siteUrl}/post/${slug}` : '';
  const keywords = [...tags, ...categories].join(', ');
  const publishDate = date || new Date().toISOString();
  
  // JSON-LD structured data
  const jsonLd = siteUrl ? {
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
  } : null;

  return `<!DOCTYPE html>
<html lang="${language || 'zh-CN'}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  
  <!-- Primary Meta Tags -->
  <title>${escapeHtml(title)}</title>
  <meta name="title" content="${escapeHtml(title)}">
  <meta name="description" content="${escapeHtml(summary)}">
  ${keywords ? `<meta name="keywords" content="${escapeHtml(keywords)}">` : ''}
  ${author ? `<meta name="author" content="${escapeHtml(author)}">` : ''}
  <meta name="robots" content="index, follow">
  ${postUrl ? `<link rel="canonical" href="${postUrl}">` : ''}
  
  ${siteUrl ? `<!-- Open Graph / Facebook -->
  <meta property="og:type" content="article">
  <meta property="og:url" content="${postUrl}">
  <meta property="og:title" content="${escapeHtml(title)}">
  <meta property="og:description" content="${escapeHtml(summary)}">
  <meta property="og:site_name" content="${escapeHtml(config.title)}">
  <meta property="article:published_time" content="${publishDate}">
  ${author ? `<meta property="article:author" content="${escapeHtml(author)}">` : ''}
  ${tags.map(tag => `<meta property="article:tag" content="${escapeHtml(tag)}">`).join('\n  ')}
  
  <!-- Twitter -->
  <meta name="twitter:card" content="summary">
  <meta name="twitter:url" content="${postUrl}">
  <meta name="twitter:title" content="${escapeHtml(title)}">
  <meta name="twitter:description" content="${escapeHtml(summary)}">` : ''}
  
  ${jsonLd ? `<!-- JSON-LD Structured Data -->
  <script type="application/ld+json">
${JSON.stringify(jsonLd, null, 2)}
  </script>` : ''}
</head>
<body>
  <h1>${escapeHtml(title)}</h1>
  <p>${escapeHtml(summary)}</p>
  ${postUrl ? `<p><a href="${postUrl}">阅读全文 / Read more</a></p>` : ''}
</body>
</html>`;
}

function main() {
  if (!fs.existsSync(MANIFEST_FILE)) {
    console.error(`Manifest file not found: ${MANIFEST_FILE}`);
    console.error('Please run "npm run build:posts" first.');
    process.exit(1);
  }

  const config = getSiteConfig();
  const posts: PostMetadata[] = JSON.parse(fs.readFileSync(MANIFEST_FILE, 'utf-8'));

  // Ensure output directory exists
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  let generated = 0;
  for (const post of posts) {
    const htmlContent = generateSEOHtml(post, config);
    const outputFile = path.join(OUTPUT_DIR, `${post.slug}.html`);
    fs.writeFileSync(outputFile, htmlContent, 'utf-8');
    generated++;
  }

  console.log(`✓ Generated ${generated} SEO HTML files in dist/posts/`);
  if (!config.siteUrl) {
    console.warn('⚠ Warning: siteUrl not configured. Some SEO features are limited.');
  }
}

main();
