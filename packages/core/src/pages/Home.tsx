import React from 'react';
import { useParams, Navigate } from 'react-router-dom';
import { usePosts } from '@/hooks/usePosts';
import PostList from '@/components/PostList';
import Pagination from '@/components/Pagination';
import Sidebar from '@/components/Sidebar';
import RightSidebar from '@/components/RightSidebar';

const POSTS_PER_PAGE = 10;

const Home: React.FC = () => {
  const { posts, loading } = usePosts();
  const { pageNum } = useParams<{ pageNum?: string }>();

  const currentPage = pageNum ? parseInt(pageNum, 10) : 1;
  const totalPages = Math.ceil(posts.length / POSTS_PER_PAGE);

  if (loading) {
    return <div className="w-full max-w-[800px] mx-auto py-8 text-center text-secondary">Loading...</div>;
  }

  if (isNaN(currentPage) || currentPage < 1 || (totalPages > 0 && currentPage > totalPages)) {
    return <Navigate to="/" replace />;
  }

  const startIndex = (currentPage - 1) * POSTS_PER_PAGE;
  const pagePosts = posts.slice(startIndex, startIndex + POSTS_PER_PAGE);

  return (
    <div className="relative w-full max-w-[800px] mx-auto xl:px-0">
      <div className="w-full">
        <PostList posts={pagePosts} />
        <Pagination currentPage={currentPage} totalPages={totalPages} />
      </div>

      <aside className="hidden xl:block absolute top-0 -left-[300px] 2xl:-left-[360px] h-full w-[260px]">
        <div className="sticky top-[40px]">
          <Sidebar />
        </div>
      </aside>

      <aside className="hidden xl:block absolute top-0 -right-[300px] 2xl:-right-[360px] h-full w-[260px]">
        <div className="sticky top-[40px]">
          <RightSidebar />
        </div>
      </aside>
    </div>
  );
};

export default Home;
