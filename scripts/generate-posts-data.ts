
import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';

const POSTS_DIR = path.join(process.cwd(), 'src/posts');
const OUTPUT_FILE = path.join(process.cwd(), 'src/generated/manifest.json');

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
            const dateObj = new Date(data.date);
            dateStr = dateObj.toISOString();
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
}

main();
