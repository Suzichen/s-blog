//! Serve options and handle types for the development preview server.

use std::fs;
use std::net::SocketAddr;
use std::path::{Path, PathBuf};
use std::sync::Arc;

use hyper::body::Bytes;
use hyper::service::service_fn;
use hyper::{Request, Response, StatusCode};
use http_body_util::Full;
use hyper_util::rt::TokioIo;
use serde::{Deserialize, Serialize};
use tokio::net::TcpListener;
use tokio::sync::oneshot;

use crate::error::EngineError;
use crate::mime::{has_file_extension, resolve_mime_type};
use crate::{AlbumConfig, SiteConfig};

/// Development server options — all fields have sensible defaults.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct ServeOptions {
    /// Working directory (project root). Defaults to `"."`.
    pub work_dir: PathBuf,
    /// Cache directory for generated data. Defaults to `".cache"`.
    pub cache_dir: PathBuf,
    /// Path to the app shell directory. Defaults to `"node_modules/@s-blog/core/dist/shell"`.
    pub shell_dir: PathBuf,
    /// Port to bind the HTTP server on. Defaults to `3000`.
    pub port: u16,
}

impl Default for ServeOptions {
    fn default() -> Self {
        Self {
            work_dir: PathBuf::from("."),
            cache_dir: PathBuf::from(".cache"),
            shell_dir: PathBuf::from("node_modules/@s-blog/core/dist/shell"),
            port: 3000,
        }
    }
}

/// Handle to a running development server.
///
/// Returned by `serve()` immediately after the server starts.
/// Use this handle to query the bound address and to shut down the server.
pub struct ServeHandle {
    /// The actual address the server is bound to (includes port).
    addr: SocketAddr,
    /// Oneshot sender to signal server shutdown; consumed on first `shutdown()` call.
    shutdown_tx: Option<oneshot::Sender<()>>,
}

impl ServeHandle {
    /// Create a new `ServeHandle`.
    pub fn new(addr: SocketAddr, shutdown_tx: oneshot::Sender<()>) -> Self {
        Self {
            addr,
            shutdown_tx: Some(shutdown_tx),
        }
    }

    /// Returns the socket address the server is bound to.
    pub fn address(&self) -> SocketAddr {
        self.addr
    }

    /// Gracefully shuts down the server.
    pub fn shutdown(&mut self) {
        if let Some(tx) = self.shutdown_tx.take() {
            let _ = tx.send(());
        }
    }
}

/// Shared state for the HTTP request handler.
struct ServerState {
    cache_dir: PathBuf,
    public_dir: PathBuf,
    shell_dir: PathBuf,
    work_dir: PathBuf,
    /// Parsed site config (for dynamic manifest/album regeneration).
    config: SiteConfig,
    /// Parsed album config (for dynamic album index regeneration).
    album_config: Option<AlbumConfig>,
    /// Normalized basePath prefix to strip from requests (e.g. "/blog"). Empty for root.
    base_path: String,
}

/// Parse a port string, returning a valid port in [1, 65535] or an error message.
pub fn parse_port(s: &str) -> Result<u16, String> {
    let n: u32 = s
        .parse()
        .map_err(|_| "端口必须是 1-65535 之间的整数".to_string())?;
    if n < 1 || n > 65535 {
        return Err("端口必须是 1-65535 之间的整数".to_string());
    }
    Ok(n as u16)
}

