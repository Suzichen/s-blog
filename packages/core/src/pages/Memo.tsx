import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useMemoConfig } from '../context';
import { useMemos } from '../hooks/useMemos';
import type { Ech0Comment, Ech0Item } from '../services/ech0';
import { fetchEch0Comments, fetchGitHubRepo, type GitHubRepoData } from '../services/ech0';
import PhotoViewer from '../components/PhotoViewer';
import type { PhotoItem } from '../types/album';

function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp * 1000;
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const date = new Date(timestamp * 1000);
  return date.toLocaleDateString();
}

const WebsiteCard: React.FC<{ site: string; title?: string }> = ({ site, title }) => (
  <a href={site} target="_blank" rel="noopener noreferrer" className="mt-3 block rounded border border-border overflow-hidden hover:border-primary transition-colors no-underline">
    <div className="px-3 py-1.5 bg-border/30 text-xs text-secondary flex items-center gap-1.5">
      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
      {title || 'Website'}
    </div>
    <div className="px-3 py-2 text-xs text-secondary truncate">{site}</div>
  </a>
);

const GitHubCard: React.FC<{ repoUrl: string }> = ({ repoUrl }) => {
  const [data, setData] = useState<GitHubRepoData | null>(null);
  useEffect(() => { fetchGitHubRepo(repoUrl).then(setData); }, [repoUrl]);

  const parts = repoUrl.replace(/\/$/, '').split('/').filter(Boolean);
  const fallbackName = parts[parts.length - 1] || 'Repository';

  return (
    <a href={repoUrl} target="_blank" rel="noopener noreferrer" className="mt-3 block rounded border border-border overflow-hidden hover:border-primary transition-colors no-underline">
      <div className="px-3 py-1.5 bg-border/30 text-xs text-secondary flex items-center gap-1.5">
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/></svg>
        GitHub
      </div>
      <div className="p-3 flex items-center gap-3">
        {data?.owner?.avatar_url ? (
          <img src={data.owner.avatar_url} alt="" className="w-10 h-10 rounded-full flex-shrink-0" />
        ) : (
          <div className="w-10 h-10 rounded-full bg-border flex-shrink-0" />
        )}
        <div className="min-w-0 flex-1">
          <div className="font-bold text-sm text-primary truncate">{data?.name || fallbackName}</div>
          {data?.description && <p className="text-xs text-secondary mt-0.5 line-clamp-2 m-0">{data.description}</p>}
          {data && (
            <div className="flex items-center gap-3 mt-1.5 text-xs text-secondary">
              <span className="flex items-center gap-1">⭐ {data.stargazers_count}</span>
              <span className="flex items-center gap-1">🍴 {data.forks_count}</span>
            </div>
          )}
        </div>
      </div>
    </a>
  );
};

