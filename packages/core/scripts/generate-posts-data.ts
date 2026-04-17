
import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';

const POSTS_DIR = path.join(process.cwd(), 'src/posts');
const OUTPUT_FILE = path.join(process.cwd(), 'public/generated/manifest.json');
const PUBLIC_POSTS_DIR = path.join(process.cwd(), 'public/posts');
const CONFIG_FILE = path.join(process.cwd(), 'src/config.ts');

interface SiteConfig {
  timezone?: string;
}

function getSiteConfig(): SiteConfig {
  if (!fs.existsSync(CONFIG_FILE)) return {};
  const configContent = fs.readFileSync(CONFIG_FILE, 'utf-8');
  const tzMatch = configContent.match(/(?:timezone|'timezone'|"timezone")\s*:\s*["']([^"']+)["']/);
  return {
    timezone: tzMatch?.[1],
  };
}

interface PostMetadata {
  slug: string;
  title: string;
  date: string;
  tags: string[];
  categories: string[];
  summary: string;
}

function getSummary(content: string, length: number = 140): string {
  // Simple markdown stripper
  const plainText = content
    .replace(/!\[.*?\]\(.*?\)/g, '') // Remove images
    .replace(/\[([^\]]+)\]\(.*?\)/g, '$1') // Remove links maintaing text
    .replace(/`{1,3}.*?`{1,3}/gs, '') // Remove code blocks
    .replace(/#+\s/g, '') // Remove headers
    .replace(/(\*\*|__)(.*?)\1/g, '$2') // Remove bold
    .replace(/(\*|_)(.*?)\1/g, '$2') // Remove italic
    .replace(/\n+/g, ' ') // Collapse newlines
    .trim();

  return plainText.substring(0, length) + (plainText.length > length ? '...' : '');
}

function normalizeArray(input: string | string[] | undefined): string[] {
  if (!input) return [];
  if (Array.isArray(input)) return input;
  // Handle space separated or comma separated
  return input.split(/[\s,]+/).filter(Boolean);
}

function main() {
  const siteConfig = getSiteConfig();

  if (!fs.existsSync(POSTS_DIR)) {
    console.error(`Posts directory not found: ${POSTS_DIR}`);
    process.exit(1);
  }

  const files = fs.readdirSync(POSTS_DIR).filter(file => file.endsWith('.md'));
  const posts: PostMetadata[] = [];

  for (const file of files) {
    const slug = file.replace(/\.md$/, '');
    const filepath = path.join(POSTS_DIR, file);
    const fileContent = fs.readFileSync(filepath, 'utf-8');
    const { data, content } = matter(fileContent);

    // Normalize Tags/Categories
    const tags = normalizeArray(data.tags);
    const categories = normalizeArray(data.categories);

    // Format date
    let dateStr = '';
    if (data.date) {
        try {
            const d = data.date instanceof Date ? data.date : new Date(data.date);
            if (isNaN(d.getTime())) throw new Error('Invalid date');
            const p = (n: number) => String(n).padStart(2, '0');

            // Check if the original date string explicitly contains a timezone offset
            const rawDateMatch = fileContent.match(/^date:\s*(.+)$/m);
            let hasTimezone = false;
            if (rawDateMatch) {
                let rawDate = rawDateMatch[1].trim();
                // Remove quotes if present
                if (/^["'].*["']$/.test(rawDate)) {
                    rawDate = rawDate.slice(1, -1).trim();
                }
                hasTimezone = /(Z|[+-]\d{2}:?\d{2})$/i.test(rawDate);
            }

            if (siteConfig.timezone && hasTimezone) {
                try {
                    const formatter = new Intl.DateTimeFormat('en-US', {
                        timeZone: siteConfig.timezone,
                        year: 'numeric',
                        month: '2-digit',
                        day: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                        hourCycle: 'h23',
                    });
                    const parts = formatter.formatToParts(d);
                    const v = (type: string) => parts.find(part => part.type === type)?.value;
                    dateStr = `${v('year')}-${v('month')}-${v('day')}T${v('hour')}:${v('minute')}:${v('second')}`;
                } catch (e) {
                    console.warn(`Invalid timezone configuration: ${siteConfig.timezone}. Falling back to default behavior.`);
                    dateStr = `${d.getUTCFullYear()}-${p(d.getUTCMonth()+1)}-${p(d.getUTCDate())}T${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:${p(d.getUTCSeconds())}`;
                }
            } else {
                // Fallback for timezone-less or unconfigured timezone
                dateStr = `${d.getUTCFullYear()}-${p(d.getUTCMonth()+1)}-${p(d.getUTCDate())}T${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:${p(d.getUTCSeconds())}`;
            }
        } catch (e) {
            console.warn(`Invalid date in ${file}: ${data.date}`);
        }
    }

    // Check for custom preview/summary
    const summary = data.preview || data.description || data.excerpt || getSummary(content);

    posts.push({
      slug,
      title: data.title || slug,
      date: dateStr,
      tags,
      categories,
      summary: summary,
    });
  }

  // Sort by date desc
  posts.sort((a, b) => (new Date(b.date).getTime() - new Date(a.date).getTime()));

  // Ensure output dir exists
  const outputDir = path.dirname(OUTPUT_FILE);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(posts, null, 2));
  console.log(`Generated manifest with ${posts.length} posts.`);

  // Copy markdown files to public/posts/ for runtime fetching
  if (!fs.existsSync(PUBLIC_POSTS_DIR)) {
    fs.mkdirSync(PUBLIC_POSTS_DIR, { recursive: true });
  }
  for (const file of files) {
    fs.copyFileSync(
      path.join(POSTS_DIR, file),
      path.join(PUBLIC_POSTS_DIR, file)
    );
  }
  console.log(`Copied ${files.length} post files to public/posts/.`);
}

main();
