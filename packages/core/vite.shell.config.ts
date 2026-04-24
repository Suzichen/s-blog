/**
 * Vite Shell Build Configuration
 * 
 * This configuration builds the App Shell - a complete static website
 * that can be deployed without any build tools. The shell loads
 * configuration at runtime via fetch().
 * 
 * Output: dist/shell/
 *   - index.html
 *   - assets/*.js
 *   - assets/*.css
 * 
 * Usage: vite build --config vite.shell.config.ts
 */
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  
  // Use relative paths to support deployment to any location
  // This allows the shell to work in subdirectories (e.g., /blog/)
  base: './',
  
  build: {
    // Output to dist/shell directory
    outDir: 'dist/shell',
    
    // Clean the output directory before building
    emptyOutDir: true,
    
    rollupOptions: {
      // Use shell-entry.tsx as the entry point
      input: {
        main: path.resolve(__dirname, 'index.html'),
      },
    },
    
    // Generate source maps for debugging
    sourcemap: false,
    
    // Optimize chunk size
    chunkSizeWarningLimit: 1000,
  },
  
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  
  // Ensure CSS is bundled
  css: {
    postcss: path.resolve(__dirname, './postcss.config.js'),
  },
});
