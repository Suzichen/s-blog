import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import exifr from 'exifr';
import { pathToFileURL } from 'url';

// Types inlined to avoid depending on compiled core source
interface AlbumEntry {
  dir: string;
  name?: string;
  cover?: string;
}

interface AlbumConfig {
  enabled: boolean;
  albums: AlbumEntry[];
}

interface ExifData {
  cameraMake: string | null;
  cameraModel: string | null;
  focalLength: string | null;
  aperture: string | null;
  shutterSpeed: string | null;
  iso: string | null;
}

interface PhotoItem {
  filename: string;
  thumbnailUrl: string;
  originalUrl: string;
  exif: ExifData;
}

interface AlbumSummary {
  dirname: string;
  name: string;
  cover: string | null;
  photoCount: number;
}

interface AlbumDetail {
  dirname: string;
  name: string;
  photos: PhotoItem[];
}

// Import album config from user's project (resolved via process.cwd())
const configPath = path.join(process.cwd(), 'src', 'album.config.ts');
const { albumConfig } = await import(pathToFileURL(configPath).href) as { albumConfig: AlbumConfig };

const PROJECT_ROOT = process.cwd();
const ALBUMS_BASE_DIR = path.join(PROJECT_ROOT, 'public', 'albums');
const GENERATED_DIR = path.join(PROJECT_ROOT, 'public', 'generated');
const PHOTO_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.heic'];
const MAX_THUMBNAIL_SIZE = 1080;

// ─── Pure Functions (exported for testing) ───

export function isValidDirname(s: string): boolean {
  // Allow: letters (any script including CJK), numbers, hyphens, underscores
  // Disallow: empty, spaces, path separators, dots at start, control chars
  if (!s || s.startsWith('.')) return false;
  return /^[\p{L}\p{N}_-]+$/u.test(s);
}

export function isPhotoFile(filename: string): boolean {
  const ext = path.extname(filename).toLowerCase();
  return PHOTO_EXTENSIONS.includes(ext);
}

export function calculateThumbnailSize(w: number, h: number): { width: number; height: number } {
  const longSide = Math.max(w, h);
  if (longSide <= MAX_THUMBNAIL_SIZE) {
    return { width: w, height: h };
  }
  const ratio = MAX_THUMBNAIL_SIZE / longSide;
  return {
    width: Math.round(w * ratio),
    height: Math.round(h * ratio),
  };
}

export function parseExif(rawExif: Record<string, unknown> | null): ExifData {
  if (!rawExif) {
    return {
      cameraMake: null,
      cameraModel: null,
      focalLength: null,
      aperture: null,
      shutterSpeed: null,
      iso: null,
    };
  }

  const getString = (value: unknown): string | null => {
    if (value === undefined || value === null) return null;
    return String(value);
  };

  // Handle shutter speed: ExposureTime is typically a decimal like 0.004
  let shutterSpeed: string | null = null;
  const exposureTime = rawExif.ExposureTime as number | undefined;
  if (exposureTime !== undefined && exposureTime !== null) {
    if (exposureTime < 1) {
      shutterSpeed = `1/${Math.round(1 / exposureTime)}`;
    } else {
      shutterSpeed = String(exposureTime);
    }
  }

  return {
    cameraMake: getString(rawExif.Make),
    cameraModel: getString(rawExif.Model),
    focalLength: rawExif.FocalLength !== undefined && rawExif.FocalLength !== null
      ? String(Math.round(rawExif.FocalLength as number))
      : null,
    aperture: rawExif.FNumber !== undefined && rawExif.FNumber !== null
      ? String(rawExif.FNumber)
      : null,
    shutterSpeed,
    iso: getString(rawExif.ISO),
  };
}

export function buildAlbumSummary(
  entry: AlbumEntry,
  photos: string[],
  thumbsDir: string
): AlbumSummary {
  const dirname = entry.dir;
  const name = entry.name || dirname;

  let cover: string | null = null;
  if (entry.cover && photos.includes(entry.cover)) {
    const coverBasename = path.parse(entry.cover).name;
    cover = `/albums/${dirname}/thumbs/${coverBasename}.webp`;
  } else if (photos.length > 0) {
    const firstBasename = path.parse(photos[0]).name;
    cover = `/albums/${dirname}/thumbs/${firstBasename}.webp`;
  }

  return {
    dirname,
    name,
    cover,
    photoCount: photos.length,
  };
}

// ─── Main Build Logic ───