const MemoCard: React.FC<{ item: Ech0Item; comments: Ech0Comment[]; onImageClick: (photos: PhotoItem[], index: number) => void }> = ({ item, comments, onImageClick }) => {
  const { serverUrl } = useMemoConfig();
  const resolveUrl = (url: string) => url.startsWith('http') ? url : `${serverUrl.replace(/\/$/, '')}${url}`;
  const photos: PhotoItem[] = (item.echo_files || []).map(f => ({
    filename: f.file.id,
    thumbnailUrl: resolveUrl(f.file.url),
    originalUrl: resolveUrl(f.file.url),
    exif: { cameraMake: null, cameraModel: null, focalLength: null, aperture: null, shutterSpeed: null, iso: null },
  }));

  return (
    <div className="relative pl-6 md:pl-8 pb-8 border-l-2 border-border last:border-l-0 last:pb-0">
      <div className="absolute -left-[5px] top-1 w-2 h-2 rounded-full bg-primary" />
      <div className="bg-bg-alt rounded-lg p-4 shadow-sm">
        <p className="text-secondary whitespace-pre-wrap break-words m-0">{item.content}</p>

        {photos.length > 0 && (
          <div className="mt-3 grid grid-cols-3 gap-2">
            {photos.map((photo, idx) => (
              <button key={photo.filename} onClick={() => onImageClick(photos, idx)} className="cursor-pointer border-0 p-0 bg-transparent">
                <img src={photo.thumbnailUrl} alt="" className="w-full aspect-square object-cover rounded" loading="lazy" />
              </button>
            ))}
          </div>
        )}

        {item.extension?.type === 'GITHUBPROJ' && item.extension.payload.repoUrl && (
          <GitHubCard repoUrl={item.extension.payload.repoUrl} />
        )}

        {item.extension?.type === 'WEBSITE' && item.extension.payload.site && (
          <WebsiteCard site={item.extension.payload.site} title={item.extension.payload.title} />
        )}

        {item.tags?.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {item.tags.map(tag => (
              <span key={tag.id} className="text-xs px-2 py-0.5 rounded-full bg-border text-secondary">#{tag.name}</span>
            ))}
          </div>
        )}

        <div className="mt-3 flex items-center gap-3 text-xs text-secondary">
          <time>{formatRelativeTime(item.created_at)}</time>
          {item.fav_count > 0 && (
            <span className="flex items-center gap-1">
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="currentColor" stroke="none">
                <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
              </svg>
              {item.fav_count}
            </span>
          )}
        </div>

        {comments.length > 0 && (
          <div className="mt-4 pt-3 border-t border-border/70 space-y-2.5">
            {comments.map(comment => (
              <div key={comment.id} className="rounded bg-bg px-3 py-2">
                <div className="flex items-center justify-between gap-2 text-xs text-secondary">
                  <span className="font-medium">{comment.nickname}</span>
                  <time>{formatRelativeTime(comment.created_at)}</time>
                </div>
                <p className="mt-1 text-sm text-secondary whitespace-pre-wrap break-words m-0">{comment.content}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

const Memo: React.FC = () => {
  const { t } = useTranslation();
  const memoConfig = useMemoConfig();
  const { memos, loading, hasMore, error, loadMore } = useMemos();
  const [viewer, setViewer] = useState<{ photos: PhotoItem[]; index: number } | null>(null);
  const [commentsByMemoId, setCommentsByMemoId] = useState<Record<string, Ech0Comment[]>>({});

  useEffect(() => {
    const missingIds = memos
      .map(memo => memo.id)
      .filter(id => !Object.prototype.hasOwnProperty.call(commentsByMemoId, id));

    if (missingIds.length === 0) {
      return;
    }

    let cancelled = false;

    Promise.all(
      missingIds.map(async (id) => {
        try {
          const comments = await fetchEch0Comments(memoConfig.serverUrl, id);
          return { id, comments };
        } catch {
          return { id, comments: [] as Ech0Comment[] };
        }
      })
    ).then((results) => {
      if (cancelled) return;
      setCommentsByMemoId((prev) => {
        const next = { ...prev };
        for (const { id, comments } of results) {
          next[id] = comments;
        }
        return next;
      });
    });

    return () => {
      cancelled = true;
    };
  }, [memos, commentsByMemoId, memoConfig.serverUrl]);

  const title = memoConfig.title || t('nav.memo');
  const isInitialLoad = loading && memos.length === 0;

  return (
    <div className="w-full max-w-[800px] mx-auto">
      <h2 className="text-2xl font-light mb-8 text-primary">{title}</h2>

      {error && memos.length === 0 && (
        <div className="text-center py-12">
          <p className="text-secondary mb-4">{t('memo.error')}</p>
          <button onClick={loadMore} className="text-sm px-4 py-2 border border-border rounded hover:bg-border transition-colors">
            {t('memo.retry')}
          </button>
        </div>
      )}

      {isInitialLoad && !error && (
        <div className="text-center py-12 text-secondary">{t('common.loading')}</div>
      )}

      {!loading && !error && memos.length === 0 && (
        <div className="text-center py-12 text-secondary">{t('memo.noMemos')}</div>
      )}

      {memos.length > 0 && (
        <div className="ml-1">
          {memos.map(item => (
            <MemoCard
              key={item.id}
              item={item}
              comments={commentsByMemoId[item.id] || []}
              onImageClick={(photos, index) => setViewer({ photos, index })}
            />
          ))}
        </div>
      )}

      {hasMore && memos.length > 0 && (
        <div className="text-center mt-8 mb-4">
          <button
            onClick={loadMore}
            disabled={loading}
            className="text-sm px-6 py-2 border border-border rounded hover:bg-border transition-colors disabled:opacity-50"
          >
            {loading ? (
              <span className="inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
            ) : (
              t('memo.loadMore')
            )}
          </button>
        </div>
      )}

      {viewer && (
        <PhotoViewer photos={viewer.photos} initialIndex={viewer.index} onClose={() => setViewer(null)} />
      )}
    </div>
  );
};

export default Memo;
