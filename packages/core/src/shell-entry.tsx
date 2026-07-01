/**
 * Shell Entry Point
 * 
 * This is the entry point for the pre-compiled App Shell.
 * It uses RuntimeConfigLoader to fetch configuration at runtime,
 * then initializes the SpageApp with the loaded configurations.
 * 
 * This file is built by vite.shell.config.ts and produces a complete
 * static website that can be deployed without any build tools.
 */
import React from 'react';
import { createRoot } from 'react-dom/client';
import { RuntimeConfigLoader, type RuntimeSiteConfig } from './RuntimeConfigLoader';
import { SpageApp } from './index';
import type { AlbumConfig } from './types/album-config';
import type { MemoConfig } from './types/memo-config';

/**
 * ShellApp - The root component for the App Shell
 * 
 * Wraps SpageApp with RuntimeConfigLoader to enable runtime configuration loading.
 * The basePath from config is used to configure routing for subdirectory deployment.
 */
const ShellApp: React.FC = () => {
  return (
    <RuntimeConfigLoader>
      {(siteConfig: RuntimeSiteConfig, albumConfig: AlbumConfig, memoConfig: MemoConfig) => (
        <SpageApp siteConfig={siteConfig} albumConfig={albumConfig} memoConfig={memoConfig} />
      )}
    </RuntimeConfigLoader>
  );
};

// Mount the application
const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Root element not found. Please ensure your HTML has an element with id="root".');
}

const root = createRoot(rootElement);
root.render(
  <React.StrictMode>
    <ShellApp />
  </React.StrictMode>
);
