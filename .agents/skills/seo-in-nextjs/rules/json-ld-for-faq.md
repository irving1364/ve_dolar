---
title: JsonLdForFaq Reference
description: API Reference for the JsonLdForFaq component.
---

The `JsonLdForFaq` component renders FAQ JSON-LD structured data in a script tag.

## Props

The `JsonLdForFaq` component accepts the following props:

### `faqs` (required)

**type:** `Array<{ question: string; answer: string }>`

An array of FAQ items. Each item must have:

- **question** (`string`): The question text
- **answer** (`string`): The answer text

### `scriptId`

**type:** `string`

A custom ID for the script tag.

### `scriptKey`

**type:** `string`

A custom React key for the script element.
