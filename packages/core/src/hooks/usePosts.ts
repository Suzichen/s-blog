import { useState, useEffect } from 'react';
import type { PostMetadata } from '../types/blog';

interface UsePostsResult {
  posts: PostMetadata[];
  loading: boolean;
  error: string | null;
}

export function usePosts(): UsePostsResult {
  const [posts, setPosts] = useState<PostMetadata[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchPosts() {
      try {
        const response = await fetch('/generated/manifest.json', { cache: 'no-cache' });
        if (!response.ok) {
          throw new Error(`Failed to load posts manifest: ${response.status}`);
        }
        const data: PostMetadata[] = await response.json();
        if (!cancelled) {
          setPosts(data);
          setLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load posts');
          setLoading(false);
        }
      }
    }

    fetchPosts();
    return () => { cancelled = true; };
  }, []);

  return { posts, loading, error };
}
