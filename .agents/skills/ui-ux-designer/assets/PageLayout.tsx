import React from 'react';

interface PageLayoutProps {
  children: React.ReactNode;
  variant?: 'default' | 'cream' | 'white';
}

/**
 * PageLayout Component
 *
 * Main page layout wrapper providing consistent structure and background.
 * Use this as the outer wrapper for all page content.
 *
 * @param children - Page content
 * @param variant - Background color variant
 */
export default function PageLayout({
  children,
  variant = 'default'
}: PageLayoutProps) {
  const variants = {
    default: 'bg-brand-cream',
    cream: 'bg-brand-cream',
    white: 'bg-white'
  };

  return (
    <main className={`min-h-screen ${variants[variant]}`}>
      {children}
    </main>
  );
}

/**
 * Section Component
 *
 * Content section wrapper with responsive padding.
 * Use this for major page sections.
 *
 * @param children - Section content
 * @param className - Additional custom classes
 * @param background - Background color
 * @param spacing - Vertical padding size
 */
interface SectionProps {
  children: React.ReactNode;
  className?: string;
  background?: 'transparent' | 'white' | 'cream' | 'green';
  spacing?: 'sm' | 'md' | 'lg' | 'xl';
}

export function Section({
  children,
  className = '',
  background = 'transparent',
  spacing = 'md'
}: SectionProps) {
  const backgrounds = {
    transparent: 'bg-transparent',
    white: 'bg-white',
    cream: 'bg-brand-cream',
    green: 'bg-brand-green'
  };

  const spacings = {
    sm: 'py-8 md:py-12',
    md: 'py-12 md:py-16 lg:py-20',
    lg: 'py-16 md:py-20 lg:py-24',
    xl: 'py-20 md:py-24 lg:py-32'
  };

  return (
    <section className={`${backgrounds[background]} ${spacings[spacing]} ${className}`}>
      {children}
    </section>
  );
}

/**
 * Container Component
 *
 * Centered container with responsive padding and max-width.
 * Use this inside Section components for content.
 *
 * @param children - Container content
 * @param className - Additional custom classes
 * @param maxWidth - Maximum width constraint
 */
interface ContainerProps {
  children: React.ReactNode;
  className?: string;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '7xl';
}

export function Container({
  children,
  className = '',
  maxWidth = '7xl'
}: ContainerProps) {
  const maxWidths = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    '2xl': 'max-w-2xl',
    '7xl': 'max-w-7xl'
  };

  return (
    <div className={`container mx-auto px-4 md:px-6 lg:px-8 ${maxWidths[maxWidth]} ${className}`}>
      {children}
    </div>
  );
}

/**
 * Hero Component
 *
 * Hero section with large heading and optional subtitle.
 * Typically used at the top of pages.
 *
 * @param title - Main heading text
 * @param subtitle - Optional subtitle text
 * @param children - Optional additional content (buttons, etc.)
 * @param alignment - Text alignment
 * @param background - Background color
 */
interface HeroProps {
  title: string;
  subtitle?: string;
  children?: React.ReactNode;
  alignment?: 'left' | 'center';
  background?: 'cream' | 'white' | 'green';
}

export function Hero({
  title,
  subtitle,
  children,
  alignment = 'center',
  background = 'cream'
}: HeroProps) {
  const alignments = {
    left: 'text-left',
    center: 'text-center'
  };

  const backgrounds = {
    cream: 'bg-brand-cream',
    white: 'bg-white',
    green: 'bg-brand-green'
  };

  const textColor = background === 'green' ? 'text-brand-cream' : 'text-brand-green';
  const subtitleColor = background === 'green' ? 'text-brand-cream' : 'text-neutral-700';

  return (
    <Section background={background} spacing="xl">
      <Container>
        <div className={alignments[alignment]}>
          <h1 className={`text-3xl md:text-4xl lg:text-5xl xl:text-6xl font-bold ${textColor} mb-6`}>
            {title}
          </h1>

          {subtitle && (
            <p className={`text-lg md:text-xl lg:text-2xl ${subtitleColor} mb-8 max-w-3xl ${alignment === 'center' ? 'mx-auto' : ''}`}>
              {subtitle}
            </p>
          )}

          {children && (
            <div className={`flex gap-4 ${alignment === 'center' ? 'justify-center' : ''} flex-wrap`}>
              {children}
            </div>
          )}
        </div>
      </Container>
    </Section>
  );
}

/**
 * Grid Component
 *
 * Responsive grid layout for cards, items, etc.
 *
 * @param children - Grid items
 * @param columns - Number of columns on desktop (auto-adjusts for mobile/tablet)
 * @param gap - Gap between grid items
 * @param className - Additional custom classes
 */
interface GridProps {
  children: React.ReactNode;
  columns?: 2 | 3 | 4;
  gap?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function Grid({
  children,
  columns = 3,
  gap = 'md',
  className = ''
}: GridProps) {
  const gridColumns = {
    2: 'grid-cols-1 md:grid-cols-2',
    3: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3',
    4: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4'
  };

  const gaps = {
    sm: 'gap-4',
    md: 'gap-6',
    lg: 'gap-8'
  };

  return (
    <div className={`grid ${gridColumns[columns]} ${gaps[gap]} ${className}`}>
      {children}
    </div>
  );
}