async function generateThumbnail(
  srcPath: string,
  destPath: string
): Promise<void> {
  // Check incremental build: skip if dest exists and is newer than src
  if (fs.existsSync(destPath)) {
    const srcStat = fs.statSync(srcPath);
    const destStat = fs.statSync(destPath);
    if (destStat.mtimeMs >= srcStat.mtimeMs) {
      return; // Skip: thumbnail is up to date
    }
  }

  await sharp(srcPath)
    .resize(MAX_THUMBNAIL_SIZE, MAX_THUMBNAIL_SIZE, {
      fit: 'inside',
      withoutEnlargement: true,
    })
    .webp()
    .toFile(destPath);
}

async function extractExif(filePath: string): Promise<ExifData> {
  try {
    const rawExif = await exifr.parse(filePath, {
      pick: ['Make', 'Model', 'FocalLength', 'FNumber', 'ExposureTime', 'ISO'],
    });
    return parseExif(rawExif);
  } catch {
    return parseExif(null);
  }
}

async function processAlbum(entry: AlbumEntry): Promise<{
  summary: AlbumSummary;
  detail: AlbumDetail;
} | null> {
  const dirname = entry.dir;

  // Validate dirname
  if (!isValidDirname(dirname)) {
    console.error(`[ERROR] Invalid dirname "${dirname}": contains invalid characters (spaces, slashes, or starts with dot). Skipping.`);
    return null;
  }

  // Validate directory existence
  const albumDir = path.join(ALBUMS_BASE_DIR, dirname);
  if (!fs.existsSync(albumDir)) {
    console.warn(`[WARN] Album directory not found: ${albumDir}. Skipping.`);
    return null;
  }

  // Scan photos (direct children only)
  const allFiles = fs.readdirSync(albumDir);
  const photoFiles = allFiles
    .filter((f) => {
      const fullPath = path.join(albumDir, f);
      return fs.statSync(fullPath).isFile() && isPhotoFile(f);
    })
    .sort(); // Deterministic order

  // Ensure thumbs directory exists
  const thumbsDir = path.join(albumDir, 'thumbs');
  if (!fs.existsSync(thumbsDir)) {
    fs.mkdirSync(thumbsDir, { recursive: true });
  }

  // Process each photo
  const photos: PhotoItem[] = [];
  for (const filename of photoFiles) {
    const srcPath = path.join(albumDir, filename);
    const basename = path.parse(filename).name;
    const thumbFilename = `${basename}.webp`;
    const destPath = path.join(thumbsDir, thumbFilename);

    // Generate thumbnail
    try {
      await generateThumbnail(srcPath, destPath);
    } catch (err) {
      console.error(`[ERROR] Failed to generate thumbnail for ${filename}:`, err);
      continue; // Skip this photo
    }

    // Extract EXIF
    const exif = await extractExif(srcPath);

    photos.push({
      filename,
      thumbnailUrl: `/albums/${dirname}/thumbs/${thumbFilename}`,
      originalUrl: `/albums/${dirname}/${filename}`,
      exif,
    });
  }

  const name = entry.name || dirname;
  const summary = buildAlbumSummary(entry, photoFiles, thumbsDir);
  const detail: AlbumDetail = { dirname, name, photos };

  return { summary, detail };
}

async function main() {
  console.log('[albums] Starting album data generation...');

  // Ensure generated directory exists
  if (!fs.existsSync(GENERATED_DIR)) {
    fs.mkdirSync(GENERATED_DIR, { recursive: true });
  }

  // If disabled, output empty index and exit
  if (!albumConfig.enabled) {
    console.log('[albums] Album module is disabled. Generating empty index.');
    fs.writeFileSync(
      path.join(GENERATED_DIR, 'albums-index.json'),
      JSON.stringify([], null, 2)
    );
    return;
  }

  const summaries: AlbumSummary[] = [];

  for (const entry of albumConfig.albums) {
    const result = await processAlbum(entry);
    if (result) {
      summaries.push(result.summary);

      // Write individual album detail JSON
      const detailPath = path.join(GENERATED_DIR, `album-${result.detail.dirname}.json`);
      fs.writeFileSync(detailPath, JSON.stringify(result.detail, null, 2));
      console.log(`[albums] Generated ${path.basename(detailPath)} (${result.detail.photos.length} photos)`);
    }
  }

  // Write albums index
  const indexPath = path.join(GENERATED_DIR, 'albums-index.json');
  fs.writeFileSync(indexPath, JSON.stringify(summaries, null, 2));
  console.log(`[albums] Generated albums-index.json (${summaries.length} albums)`);
  console.log('[albums] Done.');
}

main().catch((err) => {
  console.error('[albums] Fatal error:', err);
  process.exit(1);
});
