import { useEffect, useState } from 'react';
import { usePosts } from '@/hooks/usePosts';

export function usePost(slug: string | undefined) {
  const [content, setContent] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const { posts, loading: postsLoading } = usePosts();

  // Sort posts by date descending (newest first)
  const sortedPosts = [...posts].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  const currentIndex = sortedPosts.findIndex(p => p.slug === slug);
  const post = sortedPosts[currentIndex];

  const prevPost = currentIndex < sortedPosts.length - 1 ? sortedPosts[currentIndex + 1] : undefined;
  const nextPost = currentIndex > 0 ? sortedPosts[currentIndex - 1] : undefined;

  useEffect(() => {
    if (postsLoading) return;
    if (!slug || !post) {
      setLoading(false);
      return;
    }

    const loadPost = async () => {
      setLoading(true);
      setError(null);
      try {
        // Fetch the markdown file from public/posts/ (copied there by build:posts)
        const response = await fetch(`/posts/${slug}.md`, { cache: 'no-cache' });
        if (!response.ok) {
          throw new Error(`Failed to load post: ${response.status}`);
        }
        const rawContent = await response.text();
        // Strip frontmatter
        const contentBody = rawContent.replace(/^[\uFEFF]?---[\s\S]*?---[\r\n]*/, '');
        setContent(contentBody);
      } catch (err) {
        console.error('Failed to load post', err);
        setError(err instanceof Error ? err : new Error('Unknown error'));
      } finally {
        setLoading(false);
      }
    };

    loadPost();
  }, [slug, post, postsLoading]);

  return { post, content, loading: loading || postsLoading, error, prevPost, nextPost };
}
