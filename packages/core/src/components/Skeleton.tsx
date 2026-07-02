import React from 'react';

/**
 * Base skeleton block — a pulsing placeholder rectangle.
 */
const SkeletonBlock: React.FC<{ className?: string; style?: React.CSSProperties }> = ({ className = '', style }) => (
  <div
    className={`rounded animate-skeleton-pulse ${className}`}
    style={{ background: 'var(--color-border)', ...style }}
  />
);

/**
 * Post list skeleton — mimics the PostList default variant (title + meta + summary + readMore).
 */
export const PostListSkeleton: React.FC<{ count?: number }> = ({ count = 3 }) => (
  <ul className="list-none p-0">
    {Array.from({ length: count }).map((_, i) => (
      <li key={i} className="mb-12">
        {/* Title */}
        <SkeletonBlock className="h-7 w-3/4 mb-3" />
        {/* Meta line */}
        <div className="flex gap-3 mb-4">
          <SkeletonBlock className="h-4 w-32" />
          <SkeletonBlock className="h-4 w-24" />
        </div>
        {/* Summary lines */}
        <SkeletonBlock className="h-4 w-full mb-2" />
        <SkeletonBlock className="h-4 w-5/6 mb-2" />
        <SkeletonBlock className="h-4 w-2/3" />
        {/* Read more */}
        <SkeletonBlock className="h-4 w-24 mt-4" />
      </li>
    ))}
  </ul>
);

/**
 * Compact list skeleton — mimics the PostList compact variant (date + title per row).
 */
export const CompactListSkeleton: React.FC<{ count?: number }> = ({ count = 8 }) => (
  <ul className="list-none p-0">
    {Array.from({ length: count }).map((_, i) => (
      <li key={i} className="mb-4 pb-4 border-b border-border last:border-0 flex flex-col md:flex-row md:items-center gap-2 md:gap-8">
        <SkeletonBlock className="h-4 w-24" />
        <SkeletonBlock className="h-5 w-48 md:w-64" />
      </li>
    ))}
  </ul>
);

/**
 * Article skeleton — mimics a full post detail page (title + meta + content paragraphs).
 */
export const ArticleSkeleton: React.FC = () => (
  <div className="w-full max-w-[800px] mx-auto pb-8 px-2 md:px-4 xl:px-0">
    {/* Header */}
    <div className="mb-8 text-center">
      <SkeletonBlock className="h-10 md:h-12 w-3/4 mx-auto mb-3" />
      <div className="flex justify-center gap-4">
        <SkeletonBlock className="h-4 w-32" />
        <SkeletonBlock className="h-4 w-24" />
      </div>
    </div>
    {/* Content blocks */}
    <div className="space-y-6">
      {/* Paragraph 1 */}
      <div className="space-y-2">
        <SkeletonBlock className="h-4 w-full" />
        <SkeletonBlock className="h-4 w-full" />
        <SkeletonBlock className="h-4 w-4/5" />
      </div>
      {/* Heading */}
      <SkeletonBlock className="h-6 w-2/5 mt-4" />
      {/* Paragraph 2 */}
      <div className="space-y-2">
        <SkeletonBlock className="h-4 w-full" />
        <SkeletonBlock className="h-4 w-full" />
        <SkeletonBlock className="h-4 w-3/4" />
      </div>
      {/* Code block placeholder */}
      <SkeletonBlock className="h-32 w-full rounded-lg" />
      {/* Paragraph 3 */}
      <div className="space-y-2">
        <SkeletonBlock className="h-4 w-full" />
        <SkeletonBlock className="h-4 w-5/6" />
        <SkeletonBlock className="h-4 w-2/3" />
      </div>
    </div>
  </div>
);

/**
 * Timeline skeleton — mimics the Memo timeline (dot + card blocks).
 */
export const TimelineSkeleton: React.FC<{ count?: number }> = ({ count = 4 }) => (
  <div className="ml-1">
    {Array.from({ length: count }).map((_, i) => (
      <div key={i} className="relative pl-6 md:pl-8 pb-8 border-l-2 border-border last:border-l-0 last:pb-0">
        <div className="absolute -left-[5px] top-1 w-2 h-2 rounded-full bg-border" />
        <div className="bg-bg-alt rounded-lg p-4">
          {/* Content lines */}
          <SkeletonBlock className="h-4 w-full mb-2" />
          <SkeletonBlock className="h-4 w-4/5 mb-2" />
          <SkeletonBlock className="h-4 w-3/5" />
          {/* Time */}
          <SkeletonBlock className="h-3 w-20 mt-3" />
        </div>
      </div>
    ))}
  </div>
);

/**
 * Album grid skeleton — mimics album grid cards (cover + name).
 */
export const AlbumGridSkeleton: React.FC<{ count?: number }> = ({ count = 6 }) => (
  <div className="grid grid-cols-2 md:grid-cols-3 gap-4 md:gap-6">
    {Array.from({ length: count }).map((_, i) => (
      <div key={i} className="rounded-xl overflow-hidden bg-bg-alt animate-skeleton-pulse">
        <div className="aspect-[4/3]" />
        <div className="p-3">
          <SkeletonBlock className="h-4 w-3/5" />
        </div>
      </div>
    ))}
  </div>
);

/**
 * Photo grid skeleton — mimics album detail photo grid.
 */
export const PhotoGridSkeleton: React.FC<{ count?: number }> = ({ count = 12 }) => (
  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4">
    {Array.from({ length: count }).map((_, i) => (
      <SkeletonBlock
        key={i}
        className="aspect-square rounded-lg"
        style={{ animationDelay: `${i * 100}ms` } as React.CSSProperties}
      />
    ))}
  </div>
);

/**
 * Full-page skeleton — mimics the pre-JS app shell skeleton (3 post-like blocks).
 */
export const PageSkeleton: React.FC = () => (
  <div className="w-full max-w-[800px] mx-auto py-8 px-4">
    <div className="space-y-10">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="space-y-3">
          <SkeletonBlock className="h-6 w-2/3" />
          <SkeletonBlock className="h-4 w-2/5" />
          <SkeletonBlock className="h-4 w-full" />
          <SkeletonBlock className="h-4 w-5/6" />
        </div>
      ))}
    </div>
  </div>
);

export default SkeletonBlock;
