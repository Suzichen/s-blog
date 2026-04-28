---
title: Post With Invalid Date
date: not-a-valid-date
tags: [edge-case]
categories: [Testing]
---

This post has an invalid date format in the frontmatter. The parser should handle this gracefully by logging a warning and using an empty string for the date field.

Invalid dates should not cause the entire build process to fail. Instead, the post should still be included in the manifest with an empty date string.

This tests the error handling path of the date parsing logic.
