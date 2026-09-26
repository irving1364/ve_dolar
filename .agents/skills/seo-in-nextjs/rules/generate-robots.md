---
title: Generate the robots.txt file for a site
description: Learn how to generate the robots.txt file for a site with seo-in-nextjs.
---

`seo-in-nextjs` can generate the `robots.txt` file for your Next.js site with automatic configuration.

## Enabling robots.txt generation

1. Create a `robots.ts` or `robots.js` file in your project's app folder.

2. Import the `robotsTxt` function into the file.

   ```ts
   // app/robots.ts
   import type { MetadataRoute } from "next";
   import { robotsTxt } from "@dlcastillop/seo-in-nextjs";

   export default function robots(): MetadataRoute.Robots {
     return robotsTxt();
   }
   ```

   ```js
   // app/robots.js
   import { robotsTxt } from "@dlcastillop/seo-in-nextjs";

   export default function robots() {
     return robotsTxt();
   }
   ```

3. Open http://localhost:3000/robots.txt in your browser to see the robots file.

## Advanced robots configuration

By default, `robotsTxt()` generates a `robots.txt` file with sensible default rules that work well for most cases.

However, you can customize the configuration by passing an options object to the function to extend or override these defaults.

The configuration allows you to specify custom rules, user agents, and crawl delays.

```ts
// app/robots.ts
import type { MetadataRoute } from "next";
import { robotsTxt } from "@dlcastillop/seo-in-nextjs";

export default function robots(): MetadataRoute.Robots {
  return robotsTxt({
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/admin", "/private"],
      },
      {
        userAgent: "Googlebot",
        allow: "/",
        crawlDelay: 10,
      },
    ],
  });
}
```

```js
// app/robots.js
import { robotsTxt } from "@dlcastillop/seo-in-nextjs";

export default function robots() {
  return robotsTxt({
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/admin", "/private"],
      },
      {
        userAgent: "Googlebot",
        allow: "/",
        crawlDelay: 10,
      },
    ],
  });
}
```
