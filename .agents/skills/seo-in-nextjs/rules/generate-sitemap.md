---
title: Generate the sitemap.xml file for a site
description: Learn how to generate the sitemap.xml file for a site with seo-in-nextjs.
---

`seo-in-nextjs` can generate the `sitemap.xml` file for your Next.js site with automatic route detection.

## Enabling sitemap.xml generation

1. Create a `sitemap.ts` or `sitemap.js` file to your project's app folder.

2. Import the `sitemapXml` function into the file.

   ```ts
   // app/sitemap.ts
   import type { MetadataRoute } from "next";
   import { sitemapXml } from "@dlcastillop/seo-in-nextjs";

   export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
     return sitemapXml();
   }
   ```

   ```js
   // app/sitemap.js
   import { sitemapXml } from "@dlcastillop/seo-in-nextjs";

   export default async function sitemap() {
     return sitemapXml();
   }
   ```

3. Open http://localhost:3000/sitemap.xml in your browser to see the sitemap.

## Manual routes

Automatic route detection works by analyzing your project's file system. However, not all routes in a Next.js application are explicitly represented in the file system.

To include these routes in your sitemap, you need to manually specify them in the `manualRoutes` property of the `seo.config.ts` or `seo.config.js` file.

```ts
import { defineSeoConfig } from "@dlcastillop/seo-in-nextjs";

export default defineSeoConfig({
  baseUrl: "https://example.com",
  siteName: "Example",
  defaultOgImg: "/og-default.png",
  manualRoutes: ["/users/1", "/users/2", "/users/3"],
});
```

In the `manualRoutes` property you must include:

- Dynamic segments: Routes with parameters like `/users/[id]`, `/posts/[slug]`
- Catch-all routes: Routes using `[...slug]` or `[[...slug]]` syntax
- Parallel routes: Routes defined with `@folder` convention
- Intercepting routes: Routes using `(.)folder` or `(..)folder` syntax
- Programmatically generated routes: Routes created at runtime or build time
- Data-driven routes: Routes that depend on database, CMS, or API content

## Advanced sitemap configuration

By default, `sitemapXml()` generates a basic sitemap with all detected and manual routes. However, you can customize each route's metadata by passing a configuration array to the function.

The configuration allows you to specify additional properties for each route, such as modification date, priority, change frequency, and more.

```ts
// app/sitemap.ts
import type { MetadataRoute } from "next";
import { sitemapXml } from "@dlcastillop/seo-in-nextjs";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  return sitemapXml([
    {
      route: "/",
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 1,
    },
    {
      route: "/about",
      lastModified: new Date("2024-01-15"),
      changeFrequency: "monthly",
      priority: 0.8,
    },
  ]);
}
```

```js
// app/sitemap.js
import { sitemapXml } from "@dlcastillop/seo-in-nextjs";

export default async function sitemap() {
  return sitemapXml([
    {
      route: "/",
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 1,
    },
    {
      route: "/about",
      lastModified: new Date("2024-01-15"),
      changeFrequency: "monthly",
      priority: 0.8,
    },
  ]);
}
```

  Note: Routes specified in the configuration will be merged with both automatically detected and manually defined routes. The configuration you provide will override the default values for those specific routes, while all other routes will be included with their default settings.
