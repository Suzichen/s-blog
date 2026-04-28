//! Image thumbnail generation.
//!
//! Produces WebP thumbnails with the longest side ≤ [`MAX_THUMBNAIL_SIZE`] px,
//! preserving aspect ratio.  Supports JPEG, PNG and WebP inputs.
//!
//! Incremental builds: if the destination file already exists **and** its
//! modification time is ≥ the source file's, the thumbnail is skipped.

use std::fs;
use std::path::Path;

use image::{DynamicImage, ImageDecoder, ImageReader};
use log::warn;

use crate::error::EngineError;

/// Maximum pixel length of the longest side of a thumbnail.
pub const MAX_THUMBNAIL_SIZE: u32 = 1080;

/// Default WebP encoding quality (0–100).
const WEBP_QUALITY: f32 = 80.0;

/// Recognised photo file extensions (lower-case, with leading dot).
pub const PHOTO_EXTENSIONS: &[&str] = &[".jpg", ".jpeg", ".png", ".webp"];

// ── Public API ─────────────────────────────────────────────────────

/// Returns `true` when `filename` has a supported photo extension.
pub fn is_photo_file(filename: &str) -> bool {
    let lower = filename.to_ascii_lowercase();
    PHOTO_EXTENSIONS.iter().any(|ext| lower.ends_with(ext))
}

/// Calculate the thumbnail dimensions so that the longest side is at most
/// [`MAX_THUMBNAIL_SIZE`] while preserving the original aspect ratio.
///
/// If both dimensions are already within the limit the original size is
/// returned unchanged.
pub fn calculate_thumbnail_size(w: u32, h: u32) -> (u32, u32) {
    let long_side = w.max(h);
    if long_side <= MAX_THUMBNAIL_SIZE {
        return (w, h);
    }
    let ratio = MAX_THUMBNAIL_SIZE as f64 / long_side as f64;
    let tw = (w as f64 * ratio).round() as u32;
    let th = (h as f64 * ratio).round() as u32;
    (tw.max(1), th.max(1))
}

/// Generate a WebP thumbnail for the image at `src_path`, writing it to
/// `dest_path`.
///
/// * The longest side of the output will not exceed [`MAX_THUMBNAIL_SIZE`].
/// * The original aspect ratio is preserved.
/// * If `dest_path` already exists and is at least as new as `src_path`,
///   the call is a no-op (incremental build).
/// * Decode failures are logged as warnings and returned as
///   [`EngineError::ImageDecode`].
pub fn generate_thumbnail(src_path: &Path, dest_path: &Path) -> Result<(), EngineError> {
    // ── Incremental build check ────────────────────────────────────
    if dest_path.exists() {
        if let (Ok(src_meta), Ok(dest_meta)) = (fs::metadata(src_path), fs::metadata(dest_path)) {
            if let (Ok(src_mtime), Ok(dest_mtime)) =
                (src_meta.modified(), dest_meta.modified())
            {
                if dest_mtime >= src_mtime {
                    return Ok(()); // thumbnail is up-to-date
                }
            }
        }
    }

    // ── Decode source image + apply EXIF orientation ─────────────
    let mut decoder = ImageReader::open(src_path)
        .map_err(|e| EngineError::ImageDecode {
            file: src_path.display().to_string(),
            reason: e.to_string(),
        })?
        .into_decoder()
        .map_err(|e| EngineError::ImageDecode {
            file: src_path.display().to_string(),
            reason: e.to_string(),
        })?;

    let orientation = decoder.orientation();

    let mut img = DynamicImage::from_decoder(decoder).map_err(|e| EngineError::ImageDecode {
        file: src_path.display().to_string(),
        reason: e.to_string(),
    })?;

    // Apply EXIF orientation (rotation / mirror) so the pixel data
    // matches what the user sees in their image viewer.
    if let Ok(orient) = orientation {
        img.apply_orientation(orient);
    }

    // ── Resize ─────────────────────────────────────────────────────
    let (tw, th) = calculate_thumbnail_size(img.width(), img.height());
    let resized: DynamicImage = if tw != img.width() || th != img.height() {
        img.resize_exact(tw, th, image::imageops::FilterType::CatmullRom)
    } else {
        img
    };

    // ── Encode to WebP ─────────────────────────────────────────────
    let encoder = webp::Encoder::from_image(&resized)
        .map_err(|e| EngineError::ImageDecode {
            file: src_path.display().to_string(),
            reason: format!("WebP encoder error: {e}"),
        })?;
    let webp_data = encoder.encode(WEBP_QUALITY);

    // ── Write output ───────────────────────────────────────────────
    if let Some(parent) = dest_path.parent() {
        fs::create_dir_all(parent)?;
    }
    fs::write(dest_path, &*webp_data)?;

    Ok(())
}

