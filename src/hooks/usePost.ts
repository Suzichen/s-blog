import { useEffect, useState } from 'react';
import type { PostMetadata } from '@/types/blog';
import postsData from '@/generated/manifest.json';

const posts: PostMetadata[] = postsData as PostMetadata[];

export function usePost(slug: string | undefined) {
  const [content, setContent] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Sort posts by date descending (newest first)
  const sortedPosts = [...posts].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  const currentIndex = sortedPosts.findIndex(p => p.slug === slug);
  const post = sortedPosts[currentIndex];

  const prevPost = currentIndex < sortedPosts.length - 1 ? sortedPosts[currentIndex + 1] : undefined;
  const nextPost = currentIndex > 0 ? sortedPosts[currentIndex - 1] : undefined;

  useEffect(() => {
    if (!slug || !post) {
      setLoading(false);
      return;
    }

    const loadPost = async () => {
      setLoading(true);
      setError(null);
      try {
        const modules = import.meta.glob('@/posts/*.md', { query: '?raw', import: 'default' });
        const matchKey = Object.keys(modules).find(key => key.endsWith(`/${slug}.md`));
        
        if (matchKey) {
            const rawContent = await modules[matchKey]() as string;
            // Strip frontmatter
            const contentBody = rawContent.replace(/^[\uFEFF]?---[\s\S]*?---[\r\n]*/, '');
            setContent(contentBody);
        } else {
            console.error('Post file not found');
            setError(new Error('Post not found'));
        }
      } catch (err) {
        console.error('Failed to load post', err);
        setError(err instanceof Error ? err : new Error('Unknown error'));
      } finally {
        setLoading(false);
      }
    };

    loadPost();
  }, [slug, post]);

  return { post, content, loading, error, prevPost, nextPost };
}
