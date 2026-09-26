---
title: Getting Started
description: Learn how to get started with seo-in-nextjs.
---

## Prerequisites

You will need to have a Next.js website set up. If you don't have one yet, you can follow the ["Installation"](https://nextjs.org/docs/app/getting-started/installation) guide in the Next.js docs to create one.

Additionally, your Next.js website must meet the following requirements:

- **App Router**
- **Next.js 13.3.0 or higher**
- **React 18.2.0 or higher**

Note: This library requires a paid license. [Learn more about pricing](https://seo-in-nextjs.dlcastillop.com/#pricing).

## Installation

1. Download the library `.tgz` file from [Ko-fi](https://ko-fi.com/s/5f7e204635) if you purchased SEO in Next.js, or from [this link](https://ko-fi.com/s/816f3ed7c5) if you purchased SEO Bundle.

   Note: If you purchased SEO in Next.js or the SEO Bundle through other platforms, you can download it there instead of on Ko-fi.

2. Place the `.tgz` file in the root of your project and add it to your `package.json`:

   ```diff lang="json"
   // package.json
   {
     "dependencies": {
   +    "@dlcastillop/seo-in-nextjs": "file:./seo-in-nextjs-1.0.0.tgz"
     }
   }
   ```

   Then install the dependencies:

   ```sh
   npm install
   ```

   ```sh
   yarn
   ```

   ```sh
   pnpm install
   ```

3. Create a `seo.config.ts` (or `seo.config.js` if not using TypeScript) file in the root of your project with the following content and replace it with your corresponding data:

   ```ts
   import { defineSeoConfig } from "@dlcastillop/seo-in-nextjs";

   export default defineSeoConfig({
     baseUrl: "https://example.com",
     siteName: "Example",
     defaultOgImg: "/default-og.png",
     manualRoutes: [],
   });
   ```

4. You're all set! Start using the library in your Next.js project.
