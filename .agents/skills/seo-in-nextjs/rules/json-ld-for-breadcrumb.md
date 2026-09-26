---
title: JsonLdForBreadcrumb Reference
description: API Reference for the JsonLdForBreadcrumb component.
---

The `JsonLdForBreadcrumb` component renders Breadcrumb JSON-LD structured data in a script tag.

## Props

The `JsonLdForBreadcrumb` component accepts the following props:

### `itemList` (required)

**type:** `Array<{ name: string; route: string }>`

An array of breadcrumb items representing the navigation hierarchy. Each item must have:

- **name** (`string`): The display name for the breadcrumb item
- **route** (`string`): The route path for the breadcrumb item (e.g., `/products`, `/blog/post-1`)

The items should be ordered from the highest level (typically "Home") to the current page.

### `scriptId`

**type:** `string`

A custom ID for the script tag.

### `scriptKey`

**type:** `string`

A custom React key for the script element.
