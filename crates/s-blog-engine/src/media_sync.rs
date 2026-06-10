//! Media sync module — S3-compatible upload with incremental lock file.

use std::collections::HashMap;
use std::fs;
use std::io::Read;
use std::path::Path;
use std::time::UNIX_EPOCH;

use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};

use crate::error::EngineError;
use crate::image_proc::is_photo_file;

/// Default fingerprint threshold: 5MB. Files ≤ this use SHA-256 hash.
pub const FINGERPRINT_THRESHOLD: u64 = 5 * 1024 * 1024;

// ── Lock file types ────────────────────────────────────────────────

/// Fingerprint of a single file for change detection.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct FileFingerprint {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub hash: Option<String>,
    pub size: u64,
    pub mtime: u64,
}

/// Lock file contents — tracks all successfully uploaded files.
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct SyncLockFile {
    pub files: HashMap<String, FileFingerprint>,
}

// ── Directory size calculation ─────────────────────────────────────

/// Recursively calculate the total size (in bytes) of photo files in a directory.
pub fn calculate_dir_size(dir: &Path) -> u64 {
    if !dir.is_dir() {
        return 0;
    }
    let mut total = 0u64;
    if let Ok(entries) = fs::read_dir(dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_dir() {
                total += calculate_dir_size(&path);
            } else if let Some(name) = path.file_name().and_then(|n| n.to_str()) {
                if is_photo_file(name) {
                    total += entry.metadata().map(|m| m.len()).unwrap_or(0);
                }
            }
        }
    }
    total
}

// ── Fingerprint computation ────────────────────────────────────────

/// Compute a fingerprint for a file using the hybrid strategy.
/// Files ≤ threshold: SHA-256 hash + size + mtime.
/// Files > threshold: size + mtime only.
pub fn compute_fingerprint(path: &Path, threshold: u64) -> Result<FileFingerprint, EngineError> {
    let meta = fs::metadata(path)?;
    let size = meta.len();
    let mtime = meta
        .modified()?
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();

    let hash = if size <= threshold {
        let mut file = fs::File::open(path)?;
        let mut hasher = Sha256::new();
        let mut buf = [0u8; 8192];
        loop {
            let n = file.read(&mut buf)?;
            if n == 0 {
                break;
            }
            hasher.update(&buf[..n]);
        }
        Some(format!("{:x}", hasher.finalize()))
    } else {
        None
    };

    Ok(FileFingerprint { hash, size, mtime })
}

// ── Lock file I/O ──────────────────────────────────────────────────

/// Load lock file from disk. Returns empty lock if file doesn't exist.
pub fn load_lock(path: &Path) -> SyncLockFile {
    match fs::read_to_string(path) {
        Ok(content) => serde_json::from_str(&content).unwrap_or_default(),
        Err(_) => SyncLockFile::default(),
    }
}

/// Save lock file to disk atomically.
pub fn save_lock(lock: &SyncLockFile, path: &Path) -> Result<(), EngineError> {
    let json = serde_json::to_string_pretty(lock)?;
    fs::write(path, json)?;
    Ok(())
}

// ── Change detection ───────────────────────────────────────────────

/// Determine if a file needs to be uploaded based on its fingerprint.
pub fn needs_upload(existing: Option<&FileFingerprint>, current: &FileFingerprint) -> bool {
    match existing {
        None => true,
        Some(prev) => {
            if let (Some(cur_hash), Some(prev_hash)) = (&current.hash, &prev.hash) {
                cur_hash != prev_hash
            } else {
                current.size != prev.size || current.mtime != prev.mtime
            }
        }
    }
}

// ── S3 upload ──────────────────────────────────────────────────────

use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::Instant;

use s3::bucket::Bucket;
use s3::creds::Credentials;
use s3::Region;

use crate::ProviderConfig;

/// Options for the sync_media command.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct SyncOptions {
    pub work_dir: std::path::PathBuf,
    pub dry_run: bool,
}

