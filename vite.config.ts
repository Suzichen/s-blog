
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [
      // The manifest.json and other generated data come from root's src/generated/
      { find: '@/generated', replacement: path.resolve(__dirname, './src/generated') },
      // All other @ imports resolve to core package source code
      { find: '@', replacement: path.resolve(__dirname, './packages/core/src') },
      // Resolve @s-blog/core to the core package source for dev
      { find: '@s-blog/core', replacement: path.resolve(__dirname, './packages/core/src/index.tsx') },
    ],
  },
});
