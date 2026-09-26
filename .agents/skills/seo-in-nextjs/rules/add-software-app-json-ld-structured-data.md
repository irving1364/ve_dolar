---
title: Add Software Application JSON-LD structured data to a page
description: Learn how to add Software Application JSON-LD structured data to a page using the JsonLdForSoftwareApp component from seo-in-nextjs.
---

`seo-in-nextjs` provides the `JsonLdForSoftwareApp` component to easily add Software Application JSON-LD structured data to a page.

## Using the JsonLdForSoftwareApp component

1. Import the `JsonLdForSoftwareApp` component into every page where you want to generate the JSON-LD data.

   ```tsx
   // app/task-manager/page.tsx
   import { JsonLdForSoftwareApp } from "@dlcastillop/seo-in-nextjs";

   export default function TaskManagerPage() {
     return (
       <>
         <JsonLdForSoftwareApp
           name="Task Manager Pro"
           description="A powerful task management application to organize your work and boost productivity."
           operatingSystem="Windows, macOS, Linux"
           category="BusinessApplication"
           offer={{
             price: 29.99,
             currency: "USD",
           }}
           rating={{
             value: 4.5,
             count: 1250,
           }}
           scriptKey="app-json-ld"
         />
         <main>
           <h1>Task Manager Pro</h1>
           {/* Your content */}
         </main>
       </>
     );
   }
   ```

2. Check the generated JSON-LD by inspecting the body element of your page.

  Tip: You can use the `JsonLdForSoftwareApp` component in layout files, but it's recommended to use it in page files instead. Since layouts can be nested, adding JSON-LD in layouts can lead to duplicate or conflicting structured data when parent and child layouts both include JSON-LD scripts.