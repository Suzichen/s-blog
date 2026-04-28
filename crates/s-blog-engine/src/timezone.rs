//! Date timezone conversion utilities.
//!
//! Converts date strings to a target IANA timezone and outputs
//! ISO 8601 format without timezone suffix (`YYYY-MM-DDTHH:mm:ss`).
//!
//! Behaviour mirrors the TypeScript `generate-posts-data.ts` logic:
//!
//! - If the date string **has** a timezone offset *and* a valid target
//!   timezone is configured → convert to that timezone.
//! - If the date string **lacks** a timezone offset → treat as UTC and
//!   format as-is (no conversion).
//! - If the target timezone identifier is invalid → warn and fall back
//!   to UTC.

use chrono::{DateTime, FixedOffset, NaiveDate, NaiveDateTime, Utc};
use chrono_tz::Tz;
use log::warn;

/// Check whether a raw date string contains an explicit timezone offset.
///
/// Recognises trailing `Z`, `+HH:MM`, `+HHMM`, `-HH:MM`, `-HHMM`.
pub fn has_timezone_offset(date_str: &str) -> bool {
    let s = date_str.trim();
    if s.is_empty() {
        return false;
    }
    // Trailing Z
    if s.ends_with('Z') || s.ends_with('z') {
        return true;
    }
    // +HH:MM / -HH:MM / +HHMM / -HHMM at the end
    let bytes = s.as_bytes();
    let len = bytes.len();

    // Check for ±HH:MM (6 chars from end)
    if len >= 6 {
        let sign_pos = len - 6;
        if (bytes[sign_pos] == b'+' || bytes[sign_pos] == b'-')
            && bytes[sign_pos + 1].is_ascii_digit()
            && bytes[sign_pos + 2].is_ascii_digit()
            && bytes[sign_pos + 3] == b':'
            && bytes[sign_pos + 4].is_ascii_digit()
            && bytes[sign_pos + 5].is_ascii_digit()
        {
            return true;
        }
    }

    // Check for ±HHMM (5 chars from end)
    if len >= 5 {
        let sign_pos = len - 5;
        if (bytes[sign_pos] == b'+' || bytes[sign_pos] == b'-')
            && bytes[sign_pos + 1].is_ascii_digit()
            && bytes[sign_pos + 2].is_ascii_digit()
            && bytes[sign_pos + 3].is_ascii_digit()
            && bytes[sign_pos + 4].is_ascii_digit()
        {
            return true;
        }
    }

    false
}

/// Parse a date string into a [`DateTime<FixedOffset>`].
///
/// Supports:
/// - RFC 3339 (`2025-01-01T18:00:00+09:00`)
/// - Space-separated with offset (`2025-01-01 18:00:00+09:00`)
/// - `T`-separated with offset (`2025-01-01T18:00:00+09:00`)
///
/// Returns `None` if the string cannot be parsed as a date with offset.
fn parse_datetime_with_offset(s: &str) -> Option<DateTime<FixedOffset>> {
    let s = s.trim();

    // 1. RFC 3339
    if let Ok(dt) = DateTime::parse_from_rfc3339(s) {
        return Some(dt);
    }

    // 2. Common formats with offset
    let formats = [
        "%Y-%m-%dT%H:%M:%S%:z",
        "%Y-%m-%d %H:%M:%S%:z",
        "%Y-%m-%dT%H:%M:%S%z",
        "%Y-%m-%d %H:%M:%S%z",
    ];
    for fmt in formats {
        if let Ok(dt) = DateTime::parse_from_str(s, fmt) {
            return Some(dt);
        }
    }

    None
}

/// Parse a date string into a [`NaiveDateTime`] (no timezone info).
///
/// Supports:
/// - `2025-01-01 18:00:00`
/// - `2025-01-01T18:00:00`
/// - `2025-01-01 18:00`
/// - `2025-01-01` (time defaults to 00:00:00)
fn parse_naive_datetime(s: &str) -> Option<NaiveDateTime> {
    let s = s.trim();

    let formats = [
        "%Y-%m-%dT%H:%M:%S",
        "%Y-%m-%d %H:%M:%S",
        "%Y-%m-%dT%H:%M",
        "%Y-%m-%d %H:%M",
    ];
    for fmt in formats {
        if let Ok(dt) = NaiveDateTime::parse_from_str(s, fmt) {
            return Some(dt);
        }
    }

    // Date-only → midnight
    if let Ok(d) = NaiveDate::parse_from_str(s, "%Y-%m-%d") {
        return d.and_hms_opt(0, 0, 0);
    }

    None
}

