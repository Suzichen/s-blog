This is a post with no frontmatter at all. It starts directly with content.

The parser should handle this edge case gracefully. The slug should be derived from the filename, the title should fall back to the slug, and the date should be empty.

Tags and categories should be empty arrays, and the summary should be auto-generated from this body content.
