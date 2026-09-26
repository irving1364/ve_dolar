import React from 'react';

interface CardProps {
  children: React.ReactNode;
  variant?: 'default' | 'bordered' | 'elevated' | 'cream';
  padding?: 'sm' | 'md' | 'lg';
  className?: string;
  hoverable?: boolean;
}

/**
 * Card Component
 *
 * A flexible card component for displaying content with various styles.
 * Uses brand design system colors and follows accessibility guidelines.
 *
 * @param children - Card content
 * @param variant - Card style variant (default, bordered, elevated, cream)
 * @param padding - Internal padding size (sm, md, lg)
 * @param className - Additional custom classes
 * @param hoverable - Adds hover effect when true
 */
export default function Card({
  children,
  variant = 'default',
  padding = 'md',
  className = '',
  hoverable = false
}: CardProps) {
  const variants = {
    default: 'bg-white shadow-md border border-neutral-200',
    bordered: 'bg-brand-cream border-2 border-brand-green shadow-sm',
    elevated: 'bg-white shadow-xl border border-neutral-100',
    cream: 'bg-brand-cream shadow-md border border-neutral-200'
  };

  const paddings = {
    sm: 'p-4',
    md: 'p-6',
    lg: 'p-8'
  };

  const hoverStyles = hoverable
    ? 'transition-transform duration-200 hover:scale-105 hover:shadow-xl cursor-pointer'
    : '';

  return (
    <div
      className={`rounded-xl ${variants[variant]} ${paddings[padding]} ${hoverStyles} ${className}`}
    >
      {children}
    </div>
  );
}

/**
 * CardHeader Component
 * Optional header section for cards
 */
interface CardHeaderProps {
  children: React.ReactNode;
  className?: string;
}

export function CardHeader({ children, className = '' }: CardHeaderProps) {
  return (
    <div className={`mb-4 pb-4 border-b border-neutral-200 ${className}`}>
      {children}
    </div>
  );
}

/**
 * CardTitle Component
 * Styled title for cards
 */
interface CardTitleProps {
  children: React.ReactNode;
  className?: string;
}

export function CardTitle({ children, className = '' }: CardTitleProps) {
  return (
    <h3 className={`text-2xl font-bold text-brand-green ${className}`}>
      {children}
    </h3>
  );
}

/**
 * CardContent Component
 * Content section for cards
 */
interface CardContentProps {
  children: React.ReactNode;
  className?: string;
}

export function CardContent({ children, className = '' }: CardContentProps) {
  return (
    <div className={`text-neutral-700 ${className}`}>
      {children}
    </div>
  );
}

/**
 * CardFooter Component
 * Optional footer section for cards
 */
interface CardFooterProps {
  children: React.ReactNode;
  className?: string;
}

export function CardFooter({ children, className = '' }: CardFooterProps) {
  return (
    <div className={`mt-4 pt-4 border-t border-neutral-200 ${className}`}>
      {children}
    </div>
  );
}