/// Format a [`NaiveDateTime`] as ISO 8601 without timezone suffix.
///
/// Output: `YYYY-MM-DDTHH:mm:ss`
fn format_iso_no_tz(dt: NaiveDateTime) -> String {
    dt.format("%Y-%m-%dT%H:%M:%S").to_string()
}

/// Pre-parse an IANA timezone string into a [`Tz`] value.
///
/// Call this once before a loop and pass the result to
/// [`format_date_with_tz`] to avoid re-parsing the same string on
/// every iteration.
///
/// Returns `None` (with a warning) if the identifier is invalid.
pub fn resolve_timezone(tz_str: &str) -> Option<Tz> {
    match tz_str.parse::<Tz>() {
        Ok(tz) => Some(tz),
        Err(_) => {
            warn!(
                "Invalid timezone configuration: {}. Falling back to UTC.",
                tz_str
            );
            None
        }
    }
}

/// Convert a date string to the specified IANA timezone.
///
/// # Behaviour
///
/// | date has offset? | timezone valid? | result |
/// |------------------|-----------------|--------|
/// | yes              | yes             | convert to target tz, output naive ISO |
/// | yes              | no (invalid)    | warn, convert to UTC, output naive ISO |
/// | no               | any             | treat as UTC, output naive ISO |
/// | unparseable      | any             | return empty string |
///
/// # Arguments
///
/// * `date_str` – The raw date string from frontmatter.
/// * `timezone` – An IANA timezone identifier (e.g. `"Asia/Tokyo"`).
///
/// # Returns
///
/// An ISO 8601 string without timezone suffix, or an empty string if
/// the date cannot be parsed at all.
pub fn convert_to_timezone(date_str: &str, timezone: &str) -> String {
    let date_str = date_str.trim();
    if date_str.is_empty() {
        return String::new();
    }

    let has_offset = has_timezone_offset(date_str);

    if has_offset {
        // Parse the date with its embedded offset.
        let dt = match parse_datetime_with_offset(date_str) {
            Some(dt) => dt,
            None => {
                // Unparseable despite having an offset pattern.
                warn!("Cannot parse date with offset: {}", date_str);
                return String::new();
            }
        };

        // Resolve the target timezone.
        match timezone.parse::<Tz>() {
            Ok(tz) => {
                let converted = dt.with_timezone(&tz);
                format_iso_no_tz(converted.naive_local())
            }
            Err(_) => {
                warn!(
                    "Invalid timezone configuration: {}. Falling back to UTC.",
                    timezone
                );
                let utc = dt.with_timezone(&Utc);
                format_iso_no_tz(utc.naive_utc())
            }
        }
    } else {
        // No offset → treat as UTC, output as-is.
        match parse_naive_datetime(date_str) {
            Some(dt) => format_iso_no_tz(dt),
            None => {
                warn!("Cannot parse naive date: {}", date_str);
                String::new()
            }
        }
    }
}

/// Format a date string for the manifest.
///
/// This is the main entry point used by the posts module. It mirrors
/// the TypeScript logic:
///
/// 1. If `timezone` is `Some` **and** the raw date has an offset →
///    convert to that timezone.
/// 2. Otherwise → format as UTC (naive).
///
/// Returns an empty string for unparseable dates.
pub fn format_date(raw_date: &str, timezone: Option<&str>) -> String {
    let raw = raw_date.trim();
    if raw.is_empty() {
        return String::new();
    }

    let has_offset = has_timezone_offset(raw);

    match (timezone, has_offset) {
        (Some(tz), true) => convert_to_timezone(raw, tz),
        _ => {
            // No timezone configured, or date has no offset → UTC / as-is.
            if has_offset {
                // Has offset but no target tz → convert to UTC.
                match parse_datetime_with_offset(raw) {
                    Some(dt) => {
                        let utc = dt.with_timezone(&Utc);
                        format_iso_no_tz(utc.naive_utc())
                    }
                    None => {
                        warn!("Cannot parse date: {}", raw);
                        String::new()
                    }
                }
            } else {
                match parse_naive_datetime(raw) {
                    Some(dt) => format_iso_no_tz(dt),
                    None => {
                        warn!("Cannot parse date: {}", raw);
                        String::new()
                    }
                }
            }
        }
    }
}

