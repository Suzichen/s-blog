// Feature: engine-cli-commands, Property 6: SPA fallback
//
// For any path without a file extension, SPA fallback is triggered.
// For any path with a file extension that doesn't match an existing file, 404 is returned.

use proptest::prelude::*;
use spage_engine::mime::has_file_extension;

proptest! {
    #![proptest_config(ProptestConfig::with_cases(100))]

    /// Paths without dots in the last segment should trigger SPA fallback.
    #[test]
    fn prop_no_extension_triggers_fallback(
        segments in prop::collection::vec("[a-z][a-z0-9\\-]{0,10}", 1..4)
    ) {
        let path = format!("/{}", segments.join("/"));
        prop_assert!(
            !has_file_extension(&path),
            "path without extension {:?} must trigger SPA fallback (has_file_extension=false)",
            path
        );
    }

    /// Paths with a dot in the last segment are treated as having an extension (→ 404 if not found).
    #[test]
    fn prop_with_extension_returns_404(
        segments in prop::collection::vec("[a-z][a-z0-9\\-]{0,8}", 0..3),
        name in "[a-z]{1,8}",
        ext in "[a-z]{1,5}",
    ) {
        let prefix = if segments.is_empty() {
            String::new()
        } else {
            format!("/{}", segments.join("/"))
        };
        let path = format!("{}/{}.{}", prefix, name, ext);
        prop_assert!(
            has_file_extension(&path),
            "path with extension {:?} must NOT trigger SPA fallback (has_file_extension=true)",
            path
        );
    }

    /// Root path "/" has no extension → SPA fallback.
    #[test]
    fn prop_root_path_is_spa_fallback(dummy in 0u8..1u8) {
        let _ = dummy;
        prop_assert!(!has_file_extension("/"));
    }

    /// Empty path has no extension → SPA fallback.
    #[test]
    fn prop_empty_path_is_spa_fallback(dummy in 0u8..1u8) {
        let _ = dummy;
        prop_assert!(!has_file_extension(""));
    }
}
