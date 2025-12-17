
import React from 'react';
import postsData from '@/generated/manifest.json';
import type { PostMetadata } from '@/types/blog';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

const posts: PostMetadata[] = postsData as PostMetadata[];

const CategoryList: React.FC = () => {
  const { t } = useTranslation();
  // Extract unique categories
  const categories = Array.from(new Set(posts.flatMap(p => p.categories)));

  return (
    <div>
      <h1>{t('titles.categories')}</h1>
      <ul>
        {categories.map(cat => (
          <li key={cat}>
            <Link to={`/categories/${cat}`}>{cat}</Link>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default CategoryList;