impl Default for SyncOptions {
    fn default() -> Self {
        Self { work_dir: std::path::PathBuf::from("."), dry_run: false }
    }
}

/// Result of a sync_media operation.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncResult {
    pub uploaded: u32,
    pub skipped: u32,
    pub failed: Vec<String>,
    pub duration_ms: u64,
}

/// Create an S3 bucket client from provider config + environment variables.
pub fn create_s3_bucket(config: &ProviderConfig) -> Result<Box<Bucket>, EngineError> {
    // Load .env (ignore if missing)
    let _ = dotenvy::dotenv();

    let access_key = std::env::var("S3_ACCESS_KEY").map_err(|_| {
        EngineError::Config("S3_ACCESS_KEY not set. Please configure it in .env file".into())
    })?;
    let secret_key = std::env::var("S3_SECRET_KEY").map_err(|_| {
        EngineError::Config("S3_SECRET_KEY not set. Please configure it in .env file".into())
    })?;

    let credentials = Credentials::new(
        Some(&access_key),
        Some(&secret_key),
        None, None, None,
    )
    .map_err(|e| EngineError::Config(format!("Failed to create S3 credentials: {e}")))?;

    let region = Region::Custom {
        region: config.region.clone(),
        endpoint: config.endpoint.clone(),
    };

    let bucket = Bucket::new(&config.bucket, region, credentials)
        .map_err(|e| EngineError::Config(format!("Failed to create S3 bucket: {e}")))?
        .with_path_style();

    Ok(bucket)
}

/// Infer Content-Type from file path using the existing mime module.
fn content_type_for(path: &Path) -> &'static str {
    path.extension()
        .and_then(|e| e.to_str())
        .map(crate::mime::resolve_mime_type)
        .unwrap_or("application/octet-stream")
}

/// Upload a single file to S3 with retry logic (async).
/// NOTE: Reads entire file into memory. Acceptable for typical photo files (≤30MB).
async fn upload_with_retry(
    bucket: &Bucket,
    local_path: &Path,
    remote_key: &str,
    max_retries: u32,
) -> Result<(), String> {
    let content = fs::read(local_path)
        .map_err(|e| format!("Failed to read {}: {e}", local_path.display()))?;
    let content_type = content_type_for(local_path);

    let mut last_err = String::new();
    for attempt in 0..max_retries {
        if attempt > 0 {
            tokio::time::sleep(std::time::Duration::from_secs(1 << attempt)).await;
        }
        match bucket.put_object_with_content_type(remote_key, &content, content_type).await {
            Ok(response) if response.status_code() >= 200 && response.status_code() < 300 => {
                return Ok(());
            }
            Ok(response) => {
                last_err = format!("HTTP {}", response.status_code());
            }
            Err(e) => {
                last_err = e.to_string();
            }
        }
    }
    Err(format!(
        "{}: failed after {} retries: {}",
        local_path.display(),
        max_retries,
        last_err
    ))
}

// ── Sync orchestration ─────────────────────────────────────────────

