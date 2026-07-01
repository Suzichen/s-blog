import React from 'react';
import { SpageProvider } from './context';
import App from './App';
import './i18n';
import './styles/index.css';

import type { SiteConfig } from './types/config';
import type { AlbumConfig } from './types/album-config';
import type { MemoConfig } from './types/memo-config';

const DEFAULT_MEMO_CONFIG: MemoConfig = { enabled: false, provider: 'ech0', serverUrl: '' };

export interface SpageAppProps {
  siteConfig: SiteConfig;
  albumConfig: AlbumConfig;
  memoConfig?: MemoConfig;
}

/**
 * The top-level spage application component.
 * Wraps all internal routing, i18n, and layout with the provided site/album config.
 */
export const SpageApp: React.FC<SpageAppProps> = ({ siteConfig, albumConfig, memoConfig = DEFAULT_MEMO_CONFIG }) => {
  return (
    <SpageProvider siteConfig={siteConfig} albumConfig={albumConfig} memoConfig={memoConfig}>
      <App />
    </SpageProvider>
  );
};

// Re-export types for user projects
export type { SiteConfig } from './types/config';
export type { AlbumConfig, AlbumEntry } from './types/album-config';
export type { MemoConfig } from './types/memo-config';
export { useMemoConfig } from './context';
