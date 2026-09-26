---
title: Add JSON-LD structured data to a page
description: Learn how to add JSON-LD structured data to a page using the JsonLdScript component in seo-in-nextjs.
---

`seo-in-nextjs` provides the `JsonLdScript` component to easily add any JSON-LD structured data to a page.

## Using the JsonLdScript component

1. Import the `JsonLdScript` component into every page where you want to generate the JSON-LD data.

   ```tsx
   // app/article/getting-started/page.tsx
   import { JsonLdScript } from "@dlcastillop/seo-in-nextjs";

   export default function ArticlePage() {
     const jsonLd = {
       "@context": "https://schema.org",
       "@type": "Article",
       headline: "Getting Started with Next.js",
       author: {
         "@type": "Person",
         name: "John Doe",
       },
       datePublished: "2024-01-15",
     };

     return (
       <>
         <JsonLdScript jsonLd={jsonLd} scriptKey="jsonld-article" />
         <article>
           <h1>Getting Started with Next.js</h1>
           {/* Your content */}
         </article>
       </>
     );
   }
   ```

2. Check the generated JSON-LD by inspecting the body element of your page.

  Tip: You can use the `JsonLdScript` component in layout files, but it's recommended to use it in page files instead. Since layouts can be nested, adding JSON-LD in layouts can lead to duplicate or conflicting structured data when parent and child layouts both include JSON-LD scripts.