//! Property-based tests for thumbnail size constraints (Property 5).
//!
//! **Property 5 – Thumbnail Size Constraint**
//!
//! *For any* input image, the generated thumbnail SHALL have its longest
//! side not exceeding 1080 pixels while preserving the original aspect
//! ratio.
//!
//! **Validates: Requirements 2.4.1, 2.4.2**

use std::fs;

use image::{DynamicImage, RgbImage};
use proptest::prelude::*;
use tempfile::TempDir;

use s_blog_engine::image_proc::{
    calculate_thumbnail_size, generate_thumbnail, MAX_THUMBNAIL_SIZE,
};

// ── Strategies ─────────────────────────────────────────────────────

/// Image dimensions covering a wide range: tiny (1px) to very large.
fn dimension_pair() -> impl Strategy<Value = (u32, u32)> {
    (1..=10_000u32, 1..=10_000u32)
}

/// Dimensions that are guaranteed to exceed the thumbnail limit on at
/// least one side, forcing a resize.
fn large_dimension_pair() -> impl Strategy<Value = (u32, u32)> {
    let large = (MAX_THUMBNAIL_SIZE + 1)..=10_000u32;
    let any = 1..=10_000u32;
    prop_oneof![
        // landscape: width > limit
        (large.clone(), any.clone()),
        // portrait: height > limit
        (any.clone(), large.clone()),
        // both > limit
        (large.clone(), large.clone()),
    ]
}

/// Dimensions that are within the thumbnail limit (no resize needed).
fn small_dimension_pair() -> impl Strategy<Value = (u32, u32)> {
    (1..=MAX_THUMBNAIL_SIZE, 1..=MAX_THUMBNAIL_SIZE)
}

// ── Property Tests ─────────────────────────────────────────────────

proptest! {
    #![proptest_config(ProptestConfig::with_cases(500))]

    // ── P5.1: Longest side never exceeds MAX_THUMBNAIL_SIZE ────────
    //
    // For any input dimensions, the calculated thumbnail dimensions
    // must have max(w, h) <= 1080.
    #[test]
    fn longest_side_within_limit(
        (w, h) in dimension_pair(),
    ) {
        let (tw, th) = calculate_thumbnail_size(w, h);
        prop_assert!(
            tw.max(th) <= MAX_THUMBNAIL_SIZE,
            "longest side {} exceeds limit {} for input {}x{} -> {}x{}",
            tw.max(th), MAX_THUMBNAIL_SIZE, w, h, tw, th
        );
    }

    // ── P5.2: Aspect ratio is preserved ────────────────────────────
    //
    // Each thumbnail dimension must be within ±1px of the ideal
    // (floating-point) scaled value.  This is the tightest guarantee
    // possible with integer dimensions.
    #[test]
    fn aspect_ratio_preserved(
        (w, h) in dimension_pair(),
    ) {
        let (tw, th) = calculate_thumbnail_size(w, h);

        // If no resize was needed, dimensions are exact.
        if w.max(h) <= MAX_THUMBNAIL_SIZE {
            prop_assert_eq!((tw, th), (w, h));
            return Ok(());
        }

        // Compute the ideal scale factor from the longest side.
        let scale = MAX_THUMBNAIL_SIZE as f64 / w.max(h) as f64;
        let ideal_w = (w as f64 * scale).round().max(1.0);
        let ideal_h = (h as f64 * scale).round().max(1.0);

        prop_assert!(
            (tw as f64 - ideal_w).abs() <= 1.0,
            "width off by more than 1px: expected ~{:.1}, got {} ({}x{} -> {}x{})",
            ideal_w, tw, w, h, tw, th
        );
        prop_assert!(
            (th as f64 - ideal_h).abs() <= 1.0,
            "height off by more than 1px: expected ~{:.1}, got {} ({}x{} -> {}x{})",
            ideal_h, th, w, h, tw, th
        );
    }

    // ── P5.3: Dimensions are always at least 1×1 ──────────────────
    //
    // The thumbnail must never have a zero-width or zero-height
    // dimension, even for extreme aspect ratios.
    #[test]
    fn dimensions_at_least_one(
        (w, h) in dimension_pair(),
    ) {
        let (tw, th) = calculate_thumbnail_size(w, h);
        prop_assert!(tw >= 1, "width must be >= 1, got {} for input {}x{}", tw, w, h);
        prop_assert!(th >= 1, "height must be >= 1, got {} for input {}x{}", th, w, h);
    }

    // ── P5.4: Small images are returned unchanged ──────────────────
    //
    // If both dimensions are already within the limit, the output must
    // equal the input exactly (no unnecessary resize).
    #[test]
    fn small_images_unchanged(
        (w, h) in small_dimension_pair(),
    ) {
        let (tw, th) = calculate_thumbnail_size(w, h);
        prop_assert_eq!(
            (tw, th), (w, h),
            "small image {}x{} should not be resized, got {}x{}",
            w, h, tw, th
        );
    }

    // ── P5.5: Large images are actually downscaled ─────────────────
    //
    // If the input exceeds the limit, the longest side of the output
    // must equal exactly MAX_THUMBNAIL_SIZE (tight fit).
    #[test]
    fn large_images_hit_limit(
        (w, h) in large_dimension_pair(),
    ) {
        let (tw, th) = calculate_thumbnail_size(w, h);
        // The longest side should be exactly at the limit (or 1px off
        // due to rounding for extreme ratios).
        let long = tw.max(th);
        prop_assert!(
            long >= MAX_THUMBNAIL_SIZE - 1 && long <= MAX_THUMBNAIL_SIZE,
            "large image {}x{} -> {}x{}: longest side {} should be ~{}",
            w, h, tw, th, long, MAX_THUMBNAIL_SIZE
        );
    }

    // ── P5.6: Downscale is monotonic ───────────────────────────────
    //
    // The thumbnail dimensions must never exceed the original.
    #[test]
    fn thumbnail_never_upscales(
        (w, h) in dimension_pair(),
    ) {
        let (tw, th) = calculate_thumbnail_size(w, h);
        prop_assert!(tw <= w, "thumbnail width {} > original {} for input {}x{}", tw, w, w, h);
        prop_assert!(th <= h, "thumbnail height {} > original {} for input {}x{}", th, h, w, h);
    }
}

