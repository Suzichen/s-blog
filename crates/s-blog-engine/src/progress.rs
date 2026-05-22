//! Build progress output with TTY auto-detection.

use std::io::{self, IsTerminal, Write};
use std::time::Instant;

/// Handles build progress output, adapting to TTY vs non-TTY environments.
pub struct BuildProgress {
    is_tty: bool,
}

impl BuildProgress {
    pub fn new() -> Self {
        Self {
            is_tty: io::stdout().is_terminal(),
        }
    }

    pub fn step_start(&self, name: &str) {
        if self.is_tty {
            println!("  {name}...");
        }
    }

    pub fn step_done(&self, name: &str, detail: &str) {
        println!("  {name} ✓ {detail}");
    }

    pub fn albums_start(&self, count: usize) {
        println!("  [albums] Processing {count} albums...");
    }

    pub fn photo_progress(&self, album: &str, current: usize, total: usize) {
        if !self.is_tty {
            return;
        }
        let bar = progress_bar(current, total, 20);
        print!("\r\x1b[K  [albums] {album} {bar} {current}/{total}");
        let _ = io::stdout().flush();
    }

    pub fn photo_album_done(&self, album: &str, count: usize, elapsed: &Instant) {
        let ms = elapsed.elapsed().as_millis();
        if self.is_tty {
            print!("\r\x1b[K");
        }
        println!("  [albums] {album} ✓ {count} photos ({ms}ms)");
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
