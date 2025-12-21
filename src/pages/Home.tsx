import React from 'react';
import postsData from '@/generated/manifest.json';
import type { PostMetadata } from '@/types/blog';
import PostList from '@/components/PostList';
import Sidebar from '@/components/Sidebar';

const posts: PostMetadata[] = postsData as PostMetadata[];

const Home: React.FC = () => {
  return (
    <div className="relative w-full max-w-[800px] mx-auto xl:px-0">
      <div className="w-full">
        <PostList posts={posts} />
      </div>

      <aside className="hidden xl:block absolute top-0 -left-[300px] 2xl:-left-[360px] h-full w-[260px]">
        <div className="sticky top-[40px]">
          <Sidebar />
        </div>
      </aside>
    </div>
  );
};

export default Home;
