//! Cross-implementation verification test for `generate_albums_data`.
//!
//! Runs the Rust engine against the shared test fixtures in
//! `tests/fixtures/` and compares the generated album JSON files
//! against the golden files produced by the TypeScript script.
//!
//! **Validates: Requirement 2.6.6** — The Rust JSON output SHALL match
//! the TS `generate-albums-data.ts` output structure exactly for the
//! same input fixtures.

use std::fs;
use std::path::{Path, PathBuf};

use s_blog_engine::albums::generate_albums_data;
use s_blog_engine::AlbumConfig;

// ── Helpers ────────────────────────────────────────────────────────

fn workspace_root() -> PathBuf {
    Path::new(env!("CARGO_MANIFEST_DIR"))
        .join("../..")
        .canonicalize()
        .expect("failed to resolve workspace root")
}

fn fixtures_dir() -> PathBuf {
    workspace_root().join("tests/fixtures")
}

fn golden_dir() -> PathBuf {
    workspace_root().join("tests/golden")
}

fn fixtures_album_config() -> AlbumConfig {
    let path = fixtures_dir().join("album.config.json");
    let raw = fs::read_to_string(&path)
        .unwrap_or_else(|e| panic!("failed to read {}: {e}", path.display()));
    serde_json::from_str(&raw)
        .unwrap_or_else(|e| panic!("failed to parse {}: {e}", path.display()))
}

fn read_golden(name: &str) -> serde_json::Value {
    let path = golden_dir().join(name);
    let raw = fs::read_to_string(&path)
        .unwrap_or_else(|e| panic!("failed to read golden {}: {e}", path.display()));
    serde_json::from_str(&raw)
        .unwrap_or_else(|e| panic!("failed to parse golden {}: {e}", path.display()))
}

/// Run `generate_albums_data` against the shared fixtures and return
/// the output directory.
fn run_rust() -> (s_blog_engine::albums::AlbumsOutput, tempfile::TempDir) {
    let config = fixtures_album_config();
    let albums_dir = fixtures_dir().join("albums");
    let out = tempfile::TempDir::new().unwrap();
    let output = generate_albums_data(&albums_dir, out.path(), &config)
        .expect("generate_albums_data should succeed");
    (output, out)
}

// ── Tests ──────────────────────────────────────────────────────────

/// The generated `albums-index.json` matches the golden file.
#[test]
fn rust_albums_index_matches_golden() {
    let (_output, out) = run_rust();

    let actual_path = out.path().join("generated/albums-index.json");
    assert!(actual_path.exists(), "albums-index.json should be written");

    let actual: serde_json::Value =
        serde_json::from_str(&fs::read_to_string(&actual_path).unwrap()).unwrap();
    let expected = read_golden("albums-index.json");

    assert_eq!(
        actual, expected,
        "albums-index.json mismatch.\n  Rust:   {}\n  Golden: {}",
        serde_json::to_string_pretty(&actual).unwrap(),
        serde_json::to_string_pretty(&expected).unwrap(),
    );
}

/// The generated `album-test-album.json` matches the golden file.
#[test]
fn rust_album_test_album_matches_golden() {
    let (_output, out) = run_rust();

    let actual_path = out.path().join("generated/album-test-album.json");
    assert!(actual_path.exists(), "album-test-album.json should be written");

    let actual: serde_json::Value =
        serde_json::from_str(&fs::read_to_string(&actual_path).unwrap()).unwrap();
    let expected = read_golden("album-test-album.json");

    assert_eq!(
        actual, expected,
        "album-test-album.json mismatch.\n  Rust:   {}\n  Golden: {}",
        serde_json::to_string_pretty(&actual).unwrap(),
        serde_json::to_string_pretty(&expected).unwrap(),
    );
}

