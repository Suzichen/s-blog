import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import postsData from '@/generated/manifest.json';
import type { PostMetadata } from '@/types/blog';

const posts: PostMetadata[] = postsData as PostMetadata[];

const Sidebar: React.FC = () => {
    const { t } = useTranslation();

    const categories = useMemo(() => {
        const counts: Record<string, number> = {};
        posts.forEach((post) => {
            post.categories.forEach((category) => {
                counts[category] = (counts[category] || 0) + 1;
            });
        });
        return Object.entries(counts).sort((a, b) => b[1] - a[1]);
    }, []);

    const tags = useMemo(() => {
        const counts: Record<string, number> = {};
        posts.forEach((post) => {
            post.tags.forEach((tag) => {
                counts[tag] = (counts[tag] || 0) + 1;
            });
        });
        return Object.entries(counts).sort((a, b) => b[1] - a[1]);
    }, []);

    return (
        <div className="flex flex-col gap-8">
            {/* Categories Module */}
            <section>
                <h3 className="text-sm uppercase tracking-wider font-bold text-secondary mb-4 pb-2 border-b border-border">
                    {t('common.categories', 'Categories')}
                </h3>
                <ul className="list-none p-0 m-0">
                    {categories.map(([category, count]) => (
                        <li key={category} className="mb-2">
                            <Link
                                to={`/categories/${category}`}
                                className="flex items-center justify-between text-primary hover:text-accent group no-underline"
                            >
                                <span>{category}</span>
                                <span className="text-secondary text-xs bg-bg-secondary px-2 py-0.5 rounded-full group-hover:text-accent transition-colors">
                                    {count}
                                </span>
                            </Link>
                        </li>
                    ))}
                </ul>
            </section>

            {/* Tags Module */}
            <section>
                <h3 className="text-sm uppercase tracking-wider font-bold text-secondary mb-4 pb-2 border-b border-border">
                    {t('common.tags', 'Tags')}
                </h3>
                <div className="flex flex-wrap gap-2">
                    {tags.map(([tag]) => (
                        <Link
                            key={tag}
                            to={`/tags/${tag}`}
                            className="text-sm text-secondary hover:text-accent bg-bg-secondary px-3 py-1 rounded hover:bg-bg-secondary-hover transition-colors no-underline"
                        >
                            #{tag}
                        </Link>
                    ))}
                </div>
            </section>
        </div>
    );
};

export default Sidebar;
