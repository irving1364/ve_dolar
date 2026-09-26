---
title: Add Breadcrumb JSON-LD structured data to a page
description: Learn how to add Breadcrumb JSON-LD structured data to a page using the JsonLdForBreadcrumb component from seo-in-nextjs.
---

`seo-in-nextjs` provides the `JsonLdForBreadcrumb` component to easily add Breadcrumb JSON-LD structured data to a page.

## Using the JsonLdForBreadcrumb component

1. Import the `JsonLdForBreadcrumb` component into every page where you want to generate the JSON-LD data.

   ```tsx
   // app/products/electronics/laptops/page.tsx
   import { JsonLdForBreadcrumb } from "@dlcastillop/seo-in-nextjs";

   export default function LaptopsPage() {
     return (
       <>
         <JsonLdForBreadcrumb
           itemList={[
             { name: "Home", route: "/" },
             { name: "Products", route: "/products" },
             { name: "Electronics", route: "/products/electronics" },
             { name: "Laptops", route: "/products/electronics/laptops" },
           ]}
           scriptKey="breadcrumb-json-ld"
         />
         <main>
           <h1>Laptops</h1>
           {/* Your content */}
         </main>
       </>
     );
   }
   ```
   
     Note: The component automatically converts relative routes to absolute URLs using the `baseUrl` from your `seo.config.ts` or `seo.config.js` configuration.

2. Check the generated JSON-LD by inspecting the body element of your page.

  Tip: You can use the `JsonLdForBreadcrumb` component in layout files, but it's recommended to use it in page files instead. Since layouts can be nested, adding JSON-LD in layouts can lead to duplicate or conflicting structured data when parent and child layouts both include JSON-LD scripts.
