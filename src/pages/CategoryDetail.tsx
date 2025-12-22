import React from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import postsData from '@/generated/manifest.json';
import type { PostMetadata } from '@/types/blog';
import PostList from '@/components/PostList';
import Sidebar from '@/components/Sidebar';

const posts: PostMetadata[] = postsData as PostMetadata[];

const CategoryDetail: React.FC = () => {
    const { t } = useTranslation();
    const { category } = useParams<{ category: string }>();

    const filteredPosts = posts.filter((post) =>
        post.categories.some((c) => c.toLowerCase() === category?.toLowerCase())
    );

    return (
        <div className="relative w-full max-w-[800px] mx-auto xl:px-0">
            <div className="w-full">
                <header className="mb-12 text-center">
                    <span className="text-secondary text-sm uppercase tracking-wider block mb-2">{t('common.categories', 'Category')}</span>
                    <h1 className="text-4xl md:text-5xl font-bold m-0 relative inline-block">
                        {category}
                        <span className="absolute -bottom-2 left-1/4 right-1/4 h-1 bg-accent opacity-50 rounded-full"></span>
                    </h1>
                </header>
                <PostList posts={filteredPosts} />
            </div>

            <aside className="hidden xl:block absolute top-0 -left-[300px] 2xl:-left-[360px] h-full w-[260px]">
                <div className="sticky top-[40px]">
                    <Sidebar />
                </div>
            </aside>
        </div>
    );
};

export default CategoryDetail;
