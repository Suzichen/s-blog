import React, { createContext, useContext } from 'react';
import type { SiteConfig } from './types/config';
import type { AlbumConfig } from './types/album-config';
import type { MemoConfig } from './types/memo-config';

interface SpageContextValue {
  siteConfig: SiteConfig;
  albumConfig: AlbumConfig;
  memoConfig: MemoConfig;
}

const SpageContext = createContext<SpageContextValue | null>(null);

export const SpageProvider: React.FC<{
  siteConfig: SiteConfig;
  albumConfig: AlbumConfig;
  memoConfig: MemoConfig;
  children: React.ReactNode;
}> = ({ siteConfig, albumConfig, memoConfig, children }) => {
  return (
    <SpageContext.Provider value={{ siteConfig, albumConfig, memoConfig }}>
      {children}
    </SpageContext.Provider>
  );
};

export function useSiteConfig(): SiteConfig {
  const ctx = useContext(SpageContext);
  if (!ctx) throw new Error('useSiteConfig must be used within SpageProvider');
  return ctx.siteConfig;
}

export function useAlbumConfig(): AlbumConfig {
  const ctx = useContext(SpageContext);
  if (!ctx) throw new Error('useAlbumConfig must be used within SpageProvider');
  return ctx.albumConfig;
}

export function useMemoConfig(): MemoConfig {
  const ctx = useContext(SpageContext);
  if (!ctx) throw new Error('useMemoConfig must be used within SpageProvider');
  return ctx.memoConfig;
}
