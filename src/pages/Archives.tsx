import React, { useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { format } from 'date-fns';
import { useTranslation } from 'react-i18next';
import postsData from '@/generated/manifest.json';
import type { PostMetadata } from '@/types/blog';
import PostList from '@/components/PostList';
import ArchiveSidebar from '@/components/ArchiveSidebar';

const posts: PostMetadata[] = postsData as PostMetadata[];

const Archives: React.FC = () => {
    const { t } = useTranslation();
    const { year, month } = useParams<{ year?: string; month?: string }>();

    // Filtering logic
    const filteredPosts = useMemo(() => {
        let result = posts;
        if (year) {
            result = result.filter((post) => format(new Date(post.date), 'yyyy') === year);
        }
        if (month) {
            result = result.filter((post) => format(new Date(post.date), 'MM') === month);
        }
        return result;
    }, [year, month]);

    // Title logic
    const title = useMemo(() => {
        if (year && month) return `${year}/${month}`;
        if (year) return `${year}`;
        return t('common.allArchives', 'All Archives');
    }, [year, month, t]);

    return (
        <div className="relative w-full max-w-[800px] mx-auto xl:px-0">
            {/* Content Area */}
            <div className="w-full">
                <header className="mb-8 pl-1 border-l-4 border-accent">
                    <h1 className="text-3xl font-bold m-0 pl-3 leading-none text-primary">
                        {title}
                    </h1>
                </header>

                <div className="bg-bg-secondary/30 p-4 md:p-8 rounded-lg">
                    <PostList posts={filteredPosts} variant="compact" />
                </div>
            </div>

            {/* Left Sidebar */}
            <aside className="hidden xl:block absolute top-0 -left-[300px] 2xl:-left-[360px] h-full w-[260px]">
                <div className="sticky top-[40px]">
                    <ArchiveSidebar />
                </div>
            </aside>
        </div>
    );
};

export default Archives;
