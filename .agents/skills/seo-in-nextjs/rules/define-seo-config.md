---
title: defineSeoConfig Reference
description: API Reference for the defineSeoConfig function.
---

`seo-in-nextjs` must be configured through a `seo.config.ts` (or `seo.config.js` if not using TypeScript) file in the root of your project using the `defineSeoConfig` function with a default export.

```ts
import { defineSeoConfig } from "@dlcastillop/seo-in-nextjs";

export default defineSeoConfig({
  baseUrl: "https://example.com",
  siteName: "Example",
  defaultOgImg: "/default-og.png",
  manualRoutes: [],
});
```

## Parameters

The `defineSeoConfig` function accepts one parameter, an object containing the following properties:

### `baseUrl` (required)

**type:** `string`

The base URL of the project.

### `siteName` (required)

**type:** `string`

The name of the site.

### `defaultOgImg` (required)

**type:** `string`

The URL of the default Open Graph image.

### `manualRoutes` (required)

**type:** `string[]`

Manually specified routes that cannot be detected through automatic project exploration. Includes dynamic routes, and other routes not directly represented in the file system.
