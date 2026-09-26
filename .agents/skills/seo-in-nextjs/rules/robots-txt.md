---
title: robotsTxt Reference
description: API Reference for the robotsTxt function.
---

The `robotsTxt` function generates a `robots.txt` file for your Next.js application.

## Parameters

The `robotsTxt` function accepts one optional parameter: a configuration object.

### `robotsConfig`

**type:** `Partial<MetadataRoute.Robots>`

A configuration object that can contain the following properties:

#### `rules`

**type:** `object | object[]`

Rules for web crawlers. Can be a single rule object or an array of rule objects. Each rule object can contain:

- **userAgent** (`string | string[]`): The user agent(s) the rule applies to (e.g., `"*"`, `"Googlebot"`).
- **allow** (`string | string[]`): Path(s) that are allowed to be crawled.
- **disallow** (`string | string[]`): Path(s) that are not allowed to be crawled.
- **crawlDelay** (`number`): Time (in seconds) the crawler should wait between requests.

#### `sitemap`

**type:** `string | string[]`

The URL(s) of your sitemap file(s).

#### `host`

**type:** `string`

The preferred domain for your site (e.g., `"https://example.com"`).
