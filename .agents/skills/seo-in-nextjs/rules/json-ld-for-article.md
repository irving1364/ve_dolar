---
title: JsonLdForArticle Reference
description: API Reference for the JsonLdForArticle component.
---

The `JsonLdForArticle` component renders Article-specific JSON-LD structured data in a script tag.

## Props

The `JsonLdForArticle` component accepts the following props:

### `type` (required)

**type:** `"Article" | "NewsArticle" | "BlogPosting"`

The type of article.

### `headline` (required)

**type:** `string`

The headline or title of the article.

### `images` (required)

**type:** `string[]`

An array of image routes associated with the article.

### `datePublished` (required)

**type:** `Date`

The date when the article was first published.

### `dateModified` (required)

**type:** `Date`

The date when the article was last modified.

### `authors` (required)

**type:** `Array<{ name: string; url: string }>`

An array of author objects. Each author must have a `name` and a `url` property.

### `scriptId`

**type:** `string`

A custom ID for the script tag.

### `scriptKey`

**type:** `string`

A custom React key for the script element.
