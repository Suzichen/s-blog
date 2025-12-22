import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import postsData from '@/generated/manifest.json';
import type { PostMetadata } from '@/types/blog';

const posts: PostMetadata[] = postsData as PostMetadata[];

interface SearchOverlayProps {
    isOpen: boolean;
    onClose: () => void;
}

const SearchOverlay: React.FC<SearchOverlayProps> = ({ isOpen, onClose }) => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const [query, setQuery] = useState('');
    const inputRef = useRef<HTMLInputElement>(null);
    const [results, setResults] = useState<PostMetadata[]>([]);

    // Focus input when opened
    useEffect(() => {
        if (isOpen) {
            setTimeout(() => {
                inputRef.current?.focus();
            }, 100);
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
        return () => {
            document.body.style.overflow = '';
        };
    }, [isOpen]);

    // Handle ESC key
    useEffect(() => {
        const handleEsc = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', handleEsc);
        return () => window.removeEventListener('keydown', handleEsc);
    }, [onClose]);

    // Search Logic
    useEffect(() => {
        if (!query.trim()) {
            setResults([]);
            return;
        }
        const lowerQuery = query.toLowerCase();
        const filtered = posts.filter(post =>
            post.title.toLowerCase().includes(lowerQuery) ||
            post.summary.toLowerCase().includes(lowerQuery) ||
            post.tags.some(tag => tag.toLowerCase().includes(lowerQuery))
        );
        setResults(filtered);
    }, [query]);

    // Navigate and Close
    const handleNavigation = (slug: string) => {
        navigate(`/post/${slug}`);
        onClose();
        setQuery('');
    };

    if (!isOpen) return null;

    return (
        <div
            className="fixed inset-0 z-50 bg-bg/98 backdrop-blur-sm flex flex-col pt-[100px] items-center animate-in fade-in duration-200"
            onClick={onClose}
        >
            <div
                className="w-full max-w-[800px] px-4 md:px-8"
                onClick={e => e.stopPropagation()}
            >
                <input
                    ref={inputRef}
                    type="text"
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                    placeholder={t('common.searchPlaceholder', 'Type to search...')}
                    className="w-full text-4xl md:text-5xl font-light bg-transparent border-b-2 border-border focus:border-accent outline-none py-4 text-primary placeholder-secondary/50"
                />

                <div className="mt-8 max-h-[60vh] overflow-y-auto custom-scrollbar">
                    {results.length > 0 ? (
                        <div className="flex flex-col gap-4">
                            {results.map(post => (
                                <div
                                    key={post.slug}
                                    onClick={() => handleNavigation(post.slug)}
                                    className="cursor-pointer group py-2"
                                >
                                    <div className="text-secondary text-sm mb-1">
                                        {format(new Date(post.date), 'yyyy-MM-dd')}
                                    </div>
                                    <h3 className="text-2xl font-bold group-hover:text-accent transition-colors">
                                        {post.title}
                                    </h3>
                                </div>
                            ))}
                        </div>
                    ) : (
                        query && (
                            <div className="text-secondary text-lg mt-8 text-center">
                                {t('common.noResults', 'No matching posts found.')}
                            </div>
                        )
                    )}
                </div>
            </div>
        </div>
    );
};

export default SearchOverlay;
