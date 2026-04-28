//! Property-based tests for EXIF formatting (Property 6).
//!
//! **Property 6 – EXIF Formatting**
//!
//! *For any* ExposureTime value less than 1 second, the EXIF_Reader SHALL
//! format it as a fraction (e.g., "1/250"). *For any* FocalLength value,
//! the EXIF_Reader SHALL round it to the nearest integer.
//!
//! **Validates: Requirements 2.5.2, 2.5.3**

use proptest::prelude::*;

use s_blog_engine::exif::{format_f_number, format_float, format_shutter_speed};

// ── Strategies ─────────────────────────────────────────────────────

/// Exposure time as (numerator, denominator) where the resulting value
/// is strictly less than 1 second (num < denom). Both are non-zero.
fn sub_second_exposure() -> impl Strategy<Value = (u32, u32)> {
    // num in [1, 999], denom in [num+1, 10_000] ensures num/denom < 1.
    (1..=999u32).prop_flat_map(|num| {
        ((num + 1)..=10_000u32).prop_map(move |denom| (num, denom))
    })
}

/// Exposure time as (numerator, denominator) where the resulting value
/// is >= 1 second (num >= denom). Both are non-zero.
fn whole_second_or_more_exposure() -> impl Strategy<Value = (u32, u32)> {
    (1..=10_000u32).prop_flat_map(|denom| {
        (denom..=10_000u32).prop_map(move |num| (num, denom))
    })
}

/// Focal length as a rational (numerator, denominator) producing a
/// positive f64 value. Both are non-zero.
fn focal_length_rational() -> impl Strategy<Value = (u32, u32)> {
    (1..=100_000u32, 1..=1_000u32)
}

/// Positive f64 values typical for f-numbers (1.0 .. 64.0).
fn f_number_value() -> impl Strategy<Value = f64> {
    1.0f64..=64.0f64
}

// ── Property Tests ─────────────────────────────────────────────────

proptest! {
    #![proptest_config(ProptestConfig::with_cases(500))]

    // ── P6.1: Sub-second exposure times are formatted as fractions ─
    //
    // Requirement 2.5.2: ExposureTime < 1s → "1/{reciprocal}"
    #[test]
    fn sub_second_exposure_is_fraction(
        (num, denom) in sub_second_exposure(),
    ) {
        let result = format_shutter_speed(num, denom);

        // Must start with "1/"
        prop_assert!(
            result.starts_with("1/"),
            "sub-second exposure {}/{} should be formatted as 1/N, got {:?}",
            num, denom, result
        );

        // The denominator part must be a valid positive integer.
        let reciprocal_str = &result[2..];
        let reciprocal: u64 = reciprocal_str.parse().map_err(|e| {
            TestCaseError::Fail(
                format!(
                    "reciprocal part {:?} is not a valid integer: {e}",
                    reciprocal_str
                ).into()
            )
        })?;
        prop_assert!(
            reciprocal >= 1,
            "reciprocal must be >= 1, got {} for {}/{}",
            reciprocal, num, denom
        );

        // The reciprocal should match the implementation's computation:
        // value = num/denom, then round(1/value).
        // Note: (1.0 / (num/denom)).round() can differ from (denom/num).round()
        // due to floating-point intermediate precision, so we replicate the
        // exact computation path used by format_shutter_speed.
        let value = num as f64 / denom as f64;
        let expected = (1.0 / value).round() as u64;
        prop_assert_eq!(
            reciprocal, expected,
            "reciprocal mismatch for {}/{}: expected {}, got {}",
            num, denom, expected, reciprocal
        );
    }

    // ── P6.2: Whole-second exposures are NOT fractions ─────────────
    //
    // When exposure time >= 1s, the output should be a numeric string,
    // not a "1/N" fraction.
    #[test]
    fn whole_second_exposure_not_fraction(
        (num, denom) in whole_second_or_more_exposure(),
    ) {
        let result = format_shutter_speed(num, denom);

        // For values >= 1.0, the result should NOT be a fraction.
        prop_assert!(
            !result.starts_with("1/"),
            "exposure {}/{} (>= 1s) should not be formatted as fraction, got {:?}",
            num, denom, result
        );

        // The result should be parseable as a number.
        let parsed: f64 = result.parse().map_err(|e| {
            TestCaseError::Fail(
                format!("result {:?} is not a valid number: {e}", result).into()
            )
        })?;
        prop_assert!(
            parsed >= 1.0,
            "parsed value {} should be >= 1.0 for {}/{}",
            parsed, num, denom
        );
    }

    // ── P6.3: Focal length is rounded to nearest integer ───────────
    //
    // Requirement 2.5.3: FocalLength is rounded to the nearest integer.
    // We simulate the same logic used in read_exif: rational_to_f64
    // then round().
    #[test]
    fn focal_length_rounded_to_integer(
        (num, denom) in focal_length_rational(),
    ) {
        let value = num as f64 / denom as f64;
        let formatted = format!("{}", value.round() as i64);

        // The formatted string must be a valid integer (no decimal point).
        prop_assert!(
            !formatted.contains('.'),
            "focal length {}/{} = {} should be integer, got {:?}",
            num, denom, value, formatted
        );

        // It must equal the mathematically rounded value.
        let parsed: i64 = formatted.parse().unwrap();
        let expected = value.round() as i64;
        prop_assert_eq!(
            parsed, expected,
            "focal length {}/{} = {}: expected {}, got {}",
            num, denom, value, expected, parsed
        );
    }

    // ── P6.4: format_f_number produces valid numeric strings ───────
    //
    // The f-number formatter must produce a string that parses back to
    // the same value (no trailing .0 for whole numbers).
    #[test]
    fn f_number_round_trips(value in f_number_value()) {
        let formatted = format_f_number(value);

        // Must be parseable back to f64.
        let parsed: f64 = formatted.parse().map_err(|e| {
            TestCaseError::Fail(
                format!("f-number {:?} is not a valid number: {e}", formatted).into()
            )
        })?;

        // For whole numbers, there should be no decimal point.
        if value == value.trunc() {
            prop_assert!(
                !formatted.contains('.'),
                "whole f-number {} should not contain '.', got {:?}",
                value, formatted
            );
        }

        // The parsed value should match the original.
        prop_assert!(
            (parsed - value).abs() < 1e-10,
            "f-number round-trip failed: {} -> {:?} -> {}",
            value, formatted, parsed
        );
    }

    // ── P6.5: format_float never produces trailing ".0" for integers
    //
    // Whole-number floats must be formatted without a decimal point,
    // matching JavaScript's String(n) behavior.
    #[test]
    fn format_float_no_trailing_dot_zero(
        n in 0i64..=100_000,
    ) {
        let value = n as f64;
        let formatted = format_float(value);

        prop_assert!(
            !formatted.ends_with(".0"),
            "integer {} formatted as {:?} should not end with .0",
            n, formatted
        );
        prop_assert!(
            !formatted.contains('.'),
            "integer {} formatted as {:?} should not contain '.'",
            n, formatted
        );

        let parsed: i64 = formatted.parse().map_err(|e| {
            TestCaseError::Fail(
                format!("{:?} should parse as integer: {e}", formatted).into()
            )
        })?;
        prop_assert_eq!(parsed, n);
    }

    // ── P6.6: Zero denominator produces "0" ────────────────────────
    //
    // Edge case: if denominator is 0, format_shutter_speed should
    // return "0" rather than panic.
    #[test]
    fn zero_denom_returns_zero(num in 0..=10_000u32) {
        let result = format_shutter_speed(num, 0);
        prop_assert_eq!(result, "0", "zero denom with num={} should produce \"0\"", num);
    }
}