/// Start the development preview server.
///
/// Generates posts manifest and albums data to `.cache/`, then spawns an
/// async HTTP server. Returns a [`ServeHandle`] immediately.
///
/// # Errors
///
/// - [`EngineError::PortInUse`] if the port cannot be bound.
/// - [`EngineError::ServeDirNotFound`] if `shell_dir` does not exist.
pub fn serve(opts: ServeOptions) -> Result<ServeHandle, EngineError> {
    let work_dir = &opts.work_dir;
    let cache_dir = if opts.cache_dir.is_relative() {
        work_dir.join(&opts.cache_dir)
    } else {
        opts.cache_dir.clone()
    };
    let shell_dir = if opts.shell_dir.is_relative() {
        work_dir.join(&opts.shell_dir)
    } else {
        opts.shell_dir.clone()
    };

    if !shell_dir.exists() {
        return Err(EngineError::ServeDirNotFound(shell_dir));
    }

    // Ensure cache dir exists
    fs::create_dir_all(&cache_dir).map_err(|_| {
        EngineError::BuildStepFailed {
            step: "create cache dir".into(),
            reason: format!("cannot create {}", cache_dir.display()),
        }
    })?;

    // Parse site config
    let posts_dir = work_dir.join("posts");
    let config_path = work_dir.join("config.json");
    let config: SiteConfig = if config_path.exists() {
        let config_raw = fs::read_to_string(&config_path).unwrap_or_default();
        serde_json::from_str(&config_raw).map_err(|e| EngineError::BuildStepFailed {
            step: "parse config.json".into(),
            reason: e.to_string(),
        })?
    } else {
        return Err(EngineError::ConfigNotFound(config_path));
    };

    // Parse album config
    let album_config_path = work_dir.join("album.config.json");
    let album_config: Option<AlbumConfig> = if album_config_path.exists() {
        fs::read_to_string(&album_config_path)
            .ok()
            .and_then(|raw| serde_json::from_str(&raw).ok())
    } else {
        None
    };

    // Initial generation (warm-up)
    if posts_dir.exists() {
        let _ = crate::posts::generate_posts_manifest_only(&posts_dir, &cache_dir, &config);
    }
    if let Some(ref ac) = album_config {
        let albums_dir = work_dir.join("albums");
        if albums_dir.exists() {
            let _ = crate::albums::generate_albums_index_only(
                &albums_dir, &cache_dir, ac, config.base_path.as_deref(),
            );
        }
    }

    // Build the tokio runtime and start the server
    let rt = tokio::runtime::Builder::new_multi_thread()
        .enable_all()
        .build()
        .map_err(|e| EngineError::BuildStepFailed {
            step: "start runtime".into(),
            reason: e.to_string(),
        })?;

    let addr: SocketAddr = ([127, 0, 0, 1], opts.port).into();
    let (shutdown_tx, shutdown_rx) = oneshot::channel::<()>();

    let listener = rt.block_on(async {
        TcpListener::bind(addr).await
    }).map_err(|_| EngineError::PortInUse { port: opts.port })?;

    let bound_addr = listener.local_addr().map_err(|_| EngineError::PortInUse { port: opts.port })?;

    // Read basePath from config for request path stripping
    let base_path = config.base_path.as_deref()
        .map(|bp| crate::shell::normalize_base_path(bp))
        .unwrap_or_default();

    let state = Arc::new(ServerState {
        cache_dir,
        public_dir: work_dir.join("public"),
        shell_dir,
        work_dir: work_dir.clone(),
        config,
        album_config,
        base_path,
    });

    rt.spawn(async move {
        let mut shutdown_rx = shutdown_rx;
        loop {
            tokio::select! {
                result = listener.accept() => {
                    if let Ok((stream, _)) = result {
                        let state = state.clone();
                        tokio::spawn(async move {
                            let io = TokioIo::new(stream);
                            let svc = service_fn(move |req| {
                                let state = state.clone();
                                async move { handle_request(req, &state) }
                            });
                            let _ = hyper::server::conn::http1::Builder::new()
                                .serve_connection(io, svc)
                                .await;
                        });
                    }
                }
                _ = &mut shutdown_rx => {
                    break;
                }
            }
        }
    });

    // Keep the runtime alive by leaking it (it will be cleaned up on process exit)
    // This is intentional — the runtime must outlive the ServeHandle.
    std::mem::forget(rt);

    Ok(ServeHandle::new(bound_addr, shutdown_tx))
}

