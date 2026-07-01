//! Build progress output with TTY auto-detection.

use std::io::{self, IsTerminal, Write};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::Instant;

// ── Event-based progress (for GUI consumers) ───────────────────────

/// Progress events emitted during build operations.
#[derive(Debug, Clone)]
pub enum BuildProgressEvent {
    StepStart { step: String },
    StepDone { step: String, detail: String },
    AlbumsStart { count: usize },
    PhotoProgress { album: String, current: usize, total: usize },
    PhotoAlbumDone { album: String, count: usize, duration_ms: u64 },
}

/// Runtime context for build operations.
pub struct BuildContext {
    pub on_progress: Option<Box<dyn Fn(BuildProgressEvent) + Send>>,
    pub cancelled: Option<Arc<AtomicBool>>,
    /// S3 credentials for pull_build_assets (CI mode with provider).
    pub credentials: Option<crate::media_sync::S3Credentials>,
}

impl BuildContext {
    /// Check if cancellation has been requested.
    pub fn is_cancelled(&self) -> bool {
        self.cancelled.as_ref().map_or(false, |c| c.load(Ordering::SeqCst))
    }
}

// ── TTY-based progress (for CLI) ───────────────────────────────────

/// Handles build progress output, adapting to TTY vs non-TTY environments.
/// When a callback is provided, events are forwarded instead of printed.
pub struct BuildProgress {
    is_tty: bool,
    callback: Option<Box<dyn Fn(BuildProgressEvent) + Send>>,
    cancelled: Option<Arc<AtomicBool>>,
}

impl BuildProgress {
    pub fn new() -> Self {
        Self {
            is_tty: io::stdout().is_terminal(),
            callback: None,
            cancelled: None,
        }
    }

    /// Create a BuildProgress that forwards events to a callback instead of printing.
    pub fn with_callback(callback: Box<dyn Fn(BuildProgressEvent) + Send>) -> Self {
        Self {
            is_tty: false,
            callback: Some(callback),
            cancelled: None,
        }
    }

    /// Attach a cancellation token.
    pub fn with_cancelled(mut self, token: Arc<AtomicBool>) -> Self {
        self.cancelled = Some(token);
        self
    }

    /// Check if cancellation has been requested.
    pub fn is_cancelled(&self) -> bool {
        self.cancelled.as_ref().map_or(false, |c| c.load(Ordering::SeqCst))
    }

    pub fn step_start(&self, name: &str) {
        if let Some(ref cb) = self.callback {
            cb(BuildProgressEvent::StepStart { step: name.to_string() });
        } else if self.is_tty {
            println!("  {name}...");
        }
    }

    pub fn step_done(&self, name: &str, detail: &str) {
        if let Some(ref cb) = self.callback {
            cb(BuildProgressEvent::StepDone { step: name.to_string(), detail: detail.to_string() });
        } else {
            println!("  {name} ✓ {detail}");
        }
    }

    pub fn albums_start(&self, count: usize) {
        if let Some(ref cb) = self.callback {
            cb(BuildProgressEvent::AlbumsStart { count });
        } else {
            println!("  [albums] Processing {count} albums...");
        }
    }

    pub fn photo_progress(&self, album: &str, current: usize, total: usize) {
        if let Some(ref cb) = self.callback {
            cb(BuildProgressEvent::PhotoProgress { album: album.to_string(), current, total });
        } else {
            if !self.is_tty {
                return;
            }
            let bar = progress_bar(current, total, 20);
            print!("\r\x1b[K  [albums] {album} {bar} {current}/{total}");
            let _ = io::stdout().flush();
        }
    }

    pub fn photo_album_done(&self, album: &str, count: usize, elapsed: &Instant) {
        let ms = elapsed.elapsed().as_millis() as u64;
        if let Some(ref cb) = self.callback {
            cb(BuildProgressEvent::PhotoAlbumDone { album: album.to_string(), count, duration_ms: ms });
        } else {
            if self.is_tty {
                print!("\r\x1b[K");
            }
            println!("  [albums] {album} ✓ {count} photos ({ms}ms)");
        }
    }
}

fn progress_bar(current: usize, total: usize, width: usize) -> String {
    let filled = if total == 0 { 0 } else { (current * width) / total };
    let empty = width - filled;
    format!("[{}{}]", "█".repeat(filled), "░".repeat(empty))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn progress_bar_empty() {
        assert_eq!(progress_bar(0, 10, 10), "[░░░░░░░░░░]");
    }

    #[test]
    fn progress_bar_half() {
        assert_eq!(progress_bar(5, 10, 10), "[█████░░░░░]");
    }

    #[test]
    fn progress_bar_full() {
        assert_eq!(progress_bar(10, 10, 10), "[██████████]");
    }

    #[test]
    fn progress_bar_zero_total() {
        assert_eq!(progress_bar(0, 0, 10), "[░░░░░░░░░░]");
    }
}
