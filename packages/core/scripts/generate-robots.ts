import fs from 'fs';
import path from 'path';

const CONFIG_FILE = path.join(process.cwd(), 'src/config.ts');
const OUTPUT_FILE = path.join(process.cwd(), 'dist/robots.txt');

function getSiteUrl(): string | null {
  const configContent = fs.readFileSync(CONFIG_FILE, 'utf-8');
  const urlMatch = configContent.match(/siteUrl:\s*["'](.+?)["']/);
  return urlMatch?.[1] || null;
}

function generateRobotsTxt(siteUrl: string | null): string {
  let content = '# https://www.robotstxt.org/robotstxt.html\n';
  content += 'User-agent: *\n';
  content += 'Allow: /\n';
  content += '\n';
  
  if (siteUrl) {
    content += `Sitemap: ${siteUrl}/sitemap.xml\n`;
  }
  
  return content;
}

function main() {
  const siteUrl = getSiteUrl();
  const robotsContent = generateRobotsTxt(siteUrl);
  
  // Ensure output directory exists
  const outputDir = path.dirname(OUTPUT_FILE);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  fs.writeFileSync(OUTPUT_FILE, robotsContent, 'utf-8');
  console.log('✓ Generated robots.txt');
  
  if (!siteUrl) {
    console.warn('⚠ Warning: siteUrl not configured. Sitemap reference omitted from robots.txt.');
  }
}

main();
