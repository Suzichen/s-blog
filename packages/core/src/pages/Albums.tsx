import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAlbums } from '../hooks/useAlbums';
import { AlbumGridSkeleton } from '../components/Skeleton';
import { useSignalReady } from '../AppReadyProvider';

const Albums: React.FC = () => {
  const { albums, loading, error } = useAlbums();
  const { t } = useTranslation();

  useSignalReady(!loading);

  if (loading) {
    return (
      <div>
        <h2 className="text-2xl font-bold mb-6">{t('albums.title')}</h2>
        <AlbumGridSkeleton />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <h2 className="text-2xl font-bold mb-4">{t('albums.title')}</h2>
        <p className="text-secondary">{error}</p>
      </div>
    );
  }

  if (albums.length === 0) {
    return (
      <div className="text-center py-12">
        <h2 className="text-2xl font-bold mb-4">{t('albums.title')}</h2>
        <p className="text-secondary">{t('albums.noAlbums')}</p>
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">{t('albums.title')}</h2>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 md:gap-6">
        {albums.map((album) => (
          <Link
            key={album.dirname}
            to={`/albums/${album.dirname}`}
            className="group block rounded-xl overflow-hidden no-underline hover:no-underline"
            style={{
              background: 'var(--color-bg-alt)',
              transition: 'transform 0.2s ease, box-shadow 0.2s ease',
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.transform = 'translateY(-4px)';
              (e.currentTarget as HTMLElement).style.boxShadow = '0 8px 24px rgba(0,0,0,0.12)';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.transform = '';
              (e.currentTarget as HTMLElement).style.boxShadow = '';
            }}
          >
            <div className="aspect-[4/3] overflow-hidden">
              {album.cover ? (
                <img
                  src={album.cover}
                  alt={album.name}
                  loading="lazy"
                  className="w-full h-full object-cover"
                  style={{ transition: 'transform 0.3s ease' }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLElement).style.transform = 'scale(1.05)';
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.transform = '';
                  }}
                />
              ) : (
                <div
                  className="w-full h-full flex items-center justify-center text-4xl"
                  style={{ background: 'var(--color-border)', color: 'var(--color-secondary)' }}
                >
                  📷
                </div>
              )}
            </div>
            <div className="p-3 md:p-4">
              <h3
                className="text-sm md:text-base font-medium m-0"
                style={{ color: 'var(--color-primary)' }}
              >
                {album.name}
              </h3>
              <span
                className="text-xs mt-1 inline-block"
                style={{ color: 'var(--color-secondary)' }}
              >
                {t('albums.photoCount', { count: album.photoCount })}
              </span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
};

export default Albums;
