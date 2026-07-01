//! EXIF metadata extraction.
//!
//! Reads camera make/model, focal length, aperture, shutter speed,
//! and ISO from image files using the `kamadak-exif` crate.

use std::path::Path;

use exif::{In, Reader, Tag};
use serde::{Deserialize, Serialize};

/// EXIF metadata extracted from a photo.
///
/// All fields are `Option<String>` — when a tag is missing or the file
/// cannot be read, the field is `None` (serialised as JSON `null`).
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ExifData {
    pub camera_make: Option<String>,
    pub camera_model: Option<String>,
    pub focal_length: Option<String>,
    pub aperture: Option<String>,
    pub shutter_speed: Option<String>,
    pub iso: Option<String>,
}

impl ExifData {
    /// Returns an `ExifData` with every field set to `None`.
    pub fn empty() -> Self {
        Self {
            camera_make: None,
            camera_model: None,
            focal_length: None,
            aperture: None,
            shutter_speed: None,
            iso: None,
        }
    }
}

/// Read EXIF metadata from the file at `path`.
///
/// If the file cannot be opened, is not a supported format, or contains
/// no EXIF data, an [`ExifData`] with all-`None` fields is returned
/// (requirement 2.5.4).
pub fn read_exif(path: &Path) -> ExifData {
    let file = match std::fs::File::open(path) {
        Ok(f) => f,
        Err(e) => {
            log::debug!("Cannot open file for EXIF reading {}: {e}", path.display());
            return ExifData::empty();
        }
    };

    let mut buf_reader = std::io::BufReader::new(file);
    let exif = match Reader::new().read_from_container(&mut buf_reader) {
        Ok(e) => e,
        Err(e) => {
            // Use debug level — many valid image formats (PNG, WebP) simply
            // don't carry EXIF data, so this is expected rather than alarming.
            log::debug!("No EXIF data in {}: {e}", path.display());
            return ExifData::empty();
        }
    };

    let get_string = |tag: Tag| -> Option<String> {
        exif.get_field(tag, In::PRIMARY)
            .map(|f| f.display_value().to_string().trim().to_string())
            .filter(|s| !s.is_empty())
    };

    // ── Make / Model ───────────────────────────────────────────
    // The display_value for ASCII fields wraps the string in quotes,
    // e.g. `"NIKON CORPORATION"`. Strip surrounding quotes.
    let camera_make = get_string(Tag::Make).map(strip_quotes);
    let camera_model = get_string(Tag::Model).map(strip_quotes);

    // ── FocalLength ────────────────────────────────────────────
    // Requirement 2.5.3: round to nearest integer.
    let focal_length = exif
        .get_field(Tag::FocalLength, In::PRIMARY)
        .and_then(|f| rational_to_f64(&f.value))
        .map(|v| format!("{}", v.round() as i64));

    // ── FNumber (aperture) ─────────────────────────────────────
    let aperture = exif
        .get_field(Tag::FNumber, In::PRIMARY)
        .and_then(|f| rational_to_f64(&f.value))
        .map(|v| format_f_number(v));

    // ── ExposureTime (shutter speed) ───────────────────────────
    // Requirement 2.5.2: format as fraction (e.g. "1/250") when < 1s.
    let shutter_speed = exif
        .get_field(Tag::ExposureTime, In::PRIMARY)
        .and_then(|f| exposure_rational(&f.value))
        .map(|(num, denom)| format_shutter_speed(num, denom));

    // ── ISO ────────────────────────────────────────────────────
    let iso = exif
        .get_field(Tag::PhotographicSensitivity, In::PRIMARY)
        .map(|f| f.display_value().to_string().trim().to_string())
        .filter(|s| !s.is_empty());

    ExifData {
        camera_make,
        camera_model,
        focal_length,
        aperture,
        shutter_speed,
        iso,
    }
}


// ── Helper functions ───────────────────────────────────────────────

/// Strip surrounding double-quotes that `display_value` adds for ASCII tags.
fn strip_quotes(s: String) -> String {
    let trimmed = s.trim();
    if trimmed.starts_with('"') && trimmed.ends_with('"') && trimmed.len() >= 2 {
        trimmed[1..trimmed.len() - 1].to_string()
    } else {
        trimmed.to_string()
    }
}

/// Extract numerator and denominator from an EXIF Rational value.
/// Returns `(numerator, denominator)` for ExposureTime formatting.
/// Returns `None` when the value is zero or invalid (denom == 0).
fn exposure_rational(value: &exif::Value) -> Option<(u32, u32)> {
    match value {
        exif::Value::Rational(ref v) if !v.is_empty() => {
            let r = v[0];
            if r.num == 0 || r.denom == 0 {
                None
            } else {
                Some((r.num, r.denom))
            }
        }
        _ => None,
    }
}

