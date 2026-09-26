---
title: JsonLdScript Reference
description: API Reference for the JsonLdScript component.
---

The `JsonLdScript` component renders any JSON-LD structured data in a script tag.

## Props

The `JsonLdScript` component accepts the following props:

### `jsonLd` (required)

**type:** `T` (generic object type, defaults to `Record<string, unknown>`)

The JSON-LD structured data object to be rendered. This should be a valid JSON-LD object following the schema.org specification.

### `scriptId`

**type:** `string`

A custom ID for the script tag.

### `scriptKey`

**type:** `string`

A custom React key for the script element.
