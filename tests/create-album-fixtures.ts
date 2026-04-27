/**
 * Creates minimal valid JPEG test images for album fixture tests.
 *
 * Run: npx tsx tests/create-album-fixtures.ts
 *
 * Generates tiny 1x1 pixel JPEG files in tests/fixtures/albums/test-album/.
 * These are valid JPEG files that image processing libraries can decode,
 * but they won't contain EXIF data (testing the null-EXIF path).
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Minimal valid JPEG (1x1 white pixel) as base64
const MINIMAL_JPEG_B64 =
  '/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkS' +
  'Ew8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJ' +
  'CQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIy' +
  'MjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEA' +
  'AAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIh' +
  'MUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6' +
  'Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZ' +
  'mqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx' +
  '8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREA' +
  'AgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAV' +
  'YnLRChYkNOEl8RcYI4Q/RFhHRUYnJCk2NTg5OkNERUZHSElKU1RVVldYWVpjZGVm' +
  'Z2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6' +
  'wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEA' +
  'PwD3+gD/2Q==';

const ALBUM_DIR = path.join(__dirname, 'fixtures', 'albums', 'test-album');

function main() {
  fs.mkdirSync(ALBUM_DIR, { recursive: true });

  const jpegBuffer = Buffer.from(MINIMAL_JPEG_B64, 'base64');
  const files = ['photo1.jpg', 'photo2.jpg'];

  for (const file of files) {
    const filePath = path.join(ALBUM_DIR, file);
    fs.writeFileSync(filePath, jpegBuffer);
    console.log(`Created ${filePath} (${jpegBuffer.length} bytes)`);
  }

  console.log('Album fixtures created successfully.');
}

main();