/// Like [`format_date`] but accepts a pre-resolved [`Tz`] so the
/// caller can parse the timezone string once and reuse it across many
/// dates (e.g. in the posts loop).
///
/// Use [`resolve_timezone`] to obtain the `Option<Tz>`.
pub fn format_date_with_tz(raw_date: &str, tz: Option<Tz>) -> String {
    let raw = raw_date.trim();
    if raw.is_empty() {
        return String::new();
    }

    let has_offset = has_timezone_offset(raw);

    match (tz, has_offset) {
        (Some(tz), true) => {
            match parse_datetime_with_offset(raw) {
                Some(dt) => {
                    let converted = dt.with_timezone(&tz);
                    format_iso_no_tz(converted.naive_local())
                }
                None => {
                    warn!("Cannot parse date with offset: {}", raw);
                    String::new()
                }
            }
        }
        (_, true) => {
            // Has offset but no target tz → convert to UTC.
            match parse_datetime_with_offset(raw) {
                Some(dt) => {
                    let utc = dt.with_timezone(&Utc);
                    format_iso_no_tz(utc.naive_utc())
                }
                None => {
                    warn!("Cannot parse date: {}", raw);
                    String::new()
                }
            }
        }
        (_, false) => {
            match parse_naive_datetime(raw) {
                Some(dt) => format_iso_no_tz(dt),
                None => {
                    warn!("Cannot parse date: {}", raw);
                    String::new()
                }
            }
        }
    }
}

