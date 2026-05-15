// Feature: engine-cli-commands, Property 5: MIME type resolution
//
// For any known extension from the mapping table, resolve_mime_type returns
// the correct MIME type. For any unknown extension, it returns
// "application/octet-stream".

use proptest::prelude::*;
use s_blog_engine::mime::resolve_mime_type;

/// Known extension → expected MIME pairs.
const KNOWN: &[(&str, &str)] = &[
    ("html", "text/html"),
    ("htm", "text/html"),
    ("css", "text/css"),
    ("js", "application/javascript"),
    ("mjs", "application/javascript"),
    ("json", "application/json"),
    ("png", "image/png"),
    ("jpg", "image/jpeg"),
    ("jpeg", "image/jpeg"),
    ("gif", "image/gif"),
    ("svg", "image/svg+xml"),
    ("ico", "image/x-icon"),
    ("webp", "image/webp"),
    ("woff", "font/woff"),
    ("woff2", "font/woff2"),
    ("ttf", "font/ttf"),
    ("eot", "application/vnd.ms-fontobject"),
    ("xml", "application/xml"),
    ("txt", "text/plain"),
    ("mp4", "video/mp4"),
    ("webm", "video/webm"),
    ("pdf", "application/pdf"),
];

/// Extensions guaranteed not in the mapping.
fn unknown_ext_strategy() -> impl Strategy<Value = String> {
    "[a-z]{4,8}".prop_filter("must not be a known extension", |s| {
        !KNOWN.iter().any(|(k, _)| *k == s.as_str())
    })
}

proptest! {
    #![proptest_config(ProptestConfig::with_cases(100))]

    #[test]
    fn prop_known_extensions_return_correct_mime(idx in 0..KNOWN.len()) {
        let (ext, expected) = KNOWN[idx];
        prop_assert_eq!(resolve_mime_type(ext), expected);
    }

    #[test]
    fn prop_unknown_extensions_return_octet_stream(ext in unknown_ext_strategy()) {
        prop_assert_eq!(
            resolve_mime_type(&ext),
            "application/octet-stream",
            "unknown ext {:?} must return application/octet-stream",
            ext
        );
    }

    #[test]
    fn prop_case_insensitive(idx in 0..KNOWN.len()) {
        let (ext, expected) = KNOWN[idx];
        let upper = ext.to_uppercase();
        prop_assert_eq!(resolve_mime_type(&upper), expected);
    }
}
