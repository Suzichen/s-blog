# Implementation Plan: engine-cli-commands

## Overview

Add `build` and `serve` CLI commands to `@s-blog/engine` using a three-layer architecture: Rust crate (core logic) → NAPI (thin wrapper) → CLI (arg parsing only). This replaces the temporary `build-rust.cjs` script while ensuring the same Rust functions are reusable by a future Tauri client.

## Tasks

- [x] 1. Define Rust crate types and error variants
  - [x] 1.1 Add `BuildOptions`, `BuildResult`, `ServeOptions`, and `ServeHandle` structs to `s-blog-engine`
    - Create `crates/s-blog-engine/src/build.rs` with `BuildOptions` (work_dir, output_dir, shell_dir) and `BuildResult` (posts_count, albums_count, seo_pages_count, static_files_count, shell_files_count, duration_ms)
    - Create `crates/s-blog-engine/src/serve.rs` with `ServeOptions` (work_dir, cache_dir, shell_dir, port) and `ServeHandle` (addr, shutdown_tx)
    - Implement `Default` for both options structs with values from design
    - Implement `ServeHandle::address()` and `ServeHandle::shutdown()` methods
    - Add `Serialize`/`Deserialize` derives with `#[serde(rename_all = "camelCase")]`
    - _Requirements: 7.1, 7.2, 7.3, 7.4_

  - [x] 1.2 Add new `EngineError` variants for CLI commands
    - Add `ConfigNotFound(PathBuf)` variant
    - Add `BuildStepFailed { step: String, reason: String }` variant
    - Add `PortInUse { port: u16 }` variant
    - Add `ServeDirNotFound(PathBuf)` variant
    - Implement `Display` for each new variant with user-friendly messages
    - _Requirements: 2.4, 2.8, 2.9, 4.4, 4.8, 7.9_

  - [x] 1.3 Add MIME type resolver and SPA fallback path logic
    - Create `crates/s-blog-engine/src/mime.rs` with `resolve_mime_type(extension: &str) -> &str` function
    - Include mappings for common web extensions (html, css, js, json, png, jpg, svg, woff2, etc.)
    - Return `application/octet-stream` for unknown extensions
    - Add `has_file_extension(path: &str) -> bool` helper for SPA fallback logic
    - _Requirements: 4.5, 4.6, 4.7_

  - [x] 1.4 Add basePath HTML rewrite utility
    - Create `crates/s-blog-engine/src/shell.rs` with `rewrite_base_path(html: &str, base_path: &str) -> String`
    - Use regex pattern `(href|src)="\./` to match only HTML attribute contexts
    - Normalize basePath: strip trailing slash, ensure leading slash, handle root `/` as empty string
    - Ensure idempotency: already-rewritten HTML is unchanged on re-application
    - _Requirements: 2.3, 5.1_

- [x] 2. Implement `build()` function in Rust crate
  - [x] 2.1 Implement the production build pipeline in `build()`
    - Read and parse `config.json` and `album.config.json` from `work_dir`
    - Return `ConfigNotFound` error if `config.json` is missing
    - Return JSON parse error with filename if config is invalid JSON
    - Implement build steps in order: clean dist → copy shell (with basePath rewrite) → generate posts → generate albums → generate SEO/sitemap/rss/robots → copy static assets (albums/, public/, config files)
    - Track file counts for each step and total duration
    - Return `BuildResult` on success or `BuildStepFailed` on any step failure
    - Register `pub mod build;` and `pub mod serve;` and `pub mod mime;` and `pub mod shell;` in `lib.rs`
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 2.9, 5.1, 7.1, 7.5, 7.8, 7.9, 8.2_

  - [x] 2.2 Write property test for basePath HTML rewrite
    - **Property 1: basePath HTML rewrite**
    - **Validates: Requirements 2.3**
    - Generate arbitrary basePath strings and HTML with `href="./..."` / `src="./..."` attributes
    - Assert no `./` remains in href/src attributes after rewrite
    - Assert text outside attributes is not modified
    - Assert idempotency (rewriting twice produces same result)
    - Tag: `// Feature: engine-cli-commands, Property 1: basePath HTML rewrite`

  - [x] 2.3 Write property test for build error propagation
    - **Property 2: Build error propagation**
    - **Validates: Requirements 2.4, 7.9**
    - Simulate step failures and verify `EngineError` contains both step name and reason
    - Tag: `// Feature: engine-cli-commands, Property 2: Build error propagation`

  - [x] 2.4 Write property test for invalid JSON config error reporting
    - **Property 3: Non-legal JSON config error reporting**
    - **Validates: Requirements 2.9**
    - Generate arbitrary non-JSON byte sequences as config content
    - Assert error contains filename and parse failure description
    - Tag: `// Feature: engine-cli-commands, Property 3: Non-legal JSON config error reporting`

