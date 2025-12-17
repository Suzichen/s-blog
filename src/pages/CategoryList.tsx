import React from 'react';
import postsData from '@/generated/manifest.json';
import type { PostMetadata } from '@/types/blog';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

const posts: PostMetadata[] = postsData as PostMetadata[];

const CategoryList: React.FC = () => {
  const { t } = useTranslation();
  const categories = Array.from(new Set(posts.flatMap(p => p.categories)));

  return (
    <div className="max-w-[800px] mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6 text-primary">{t('titles.categories')}</h1>
      <ul className="list-none p-0 flex flex-wrap gap-4">
        {categories.map(cat => (
          <li key={cat}>
            <Link 
              to={`/categories/${cat}`}
              className="inline-block px-4 py-2 bg-bg-alt border border-border rounded-full text-secondary hover:text-accent hover:border-accent transition-colors no-underline"
            >
              {cat}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default CategoryList;
