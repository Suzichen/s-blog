import { useState, useEffect, useCallback, useRef } from 'react';
import { useMemoConfig } from '../context';
import { fetchEchos, type Ech0Item } from '../services/ech0';

export function useMemos() {
  const { serverUrl, pageSize = 20, provider } = useMemoConfig();
  const [memos, setMemos] = useState<Ech0Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const pageRef = useRef(1);

  const load = useCallback(async (page: number) => {
    if (provider !== 'ech0') {
      setError(`Unsupported memo provider: "${provider}". Only "ech0" is currently supported.`);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await fetchEchos(serverUrl, { page, pageSize });
      setMemos(prev => {
        const next = page === 1 ? result.items : [...prev, ...result.items];
        setHasMore(next.length < result.total);
        return next;
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [serverUrl, pageSize, provider]);

  useEffect(() => {
    pageRef.current = 1;
    load(1);
  }, [load]);

  const loadMore = useCallback(() => {
    if (loading || !hasMore) return;
    pageRef.current += 1;
    load(pageRef.current);
  }, [loading, hasMore, load]);

  return { memos, loading, hasMore, error, loadMore };
}
