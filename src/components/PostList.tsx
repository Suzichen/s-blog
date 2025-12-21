import React from 'react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { useTranslation } from 'react-i18next';
import type { PostMetadata } from '@/types/blog';

interface PostListProps {
    posts: PostMetadata[];
}

const PostList: React.FC<PostListProps> = ({ posts }) => {
    const { t } = useTranslation();

    if (posts.length === 0) {
        return <div className="text-secondary">{t('common.noPosts', 'No posts found.')}</div>;
    }

    return (
        <ul className="list-none p-0">
            {posts.map((post) => (
                <li key={post.slug} className="mb-12">
                    <h2 className="m-0 mb-2 text-2xl font-bold">
                        <Link to={`/post/${post.slug}`} className="text-primary hover:text-accent no-underline hover:underline">
                            {post.title}
                        </Link>
                    </h2>
                    <div className="text-sm text-secondary mb-4">
                        <span>{format(new Date(post.date), 'MMMM dd, yyyy')}</span>
                        {post.categories.length > 0 && (
                            <span> | {post.categories.join(', ')}</span>
                        )}
                    </div>
                    <p className="text-primary leading-relaxed">{post.summary}</p>
                    <Link to={`/post/${post.slug}`} className="inline-block mt-2 text-sm font-medium text-accent hover:underline">
                        {t('common.readMore')} &rarr;
                    </Link>
                </li>
            ))}
        </ul>
    );
};

export default PostList;