/// Generate thumbnails for every supported photo in `src_dir`, writing
/// WebP files into `dest_dir`.
///
/// Returns the list of source filenames (not full paths) that were
/// successfully processed.  Files that fail to decode are warned about
/// and skipped.
pub fn generate_thumbnails_for_dir(
    src_dir: &Path,
    dest_dir: &Path,
) -> Result<Vec<String>, EngineError> {
    if !src_dir.is_dir() {
        return Err(EngineError::DirectoryNotFound(src_dir.to_path_buf()));
    }

    fs::create_dir_all(dest_dir)?;

    let mut processed = Vec::new();

    let mut entries: Vec<_> = fs::read_dir(src_dir)?
        .filter_map(|e| e.ok())
        .collect();
    entries.sort_by_key(|e| e.file_name());

    for entry in entries {
        let fname = entry.file_name().to_string_lossy().to_string();
        if !is_photo_file(&fname) {
            continue;
        }

        let src = entry.path();
        let stem = Path::new(&fname)
            .file_stem()
            .unwrap_or_default()
            .to_string_lossy();
        let dest = dest_dir.join(format!("{stem}.webp"));

        match generate_thumbnail(&src, &dest) {
            Ok(()) => {
                processed.push(fname);
            }
            Err(e) => {
                warn!("Skipping {}: {e}", src.display());
            }
        }
    }

    Ok(processed)
}

// ── Tests ──────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn is_photo_file_accepts_supported_extensions() {
        assert!(is_photo_file("photo.jpg"));
        assert!(is_photo_file("photo.JPG"));
        assert!(is_photo_file("photo.jpeg"));
        assert!(is_photo_file("photo.png"));
        assert!(is_photo_file("photo.webp"));
    }

    #[test]
    fn is_photo_file_rejects_unsupported() {
        assert!(!is_photo_file("photo.gif"));
        assert!(!is_photo_file("photo.bmp"));
        assert!(!is_photo_file("photo.heic"));
        assert!(!is_photo_file("readme.md"));
    }

    #[test]
    fn calculate_thumbnail_size_no_resize_needed() {
        assert_eq!(calculate_thumbnail_size(800, 600), (800, 600));
        assert_eq!(calculate_thumbnail_size(1080, 1080), (1080, 1080));
    }

    #[test]
    fn calculate_thumbnail_size_landscape() {
        let (tw, th) = calculate_thumbnail_size(4000, 3000);
        assert!(tw.max(th) <= MAX_THUMBNAIL_SIZE);
        // Aspect ratio roughly preserved
        let orig_ratio = 4000.0 / 3000.0;
        let thumb_ratio = tw as f64 / th as f64;
        assert!((orig_ratio - thumb_ratio).abs() < 0.02);
    }

    #[test]
    fn calculate_thumbnail_size_portrait() {
        let (tw, th) = calculate_thumbnail_size(2000, 4000);
        assert!(tw.max(th) <= MAX_THUMBNAIL_SIZE);
        let orig_ratio = 2000.0 / 4000.0;
        let thumb_ratio = tw as f64 / th as f64;
        assert!((orig_ratio - thumb_ratio).abs() < 0.02);
    }

    #[test]
    fn calculate_thumbnail_size_square() {
        let (tw, th) = calculate_thumbnail_size(5000, 5000);
        assert_eq!(tw, MAX_THUMBNAIL_SIZE);
        assert_eq!(th, MAX_THUMBNAIL_SIZE);
    }

    #[test]
    fn calculate_thumbnail_size_tiny() {
        assert_eq!(calculate_thumbnail_size(1, 1), (1, 1));
        assert_eq!(calculate_thumbnail_size(10, 5), (10, 5));
    }
}
