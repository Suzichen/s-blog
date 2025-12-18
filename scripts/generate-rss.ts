import fs from 'fs';
import path from 'path';

const MANIFEST_FILE = path.join(process.cwd(), 'src/generated/manifest.json');
const CONFIG_FILE = path.join(process.cwd(), 'src/config.ts');
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
  siteUrl?: string;
  author?: string;
  language?: string;
}

function getSiteConfig(): SiteConfig {
  const configContent = fs.readFileSync(CONFIG_FILE, 'utf-8');
  
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

function generateRSS(posts: PostMetadata[], config: SiteConfig): string {
  const { title, description, siteUrl, author, language } = config;
  const now = new Date().toUTCString();
  
  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
  xml += '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">\n';
  xml += '  <channel>\n';
  xml += `    <title>${escapeXml(title)}</title>\n`;
  xml += `    <description>${escapeXml(description)}</description>\n`;
  xml += `    <link>${escapeXml(siteUrl || '')}</link>\n`;
  xml += `    <language>${language || 'zh-CN'}</language>\n`;
  xml += `    <lastBuildDate>${now}</lastBuildDate>\n`;
  
  if (siteUrl) {
    xml += `    <atom:link href="${escapeXml(siteUrl)}/rss.xml" rel="self" type="application/rss+xml" />\n`;
  }
  
  // Items
  for (const post of posts) {
    const postUrl = siteUrl ? `${siteUrl}/post/${post.slug}` : '';
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
  const config = getSiteConfig();
  
  if (!config.siteUrl) {
    console.log('⊘ Skipping rss.xml generation (siteUrl not configured)');
    return;
  }

  if (!fs.existsSync(MANIFEST_FILE)) {
    console.error(`Manifest file not found: ${MANIFEST_FILE}`);
    console.error('Please run "npm run build:posts" first.');
    process.exit(1);
  }

  const posts: PostMetadata[] = JSON.parse(fs.readFileSync(MANIFEST_FILE, 'utf-8'));
  const rssContent = generateRSS(posts, config);
  
  // Ensure output directory exists
  const outputDir = path.dirname(OUTPUT_FILE);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  fs.writeFileSync(OUTPUT_FILE, rssContent, 'utf-8');
  console.log(`✓ Generated rss.xml with ${posts.length} items`);
}

main();
