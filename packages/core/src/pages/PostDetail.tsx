import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, Link, useLocation, useNavigationType, useNavigate } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeSlug from 'rehype-slug';
import TableOfContents from '@/components/TableOfContents';
import Prism from 'prismjs';
import 'prismjs/themes/prism.css'; 
import { format } from 'date-fns';
import { useTranslation } from 'react-i18next';
import { usePost } from '@/hooks/usePost';
import { restoreScrollForKey } from '@/hooks/useScrollToTop';
import ImageWithCaption from '@/components/ImageWithCaption';
import PhotoViewer from '@/components/PhotoViewer';
import type { PhotoItem } from '@/types/album';

const PostDetail: React.FC = () => {
  const { t } = useTranslation();
  const { slug } = useParams<{ slug: string }>();
  const { hash, key } = useLocation();
  const navType = useNavigationType();
  const navigate = useNavigate();
  
  const { post, content, loading, isFallback, prevPost, nextPost } = usePost(slug);

  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(0);
  const [viewerPhotos, setViewerPhotos] = useState<PhotoItem[]>([]);
  const imagesRef = useRef<{ src: string; caption: string }[]>([]);

  // Reset every render - ReactMarkdown will re-register all images
  imagesRef.current = [];

  const openViewer = useCallback((index: number) => {
    setViewerPhotos(imagesRef.current.map((img) => ({
      filename: img.caption,
      thumbnailUrl: img.src,
      originalUrl: img.src,
      exif: { cameraMake: null, cameraModel: null, focalLength: null, aperture: null, shutterSpeed: null, iso: null },
    })));
    setViewerIndex(index);
    setViewerOpen(true);
  }, []);

  // After content renders: handle hash scroll or POP restore
  useEffect(() => {
    if (!content) return;
    Prism.highlightAll();

    if (navType === 'POP') {
      const restored = restoreScrollForKey(key);
      if (!restored && hash) {
        const id = decodeURIComponent(hash.slice(1));
        requestAnimationFrame(() => {
          document.getElementById(id)?.scrollIntoView();
        });
      }
    } else if (hash) {
      const id = decodeURIComponent(hash.slice(1));
      requestAnimationFrame(() => {
        document.getElementById(id)?.scrollIntoView();
      });
    }
  }, [content]);

  // Handle hash changes within the same page (TOC clicks)
  useEffect(() => {
    if (!content || !hash) return;
    const id = decodeURIComponent(hash.slice(1));
    const el = document.getElementById(id);
    if (el) el.scrollIntoView();
  }, [hash]);

  if (!post) {
    if (loading) return <div>{t('common.loading')}</div>; 
    return <div>{t('common.postNotFound')}</div>;
  }

  if (loading) {
    return <div>{t('common.loading')}</div>;
  }

  return (
    <div className="relative w-full max-w-[800px] mx-auto pb-8 px-2 md:px-4 xl:px-0 xl:max-w-content">
      <article>
        {isFallback && (
          <div className="mb-4 px-4 py-2 bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-200 text-sm rounded-lg">
            {t('post.noLocalizedVersion')}
          </div>
        )}
        <header className="mb-8 border-b-0 text-center">
          <h1 className="text-4xl md:text-5xl font-normal mb-2 leading-tight">{post.title}</h1>
          <div className="text-sm text-secondary flex justify-center items-center gap-4">
            <span>{format(new Date(post.date), 'MMMM dd, yyyy')}</span>
            <span>
               {t('common.tags')}: {post.tags.join(', ')}
            </span>
          </div>
        </header>
        
        {/* Mobile TOC - inline collapsible */}
        <div className="xl:hidden mb-6">
          <TableOfContents content={content} collapsible />
        </div>

        <div className="markdown-body">
          <ReactMarkdown 
              remarkPlugins={[remarkGfm]}
              rehypePlugins={[rehypeSlug]}
              components={{
                img: ({ src, alt, title }) => {
                  const caption = title || alt || '';
                  const index = imagesRef.current.length;
                  if (src) {
                    imagesRef.current.push({ src, caption });
                  }
                  return (
                    <ImageWithCaption
                      src={src}
                      alt={alt}
                      title={title}
                      onClick={() => src && openViewer(index)}
                    />
                  );
                },
                a: ({ node, href, ...props }) => {
                  if (href?.startsWith('#')) {
                    return (
                      <a 
                        href={href} 
                        onClick={(e) => { 
                          e.preventDefault(); 
                          // Only navigate if it's an internal hash link
                          navigate(`${window.location.pathname}${href}`); 
                        }} 
                        {...props} 
                      />
                    );
                  }
                  return <a href={href} {...props} />;
                }
              }}
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

      {viewerOpen && (
        <PhotoViewer
          photos={viewerPhotos}
          initialIndex={viewerIndex}
          onClose={() => setViewerOpen(false)}
        />
      )}
    </div>
  );
};

export default PostDetail;