/// Convert an EXIF Rational value to `f64`.
/// Returns `None` for zero or invalid rationals (denom == 0 or num == 0).
fn rational_to_f64(value: &exif::Value) -> Option<f64> {
    match value {
        exif::Value::Rational(ref v) if !v.is_empty() => {
            let r = v[0];
            if r.num == 0 || r.denom == 0 {
                None
            } else {
                Some(r.num as f64 / r.denom as f64)
            }
        }
        _ => None,
    }
}

/// Format shutter speed to match the TS implementation:
/// - If exposure time < 1 second → `"1/{round(1/time)}"`
/// - Otherwise → the decimal value as a string.
pub fn format_shutter_speed(num: u32, denom: u32) -> String {
    if denom == 0 {
        return String::from("0");
    }
    let value = num as f64 / denom as f64;
    if value < 1.0 {
        let reciprocal = (1.0 / value).round() as u64;
        format!("1/{reciprocal}")
    } else {
        // Match TS: String(exposureTime) for values >= 1
        format_float(value)
    }
}

/// Format an f-number value, dropping the trailing `.0` when it's a
/// whole number so the output matches the TS `String(fNumber)` behaviour.
pub fn format_f_number(v: f64) -> String {
    format_float(v)
}

/// Format a float the same way JavaScript's `String(n)` does for the
/// values we encounter in EXIF data (small rationals).
pub fn format_float(v: f64) -> String {
    if v == v.trunc() {
        // Whole number — no decimal point
        format!("{}", v as i64)
    } else {
        format!("{v}")
    }
}

// ── Tests ──────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn strip_quotes_removes_surrounding_quotes() {
        assert_eq!(strip_quotes("\"NIKON\"".into()), "NIKON");
        assert_eq!(strip_quotes("NIKON".into()), "NIKON");
        assert_eq!(strip_quotes("\"\"".into()), "");
    }

    #[test]
    fn format_shutter_speed_fraction() {
        // 1/250 s
        assert_eq!(format_shutter_speed(1, 250), "1/250");
        // 10/2500 = 0.004 → 1/250
        assert_eq!(format_shutter_speed(10, 2500), "1/250");
    }

    #[test]
    fn format_shutter_speed_whole() {
        // 30 seconds
        assert_eq!(format_shutter_speed(30, 1), "30");
    }

    #[test]
    fn format_f_number_whole() {
        assert_eq!(format_f_number(2.0), "2");
    }

    #[test]
    fn format_f_number_decimal() {
        assert_eq!(format_f_number(1.8), "1.8");
    }

    #[test]
    fn format_float_integer() {
        assert_eq!(format_float(100.0), "100");
    }

    #[test]
    fn format_float_decimal() {
        assert_eq!(format_float(5.6), "5.6");
    }

    #[test]
    fn empty_exif_all_none() {
        let e = ExifData::empty();
        assert_eq!(e.camera_make, None);
        assert_eq!(e.camera_model, None);
        assert_eq!(e.focal_length, None);
        assert_eq!(e.aperture, None);
        assert_eq!(e.shutter_speed, None);
        assert_eq!(e.iso, None);
    }

    #[test]
    fn read_exif_nonexistent_file_returns_empty() {
        let data = read_exif(Path::new("/nonexistent/photo.jpg"));
        assert_eq!(data, ExifData::empty());
    }

    #[test]
    fn exif_data_serializes_to_camel_case() {
        let data = ExifData {
            camera_make: Some("NIKON".into()),
            camera_model: Some("D850".into()),
            focal_length: Some("50".into()),
            aperture: Some("1.8".into()),
            shutter_speed: Some("1/250".into()),
            iso: Some("100".into()),
        };
        let json = serde_json::to_value(&data).unwrap();
        assert_eq!(json["cameraMake"], "NIKON");
        assert_eq!(json["cameraModel"], "D850");
        assert_eq!(json["focalLength"], "50");
        assert_eq!(json["aperture"], "1.8");
        assert_eq!(json["shutterSpeed"], "1/250");
        assert_eq!(json["iso"], "100");
    }

    #[test]
    fn exif_data_none_serializes_to_null() {
        let data = ExifData::empty();
        let json = serde_json::to_value(&data).unwrap();
        assert!(json["cameraMake"].is_null());
        assert!(json["shutterSpeed"].is_null());
    }

    #[test]
    fn read_exif_from_real_jpeg() {
        // Use the test fixture JPEG that has EXIF data
        let fixture = Path::new("../../albums/Sakura/DSC_1136.JPG");
        if !fixture.exists() {
            // Skip if fixture not available (CI may not have it)
            return;
        }
        let data = read_exif(fixture);
        // We just verify it doesn't panic and returns *something*
        // The exact values depend on the fixture file
        assert!(
            data.camera_make.is_some() || data.camera_model.is_some(),
            "Expected at least make or model from a real JPEG with EXIF"
        );
    }
}
