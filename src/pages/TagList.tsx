import React from 'react';
import postsData from '@/generated/manifest.json';
import type { PostMetadata } from '@/types/blog';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

const posts: PostMetadata[] = postsData as PostMetadata[];

const TagList: React.FC = () => {
  const { t } = useTranslation();
  const tags = Array.from(new Set(posts.flatMap(p => p.tags)));

  return (
    <div className="max-w-[800px] mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6 text-primary">{t('titles.tags')}</h1>
      <ul className="list-none p-0 flex flex-wrap gap-3">
        {tags.map(tag => (
          <li key={tag}>
            <Link 
              to={`/tags/${tag}`}
              className="inline-block text-sm text-accent hover:text-primary transition-colors no-underline"
            >
              #{tag}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default TagList;
