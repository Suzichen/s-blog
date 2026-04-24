/**
 * serve.ts
 * 
 * Simple HTTP server for local development preview.
 * Serves the dist/ directory on localhost.
 * 
 * This is a lightweight alternative to vite preview for the App Shell architecture.
 */

import http from 'http';
import fs from 'fs';
import path from 'path';

const CWD = process.cwd();
const DIST_DIR = path.join(CWD, 'dist');
const PORT = parseInt(process.env.PORT || '3000', 10);

// MIME types for common file extensions
const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.xml': 'application/xml',
  '.md': 'text/markdown; charset=utf-8',
};

function getMimeType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  return MIME_TYPES[ext] || 'application/octet-stream';
}

function serveFile(res: http.ServerResponse, filePath: string): void {
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('404 Not Found');
      return;
    }
    res.writeHead(200, { 'Content-Type': getMimeType(filePath) });
    res.end(data);
  });
}

function main(): void {
  // Check if dist directory exists
  if (!fs.existsSync(DIST_DIR)) {
    console.error(`Error: dist/ directory not found at ${DIST_DIR}`);
    console.error('Please run "npm run build" first.');
    process.exit(1);
  }

  const server = http.createServer((req, res) => {
    let urlPath = req.url || '/';
    
    // Remove query string
    urlPath = urlPath.split('?')[0];
    
    // Decode URL
    urlPath = decodeURIComponent(urlPath);
    
    // Resolve file path
    let filePath = path.join(DIST_DIR, urlPath);
    
    // If path is a directory, try index.html
    if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
      filePath = path.join(filePath, 'index.html');
    }
    
    // If file doesn't exist, serve index.html for SPA routing
    if (!fs.existsSync(filePath)) {
      filePath = path.join(DIST_DIR, 'index.html');
    }
    
    serveFile(res, filePath);
  });

  server.listen(PORT, () => {
    console.log(`\n  🚀 S-blog dev server running at:\n`);
    console.log(`     Local:   http://localhost:${PORT}/`);
    console.log(`\n  Press Ctrl+C to stop.\n`);
  });
}

main();
