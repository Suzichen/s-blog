import React, { useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeSlug from 'rehype-slug';
import TableOfContents from '@/components/TableOfContents';
import Prism from 'prismjs';
import 'prismjs/themes/prism.css'; 
import { format } from 'date-fns';
import { useTranslation } from 'react-i18next';
import { usePost } from '@/hooks/usePost';

const PostDetail: React.FC = () => {
  const { t } = useTranslation();
  const { slug } = useParams<{ slug: string }>();
  
  const { post, content, loading, prevPost, nextPost } = usePost(slug);

  useEffect(() => {
    if (content) {
      Prism.highlightAll();
    }
  }, [content]);

  if (!post) {
    if (loading) return <div>{t('common.loading')}</div>; 
    return <div>{t('common.postNotFound')}</div>;
  }

  if (loading) {
    return <div>{t('common.loading')}</div>;
  }

  return (
    <div className="relative w-full max-w-[800px] mx-auto pb-8 px-4 xl:px-0 xl:max-w-content">
      <article>
        <header className="mb-8 border-b-0 text-center">
          <h1 className="text-4xl md:text-5xl font-normal mb-2 leading-tight">{post.title}</h1>
          <div className="text-sm text-secondary flex justify-center items-center gap-4">
            <span>{format(new Date(post.date), 'MMMM dd, yyyy')}</span>
            <span>
               {t('common.tags')}: {post.tags.join(', ')}
            </span>
          </div>
        </header>
        
        <div className="markdown-body">
          <ReactMarkdown 
              remarkPlugins={[remarkGfm]}
              rehypePlugins={[rehypeSlug]}
          >
              {content}
          </ReactMarkdown>
        </div>
        
        <hr className="my-12 border-border" />
        
        <nav className="flex justify-between flex-wrap gap-4">
          <div className="flex-1 min-w-[200px]">
            {prevPost && (
              <Link to={`/post/${prevPost.slug}`} className="block group no-underline">
                <div className="text-sm text-secondary mb-1">{t('common.prevPost')}</div>
                <div className="text-lg font-bold group-hover:text-accent transition-colors">
                  &laquo; {prevPost.title}
                </div>
              </Link>
            )}
          </div>
          <div className="flex-1 min-w-[200px] text-right">
            {nextPost && (
              <Link to={`/post/${nextPost.slug}`} className="block group no-underline">
                <div className="text-sm text-secondary mb-1">{t('common.nextPost')}</div>
                <div className="text-lg font-bold group-hover:text-accent transition-colors">
                  {nextPost.title} &raquo;
                </div>
              </Link>
            )}
          </div>
        </nav>
      </article>

      {/* Desktop TOC Sidebar */}
      <aside className="hidden xl:block absolute top-0 -right-[340px] 2xl:-right-[360px] h-full w-[300px]">
        {/* Sticky Inner */}
        <div className="sticky top-[120px] max-h-[calc(100vh-140px)] overflow-y-auto pr-2 custom-scrollbar">
            <TableOfContents content={content} />
        </div>
      </aside>
    </div>
  );
};

export default PostDetail;
