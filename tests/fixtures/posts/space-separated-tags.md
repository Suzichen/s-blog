---
title: Space Separated Tags
date: 2024-04-10 09:00:00
tags: react vue angular
categories: Frontend
---

This post uses space-separated strings for tags and a plain string for categories. The normalizeArray function should split these into proper arrays.

Space-separated tags are a common shorthand that some users prefer. The parser needs to handle this format and produce the same array output as bracket notation.

This tests the normalizeArray utility function with space-delimited input.