// ── Tests ──────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    // ── has_timezone_offset ────────────────────────────────────────

    #[test]
    fn offset_trailing_z() {
        assert!(has_timezone_offset("2025-01-01T00:00:00Z"));
        assert!(has_timezone_offset("2025-01-01T00:00:00z"));
    }

    #[test]
    fn offset_plus_hhmm_colon() {
        assert!(has_timezone_offset("2025-01-01T18:00:00+09:00"));
        assert!(has_timezone_offset("2025-01-01 18:00:00+09:00"));
    }

    #[test]
    fn offset_minus_hhmm_colon() {
        assert!(has_timezone_offset("2025-01-01T18:00:00-05:00"));
    }

    #[test]
    fn offset_plus_hhmm_no_colon() {
        assert!(has_timezone_offset("2025-01-01T18:00:00+0900"));
    }

    #[test]
    fn no_offset_naive_datetime() {
        assert!(!has_timezone_offset("2025-01-01T18:00:00"));
        assert!(!has_timezone_offset("2025-01-01 18:00:00"));
    }

    #[test]
    fn no_offset_date_only() {
        assert!(!has_timezone_offset("2025-01-01"));
    }

    #[test]
    fn no_offset_empty() {
        assert!(!has_timezone_offset(""));
        assert!(!has_timezone_offset("   "));
    }

    // ── convert_to_timezone ────────────────────────────────────────

    #[test]
    fn convert_rfc3339_to_tokyo() {
        // 2025-01-01T09:00:00Z → Asia/Tokyo (+9) → 2025-01-01T18:00:00
        let result = convert_to_timezone("2025-01-01T09:00:00Z", "Asia/Tokyo");
        assert_eq!(result, "2025-01-01T18:00:00");
    }

    #[test]
    fn convert_offset_to_tokyo() {
        // 2025-01-01T18:00:00+09:00 is already JST → stays 18:00
        let result = convert_to_timezone("2025-01-01T18:00:00+09:00", "Asia/Tokyo");
        assert_eq!(result, "2025-01-01T18:00:00");
    }

    #[test]
    fn convert_space_separated_offset_to_tokyo() {
        let result = convert_to_timezone("2025-01-01 09:00:00+00:00", "Asia/Tokyo");
        assert_eq!(result, "2025-01-01T18:00:00");
    }

    #[test]
    fn convert_cross_day_boundary() {
        // 2025-01-01T23:00:00+00:00 → Asia/Tokyo (+9) → 2025-01-02T08:00:00
        let result = convert_to_timezone("2025-01-01T23:00:00+00:00", "Asia/Tokyo");
        assert_eq!(result, "2025-01-02T08:00:00");
    }

    #[test]
    fn convert_negative_offset_to_utc() {
        // 2025-01-01T20:00:00-05:00 → UTC → 2025-01-02T01:00:00
        let result = convert_to_timezone("2025-01-01T20:00:00-05:00", "UTC");
        assert_eq!(result, "2025-01-02T01:00:00");
    }

    #[test]
    fn convert_no_offset_treated_as_utc() {
        // No offset → output as-is (treated as UTC, no conversion)
        let result = convert_to_timezone("2025-01-01 10:30:00", "Asia/Tokyo");
        assert_eq!(result, "2025-01-01T10:30:00");
    }

    #[test]
    fn convert_date_only_no_offset() {
        let result = convert_to_timezone("2025-01-01", "Asia/Tokyo");
        assert_eq!(result, "2025-01-01T00:00:00");
    }

    #[test]
    fn convert_invalid_timezone_falls_back_to_utc() {
        // Invalid tz → warn + fall back to UTC
        // 2025-01-01T18:00:00+09:00 in UTC → 2025-01-01T09:00:00
        let result = convert_to_timezone("2025-01-01T18:00:00+09:00", "Invalid/Timezone");
        assert_eq!(result, "2025-01-01T09:00:00");
    }

    #[test]
    fn convert_empty_date_returns_empty() {
        assert_eq!(convert_to_timezone("", "Asia/Tokyo"), "");
        assert_eq!(convert_to_timezone("   ", "Asia/Tokyo"), "");
    }

    // ── format_date ────────────────────────────────────────────────

    #[test]
    fn format_date_with_tz_and_offset() {
        let result = format_date("2025-01-01T09:00:00Z", Some("Asia/Tokyo"));
        assert_eq!(result, "2025-01-01T18:00:00");
    }

    #[test]
    fn format_date_with_tz_no_offset() {
        // No offset in date → treated as UTC, output as-is
        let result = format_date("2025-01-01 10:30:00", Some("Asia/Tokyo"));
        assert_eq!(result, "2025-01-01T10:30:00");
    }

    #[test]
    fn format_date_no_tz_with_offset() {
        // No timezone configured, date has offset → convert to UTC
        let result = format_date("2025-01-01T18:00:00+09:00", None);
        assert_eq!(result, "2025-01-01T09:00:00");
    }

    #[test]
    fn format_date_no_tz_no_offset() {
        let result = format_date("2025-01-01 10:30:00", None);
        assert_eq!(result, "2025-01-01T10:30:00");
    }

    #[test]
    fn format_date_date_only() {
        let result = format_date("2025-06-15", None);
        assert_eq!(result, "2025-06-15T00:00:00");
    }

    #[test]
    fn format_date_empty() {
        assert_eq!(format_date("", None), "");
        assert_eq!(format_date("", Some("Asia/Tokyo")), "");
    }

    #[test]
    fn format_date_with_minute_only_time() {
        let result = format_date("2025-01-01 10:30", None);
        assert_eq!(result, "2025-01-01T10:30:00");
    }

    // ── resolve_timezone + format_date_with_tz ─────────────────────

    #[test]
    fn resolve_valid_timezone() {
        let tz = resolve_timezone("Asia/Tokyo");
        assert!(tz.is_some());
    }

    #[test]
    fn resolve_invalid_timezone_returns_none() {
        let tz = resolve_timezone("Not/Real");
        assert!(tz.is_none());
    }

    #[test]
    fn format_date_with_tz_preresolved() {
        let tz = resolve_timezone("Asia/Tokyo");
        let result = format_date_with_tz("2025-01-01T09:00:00Z", tz);
        assert_eq!(result, "2025-01-01T18:00:00");
    }

    #[test]
    fn format_date_with_tz_none_falls_back_to_utc() {
        let result = format_date_with_tz("2025-01-01T18:00:00+09:00", None);
        assert_eq!(result, "2025-01-01T09:00:00");
    }

    #[test]
    fn format_date_with_tz_no_offset_passthrough() {
        let tz = resolve_timezone("Asia/Tokyo");
        let result = format_date_with_tz("2025-01-01 10:30:00", tz);
        assert_eq!(result, "2025-01-01T10:30:00");
    }

    #[test]
    fn format_date_with_tz_matches_format_date() {
        // Ensure both APIs produce identical results.
        let cases = [
            ("2025-01-01T09:00:00Z", Some("Asia/Tokyo")),
            ("2025-01-01 10:30:00", Some("Asia/Tokyo")),
            ("2025-01-01T18:00:00+09:00", None),
            ("2025-01-01 10:30:00", None),
            ("2025-06-15", None),
            ("", Some("Asia/Tokyo")),
        ];
        for (date, tz_str) in cases {
            let via_str = format_date(date, tz_str);
            let resolved = tz_str.and_then(resolve_timezone);
            let via_tz = format_date_with_tz(date, resolved);
            assert_eq!(via_str, via_tz, "mismatch for date={date:?} tz={tz_str:?}");
        }
    }
}
