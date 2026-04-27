//! NAPI-RS bindings for s-blog-engine.
//!
//! Each exported function accepts JSON strings for configuration and
//! returns JSON strings (or counts) so the Node.js layer stays thin.

// Binding functions will be added as the core engine modules are
// implemented (tasks 12–22). Each function will deserialize its
// JSON arguments, call into `s_blog_engine`, and serialize the result.

// Example (to be filled in later):
//
// #[napi]
// pub fn generate_posts_data(
//     posts_dir: String,
//     output_dir: String,
//     config_json: String,
// ) -> napi::Result<String> {
//     todo!()
// }
