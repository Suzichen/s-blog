
import React from 'react';
import { Link } from 'react-router-dom';
import postsData from '@/generated/manifest.json';
import type { PostMetadata } from '@/types/blog';
import { format } from 'date-fns';
import { useTranslation } from 'react-i18next';

const posts: PostMetadata[] = postsData as PostMetadata[];

const Home: React.FC = () => {
  const { t } = useTranslation();
  return (
    <div>
      <ul className="post-list">
        {posts.map((post) => (
          <li key={post.slug} className="post-item">
            <h2 className="post-title">
              <Link to={`/post/${post.slug}`}>{post.title}</Link>
            </h2>
            <div className="post-meta">
              <span>{format(new Date(post.date), 'MMMM dd, yyyy')}</span>
              {post.categories.length > 0 && (
                <span> | {post.categories.join(', ')}</span>
              )}
            </div>
            <p className="post-summary">{post.summary}</p>
            <Link to={`/post/${post.slug}`} className="read-more">{t('common.readMore')} &rarr;</Link>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default Home;
