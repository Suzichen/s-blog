import React from 'react';
import { SBlogProvider } from './context';
import App from './App';
import './i18n';
import './styles/index.css';

import type { SiteConfig } from './types/config';
import type { AlbumConfig } from './types/album-config';

export interface SBlogAppProps {
  siteConfig: SiteConfig;
  albumConfig: AlbumConfig;
}

/**
 * The top-level S-blog application component.
 * Wraps all internal routing, i18n, and layout with the provided site/album config.
 */
export const SBlogApp: React.FC<SBlogAppProps> = ({ siteConfig, albumConfig }) => {
  return (
    <SBlogProvider siteConfig={siteConfig} albumConfig={albumConfig}>
      <App />
    </SBlogProvider>
  );
};

// Re-export types for user projects
export type { SiteConfig } from './types/config';
export type { AlbumConfig, AlbumEntry } from './types/album-config';
