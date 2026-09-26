---
title: JsonLdForSoftwareApp Reference
description: API Reference for the JsonLdForSoftwareApp component.
---

The `JsonLdForSoftwareApp` component renders Software Application JSON-LD structured data in a script tag.

## Props

The `JsonLdForSoftwareApp` component accepts the following props:

### `name` (required)

**type:** `string`

The name of the software application.

### `operatingSystem` (required)

**type:** `string`

The operating system(s) the application runs on (e.g., `"Windows, macOS, Linux"`, `"iOS, Android"`).

### `category` (required)

**type:** `ApplicationCategory`

The category of the application. Valid values are:

- `"GameApplication"`
- `"SocialNetworkingApplication"`
- `"TravelApplication"`
- `"ShoppingApplication"`
- `"SportsApplication"`
- `"LifestyleApplication"`
- `"BusinessApplication"`
- `"DesignApplication"`
- `"DeveloperApplication"`
- `"DriverApplication"`
- `"EducationalApplication"`
- `"HealthApplication"`
- `"FinanceApplication"`
- `"SecurityApplication"`
- `"BrowserApplication"`
- `"CommunicationApplication"`
- `"DesktopEnhancementApplication"`
- `"EntertainmentApplication"`
- `"MultimediaApplication"`
- `"HomeApplication"`
- `"UtilitiesApplication"`
- `"ReferenceApplication"`

### `offer` (required)

**type:** `{ price: number; currency: string }`

The pricing information for the application:

- **price** (`number`): The price of the application (use `0` for free apps)
- **currency** (`string`): The currency code (e.g., `"USD"`, `"EUR"`, `"GBP"`)

### `rating` (required)

**type:** `{ value: number; count: number }`

The aggregate rating information:

- **value** (`number`): The average rating value (typically 0-5)
- **count** (`number`): The total number of ratings

### `description`

**type:** `string`

A description of the software application.

### `scriptId`

**type:** `string`

A custom ID for the script tag.

### `scriptKey`

**type:** `string`

A custom React key for the script element.
