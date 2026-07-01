/**
 * Rust engine regression tests (default basePath: "/").
 *
 * Runs `spage build` against test fixtures and compares output against golden files.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  setupTmpDir,
  cleanupTmpDir,
  runRustEngine,
  readGoldenFile,
  readTmpOutput,
  tmpOutputExists,
  normalizeSitemapTimestamps,
  normalizeRssTimestamps,
  normalizeSeoTimestamps,
  listFilesRecursive,
  GOLDEN_DIR,
} from './test-utils';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TMP = path.join(__dirname, '.tmp-test-default');

describe('Rust engine regression (basePath: "/")', () => {
  beforeAll(() => {
    setupTmpDir(TMP, 'default');
    const ok = runRustEngine(TMP);
    expect(ok).toBe(true);
  });

  afterAll(() => {
    cleanupTmpDir(TMP);
  });

  describe('posts manifest', () => {
    it('should produce manifest.json matching golden file', () => {
      const actual = JSON.parse(readTmpOutput('dist/generated/manifest.json', TMP));
      const expected = JSON.parse(readGoldenFile('manifest.json'));
      expect(actual).toEqual(expected);
    });

    it('should use preview field as summary when present', () => {
      const manifest = JSON.parse(readTmpOutput('dist/generated/manifest.json', TMP));
      const post = manifest.find((p: any) => p.slug === 'with-preview');
      expect(post.summary).toBe(
        'This is a custom preview text that should be used instead of auto-generated summary.',
      );
    });

    it('should use description field as summary when preview is absent', () => {
      const manifest = JSON.parse(readTmpOutput('dist/generated/manifest.json', TMP));
      const post = manifest.find((p: any) => p.slug === 'with-description');
      expect(post).toBeDefined();
      expect(post.summary).toBe(
        'This summary comes from the description field, not preview or body content.',
      );
    });

    it('should use excerpt field as summary when preview and description are absent', () => {
      const manifest = JSON.parse(readTmpOutput('dist/generated/manifest.json', TMP));
      const post = manifest.find((p: any) => p.slug === 'with-excerpt');
      expect(post).toBeDefined();
      expect(post.summary).toBe(
        'This summary comes from the excerpt field, the lowest priority custom field.',
      );
    });

    it('should auto-generate summary from body when no custom field is present', () => {
      const manifest = JSON.parse(readTmpOutput('dist/generated/manifest.json', TMP));
      const post = manifest.find((p: any) => p.slug === 'simple');
      expect(post).toBeDefined();
      expect(post.summary.length).toBeGreaterThan(0);
      expect(post.summary).toContain('simple test post');
    });
  });

  describe('albums data', () => {
    it('should produce albums-index.json matching golden file', () => {
      const actual = JSON.parse(readTmpOutput('dist/generated/albums-index.json', TMP));
      const expected = JSON.parse(readGoldenFile('albums-index.json'));
      expect(actual).toEqual(expected);
    });

    it('should produce album detail JSON matching golden files', () => {
      const actualTestAlbum = JSON.parse(readTmpOutput('dist/generated/album-test-album.json', TMP));
      const expectedTestAlbum = JSON.parse(readGoldenFile('album-test-album.json'));
      expect(actualTestAlbum).toEqual(expectedTestAlbum);

      const actualEmptyAlbum = JSON.parse(readTmpOutput('dist/generated/album-empty-album.json', TMP));
      const expectedEmptyAlbum = JSON.parse(readGoldenFile('album-empty-album.json'));
      expect(actualEmptyAlbum).toEqual(expectedEmptyAlbum);
    });

    it('should produce sakura-exif album with EXIF data', () => {
      const detail = JSON.parse(readTmpOutput('dist/generated/album-sakura-exif.json', TMP));
      const goldenDetail = JSON.parse(readGoldenFile('album-sakura-exif.json'));
      expect(detail).toEqual(goldenDetail);

      const photosWithExif = detail.photos.filter(
        (p: any) => p.exif.cameraMake !== null || p.exif.cameraModel !== null,
      );
      expect(photosWithExif.length).toBeGreaterThan(0);
    });

    it('should extract EXIF metadata fields correctly', () => {
      const detail = JSON.parse(readTmpOutput('dist/generated/album-sakura-exif.json', TMP));
      const withCamera = detail.photos.find((p: any) => p.exif.cameraMake !== null);
      if (withCamera) {
        expect(typeof withCamera.exif.cameraMake).toBe('string');
        expect(typeof withCamera.exif.cameraModel).toBe('string');
        if (withCamera.exif.focalLength !== null) {
          expect(withCamera.exif.focalLength).toMatch(/^\d+$/);
        }
        if (withCamera.exif.shutterSpeed !== null) {
          expect(withCamera.exif.shutterSpeed).toMatch(/^1\/\d+$|^\d+$/);
        }
      }
    });

    it('should generate thumbnails for sakura-exif album', () => {
      expect(tmpOutputExists('dist/albums/sakura-exif/thumbs/DSC_1464.webp', TMP)).toBe(true);
      expect(tmpOutputExists('dist/albums/sakura-exif/thumbs/DSC_1666.webp', TMP)).toBe(true);
      expect(tmpOutputExists('dist/albums/sakura-exif/thumbs/DSC_1754.webp', TMP)).toBe(true);
    });
  });

  describe('SEO pages', () => {
    it('should produce SEO HTML files matching golden files', () => {
      const goldenSeoFiles = listFilesRecursive(path.join(GOLDEN_DIR, 'seo'));
      expect(goldenSeoFiles.length).toBeGreaterThan(0);

      for (const relPath of goldenSeoFiles) {
        const actual = normalizeSeoTimestamps(readTmpOutput(`dist/post/${relPath}`, TMP));
        const expected = normalizeSeoTimestamps(readGoldenFile(`seo/${relPath}`));
        expect(actual, `SEO file mismatch: seo/${relPath}`).toBe(expected);
      }
    });
  });

  describe('sitemap', () => {
    it('should produce sitemap.xml matching golden file (ignoring dynamic timestamps)', () => {
      const actual = normalizeSitemapTimestamps(readTmpOutput('dist/sitemap.xml', TMP));
      const expected = normalizeSitemapTimestamps(readGoldenFile('sitemap.xml'));
      expect(actual).toBe(expected);
    });
  });

  describe('RSS feed', () => {
    it('should produce rss.xml matching golden file (ignoring dynamic timestamps)', () => {
      const actual = normalizeRssTimestamps(readTmpOutput('dist/rss.xml', TMP));
      const expected = normalizeRssTimestamps(readGoldenFile('rss.xml'));
      expect(actual).toBe(expected);
    });
  });

  describe('robots.txt', () => {
    it('should produce robots.txt matching golden file', () => {
      const actual = readTmpOutput('dist/robots.txt', TMP);
      const expected = readGoldenFile('robots.txt');
      expect(actual).toBe(expected);
    });
  });
});
