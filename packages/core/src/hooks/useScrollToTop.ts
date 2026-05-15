import { useEffect, useRef } from 'react';
import { useLocation, useNavigationType } from 'react-router-dom';

const STORAGE_KEY = 'scroll-positions';

const isReload = (() => {
  const entries = performance.getEntriesByType('navigation') as PerformanceNavigationTiming[];
  return entries.length > 0 && entries[0].type === 'reload';
})();

// Clear saved positions on reload so they don't interfere
if (isReload) {
  sessionStorage.removeItem(STORAGE_KEY);
}

function getScrollMap(): Record<string, number> {
  try {
    return JSON.parse(sessionStorage.getItem(STORAGE_KEY) || '{}');
  } catch { return {}; }
}

function saveScroll(key: string, y: number) {
  const map = getScrollMap();
  map[key] = y;
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(map));
}

export function useScrollToTop() {
  const { pathname, hash, key } = useLocation();
  const action = useNavigationType();
  const keyRef = useRef(key);
  const scrollRef = useRef(0);

  // Track scroll position continuously
  useEffect(() => {
    const onScroll = () => { scrollRef.current = window.scrollY; };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // When key changes, save the scroll position of the PREVIOUS key
  useEffect(() => {
    if (keyRef.current !== key && keyRef.current !== 'default') {
      saveScroll(keyRef.current, scrollRef.current);
    }
    keyRef.current = key;
  }, [key]);

  // Handle scroll-to-top for PUSH/REPLACE
  useEffect(() => {
    if (action !== 'POP' && !hash) {
      window.scrollTo(0, 0);
    }
  }, [action, pathname, hash]);
}

export function restoreScrollForKey(key: string): boolean {
  if (key === 'default') return false;
  const map = getScrollMap();
  const y = map[key];
  if (y != null && y > 0) {
    requestAnimationFrame(() => window.scrollTo(0, y));
    return true;
  }
  return false;
}
