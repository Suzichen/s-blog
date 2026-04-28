//! Manual verification test — run with:
//!
//!   cargo test -p s-blog-engine --test thumbnail_manual -- --nocapture
//!
//! Then open `target/thumb-test/` to visually inspect the output.

use std::path::{Path, PathBuf};
use s_blog_engine::image_proc;

/// Resolve a path relative to the workspace root (two levels up from the crate).
fn workspace_root() -> PathBuf {
    Path::new(env!("CARGO_MANIFEST_DIR"))
        .join("../..")
        .canonicalize()
        .expect("cannot resolve workspace root")
}

#[test]
fn generate_thumbnails_for_sakura_album() {
    let root = workspace_root();
    let src = root.join("albums/Sakura");
    let dest = root.join("target/thumb-test/Sakura");

    // Clean previous run
    if dest.exists() {
        std::fs::remove_dir_all(&dest).unwrap();
    }

    let processed = image_proc::generate_thumbnails_for_dir(&src, &dest)
        .expect("thumbnail generation failed");

    println!("\n=== Processed {} photos ===", processed.len());
    for name in &processed {
        let stem = Path::new(name).file_stem().unwrap().to_string_lossy();
        let thumb = dest.join(format!("{stem}.webp"));
        let meta = std::fs::metadata(&thumb).unwrap();
        println!("  {name} -> {stem}.webp ({:.1} KB)", meta.len() as f64 / 1024.0);
    }

    // Read back each thumbnail and print dimensions
    println!("\n=== Thumbnail dimensions ===");
    for name in &processed {
        let stem = Path::new(name).file_stem().unwrap().to_string_lossy();
        let thumb = dest.join(format!("{stem}.webp"));
        let img = image::open(&thumb).unwrap();
        let (w, h) = (img.width(), img.height());
        let orientation = if h > w { "portrait" } else if w > h { "landscape" } else { "square" };
        println!("  {stem}.webp: {w}x{h} ({orientation})");
        assert!(w.max(h) <= 1080, "longest side exceeds 1080: {w}x{h}");
    }

    println!("\n✓ All thumbnails generated in: {}", dest.display());
    println!("  Open the folder to visually verify orientation is correct.");
}
