
import React from 'react';
import postsData from '@/generated/manifest.json';
import type { PostMetadata } from '@/types/blog';
import { Link } from 'react-router-dom';

const posts: PostMetadata[] = postsData as PostMetadata[];

const TagList: React.FC = () => {
  // Extract unique tags
  const tags = Array.from(new Set(posts.flatMap(p => p.tags)));

  return (
    <div>
      <h1>Tags</h1>
      <ul>
        {tags.map(tag => (
          <li key={tag}>
            <Link to={`/tags/${tag}`}>{tag}</Link>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default TagList;
