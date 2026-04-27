import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';

// Configuration paths - now using JSON files
const POSTS_DIR = path.join(process.cwd(), 'posts');
const OUTPUT_FILE = path.join(process.cwd(), 'public/generated/manifest.json');
const CONFIG_FILE = path.join(process.cwd(), 'config.json');

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

interface PostMetadata {
  slug: string;
  title: string;
  date: string;
  tags: string[];
  categories: string[];
  summary: string;
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

function getSummary(content: string, length: number = 140): string {
  // Simple markdown stripper
  const plainText = content
    .replace(/!\[.*?\]\(.*?\)/g, '') // Remove images
    .replace(/\[([^\]]+)\]\(.*?\)/g, '$1') // Remove links maintaining text
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
  const siteConfig = loadSiteConfig();
  const basePath = normalizeBasePath(siteConfig.basePath);

  // Check for posts directory - now at root level
  if (!fs.existsSync(POSTS_DIR)) {
    // Fallback to src/posts for backward compatibility
    const legacyPostsDir = path.join(process.cwd(), 'src/posts');
    if (fs.existsSync(legacyPostsDir)) {
      console.warn(`Warning: Using legacy posts directory at src/posts/. Consider moving to posts/`);
      // Use legacy path
      const files = fs.readdirSync(legacyPostsDir).filter(file => file.endsWith('.md'));
      processPostsFromDir(legacyPostsDir, files, siteConfig, basePath);
      return;
    }
    console.error(`Posts directory not found: ${POSTS_DIR}`);
    process.exit(1);
  }

  const files = fs.readdirSync(POSTS_DIR).filter(file => file.endsWith('.md'));
  processPostsFromDir(POSTS_DIR, files, siteConfig, basePath);
}

function processPostsFromDir(
  postsDir: string,
  files: string[],
  siteConfig: SiteConfig,
  basePath: string
) {
  const posts: PostMetadata[] = [];

  for (const file of files) {
    const slug = file.replace(/\.md$/, '');
    const filepath = path.join(postsDir, file);
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
            dateStr = `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())}T${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:${p(d.getUTCSeconds())}`;
          }
        } else {
          // Fallback for timezone-less or unconfigured timezone
          dateStr = `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())}T${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:${p(d.getUTCSeconds())}`;
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

  // Log basePath info if configured
  if (basePath) {
    console.log(`BasePath configured: ${basePath}`);
  }
}

main();
