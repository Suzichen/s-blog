
import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import Prism from 'prismjs';
import 'prismjs/themes/prism.css'; // You might want a different theme
import postsData from '@/generated/manifest.json';
import type { PostMetadata } from '@/types/blog';
import { format } from 'date-fns';

const posts: PostMetadata[] = postsData as PostMetadata[];

const PostDetail: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const [content, setContent] = useState<string>('');
  const [loading, setLoading] = useState(true);

  // Sort posts by date descending (newest first)
  const sortedPosts = [...posts].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  const currentIndex = sortedPosts.findIndex(p => p.slug === slug);
  const post = sortedPosts[currentIndex];
  
  // Previous: index - 1 (newer post)
  // Next: index + 1 (older post)
  // Note: "Previous" usually means "Newer" in blog context if traversing backwards in time, 
  // but "Previous Post" textually often implies "Older". 
  // User asked for "Previous" and "Next".
  // Let's interpret "Previous" as "Older" (Left) and "Next" as "Newer" (Right) or vice versa?
  // Convention A: Previous = Older, Next = Newer
  // Convention B: Previous = Newer (up the list), Next = Older (down the list)
  // Let's stick to chronological flow: 
  // "Previous Post" -> Older (Index + 1)
  // "Next Post" -> Newer (Index - 1)
  // Wait, intuitively "Next" is usually the one after this one. If reading chronologically, "Next" is newer.
  // If reading reverse-chronologically (blog feed), "Next" is older.
  // Let's use standard blog keys:
  // prevPost = sortedPosts[currentIndex + 1]; // Older
  // nextPost = sortedPosts[currentIndex - 1]; // Newer
  
  const prevPost = currentIndex < sortedPosts.length - 1 ? sortedPosts[currentIndex + 1] : undefined;
  const nextPost = currentIndex > 0 ? sortedPosts[currentIndex - 1] : undefined;

  useEffect(() => {
    if (!slug || !post) {
      setLoading(false);
      return;
    }

    const loadPost = async () => {
      try {
        // Import all markdown files as raw strings
        const modules = import.meta.glob('@/posts/*.md', { query: '?raw', import: 'default' });
        
        // Find the matching module
        // We know the structure: /src/posts/slug.md
        const matchKey = Object.keys(modules).find(key => key.endsWith(`/${slug}.md`));
        
        if (matchKey) {
            const rawContent = await modules[matchKey]() as string;
            // Strip frontmatter - handle BOM and robust newline support
            const contentBody = rawContent.replace(/^[\uFEFF]?---[\s\S]*?---[\r\n]*/, '');
            setContent(contentBody);
        } else {
            console.error('Post file not found');
        }
      } catch (err) {
        console.error('Failed to load post', err);
      } finally {
        setLoading(false);
      }
    };

    loadPost();
  }, [slug, post]);

  useEffect(() => {
    if (content) {
      Prism.highlightAll();
    }
  }, [content]);

  if (!post) {
    return <div>Post not found</div>;
  }

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <article>
      <header style={{ marginBottom: '2rem', borderBottom: 'none' }}>
        <h1 style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>{post.title}</h1>
        <div className="post-meta">
          <span>{format(new Date(post.date), 'MMMM dd, yyyy')}</span>
          <span style={{ marginLeft: '1rem' }}>
             Tags: {post.tags.join(', ')}
          </span>
        </div>
      </header>
      <div className="markdown-body">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
      </div>
      
      <hr style={{ margin: '3rem 0' }} />
      
      <nav className="post-navigation" style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
        <div className="nav-previous" style={{ flex: 1, minWidth: '200px' }}>
          {prevPost && (
            <Link to={`/post/${prevPost.slug}`} style={{ display: 'block', textDecoration: 'none' }}>
              <div style={{ fontSize: '0.875rem', color: '#666' }}>Previous Post</div>
              <div style={{ fontSize: '1.1rem', fontWeight: 'bold' }}>&laquo; {prevPost.title}</div>
            </Link>
          )}
        </div>
        <div className="nav-next" style={{ flex: 1, minWidth: '200px', textAlign: 'right' }}>
          {nextPost && (
            <Link to={`/post/${nextPost.slug}`} style={{ display: 'block', textDecoration: 'none' }}>
              <div style={{ fontSize: '0.875rem', color: '#666' }}>Next Post</div>
              <div style={{ fontSize: '1.1rem', fontWeight: 'bold' }}>{nextPost.title} &raquo;</div>
            </Link>
          )}
        </div>
      </nav>
    </article>
  );
};

export default PostDetail;