/// Handle a single HTTP request by resolving the file path.
fn handle_request(
    req: Request<hyper::body::Incoming>,
    state: &ServerState,
) -> Result<Response<Full<Bytes>>, std::convert::Infallible> {
    let raw_path = req.uri().path();

    // Strip basePath prefix if configured (e.g. "/blog/assets/index.js" → "/assets/index.js")
    let path = if !state.base_path.is_empty() && raw_path.starts_with(&state.base_path) {
        let stripped = &raw_path[state.base_path.len()..];
        if stripped.is_empty() || stripped.starts_with('/') {
            stripped
        } else {
            raw_path
        }
    } else {
        raw_path
    };

    // Strip leading slash for file resolution
    let rel = path.trim_start_matches('/');

    // Dynamic regeneration for manifest and album index on every request
    if rel == "generated/manifest.json" {
        let posts_dir = state.work_dir.join("posts");
        if posts_dir.exists() {
            let _ = crate::posts::generate_posts_manifest_only(
                &posts_dir, &state.cache_dir, &state.config,
            );
        }
    } else if rel == "generated/albums-index.json" || rel.starts_with("generated/album-") {
        if let Some(ref ac) = state.album_config {
            let albums_dir = state.work_dir.join("albums");
            if albums_dir.exists() {
                let _ = crate::albums::generate_albums_index_only(
                    &albums_dir, &state.cache_dir, ac, state.config.base_path.as_deref(),
                );
            }
        }
    }

    // Priority 1: .cache/ generated data (manifest.json, album data)
    let candidate = state.cache_dir.join(rel);
    if candidate.is_file() {
        return Ok(serve_file(&candidate));
    }

    // Priority 2: work_dir files (posts/, albums/, config.json, public/ root files, etc.)
    let candidate = state.work_dir.join(rel);
    if candidate.is_file() {
        return Ok(serve_file(&candidate));
    }

    // Priority 3: public/ static assets (for files requested without "public/" prefix)
    let candidate = state.public_dir.join(rel);
    if candidate.is_file() {
        return Ok(serve_file(&candidate));
    }

    // Priority 4: shell files
    let candidate = state.shell_dir.join(rel);
    if candidate.is_file() {
        if rel == "index.html" || rel.is_empty() {
            return Ok(serve_index_html(&candidate, &state.base_path));
        }
        return Ok(serve_file(&candidate));
    }

    // Priority 5: SPA fallback or 404
    if has_file_extension(path) {
        // Has extension but file not found → 404
        Ok(Response::builder()
            .status(StatusCode::NOT_FOUND)
            .body(Full::new(Bytes::from("404 Not Found")))
            .unwrap())
    } else {
        // No extension → serve index.html (SPA fallback) with basePath rewrite
        let index = state.shell_dir.join("index.html");
        if index.is_file() {
            Ok(serve_index_html(&index, &state.base_path))
        } else {
            Ok(Response::builder()
                .status(StatusCode::NOT_FOUND)
                .body(Full::new(Bytes::from("404 Not Found")))
                .unwrap())
        }
    }
}

/// Serve index.html with `./` references rewritten to use the configured basePath.
///
/// This ensures that regardless of the browser's current URL depth, asset
/// references resolve to absolute paths that the server can correctly map.
fn serve_index_html(path: &Path, base_path: &str) -> Response<Full<Bytes>> {
    match fs::read_to_string(path) {
        Ok(html) => {
            let rewritten = crate::shell::rewrite_base_path(&html, base_path);
            Response::builder()
                .status(StatusCode::OK)
                .header("Content-Type", "text/html")
                .body(Full::new(Bytes::from(rewritten)))
                .unwrap()
        }
        Err(_) => Response::builder()
            .status(StatusCode::INTERNAL_SERVER_ERROR)
            .body(Full::new(Bytes::from("500 Internal Server Error")))
            .unwrap(),
    }
}

/// Read a file and return an HTTP response with the appropriate MIME type.
fn serve_file(path: &Path) -> Response<Full<Bytes>> {
    match fs::read(path) {
        Ok(content) => {
            let ext = path
                .extension()
                .and_then(|e| e.to_str())
                .unwrap_or("");
            let mime = resolve_mime_type(ext);
            Response::builder()
                .status(StatusCode::OK)
                .header("Content-Type", mime)
                .body(Full::new(Bytes::from(content)))
                .unwrap()
        }
        Err(_) => Response::builder()
            .status(StatusCode::INTERNAL_SERVER_ERROR)
            .body(Full::new(Bytes::from("500 Internal Server Error")))
            .unwrap(),
    }
}