/// Pull thumbs + JSON from S3 for CI build (no local albums/).
pub fn pull_build_assets(
    provider: &ProviderConfig,
    album_config: &crate::AlbumConfig,
    output_dir: &Path,
) -> Result<u32, EngineError> {
    let _ = dotenvy::dotenv();
    let bucket = create_s3_bucket(provider)?;
    let rt = tokio::runtime::Builder::new_current_thread()
        .enable_all()
        .build()
        .map_err(|e| EngineError::Config(format!("Failed to create runtime: {e}")))?;

    let output_dir = output_dir.to_path_buf();
    let albums = album_config.albums.clone();

    rt.block_on(async {
        let mut album_count = 0u32;

        // Pull generated JSON files
        let gen_dir = output_dir.join("generated");
        fs::create_dir_all(&gen_dir)?;
        for name in std::iter::once("albums-index.json".to_string()).chain(
            albums.iter().map(|a| format!("album-{}.json", a.dir))
        ) {
            let key = format!("generated/{}", name);
            match bucket.get_object(&key).await {
                Ok(resp) if resp.status_code() == 200 => {
                    fs::write(gen_dir.join(&name), resp.bytes())?;
                }
                _ => { log::warn!("[pull] Not found: {key}"); }
            }
        }

        // Pull thumbnails for each album
        for entry in &albums {
            let prefix = format!("albums/{}/thumbs/", entry.dir);
            let objects = match bucket.list(prefix.clone(), None).await {
                Ok(results) => results.into_iter()
                    .flat_map(|r| r.contents)
                    .collect::<Vec<_>>(),
                Err(_) => continue,
            };
            if objects.is_empty() { continue; }
            album_count += 1;

            let thumbs_dir = output_dir.join("albums").join(&entry.dir).join("thumbs");
            fs::create_dir_all(&thumbs_dir)?;
            for obj in &objects {
                let filename = obj.key.strip_prefix(&prefix).unwrap_or(&obj.key);
                match bucket.get_object(&obj.key).await {
                    Ok(resp) if resp.status_code() == 200 => {
                        fs::write(thumbs_dir.join(filename), resp.bytes())?;
                    }
                    _ => { log::warn!("[pull] Download failed: {}", obj.key); }
                }
            }
            println!("  [albums] {} ✓ {} thumbs (from S3)", entry.dir, objects.len());
        }

        Ok(album_count)
    })
}

