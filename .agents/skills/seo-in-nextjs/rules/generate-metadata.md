---
title: Generate the metadata for a page
description: Learn how to generate the metadata for a page with seo-in-nextjs.
---

`seo-in-nextjs` can generate the metadata for a page in Next.js, including the title, description, canonical URL, and Open Graph and Twitter metadata.

## Using the genPageMetadata function

1. Import the `genPageMetadata` function into every page where you want to generate metadata.

   ```ts
   // app/page.tsx
   import { genPageMetadata } from "@dlcastillop/seo-in-nextjs";

   export const metadata = genPageMetadata({
     title: "Example - Your trusted source for quality examples",
     description:
       "Discover comprehensive examples and tutorials for web development, design patterns, and best practices.",
     pageRoute: "/",
     ogImg: "/og-home.png",
   });
   ```

2. Check the generated metadata by inspecting the head element of your page.

  Tip: You can generate metadata in layout files, but it's recommended to do it in page files instead. Since layouts can be nested, generating metadata in layouts can lead to confusion and unexpected behavior when metadata from parent and child layouts conflict.

## Using genPageMetadata in async pages

When working with async pages, you can wrap `genPageMetadata` inside an async function to generate metadata dynamically based on fetched data.

1. Export an async `generateMetadata` function that returns the result of `genPageMetadata`.

   ```ts
   // app/blog/[slug]/page.tsx
   import { genPageMetadata } from "@dlcastillop/seo-in-nextjs";
   import type { Metadata } from "next";

   export async function generateMetadata(): Promise<Metadata> {
     return genPageMetadata;
   }
   ```

   ```js
   // app/blog/[slug]/page.jsx
   import { genPageMetadata } from "@dlcastillop/seo-in-nextjs";

   export async function generateMetadata() {
     return genPageMetadata;
   }
   ```
   
2. Use the function parameters (like `params` or `searchParams`) to fetch the necessary data.

   ```diff lang="ts"
   // app/blog/[slug]/page.tsx
   import { genPageMetadata } from "@dlcastillop/seo-in-nextjs";
   import type { Metadata } from "next";

   +interface PageProps {
   +  params: Promise<{
   +   slug: string;
   +  }>;
   +}

   +async function getArticle(slug: string) {
   +  const res = await fetch(`https://api.example.com/articles/${slug}`);
   +  return res.json();
   +}

   export async function generateMetadata({
   +  params,
   +}: PageProps): Promise<Metadata> {
   +  const { slug } = await params;
   +  const article = await getArticle(slug);

     return genPageMetadata;
   }
   ```

   ```diff lang="js"
   // app/blog/[slug]/page.jsx
   import { genPageMetadata } from "@dlcastillop/seo-in-nextjs";

   +async function getArticle(slug) {
   +  const res = await fetch(`https://api.example.com/articles/${slug}`);
   +  return res.json();
   +}

   +export async function generateMetadata({ params }) {
   +  const { slug } = await params;
   +  const article = await getArticle(slug);

     return genPageMetadata;
   }
   ```

3. Pass the dynamic values to `genPageMetadata`.

   ```diff lang="ts"
   // app/blog/[slug]/page.tsx
   import { genPageMetadata } from "@dlcastillop/seo-in-nextjs";
   import type { Metadata } from "next";

   interface PageProps {
     params: Promise<{
       slug: string;
     }>;
   }

   async function getArticle(slug: string) {
     const res = await fetch(`https://api.example.com/articles/${slug}`);
     return res.json();
   }

   export async function generateMetadata({
     params,
   }: PageProps): Promise<Metadata> {
     const { slug } = await params;
     const article = await getArticle(slug);

   +  return genPageMetadata({
   +    title: `${article.title} - Example Blog`,
   +    description: article.description,
   +    pageRoute: `/blog/${slug}`,
   +    ogImg: article.coverImage,
   +  });
   }
   ```

   ```diff lang="js"
   // app/blog/[slug]/page.jsx
   import { genPageMetadata } from "@dlcastillop/seo-in-nextjs";

   async function getArticle() {
     const res = await fetch(`https://api.example.com/articles/${slug}`);
     return res.json();
   }

   export async function generateMetadata({ params }) {
     const { slug } = await params;
     const article = await getArticle(slug);

   +  return genPageMetadata({
   +    title: `${article.title} - Example Blog`,
   +    description: article.description,
   +    pageRoute: `/blog/${slug}`,
   +    ogImg: article.coverImage,
   +  });
   }
   ```
