---
title: sitemapXml Reference
description: API Reference for the sitemapXml function.
---

The `sitemapXml` function generates a `sitemap.xml` file for your Next.js application.

## Parameters

The `sitemapXml` function accepts one optional parameter: an array of route configuration objects.

### `sitemapConfig`

**type:** `SitemapConfig[]`

An array of route configuration objects. Each object can contain the following properties:

#### `route` (required)

**type:** `string`

The route path for the page (e.g., `/about`, `/blog/post-1`).

#### `lastModified`

**type:** `string | Date`

The date when the page was last modified.

#### `changeFrequency`

**type:** `'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never'`

How frequently the page is likely to change.

#### `priority`

**type:** `number`

The priority of this URL relative to other URLs on your site. Value must be between 0.0 and 1.0.

#### `alternates`

**type:** `{ languages?: Languages<string> }`

Language alternates for the page.
