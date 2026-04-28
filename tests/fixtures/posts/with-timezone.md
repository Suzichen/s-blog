---
title: Post With Timezone
date: 2024-06-15T10:30:00+09:00
tags: [timezone, date-handling]
categories: [Technical]
---

This post has a date with an explicit timezone offset (+09:00 for JST). When the site config has a timezone setting, the date should be converted to that timezone.

The timezone conversion logic should detect the offset in the date string and apply the configured timezone. If the configured timezone matches the offset, the local time should remain the same.

This is important for blogs with international audiences where consistent date display matters.
