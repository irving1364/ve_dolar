---
title: SEO Check Tool
description: Learn how to audit your Next.js project's SEO implementation with the built-in check tool from seo-in-nextjs.
---

`seo-in-nextjs` includes a built-in tool to audit your project's SEO implementation.

## Setup

1. Add the following script to your `package.json`:

   ```json
   //package.json
   {
     "scripts": {
       "check-seo": "node --input-type=module -e \"import('@dlcastillop/seo-in-nextjs/scripts').then(m => m.checkSeo())\""
     }
   }
   ```

2. Run the check from your terminal:

   ```sh
   npm run check-seo
   ```

   ```sh
   yarn check-seo
   ```

   ```sh
   pnpm check-seo
   ```

## What it checks

The SEO check tool analyzes four areas of your project:

### 1. Page Metadata

Identifies the metadata status for each page in your application:

- **Pages without metadata**: Routes that are missing metadata configuration
- **Pages with manual metadata**: Routes using Next.js native metadata export
- **Pages using `genPageMetadata`**: Routes leveraging the library's metadata utility

### 2. Robots Configuration

Verifies how your site handles robot crawling rules:

- **Static file**: Checks if `robots.txt` exists in the `public` folder
- **Manual generation**: Detects if you're using `robots.ts` or `robots.js` with custom logic
- **Library utility**: Identifies usage of the `robotsTxt` function from the library

### 3. Sitemap Configuration

Examines your sitemap implementation:

- **Static file**: Checks if `sitemap.xml` exists in the `public` folder
- **Manual generation**: Detects if you're using `sitemap.ts` or `sitemap.js` with custom logic
- **Library utility**: Identifies usage of the `sitemapXml` function from the library

### 4. Improvement Suggestions

Based on the analysis, the tool provides actionable recommendations to enhance your SEO setup, such as:

- Adding metadata to pages that are missing it
- Implementing dynamic `robots.txt` instead of static files
- Configuring sitemap generation for better crawlability
- Leveraging library utilities for consistency

Tip: Run this check regularly during development and before deployment to ensure your SEO configuration is complete and up to date.
