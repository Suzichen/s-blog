
import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
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

  const post = posts.find(p => p.slug === slug);

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
        // Note: import.meta.glob keys are relative to the glob pattern usually or absolute.
        // We know the structure: /src/posts/slug.md
        // Glob result keys: "/src/posts/slug.md" (if absolute glob) or "./../../posts/slug.md" (relative).
        // Safest is to find key ending with /slug.md
        
        const matchKey = Object.keys(modules).find(key => key.endsWith(`/${slug}.md`));
        
        if (matchKey) {
            const rawContent = await modules[matchKey]() as string;
            // Strip frontmatter - more robust regex handling newlines
            // Matches start of file --- ... --- with any amount of whitespace/newlines around
            const contentBody = rawContent.replace(/^---[\r\n]+[\s\S]*?[\r\n]+---[\r\n]*/, '');
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
    </article>
  );
};

export default PostDetail;