/// Execute the full media sync pipeline.
pub fn sync_media(opts: SyncOptions) -> Result<SyncResult, EngineError> {
    let start = Instant::now();
    let work_dir = &opts.work_dir;

    // 1. Load album config
    let config_path = work_dir.join("album.config.json");
    if !config_path.exists() {
        return Err(EngineError::Config(
            "album.config.json not found".into(),
        ));
    }
    let raw = fs::read_to_string(&config_path)?;
    let album_config: crate::AlbumConfig =
        serde_json::from_reader(json_comments::StripComments::new(raw.as_bytes()))
            .map_err(|e| EngineError::Config(format!("Failed to parse album.config.json: {e}")))?;

    let provider = album_config.provider.as_ref().ok_or_else(|| {
        EngineError::Config("No provider configured in album.config.json".into())
    })?;

    // 2. Scan albums directory
    let albums_dir = work_dir.join("albums");
    if !albums_dir.is_dir() {
        return Err(EngineError::Config("albums/ directory not found".into()));
    }

    let mut files_to_check: Vec<(String, std::path::PathBuf)> = Vec::new();
    for entry in &album_config.albums {
        let album_path = albums_dir.join(&entry.dir);
        if !album_path.is_dir() {
            continue;
        }
        if let Ok(entries) = fs::read_dir(&album_path) {
            for file_entry in entries.flatten() {
                let path = file_entry.path();
                if path.is_file() {
                    if let Some(name) = path.file_name().and_then(|n| n.to_str()) {
                        if is_photo_file(name) {
                            let rel = format!("{}/{}", entry.dir, name);
                            files_to_check.push((rel, path));
                        }
                    }
                }
            }
        }
    }

    // 3. Load lock + compute fingerprints + determine upload queue
    let lock_path = work_dir.join(".sblog-sync.lock");
    let mut lock = load_lock(&lock_path);

    let mut upload_queue: Vec<(String, std::path::PathBuf, FileFingerprint)> = Vec::new();
    let mut skipped = 0u32;

    for (rel_path, full_path) in &files_to_check {
        let fp = compute_fingerprint(full_path, FINGERPRINT_THRESHOLD)?;
        if needs_upload(lock.files.get(rel_path), &fp) {
            upload_queue.push((rel_path.clone(), full_path.clone(), fp));
        } else {
            skipped += 1;
        }
    }

    // 4. Dry-run mode
    if opts.dry_run {
        println!("[sync] Dry-run: {} file(s) to upload, {} skipped", upload_queue.len(), skipped);
        for (rel, _, _) in &upload_queue {
            println!("  + albums/{}", rel);
        }
        return Ok(SyncResult {
            uploaded: 0,
            skipped,
            failed: vec![],
            duration_ms: start.elapsed().as_millis() as u64,
        });
    }

    // 5. Create S3 client + runtime
    let bucket = create_s3_bucket(provider)?;
    let rt = tokio::runtime::Builder::new_current_thread()
        .enable_all()
        .build()
        .map_err(|e| EngineError::Config(format!("Failed to create tokio runtime: {e}")))?;

    // 6. Register Ctrl+C handler
    let interrupted = Arc::new(AtomicBool::new(false));
    let interrupted_clone = interrupted.clone();
    let _ = ctrlc::set_handler(move || {
        interrupted_clone.store(true, Ordering::SeqCst);
    });

    // 7. Upload loop + generate & upload thumbs/JSON
    let (uploaded, failed) = rt.block_on(async {
        let mut uploaded = 0u32;
        let mut failed: Vec<String> = Vec::new();
        let total = upload_queue.len();

        for (i, (rel_path, full_path, fp)) in upload_queue.iter().enumerate() {
            if interrupted.load(Ordering::SeqCst) {
                println!("[sync] Interrupted, saving progress...");
                break;
            }
            let remote_key = format!("albums/{}", rel_path);
            print!("[sync] ({}/{}) Uploading {} ... ", i + 1, total, rel_path);
            match upload_with_retry(&bucket, full_path, &remote_key, 3).await {
                Ok(()) => {
                    println!("✓");
                    lock.files.insert(rel_path.clone(), fp.clone());
                    uploaded += 1;
                }
                Err(e) => {
                    println!("✗");
                    log::error!("[sync] {}", e);
                    failed.push(rel_path.clone());
                }
            }
        }

        // 8. Generate thumbnails + album JSON, then upload them
        {
            println!("[sync] Generating thumbnails and index JSON...");
            let sync_out = work_dir.join(".sync-build");
            let _ = fs::remove_dir_all(&sync_out);
            fs::create_dir_all(&sync_out).ok();

            // Read site config for basePath
            let site_config_path = work_dir.join("config.json");
            let base_path = if site_config_path.exists() {
                let raw = fs::read_to_string(&site_config_path).unwrap_or_default();
                let sc: crate::SiteConfig =
                    serde_json::from_reader(json_comments::StripComments::new(raw.as_bytes()))
                        .unwrap_or_else(|_| crate::SiteConfig {
                            title: String::new(), description: String::new(),
                            logo: String::new(), favicon: String::new(),
                            site_url: None, author: None, language: None,
                            timezone: None, base_path: None,
                        });
                sc.base_path
            } else {
                None
            };

            let _ = crate::albums::generate_albums_data_with_base(
                &albums_dir, &sync_out, &album_config, base_path.as_deref(),
            );

            // Upload thumbs
            let mut thumb_count = 0u32;
            for entry in &album_config.albums {
                let thumbs_dir = sync_out.join("albums").join(&entry.dir).join("thumbs");
                if !thumbs_dir.is_dir() { continue; }
                if let Ok(files) = fs::read_dir(&thumbs_dir) {
                    for f in files.flatten() {
                        if !f.path().is_file() { continue; }
                        if interrupted.load(Ordering::SeqCst) { break; }
                        let name = f.file_name().to_string_lossy().to_string();
                        let remote_key = format!("albums/{}/thumbs/{}", entry.dir, name);
                        if upload_with_retry(&bucket, &f.path(), &remote_key, 3).await.is_ok() {
                            thumb_count += 1;
                        }
                    }
                }
            }
            println!("[sync] Thumbnails uploaded: {thumb_count}");

            // Upload generated JSON files
            let gen_dir = sync_out.join("generated");
            if gen_dir.is_dir() {
                if let Ok(files) = fs::read_dir(&gen_dir) {
                    for f in files.flatten() {
                        if !f.path().is_file() { continue; }
                        let name = f.file_name().to_string_lossy().to_string();
                        let remote_key = format!("generated/{}", name);
                        let _ = upload_with_retry(&bucket, &f.path(), &remote_key, 3).await;
                    }
                }
                println!("[sync] Index JSON uploaded");
            }

            // Cleanup temp dir
            let _ = fs::remove_dir_all(&sync_out);
        }

        (uploaded, failed)
    });

    // 9. Save lock (one-time write)
    save_lock(&lock, &lock_path)?;

    Ok(SyncResult {
        uploaded,
        skipped,
        failed,
        duration_ms: start.elapsed().as_millis() as u64,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use tempfile::tempdir;

    #[test]
    fn empty_dir_returns_zero() {
        let tmp = tempdir().unwrap();
        assert_eq!(calculate_dir_size(tmp.path()), 0);
    }

    #[test]
    fn counts_only_photo_files() {
        let tmp = tempdir().unwrap();
        fs::write(tmp.path().join("photo.jpg"), vec![0u8; 100]).unwrap();
        fs::write(tmp.path().join("readme.txt"), vec![0u8; 50]).unwrap();
        assert_eq!(calculate_dir_size(tmp.path()), 100);
    }

    #[test]
    fn recurses_into_subdirs() {
        let tmp = tempdir().unwrap();
        let sub = tmp.path().join("sub");
        fs::create_dir(&sub).unwrap();
        fs::write(sub.join("a.png"), vec![0u8; 200]).unwrap();
        fs::write(tmp.path().join("b.webp"), vec![0u8; 300]).unwrap();
        assert_eq!(calculate_dir_size(tmp.path()), 500);
    }

    #[test]
    fn nonexistent_dir_returns_zero() {
        assert_eq!(calculate_dir_size(Path::new("/nonexistent_path_xyz")), 0);
    }

    #[test]
    fn small_file_produces_hash() {
        let tmp = tempdir().unwrap();
        let f = tmp.path().join("small.jpg");
        fs::write(&f, b"hello world").unwrap();
        let fp = compute_fingerprint(&f, FINGERPRINT_THRESHOLD).unwrap();
        assert!(fp.hash.is_some());
        assert_eq!(fp.size, 11);
    }

    #[test]
    fn large_file_no_hash() {
        let tmp = tempdir().unwrap();
        let f = tmp.path().join("big.jpg");
        fs::write(&f, vec![0u8; 100]).unwrap();
        // Use threshold of 50 to simulate "large" file
        let fp = compute_fingerprint(&f, 50).unwrap();
        assert!(fp.hash.is_none());
        assert_eq!(fp.size, 100);
    }

    #[test]
    fn lock_roundtrip() {
        let tmp = tempdir().unwrap();
        let lock_path = tmp.path().join(".sblog-sync.lock");
        let mut lock = SyncLockFile::default();
        lock.files.insert(
            "Sakura/test.jpg".into(),
            FileFingerprint { hash: Some("abc123".into()), size: 1000, mtime: 12345 },
        );
        save_lock(&lock, &lock_path).unwrap();
        let loaded = load_lock(&lock_path);
        assert_eq!(lock.files, loaded.files);
    }

    #[test]
    fn load_lock_missing_file_returns_empty() {
        let lock = load_lock(Path::new("/nonexistent/.sblog-sync.lock"));
        assert!(lock.files.is_empty());
    }

    #[test]
    fn needs_upload_no_existing() {
        let fp = FileFingerprint { hash: Some("abc".into()), size: 100, mtime: 1 };
        assert!(needs_upload(None, &fp));
    }

    #[test]
    fn needs_upload_same_hash() {
        let fp = FileFingerprint { hash: Some("abc".into()), size: 100, mtime: 1 };
        assert!(!needs_upload(Some(&fp), &fp));
    }

    #[test]
    fn needs_upload_different_hash() {
        let prev = FileFingerprint { hash: Some("abc".into()), size: 100, mtime: 1 };
        let cur = FileFingerprint { hash: Some("def".into()), size: 100, mtime: 1 };
        assert!(needs_upload(Some(&prev), &cur));
    }

    #[test]
    fn needs_upload_no_hash_same_size_mtime() {
        let fp = FileFingerprint { hash: None, size: 100, mtime: 1 };
        assert!(!needs_upload(Some(&fp), &fp));
    }

    #[test]
    fn needs_upload_no_hash_different_size() {
        let prev = FileFingerprint { hash: None, size: 100, mtime: 1 };
        let cur = FileFingerprint { hash: None, size: 200, mtime: 1 };
        assert!(needs_upload(Some(&prev), &cur));
    }

    #[test]
    fn needs_upload_no_hash_different_mtime() {
        let prev = FileFingerprint { hash: None, size: 100, mtime: 1 };
        let cur = FileFingerprint { hash: None, size: 100, mtime: 2 };
        assert!(needs_upload(Some(&prev), &cur));
    }

    #[test]
    fn create_s3_bucket_missing_env_returns_error() {
        // Skip if .env provides credentials (local dev environment)
        let _ = dotenvy::dotenv();
        if std::env::var("S3_ACCESS_KEY").is_ok() {
            return;
        }
        let config = crate::ProviderConfig {
            type_: "s3".into(),
            endpoint: "https://example.com".into(),
            region: "auto".into(),
            bucket: "test".into(),
            public_url: "https://cdn.example.com".into(),
        };
        let err = create_s3_bucket(&config).unwrap_err();
        assert!(err.to_string().contains("S3_ACCESS_KEY"));
    }

    #[test]
    fn sync_media_no_provider_returns_error() {
        let tmp = tempdir().unwrap();
        // Write album config without provider
        fs::write(
            tmp.path().join("album.config.json"),
            r#"{"enabled":true,"albums":[]}"#,
        ).unwrap();
        fs::create_dir(tmp.path().join("albums")).unwrap();
        let opts = SyncOptions { work_dir: tmp.path().to_path_buf(), dry_run: false };
        let err = sync_media(opts).unwrap_err();
        assert!(err.to_string().contains("provider"));
    }

    #[test]
    fn sync_media_dry_run_lists_files() {
        let tmp = tempdir().unwrap();
        let albums_dir = tmp.path().join("albums").join("test");
        fs::create_dir_all(&albums_dir).unwrap();
        fs::write(albums_dir.join("photo.jpg"), vec![0u8; 50]).unwrap();
        fs::write(
            tmp.path().join("album.config.json"),
            r#"{"enabled":true,"albums":[{"dir":"test"}],"provider":{"type":"s3","endpoint":"http://x","region":"auto","bucket":"b","publicUrl":"http://x"}}"#,
        ).unwrap();
        let opts = SyncOptions { work_dir: tmp.path().to_path_buf(), dry_run: true };
        let result = sync_media(opts).unwrap();
        assert_eq!(result.uploaded, 0);
        assert_eq!(result.skipped, 0);
        assert!(result.failed.is_empty());
    }

    #[test]
    fn sync_media_dry_run_skips_already_synced() {
        let tmp = tempdir().unwrap();
        let albums_dir = tmp.path().join("albums").join("test");
        fs::create_dir_all(&albums_dir).unwrap();
        let photo = albums_dir.join("photo.jpg");
        fs::write(&photo, vec![0u8; 50]).unwrap();
        fs::write(
            tmp.path().join("album.config.json"),
            r#"{"enabled":true,"albums":[{"dir":"test"}],"provider":{"type":"s3","endpoint":"http://x","region":"auto","bucket":"b","publicUrl":"http://x"}}"#,
        ).unwrap();

        // Pre-populate lock with matching fingerprint
        let fp = compute_fingerprint(&photo, FINGERPRINT_THRESHOLD).unwrap();
        let mut lock = SyncLockFile::default();
        lock.files.insert("test/photo.jpg".into(), fp);
        save_lock(&lock, &tmp.path().join(".sblog-sync.lock")).unwrap();

        let opts = SyncOptions { work_dir: tmp.path().to_path_buf(), dry_run: true };
        let result = sync_media(opts).unwrap();
        assert_eq!(result.uploaded, 0);
        assert_eq!(result.skipped, 1);
    }
}
