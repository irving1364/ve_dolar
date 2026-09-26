---
title: Add Article JSON-LD structured data to a page
description: Learn how to add Article JSON-LD structured data to a page using the JsonLdForArticle component from seo-in-nextjs.
---

`seo-in-nextjs` provides the `JsonLdForArticle` component to easily add Article-specific JSON-LD structured data to a page.

## Using the JsonLdForArticle component

1. Import the `JsonLdForArticle` component into every page where you want to generate the JSON-LD data.

   ```tsx
   // app/article/getting-started/page.tsx
   import { JsonLdForArticle } from "@dlcastillop/seo-in-nextjs";

   export default function ArticlePage() {
     return (
       <>
         <JsonLdForArticle
           type="Article"
           headline="Getting Started with Next.js"
           images={["/article-image.jpg"]}
           datePublished={new Date("2024-01-15")}
           dateModified={new Date("2024-01-20")}
           authors={[
             {
               name: "John Doe",
               url: "https://example.com/authors/john-doe",
             },
           ]}
           scriptKey="article-json-ld"
         />
         <article>
           <h1>Getting Started with Next.js</h1>
           {/* Your content */}
         </article>
       </>
     );
   }
   ```

2. Check the generated JSON-LD by inspecting the body element of your page.

  Tip: You can use the `JsonLdForArticle` component in layout files, but it's recommended to use it in page files instead. Since layouts can be nested, adding JSON-LD in layouts can lead to duplicate or conflicting structured data when parent and child layouts both include JSON-LD scripts.