- [x] 3. Implement `serve()` function in Rust crate
  - [x] 3.1 Implement the dev data generation and HTTP server in `serve()`
    - Add `tokio` and `hyper` (or minimal HTTP lib) to `Cargo.toml` dependencies
    - Generate posts manifest (manifest-only mode) to `.cache/manifest.json`
    - Generate albums data to `.cache/`
    - Spawn async HTTP server on specified port, return `ServeHandle` immediately
    - Implement path resolution priority: `.cache/` → `posts/` → `albums/` → `public/` → shell → SPA fallback
    - SPA fallback: paths without file extension serve `index.html`; paths with extension return 404
    - Set MIME type based on file extension using `resolve_mime_type()`
    - Return `PortInUse` error if bind fails, `ServeDirNotFound` if shell_dir missing
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 4.1, 4.2, 4.3, 4.5, 4.6, 4.7, 4.8, 4.9, 4.11, 7.2, 7.6, 8.1_

  - [x]* 3.2 Write property test for port validation
    - **Property 4: Port validation**
    - **Validates: Requirements 4.4**
    - Generate arbitrary u32 values outside [1, 65535] and non-integer values
    - Assert parser rejects with error mentioning valid range
    - Tag: `// Feature: engine-cli-commands, Property 4: Port validation`

  - [x]* 3.3 Write property test for MIME type resolution
    - **Property 5: MIME type resolution**
    - **Validates: Requirements 4.5**
    - Generate known extensions from mapping table, assert correct MIME returned
    - Generate arbitrary unknown extensions, assert `application/octet-stream` returned
    - Tag: `// Feature: engine-cli-commands, Property 5: MIME type resolution`

  - [x]* 3.4 Write property test for SPA fallback logic
    - **Property 6: SPA fallback**
    - **Validates: Requirements 4.6**
    - Generate arbitrary paths without file extensions, assert SPA fallback triggered
    - Generate arbitrary paths with file extensions that don't match existing files, assert 404
    - Tag: `// Feature: engine-cli-commands, Property 6: SPA fallback`

  - [x]* 3.5 Write property test for directory isolation
    - **Property 7: Directory isolation**
    - **Validates: Requirements 8.1, 8.2**
    - Run build with random valid config in temp directory, assert no files created outside output_dir
    - Run serve data generation, assert no files created outside cache_dir
    - Tag: `// Feature: engine-cli-commands, Property 7: Directory isolation`

- [x] 4. Checkpoint - Ensure Rust crate tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Implement NAPI thin wrappers
  - [x] 5.1 Add `build_command()` NAPI function
    - Add `build_command(options_json: String) -> napi::Result<String>` to `crates/s-blog-engine-napi/src/lib.rs`
    - Deserialize `options_json` into `BuildOptions`
    - Call `s_blog_engine::build::build(opts)`
    - Serialize `BuildResult` to JSON and return
    - Map `EngineError` to `napi::Error` with user-friendly reason string
    - _Requirements: 7.7, 6.8_

  - [x] 5.2 Add `serve_command()` NAPI function
    - Add `serve_command(options_json: String) -> napi::Result<()>` to `crates/s-blog-engine-napi/src/lib.rs`
    - Deserialize `options_json` into `ServeOptions`
    - Call `s_blog_engine::serve::serve(opts)` to get `ServeHandle`
    - Print server address to stdout
    - Block waiting for Ctrl+C signal, then call `handle.shutdown()`
    - Map `EngineError` to `napi::Error`
    - _Requirements: 7.7, 6.8, 4.9_

  - [x] 5.3 Update NAPI Cargo.toml dependencies
    - Add `tokio` runtime dependency to `crates/s-blog-engine-napi/Cargo.toml` for async serve blocking
    - Ensure `s-blog-engine` dependency includes necessary features
    - _Requirements: 7.7_

- [x] 6. Implement CLI entry point
  - [x] 6.1 Create `bin/s-blog.cjs` CLI runner
    - Create `crates/s-blog-engine-napi/bin/s-blog.cjs` with shebang `#!/usr/bin/env node`
    - Parse `process.argv` manually (no third-party frameworks)
    - Implement subcommand routing: `build`, `serve`, `--version`, `--help`
    - For `build`: parse `--output` flag, construct options JSON, call `engine.buildCommand()`
    - For `serve`: parse `--port` flag, validate port is integer in [1, 65535], call `engine.serveCommand()`
    - Display help text with command descriptions when no args or `--help`
    - Display version from `package.json` for `--version`
    - Output error for unknown subcommands with non-zero exit code
    - Handle `require('@s-blog/engine')` load failure with stderr message and exit code 1
    - Keep file under 200 lines, CommonJS format
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7_

  - [x] 6.2 Register bin field in package.json
    - Add `"bin": { "s-blog": "./bin/s-blog.cjs" }` to `crates/s-blog-engine-napi/package.json`
    - Add `"bin/s-blog.cjs"` to the `files` array
    - _Requirements: 1.1, 5.2_

- [x] 7. Checkpoint - Ensure build and CLI work end-to-end
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 8. Integration tests
  - [ ]* 8.1 Write Node.js integration tests for CLI commands
    - Create test file for CLI integration (vitest or similar)
    - Test: `s-blog` with no args outputs help and exits 0
    - Test: `s-blog --version` outputs version matching package.json
    - Test: `s-blog build` produces correct dist/ structure
    - Test: `s-blog serve` starts server and generates .cache/ with manifest and albums data
    - Test: `s-blog serve` starts server responding to HTTP requests
    - Test: serve SPA fallback returns index.html for extensionless paths
    - Test: unknown subcommand exits with non-zero code
    - _Requirements: 1.2, 1.4, 1.6, 2.1, 3.1, 4.1, 4.6, 5.1_

- [~] 9. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- The Rust crate layer (`s-blog-engine`) contains all logic; NAPI and CLI are thin wrappers
- `tokio` is needed for the async HTTP server in `serve()`; consider `hyper` or `tiny_http` for minimal footprint
- The CLI must remain under 200 lines and use no third-party CLI frameworks

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2", "1.3", "1.4"] },
    { "id": 1, "tasks": ["2.1"] },
    { "id": 2, "tasks": ["2.2", "2.3", "2.4", "3.1"] },
    { "id": 3, "tasks": ["3.2", "3.3", "3.4", "3.5"] },
    { "id": 4, "tasks": ["5.1", "5.2", "5.3"] },
    { "id": 5, "tasks": ["6.1", "6.2"] },
    { "id": 6, "tasks": ["8.1"] }
  ]
}
```
