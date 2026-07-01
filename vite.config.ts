import { defineConfig, Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs';

// Plugin to serve albums and posts directly from the project root during development
function serveSpageData(): Plugin {
  return {
    name: 'serve-spage-data',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url && (req.url.startsWith('/albums/') || req.url.startsWith('/posts/'))) {
          const cwd = process.cwd();
          const requestPath = decodeURIComponent(req.url.split('?')[0]);
          const localPath = path.join(cwd, requestPath);
          
          // Security check: Prevent path traversal (e.g., /albums/../../etc/passwd)
          // Also, Vite's server.fs.allow defaults to workspace root, so this is generally safe.
          if (localPath.startsWith(cwd) && fs.existsSync(localPath) && fs.statSync(localPath).isFile()) {
            req.url = '/@fs/' + localPath.replace(/\\/g, '/');
          }
        }
        next();
      });
    }
  };
}

export default defineConfig({
  plugins: [react(), serveSpageData()],
  resolve: {
    alias: {
      '@s-blog/core/style.css': path.resolve(__dirname, 'packages/core/dist/index.css'),
      '@s-blog/core': path.resolve(__dirname, 'packages/core/src/index.tsx'),
      '@': path.resolve(__dirname, 'packages/core/src'),
    },
  },
});
