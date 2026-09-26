---
title: genPageMetadata Reference
description: API Reference for the genPageMetadata function.
---

The `genPageMetadata` function generates the metadata for a page, including the title, description, canonical URL, and Open Graph and Twitter metadata.

## Parameters

The `genPageMetadata` function accepts one parameter, an object containing the following properties:

### `title` (required)

**type:** `string`

The title of the page.

### `description` (required)

**type:** `string`

The description of the page.

### `pageRoute` (required)

**type:** `string`

The route for the page.

### `ogImg`

**type:** `string`

The URL of the Open Graph image. If not specified, defaults to the Open Graph defined in `defineSeoConfig`.
