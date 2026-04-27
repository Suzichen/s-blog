/**
 * Cross-implementation verification tests for basePath subdirectory deployment.
 *
 * These tests verify that all generated assets correctly include the basePath
 * prefix when configured (e.g., basePath: "/blog").
 *
 * Validates: Requirement 1.5.5
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  setupTmpDir,
  cleanupTmpDir,
  runTsScript,
  readGoldenFile,
  readTmpOutput,
  tmpOutputExists,
  normalizeSitemapTimestamps,
  normalizeRssTimestamps,
  normalizeSeoTimestamps,
  listFilesRecursive,
  BASEPATH_GOLDEN_DIR,
} from './test-utils';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TMP = path.join(__dirname, '.tmp-test-basepath');

describe('Cross-implementation verification (basePath: "/blog")', () => {
  beforeAll(() => {
    setupTmpDir(TMP, 'basepath');
  });

  afterAll(() => {
    cleanupTmpDir(TMP);
  });

  // IMPORTANT: Must run first — SEO, sitemap, and RSS depend on manifest.json
  describe('generate-posts-data with basePath', () => {
    beforeAll(() => {
      const ok = runTsScript('generate-posts-data', TMP);
      expect(ok).toBe(true);
    });

    it('should produce manifest.json matching basepath golden file', () => {
      const actual = JSON.parse(readTmpOutput('public/generated/manifest.json', TMP));
      const expected = JSON.parse(readGoldenFile('manifest.json', 'basepath'));
      expect(actual).toEqual(expected);
    });
  });

  describe('generate-seo with basePath', () => {
    beforeAll(() => {
      expect(tmpOutputExists('public/generated/manifest.json', TMP)).toBe(true);
      const ok = runTsScript('generate-seo', TMP);
      expect(ok).toBe(true);
    });

    it('should produce SEO HTML files matching basepath golden files', () => {
      const goldenSeoFiles = listFilesRecursive(
        path.join(BASEPATH_GOLDEN_DIR, 'seo'),
      );
      expect(goldenSeoFiles.length).toBeGreaterThan(0);

      for (const relPath of goldenSeoFiles) {
        const actual = normalizeSeoTimestamps(readTmpOutput(`dist/post/${relPath}`, TMP));
        const expected = normalizeSeoTimestamps(readGoldenFile(`seo/${relPath}`, 'basepath'));
        expect(actual, `SEO file mismatch: seo/${relPath}`).toBe(expected);
      }
    });

    it('should include basePath in asset paths', () => {
      const goldenSeoFiles = listFilesRecursive(
        path.join(BASEPATH_GOLDEN_DIR, 'seo'),
      );
      const firstFile = goldenSeoFiles[0];
      const html = readTmpOutput(`dist/post/${firstFile}`, TMP);

      expect(html).toContain('href="/blog/assets/');
      expect(html).toContain('src="/blog/assets/');
      expect(html).not.toContain('href="./assets/');
      expect(html).not.toContain('src="./assets/');
    });

    it('should include basePath in canonical and OG URLs', () => {
      const goldenSeoFiles = listFilesRecursive(
        path.join(BASEPATH_GOLDEN_DIR, 'seo'),
      );
      const firstFile = goldenSeoFiles[0];
      const html = readTmpOutput(`dist/post/${firstFile}`, TMP);

      expect(html).toContain('https://test-blog.example.com/blog/post/');
    });
  });

  describe('generate-sitemap with basePath', () => {
    beforeAll(() => {
      expect(tmpOutputExists('public/generated/manifest.json', TMP)).toBe(true);
      const ok = runTsScript('generate-sitemap', TMP);
      expect(ok).toBe(true);
    });

    it('should produce sitemap.xml matching basepath golden file', () => {
      const actual = normalizeSitemapTimestamps(readTmpOutput('dist/sitemap.xml', TMP));
      const expected = normalizeSitemapTimestamps(readGoldenFile('sitemap.xml', 'basepath'));
      expect(actual).toBe(expected);
    });

    it('should include basePath in all sitemap URLs', () => {
      const sitemap = readTmpOutput('dist/sitemap.xml', TMP);
      expect(sitemap).toContain('https://test-blog.example.com/blog/');
      expect(sitemap).toContain('https://test-blog.example.com/blog/post/');
      const locMatches = sitemap.match(/<loc>(.*?)<\/loc>/g) || [];
      for (const loc of locMatches) {
        expect(loc).toContain('/blog');
      }
    });
  });

  describe('generate-rss with basePath', () => {
    beforeAll(() => {
      expect(tmpOutputExists('public/generated/manifest.json', TMP)).toBe(true);
      const ok = runTsScript('generate-rss', TMP);
      expect(ok).toBe(true);
    });

    it('should produce rss.xml matching basepath golden file', () => {
      const actual = normalizeRssTimestamps(readTmpOutput('dist/rss.xml', TMP));
      const expected = normalizeRssTimestamps(readGoldenFile('rss.xml', 'basepath'));
      expect(actual).toBe(expected);
    });

    it('should include basePath in all RSS URLs', () => {
      const rss = readTmpOutput('dist/rss.xml', TMP);
      expect(rss).toContain('https://test-blog.example.com/blog/');
      const linkMatches = rss.match(/<link>(.*?)<\/link>/g) || [];
      for (const link of linkMatches) {
        if (link.includes('test-blog.example.com')) {
          expect(link).toContain('/blog');
        }
      }
    });
  });

  describe('generate-robots with basePath', () => {
    beforeAll(() => {
      const ok = runTsScript('generate-robots', TMP);
      expect(ok).toBe(true);
    });

    it('should produce robots.txt matching basepath golden file', () => {
      const actual = readTmpOutput('dist/robots.txt', TMP);
      const expected = readGoldenFile('robots.txt', 'basepath');
      expect(actual).toBe(expected);
    });
  });
});
