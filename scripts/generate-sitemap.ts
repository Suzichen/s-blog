import fs from 'fs';
import path from 'path';

const MANIFEST_FILE = path.join(process.cwd(), 'src/generated/manifest.json');
const CONFIG_FILE = path.join(process.cwd(), 'src/config.ts');
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
  siteUrl?: string;
}

function getSiteUrl(): string | null {
  const configContent = fs.readFileSync(CONFIG_FILE, 'utf-8');
  const urlMatch = configContent.match(/siteUrl:\s*["'](.+?)["']/);
  return urlMatch?.[1] || null;
}

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function generateSitemap(posts: PostMetadata[], siteUrl: string): string {
  const now = new Date().toISOString().split('T')[0];
  
  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
  xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';
  
  // Homepage
  xml += '  <url>\n';
  xml += `    <loc>${escapeXml(siteUrl)}/</loc>\n`;
  xml += `    <lastmod>${now}</lastmod>\n`;
  xml += '    <changefreq>daily</changefreq>\n';
  xml += '    <priority>1.0</priority>\n';
  xml += '  </url>\n';
  
  // Posts
  for (const post of posts) {
    const postUrl = `${siteUrl}/post/${post.slug}`;
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
  const siteUrl = getSiteUrl();
  
  if (!siteUrl) {
    console.log('⊘ Skipping sitemap.xml generation (siteUrl not configured)');
    return;
  }

  if (!fs.existsSync(MANIFEST_FILE)) {
    console.error(`Manifest file not found: ${MANIFEST_FILE}`);
    console.error('Please run "npm run build:posts" first.');
    process.exit(1);
  }

  const posts: PostMetadata[] = JSON.parse(fs.readFileSync(MANIFEST_FILE, 'utf-8'));
  const sitemapContent = generateSitemap(posts, siteUrl);
  
  // Ensure output directory exists
  const outputDir = path.dirname(OUTPUT_FILE);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  fs.writeFileSync(OUTPUT_FILE, sitemapContent, 'utf-8');
  console.log(`✓ Generated sitemap.xml with ${posts.length + 1} URLs`);
}

main();
