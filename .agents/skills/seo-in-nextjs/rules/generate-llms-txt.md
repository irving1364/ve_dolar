---
title: Generate the llms.txt file for a site
description: Learn how to generate the llms.txt file for a site with seo-in-nextjs.
---

`seo-in-nextjs` can generate the `llms.txt` file for your Next.js site with automatic route detection.

## Enabling llms.txt generation

There are two ways to generate the `llms.txt` file.

### Build-time generation (Recommended)

1. Add the generation to your build script in `package.json`.

   ```json
   {
     "scripts": {
       "build": "node --input-type=module -e \"import('@dlcastillop/seo-in-nextjs/scripts').then(m => m.generateLlmsTxt())\" && next build"
     }
   }
   ```

2. After the build finishes, navigate to `/llms.txt` on your website to view the generated file.

### Manual generation

1. Add a separate script to generate the file on demand.

   ```json
   {
     "scripts": {
       "generate-llmstxt": "node --input-type=module -e \"import('@dlcastillop/seo-in-nextjs/scripts').then(m => m.generateLlmsTxt())\""
     }
   }
   ```

2. Then run it manually.

   ```sh
   npm run generate-llmstxt
   ```

   ```sh
   yarn generate-llmstxt
   ```

   ```sh
   pnpm generate-llmstxt
   ```

3. Open http://localhost:3000/llms.txt in your browser to see the `llms.txt` file.

  Tip: If using manual generation, remember to track the generated `llms.txt` file in your version control system and regenerate it when your routes change.

## Manual routes

Automatic route detection works by analyzing your project's file system. However, not all routes in a Next.js application are explicitly represented in the file system.

To include these routes in your `llms.txt` file, you need to manually specify them in the `manualRoutes` property of the `seo.config.ts` or `seo.config.js` file.

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
