# Design System Reference

## Brand Color Palette

### Primary Colors

**Cream (#fbfbee)**
- RGB: rgb(251, 251, 238)
- HSL: hsl(60, 68%, 96%)
- Use: Background, light surfaces, subtle accents
- Accessibility: Works as background with dark text

**Yellow (#ffde59)**
- RGB: rgb(255, 222, 89)
- HSL: hsl(48, 100%, 67%)
- Use: Primary actions, highlights, call-to-action buttons, accents
- Accessibility: Requires dark text for contrast (use with #0b6d41 or black)

**Forest Green (#0b6d41)**
- RGB: rgb(11, 109, 65)
- HSL: hsl(153, 82%, 24%)
- Use: Primary text, headers, buttons, borders, important elements
- Accessibility: Excellent contrast on cream background (WCAG AAA)

### Semantic Colors

**Success**: #0b6d41 (Forest Green)
**Warning**: #ffde59 (Yellow)
**Error**: #dc2626 (Red 600)
**Info**: #0284c7 (Sky 600)

### Neutral Palette

- **Gray 50**: #f9fafb (Very light backgrounds)
- **Gray 100**: #f3f4f6 (Light backgrounds)
- **Gray 200**: #e5e7eb (Borders, dividers)
- **Gray 300**: #d1d5db (Disabled states)
- **Gray 400**: #9ca3af (Placeholders)
- **Gray 500**: #6b7280 (Secondary text)
- **Gray 600**: #4b5563 (Body text)
- **Gray 700**: #374151 (Headings)
- **Gray 800**: #1f2937 (Strong emphasis)
- **Gray 900**: #111827 (Primary text alternative)

## Tailwind Configuration

Add these custom colors to `tailwind.config.js`:

```javascript
module.exports = {
  theme: {
    extend: {
      colors: {
        brand: {
          cream: '#fbfbee',
          yellow: '#ffde59',
          green: '#0b6d41',
        },
        primary: {
          50: '#f0fdf8',
          100: '#dcfcee',
          200: '#baf7dc',
          300: '#84efc2',
          400: '#48dfa0',
          500: '#1ec481',
          600: '#0b6d41', // Main brand green
          700: '#0a5a36',
          800: '#09482c',
          900: '#073b24',
        },
        accent: {
          50: '#fffef0',
          100: '#fffcd9',
          200: '#fff8b3',
          300: '#fff280',
          400: '#ffe54d',
          500: '#ffde59', // Main brand yellow
          600: '#f5c700',
          700: '#cc9f00',
          800: '#a37c00',
          900: '#7a5c00',
        },
        neutral: {
          cream: '#fbfbee', // Main brand cream
          50: '#f9fafb',
          100: '#f3f4f6',
          200: '#e5e7eb',
          300: '#d1d5db',
          400: '#9ca3af',
          500: '#6b7280',
          600: '#4b5563',
          700: '#374151',
          800: '#1f2937',
          900: '#111827',
        }
      }
    }
  }
}
```

## Typography

### Font Families
- **Headers**: System font stack or Inter
- **Body**: System font stack or Inter
- **Monospace**: 'Courier New', monospace

### Font Scale
- **xs**: 0.75rem (12px)
- **sm**: 0.875rem (14px)
- **base**: 1rem (16px)
- **lg**: 1.125rem (18px)
- **xl**: 1.25rem (20px)
- **2xl**: 1.5rem (24px)
- **3xl**: 1.875rem (30px)
- **4xl**: 2.25rem (36px)
- **5xl**: 3rem (48px)

### Font Weights
- **Light**: 300
- **Normal**: 400
- **Medium**: 500
- **Semibold**: 600
- **Bold**: 700

## Spacing System

Use Tailwind's default spacing scale (0.25rem increments):
- **0**: 0px
- **1**: 0.25rem (4px)
- **2**: 0.5rem (8px)
- **3**: 0.75rem (12px)
- **4**: 1rem (16px)
- **6**: 1.5rem (24px)
- **8**: 2rem (32px)
- **12**: 3rem (48px)
- **16**: 4rem (64px)

## Component Patterns

### Buttons

**Primary Button**
- Background: `bg-brand-yellow` (#ffde59)
- Text: `text-brand-green` (#0b6d41)
- Hover: `hover:bg-accent-400`
- Font: `font-semibold`

**Secondary Button**
- Background: `bg-brand-green` (#0b6d41)
- Text: `text-brand-cream` (#fbfbee)
- Hover: `hover:bg-primary-700`
- Font: `font-semibold`

**Outline Button**
- Border: `border-2 border-brand-green`
- Text: `text-brand-green`
- Hover: `hover:bg-brand-green hover:text-brand-cream`

### Cards
- Background: `bg-brand-cream` or `bg-white`
- Border: `border border-neutral-200` or `border-brand-green`
- Shadow: `shadow-md` or `shadow-lg`
- Rounded: `rounded-lg` or `rounded-xl`

### Forms
- Input Background: `bg-white`
- Input Border: `border border-neutral-300 focus:border-brand-green`
- Input Ring: `focus:ring-2 focus:ring-brand-green focus:ring-opacity-50`
- Label: `text-brand-green font-medium`

### Navigation
- Background: `bg-brand-cream` or `bg-brand-green`
- Active Link: `text-brand-yellow bg-brand-green` or underline
- Hover: `hover:text-brand-yellow`

## Accessibility Guidelines

### Color Contrast
- **Brand Green on Cream**: 6.85:1 (WCAG AAA ✓)
- **Brand Green on White**: 7.23:1 (WCAG AAA ✓)
- **Brand Green on Yellow**: 4.89:1 (WCAG AA ✓)
- **Gray 900 on Cream**: 13.2:1 (WCAG AAA ✓)

### Best Practices
1. Always ensure text has minimum 4.5:1 contrast ratio (WCAG AA)
2. Use focus indicators on all interactive elements
3. Include aria-labels for icon buttons
4. Ensure keyboard navigation works properly
5. Test with screen readers

## Responsive Design

### Breakpoints (Tailwind defaults)
- **sm**: 640px
- **md**: 768px
- **lg**: 1024px
- **xl**: 1280px
- **2xl**: 1536px

### Mobile-First Approach
Always design for mobile first, then enhance for larger screens using responsive utilities:
- `md:text-lg` - Larger text on tablets
- `lg:grid-cols-3` - More columns on desktop
- `xl:max-w-7xl` - Wider containers on large screens

## Animation & Transitions

### Transitions
- Default: `transition-all duration-200 ease-in-out`
- Hover effects: `transition-colors duration-150`
- Transform: `transition-transform duration-300`

### Common Animations
- Fade in: `animate-fade-in`
- Slide up: `animate-slide-up`
- Pulse: `animate-pulse`
- Bounce: `animate-bounce`
