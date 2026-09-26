---
title: Add FAQ JSON-LD structured data to a page
description: Learn how to add FAQ JSON-LD structured data to a page using the JsonLdForFaq component from seo-in-nextjs.
---

`seo-in-nextjs` provides the `JsonLdForFaq` component to easily add Breadcrumb JSON-LD structured data to a page.

## Using the JsonLdForFaq component

1. Import the `JsonLdForFaq` component into every page where you want to generate the JSON-LD data.

   ```tsx
   // app/faq/page.tsx
   import { JsonLdForFaq } from "@dlcastillop/seo-in-nextjs";

   export default function FaqPage() {
     return (
       <>
         <JsonLdForFaq
           faqs={[
             {
               question: "What is Next.js?",
               answer:
                 "Next.js is a React framework that enables server-side rendering and static site generation.",
             },
             {
               question: "How do I get started with Next.js?",
               answer:
                 "You can start by installing Next.js with npm, yarn, or pnpm using the create-next-app command.",
             },
             {
               question: "Is Next.js free to use?",
               answer:
                 "Yes, Next.js is open-source and free to use for both personal and commercial projects.",
             },
           ]}
           scriptKey="faq-json-ld"
         />
         <main>
           <h1>Frequently Asked Questions</h1>
           {/* Your content */}
         </main>
       </>
     );
   }
   ```

     Note: Make sure your FAQ content matches what's actually displayed on the page. Search engines may penalize sites where the structured data doesn't match the visible content.

2. Check the generated JSON-LD by inspecting the body element of your page.

  Tip: You can use the `JsonLdForFaq` component in layout files, but it's recommended to use it in page files instead. Since layouts can be nested, adding JSON-LD in layouts can lead to duplicate or conflicting structured data when parent and child layouts both include JSON-LD scripts.