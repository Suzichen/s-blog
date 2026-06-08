import React from 'react';
import { SBlogProvider } from './context';
import App from './App';
import './i18n';
import './styles/index.css';

import type { SiteConfig } from './types/config';
import type { AlbumConfig } from './types/album-config';
import type { MemoConfig } from './types/memo-config';

const DEFAULT_MEMO_CONFIG: MemoConfig = { enabled: false, provider: 'ech0', serverUrl: '' };

export interface SBlogAppProps {
  siteConfig: SiteConfig;
  albumConfig: AlbumConfig;
  memoConfig?: MemoConfig;
}

/**
 * The top-level S-blog application component.
 * Wraps all internal routing, i18n, and layout with the provided site/album config.
 */
export const SBlogApp: React.FC<SBlogAppProps> = ({ siteConfig, albumConfig, memoConfig = DEFAULT_MEMO_CONFIG }) => {
  return (
    <SBlogProvider siteConfig={siteConfig} albumConfig={albumConfig} memoConfig={memoConfig}>
      <App />
    </SBlogProvider>
  );
};

// Re-export types for user projects
export type { SiteConfig } from './types/config';
export type { AlbumConfig, AlbumEntry } from './types/album-config';
export type { MemoConfig } from './types/memo-config';
export { useMemoConfig } from './context';
