import React from 'react';

interface ButtonProps {
  variant?: 'primary' | 'secondary' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  type?: 'button' | 'submit' | 'reset';
  className?: string;
  ariaLabel?: string;
}

/**
 * Button Component
 *
 * A versatile button component following the brand design system.
 * Uses custom brand colors: cream (#fbfbee), yellow (#ffde59), green (#0b6d41)
 *
 * @param variant - Button style variant (primary, secondary, outline)
 * @param size - Button size (sm, md, lg)
 * @param children - Button content
 * @param onClick - Click handler function
 * @param disabled - Disabled state
 * @param type - HTML button type
 * @param className - Additional custom classes
 * @param ariaLabel - Accessibility label
 */
export default function Button({
  variant = 'primary',
  size = 'md',
  children,
  onClick,
  disabled = false,
  type = 'button',
  className = '',
  ariaLabel
}: ButtonProps) {
  const baseStyles = 'font-semibold rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed';

  const variants = {
    primary: 'bg-brand-yellow text-brand-green hover:bg-accent-400 focus:ring-brand-yellow active:bg-accent-500',
    secondary: 'bg-brand-green text-brand-cream hover:bg-primary-700 focus:ring-brand-green active:bg-primary-800',
    outline: 'border-2 border-brand-green text-brand-green hover:bg-brand-green hover:text-brand-cream focus:ring-brand-green bg-transparent'
  };

  const sizes = {
    sm: 'px-4 py-2 text-sm',
    md: 'px-6 py-3 text-base',
    lg: 'px-8 py-4 text-lg'
  };

  return (
    <button
      className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${className}`}
      onClick={onClick}
      disabled={disabled}
      type={type}
      aria-label={ariaLabel}
    >
      {children}
    </button>
  );
}
