import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { usePosts } from '@/hooks/usePosts';
import { useSiteConfig } from '../context';
import { resolvePostUrl } from '../utils/resolvePostUrl';

export function usePost(slug: string | undefined) {
  const [content, setContent] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [isFallback, setIsFallback] = useState(false);
  const { posts, loading: postsLoading } = usePosts();
  const { i18n } = useTranslation();
  const currentLang = i18n.resolvedLanguage ?? '';
  const siteConfig = useSiteConfig();
  const siteDefaultLanguage = siteConfig.language ?? '';

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
      setIsFallback(false);
      return;
    }

    const availableLanguages = post.availableLanguages ?? [];

    // Determine isFallback: true when the post has no localized version for
    // the user's language AND the user's language is not the site default language.
    const langHasLocalizedVersion = availableLanguages.includes(currentLang);
    const isDefaultLangUser = currentLang === siteDefaultLanguage;
    setIsFallback(!langHasLocalizedVersion && !isDefaultLangUser);

    const loadPost = async () => {
      setLoading(true);
      setError(null);
      try {
        const url = resolvePostUrl(slug, availableLanguages, currentLang);
        let response = await fetch(url, { cache: 'no-cache' });

        // 404 fallback: if localized file not found, try default file
        if (!response.ok && response.status === 404 && url !== `/posts/${slug}.md`) {
          response = await fetch(`/posts/${slug}.md`, { cache: 'no-cache' });
        }

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
  }, [slug, post, postsLoading, currentLang, siteDefaultLanguage]);

  return { post, content, loading: loading || postsLoading, error, isFallback, prevPost, nextPost };
}