/// The generated `album-empty-album.json` matches the golden file.
#[test]
fn rust_album_empty_album_matches_golden() {
    let (_output, out) = run_rust();

    let actual_path = out.path().join("generated/album-empty-album.json");
    assert!(actual_path.exists(), "album-empty-album.json should be written");

    let actual: serde_json::Value =
        serde_json::from_str(&fs::read_to_string(&actual_path).unwrap()).unwrap();
    let expected = read_golden("album-empty-album.json");

    assert_eq!(
        actual, expected,
        "album-empty-album.json mismatch.\n  Rust:   {}\n  Golden: {}",
        serde_json::to_string_pretty(&actual).unwrap(),
        serde_json::to_string_pretty(&expected).unwrap(),
    );
}

/// The generated `album-sakura-exif.json` matches the golden file,
/// including EXIF metadata.
#[test]
fn rust_album_sakura_exif_matches_golden() {
    let (_output, out) = run_rust();

    let actual_path = out.path().join("generated/album-sakura-exif.json");
    assert!(actual_path.exists(), "album-sakura-exif.json should be written");

    let actual: serde_json::Value =
        serde_json::from_str(&fs::read_to_string(&actual_path).unwrap()).unwrap();
    let expected = read_golden("album-sakura-exif.json");

    assert_eq!(
        actual, expected,
        "album-sakura-exif.json mismatch.\n  Rust:   {}\n  Golden: {}",
        serde_json::to_string_pretty(&actual).unwrap(),
        serde_json::to_string_pretty(&expected).unwrap(),
    );
}

/// EXIF fields are populated for photos that have EXIF data.
#[test]
fn rust_sakura_exif_has_camera_data() {
    let (_output, out) = run_rust();

    let actual_path = out.path().join("generated/album-sakura-exif.json");
    let detail: serde_json::Value =
        serde_json::from_str(&fs::read_to_string(&actual_path).unwrap()).unwrap();

    let photos = detail["photos"].as_array().unwrap();
    let with_camera: Vec<_> = photos
        .iter()
        .filter(|p| !p["exif"]["cameraMake"].is_null())
        .collect();

    assert!(
        !with_camera.is_empty(),
        "Expected at least one photo with EXIF camera data"
    );

    for photo in &with_camera {
        assert!(photo["exif"]["cameraMake"].is_string());
        assert!(photo["exif"]["cameraModel"].is_string());
    }
}

/// Thumbnails are generated for albums with photos.
#[test]
fn rust_generates_thumbnails() {
    let (_output, out) = run_rust();

    // test-album thumbnails
    assert!(
        out.path().join("albums/test-album/thumbs/photo1.webp").exists(),
        "photo1.webp thumbnail should exist"
    );
    assert!(
        out.path().join("albums/test-album/thumbs/photo2.webp").exists(),
        "photo2.webp thumbnail should exist"
    );

    // sakura-exif thumbnails
    assert!(
        out.path().join("albums/sakura-exif/thumbs/DSC_1464.webp").exists(),
        "DSC_1464.webp thumbnail should exist"
    );
    assert!(
        out.path().join("albums/sakura-exif/thumbs/DSC_1666.webp").exists(),
        "DSC_1666.webp thumbnail should exist"
    );
    assert!(
        out.path().join("albums/sakura-exif/thumbs/DSC_1754.webp").exists(),
        "DSC_1754.webp thumbnail should exist"
    );
}

/// The returned summaries count matches the golden index count.
#[test]
fn rust_summary_count_matches() {
    let (output, _out) = run_rust();
    let expected = read_golden("albums-index.json");
    let expected_count = expected.as_array().unwrap().len();
    assert_eq!(output.summaries.len(), expected_count);
}

/// Disabled config produces empty albums-index.json.
#[test]
fn rust_disabled_config_produces_empty_index() {
    let config = AlbumConfig {
        enabled: false,
        albums: vec![],
        provider: None,
    };
    let albums_dir = fixtures_dir().join("albums");
    let out = tempfile::TempDir::new().unwrap();

    let output = generate_albums_data(&albums_dir, out.path(), &config).unwrap();
    assert!(output.summaries.is_empty());
    assert!(output.details.is_empty());

    let index_path = out.path().join("generated/albums-index.json");
    let content: serde_json::Value =
        serde_json::from_str(&fs::read_to_string(index_path).unwrap()).unwrap();
    assert_eq!(content, serde_json::json!([]));
}
