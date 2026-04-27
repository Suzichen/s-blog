---
title: Post With Tags and Categories
date: 2024-03-20 14:30:00
tags: [javascript, typescript, testing]
categories: [Development, Tutorial]
---

This post has tags and categories defined as YAML arrays. The frontmatter parser should correctly extract these as string arrays.

Tags are useful for cross-cutting concerns while categories provide a hierarchical organization. Both should be normalized into arrays regardless of input format.

Testing multiple tags and categories ensures the parser handles array fields properly across different input styles.
