import { useState, useEffect } from 'react';
import type { AlbumDetail } from '../types/album';

interface UseAlbumResult {
  album: AlbumDetail | null;
  loading: boolean;
  error: string | null;
}

export function useAlbum(dirname: string): UseAlbumResult {
  const [album, setAlbum] = useState<AlbumDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchAlbum() {
      try {
        setLoading(true);
        setError(null);
        const response = await fetch(`/generated/album-${dirname}.json`, { cache: 'no-cache' });
        if (!response.ok) {
          throw new Error(`Failed to load album "${dirname}": ${response.status}`);
        }
        const data: AlbumDetail = await response.json();
        if (!cancelled) {
          setAlbum(data);
          setLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load album');
          setLoading(false);
        }
      }
    }

    fetchAlbum();
    return () => { cancelled = true; };
  }, [dirname]);

  return { album, loading, error };
}