// ── Integration: actual image encode/decode round-trip ─────────────

proptest! {
    #![proptest_config(ProptestConfig::with_cases(20))]

    // ── P5.7: End-to-end thumbnail generation respects size limit ──
    //
    // Create a synthetic JPEG image with random dimensions, run it
    // through `generate_thumbnail`, decode the output, and verify the
    // pixel dimensions satisfy the constraint.
    #[test]
    fn end_to_end_thumbnail_size(
        w in 100..=4000u32,
        h in 100..=4000u32,
    ) {
        let dir = TempDir::new().unwrap();
        let src_path = dir.path().join("input.jpg");
        let dest_path = dir.path().join("output.webp");

        // Create a synthetic JPEG image.
        let img = RgbImage::new(w, h);
        DynamicImage::ImageRgb8(img)
            .save(&src_path)
            .expect("failed to save synthetic JPEG");

        // Generate thumbnail.
        generate_thumbnail(&src_path, &dest_path)
            .expect("generate_thumbnail failed");

        // Decode the output and check dimensions.
        prop_assert!(dest_path.exists(), "thumbnail file must exist");
        let thumb = image::open(&dest_path).expect("failed to open thumbnail");
        let (tw, th) = (thumb.width(), thumb.height());

        prop_assert!(
            tw.max(th) <= MAX_THUMBNAIL_SIZE,
            "end-to-end: longest side {} exceeds {} for input {}x{} -> {}x{}",
            tw.max(th), MAX_THUMBNAIL_SIZE, w, h, tw, th
        );

        // Aspect ratio check: each dimension within ±1px of ideal.
        if w > MAX_THUMBNAIL_SIZE || h > MAX_THUMBNAIL_SIZE {
            let scale = MAX_THUMBNAIL_SIZE as f64 / w.max(h) as f64;
            let ideal_w = (w as f64 * scale).round().max(1.0);
            let ideal_h = (h as f64 * scale).round().max(1.0);
            prop_assert!(
                (tw as f64 - ideal_w).abs() <= 1.0,
                "end-to-end width off by more than 1px: expected ~{:.1}, got {}",
                ideal_w, tw
            );
            prop_assert!(
                (th as f64 - ideal_h).abs() <= 1.0,
                "end-to-end height off by more than 1px: expected ~{:.1}, got {}",
                ideal_h, th
            );
        }

        // Clean up temp files to avoid disk bloat across many cases.
        let _ = fs::remove_file(&src_path);
        let _ = fs::remove_file(&dest_path);
    }
}
