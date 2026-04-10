import React, { createContext, useContext } from 'react';
import type { SiteConfig } from './types/config';
import type { AlbumConfig } from './types/album-config';

interface SBlogContextValue {
  siteConfig: SiteConfig;
  albumConfig: AlbumConfig;
}

const SBlogContext = createContext<SBlogContextValue | null>(null);

export const SBlogProvider: React.FC<{
  siteConfig: SiteConfig;
  albumConfig: AlbumConfig;
  children: React.ReactNode;
}> = ({ siteConfig, albumConfig, children }) => {
  return (
    <SBlogContext.Provider value={{ siteConfig, albumConfig }}>
      {children}
    </SBlogContext.Provider>
  );
};

export function useSiteConfig(): SiteConfig {
  const ctx = useContext(SBlogContext);
  if (!ctx) throw new Error('useSiteConfig must be used within SBlogProvider');
  return ctx.siteConfig;
}

export function useAlbumConfig(): AlbumConfig {
  const ctx = useContext(SBlogContext);
  if (!ctx) throw new Error('useAlbumConfig must be used within SBlogProvider');
  return ctx.albumConfig;
}
