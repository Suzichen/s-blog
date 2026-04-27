/**
 * Cross-implementation verification tests (default basePath: "/").
 *
 * These tests run the existing TS scripts against test fixtures and compare
 * the output against golden files. When Rust modules are ready, parallel
 * tests can be added to verify Rust output matches the same golden files.
 *
 * NOTE: describe blocks execute sequentially in declaration order (vitest default).
 * generate-posts-data MUST run before generate-seo/sitemap/rss since those
 * depend on the manifest.json it produces. This ordering is intentional.
 *
 * Validates: Requirements 2.0.4, 2.0.5
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
  GOLDEN_DIR,
} from './test-utils';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TMP = path.join(__dirname, '.tmp-test-default');

describe('Cross-implementation verification', () => {
  beforeAll(() => {
    setupTmpDir(TMP, 'default');
  });

  afterAll(() => {
    cleanupTmpDir(TMP);
  });

  // IMPORTANT: This must run first — SEO, sitemap, and RSS depend on manifest.json
  describe('generate-posts-data', () => {
    beforeAll(() => {
      const ok = runTsScript('generate-posts-data', TMP);
      expect(ok).toBe(true);
    });

    it('should produce manifest.json matching golden file', () => {
      const actual = JSON.parse(readTmpOutput('public/generated/manifest.json', TMP));
      const expected = JSON.parse(readGoldenFile('manifest.json'));
      expect(actual).toEqual(expected);
    });

    it('should use preview field as summary when present', () => {
      const manifest = JSON.parse(readTmpOutput('public/generated/manifest.json', TMP));
      const post = manifest.find((p: any) => p.slug === 'with-preview');
      expect(post.summary).toBe(
        'This is a custom preview text that should be used instead of auto-generated summary.',
      );
    });

    it('should use description field as summary when preview is absent', () => {
      const manifest = JSON.parse(readTmpOutput('public/generated/manifest.json', TMP));
      const post = manifest.find((p: any) => p.slug === 'with-description');
      expect(post).toBeDefined();
      expect(post.summary).toBe(
        'This summary comes from the description field, not preview or body content.',
      );
    });

    it('should use excerpt field as summary when preview and description are absent', () => {
      const manifest = JSON.parse(readTmpOutput('public/generated/manifest.json', TMP));
      const post = manifest.find((p: any) => p.slug === 'with-excerpt');
      expect(post).toBeDefined();
      expect(post.summary).toBe(
        'This summary comes from the excerpt field, the lowest priority custom field.',
      );
    });

    it('should auto-generate summary from body when no custom field is present', () => {
      const manifest = JSON.parse(readTmpOutput('public/generated/manifest.json', TMP));
      const post = manifest.find((p: any) => p.slug === 'simple');
      expect(post).toBeDefined();
      expect(post.summary.length).toBeGreaterThan(0);
      expect(post.summary).toContain('simple test post');
    });
  });

  describe('generate-albums-data', () => {
    beforeAll(() => {
      const ok = runTsScript('generate-albums-data', TMP);
      expect(ok).toBe(true);
    });

    it('should produce albums-index.json matching golden file', () => {
      const actual = JSON.parse(readTmpOutput('public/generated/albums-index.json', TMP));
      const expected = JSON.parse(readGoldenFile('albums-index.json'));
      expect(actual).toEqual(expected);
    });

    it('should produce album detail JSON matching golden files', () => {
      const actualTestAlbum = JSON.parse(
        readTmpOutput('public/generated/album-test-album.json', TMP),
      );
      const expectedTestAlbum = JSON.parse(readGoldenFile('album-test-album.json'));
      expect(actualTestAlbum).toEqual(expectedTestAlbum);

      const actualEmptyAlbum = JSON.parse(
        readTmpOutput('public/generated/album-empty-album.json', TMP),
      );
      const expectedEmptyAlbum = JSON.parse(readGoldenFile('album-empty-album.json'));
      expect(actualEmptyAlbum).toEqual(expectedEmptyAlbum);
    });

    it('should produce sakura-exif album with EXIF data', () => {
      const detail = JSON.parse(
        readTmpOutput('public/generated/album-sakura-exif.json', TMP),
      );
      const goldenDetail = JSON.parse(readGoldenFile('album-sakura-exif.json'));
      expect(detail).toEqual(goldenDetail);

      // Verify EXIF fields are populated (not all null)
      const photosWithExif = detail.photos.filter(
        (p: any) => p.exif.cameraMake !== null || p.exif.cameraModel !== null,
      );
      expect(photosWithExif.length).toBeGreaterThan(0);
    });

    it('should extract EXIF metadata fields correctly', () => {
      const detail = JSON.parse(
        readTmpOutput('public/generated/album-sakura-exif.json', TMP),
      );
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
      expect(tmpOutputExists('public/albums/sakura-exif/thumbs/DSC_1464.webp', TMP)).toBe(true);
      expect(tmpOutputExists('public/albums/sakura-exif/thumbs/DSC_1666.webp', TMP)).toBe(true);
      expect(tmpOutputExists('public/albums/sakura-exif/thumbs/DSC_1754.webp', TMP)).toBe(true);
    });
  });

  // Depends on manifest.json from generate-posts-data
  describe('generate-seo', () => {
    beforeAll(() => {
      expect(tmpOutputExists('public/generated/manifest.json', TMP)).toBe(true);
      const ok = runTsScript('generate-seo', TMP);
      expect(ok).toBe(true);
    });

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

  // Depends on manifest.json from generate-posts-data
  describe('generate-sitemap', () => {
    beforeAll(() => {
      expect(tmpOutputExists('public/generated/manifest.json', TMP)).toBe(true);
      const ok = runTsScript('generate-sitemap', TMP);
      expect(ok).toBe(true);
    });

    it('should produce sitemap.xml matching golden file (ignoring dynamic timestamps)', () => {
      const actual = normalizeSitemapTimestamps(readTmpOutput('dist/sitemap.xml', TMP));
      const expected = normalizeSitemapTimestamps(readGoldenFile('sitemap.xml'));
      expect(actual).toBe(expected);
    });
  });

  // Depends on manifest.json from generate-posts-data
  describe('generate-rss', () => {
    beforeAll(() => {
      expect(tmpOutputExists('public/generated/manifest.json', TMP)).toBe(true);
      const ok = runTsScript('generate-rss', TMP);
      expect(ok).toBe(true);
    });

    it('should produce rss.xml matching golden file (ignoring dynamic timestamps)', () => {
      const actual = normalizeRssTimestamps(readTmpOutput('dist/rss.xml', TMP));
      const expected = normalizeRssTimestamps(readGoldenFile('rss.xml'));
      expect(actual).toBe(expected);
    });
  });

  describe('generate-robots', () => {
    beforeAll(() => {
      const ok = runTsScript('generate-robots', TMP);
      expect(ok).toBe(true);
    });

    it('should produce robots.txt matching golden file', () => {
      const actual = readTmpOutput('dist/robots.txt', TMP);
      const expected = readGoldenFile('robots.txt');
      expect(actual).toBe(expected);
    });
  });

  // ─── Future Rust Integration Point ───
  // When Rust modules are ready, add parallel tests here:
  //
  // describe('Rust engine verification', () => {
  //   it('generate_posts_data output matches golden file');
  //   it('generate_albums_data output matches golden file');
  //   it('generate_seo_pages output matches golden files');
  //   it('generate_sitemap output matches golden file');
  //   it('generate_rss output matches golden file');
  //   it('generate_robots output matches golden file');
  // });
});
