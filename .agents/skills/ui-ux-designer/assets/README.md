# UI Component Templates

This directory contains reusable React/TypeScript component templates for your Next.js application. These components follow the brand design system with custom colors:

- **Cream**: #fbfbee
- **Yellow**: #ffde59
- **Green**: #0b6d41

## Components Included

### 1. Button.tsx
Versatile button component with three variants:
- **Primary**: Yellow background with green text (main CTA)
- **Secondary**: Green background with cream text
- **Outline**: Transparent with green border

**Usage Example:**
```tsx
import Button from '@/components/Button';

<Button variant="primary" size="md" onClick={handleClick}>
  Click Me
</Button>
```

### 2. Card.tsx
Flexible card component with multiple variants and sub-components:
- Card (main component)
- CardHeader
- CardTitle
- CardContent
- CardFooter

**Usage Example:**
```tsx
import Card, { CardHeader, CardTitle, CardContent } from '@/components/Card';

<Card variant="bordered" hoverable>
  <CardHeader>
    <CardTitle>Card Title</CardTitle>
  </CardHeader>
  <CardContent>
    <p>Card content goes here</p>
  </CardContent>
</Card>
```

### 3. Input.tsx
Form input components with label, error states, and helper text:
- Input (single-line)
- TextArea (multi-line)

**Usage Example:**
```tsx
import Input, { TextArea } from '@/components/Input';

<Input
  label="Email Address"
  type="email"
  placeholder="you@example.com"
  required
  error={errors.email}
  value={email}
  onChange={(e) => setEmail(e.target.value)}
/>
```

### 4. PageLayout.tsx
Page structure components for consistent layouts:
- PageLayout (main wrapper)
- Section (content sections)
- Container (centered content)
- Hero (hero sections)
- Grid (responsive grids)

**Usage Example:**
```tsx
import PageLayout, { Hero, Section, Container, Grid } from '@/components/PageLayout';
import Card from '@/components/Card';
import Button from '@/components/Button';

export default function HomePage() {
  return (
    <PageLayout variant="cream">
      <Hero
        title="Welcome to Our Platform"
        subtitle="Build amazing things with our tools"
        alignment="center"
      >
        <Button variant="primary" size="lg">Get Started</Button>
        <Button variant="outline" size="lg">Learn More</Button>
      </Hero>

      <Section spacing="lg">
        <Container>
          <Grid columns={3} gap="lg">
            <Card variant="bordered">Feature 1</Card>
            <Card variant="bordered">Feature 2</Card>
            <Card variant="bordered">Feature 3</Card>
          </Grid>
        </Container>
      </Section>
    </PageLayout>
  );
}
```

## Installation

1. **Copy components to your project:**
   ```bash
   cp -r .claude/skills/ui-ux-designer/assets/*.tsx components/
   ```

2. **Ensure Tailwind CSS is configured with brand colors:**

   Update `tailwind.config.js`:
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
           // Add more from references/design-system.md
         }
       }
     }
   }
   ```

3. **Import and use components in your pages:**
   ```tsx
   import Button from '@/components/Button';
   import Card from '@/components/Card';
   // etc.
   ```

## Customization

These are template components. Feel free to:
- Modify styling to match your exact needs
- Add new variants or sizes
- Extend functionality with additional props
- Combine components to create more complex UI patterns

## Accessibility

All components include:
- ✓ Proper ARIA labels and roles
- ✓ Keyboard navigation support
- ✓ Focus indicators
- ✓ WCAG AA+ contrast ratios
- ✓ Semantic HTML structure

## Documentation

For complete design system documentation including:
- Color palette and usage guidelines
- Typography scale
- Spacing system
- Responsive breakpoints
- Accessibility guidelines

See: `references/design-system.md`
