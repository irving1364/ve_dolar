import React from 'react';

interface InputProps {
  type?: 'text' | 'email' | 'password' | 'number' | 'tel' | 'url' | 'search';
  label?: string;
  placeholder?: string;
  value?: string;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onBlur?: (e: React.FocusEvent<HTMLInputElement>) => void;
  error?: string;
  helperText?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
  id?: string;
  name?: string;
  autoComplete?: string;
}

/**
 * Input Component
 *
 * An accessible form input component following the brand design system.
 * Includes label, error states, and helper text support.
 *
 * @param type - Input type attribute
 * @param label - Input label text
 * @param placeholder - Placeholder text
 * @param value - Controlled input value
 * @param onChange - Change handler function
 * @param onBlur - Blur handler function
 * @param error - Error message to display
 * @param helperText - Helper text below input
 * @param required - Required field indicator
 * @param disabled - Disabled state
 * @param className - Additional custom classes
 * @param id - Input ID
 * @param name - Input name attribute
 * @param autoComplete - Autocomplete attribute
 */
export default function Input({
  type = 'text',
  label,
  placeholder,
  value,
  onChange,
  onBlur,
  error,
  helperText,
  required = false,
  disabled = false,
  className = '',
  id,
  name,
  autoComplete
}: InputProps) {
  const inputId = id || name || `input-${Math.random().toString(36).substr(2, 9)}`;

  const baseInputStyles = 'w-full px-4 py-3 rounded-lg border transition-colors focus:outline-none focus:ring-2 disabled:bg-neutral-100 disabled:cursor-not-allowed';

  const inputStyles = error
    ? 'border-red-500 focus:border-red-500 focus:ring-red-500'
    : 'border-neutral-300 focus:border-brand-green focus:ring-brand-green';

  return (
    <div className={`space-y-2 ${className}`}>
      {label && (
        <label
          htmlFor={inputId}
          className="block text-sm font-medium text-brand-green"
        >
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}

      <input
        id={inputId}
        name={name}
        type={type}
        value={value}
        onChange={onChange}
        onBlur={onBlur}
        placeholder={placeholder}
        required={required}
        disabled={disabled}
        autoComplete={autoComplete}
        className={`${baseInputStyles} ${inputStyles}`}
        aria-invalid={error ? 'true' : 'false'}
        aria-describedby={
          error ? `${inputId}-error` : helperText ? `${inputId}-helper` : undefined
        }
      />

      {error && (
        <p
          id={`${inputId}-error`}
          className="text-sm text-red-600"
          role="alert"
        >
          {error}
        </p>
      )}

      {helperText && !error && (
        <p
          id={`${inputId}-helper`}
          className="text-sm text-neutral-500"
        >
          {helperText}
        </p>
      )}
    </div>
  );
}

/**
 * TextArea Component
 * Multiline text input variant
 */
interface TextAreaProps {
  label?: string;
  placeholder?: string;
  value?: string;
  onChange?: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  onBlur?: (e: React.FocusEvent<HTMLTextAreaElement>) => void;
  error?: string;
  helperText?: string;
  required?: boolean;
  disabled?: boolean;
  rows?: number;
  className?: string;
  id?: string;
  name?: string;
}

export function TextArea({
  label,
  placeholder,
  value,
  onChange,
  onBlur,
  error,
  helperText,
  required = false,
  disabled = false,
  rows = 4,
  className = '',
  id,
  name
}: TextAreaProps) {
  const inputId = id || name || `textarea-${Math.random().toString(36).substr(2, 9)}`;

  const baseStyles = 'w-full px-4 py-3 rounded-lg border transition-colors focus:outline-none focus:ring-2 disabled:bg-neutral-100 disabled:cursor-not-allowed resize-y';

  const textareaStyles = error
    ? 'border-red-500 focus:border-red-500 focus:ring-red-500'
    : 'border-neutral-300 focus:border-brand-green focus:ring-brand-green';

  return (
    <div className={`space-y-2 ${className}`}>
      {label && (
        <label
          htmlFor={inputId}
          className="block text-sm font-medium text-brand-green"
        >
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}

      <textarea
        id={inputId}
        name={name}
        value={value}
        onChange={onChange}
        onBlur={onBlur}
        placeholder={placeholder}
        required={required}
        disabled={disabled}
        rows={rows}
        className={`${baseStyles} ${textareaStyles}`}
        aria-invalid={error ? 'true' : 'false'}
        aria-describedby={
          error ? `${inputId}-error` : helperText ? `${inputId}-helper` : undefined
        }
      />

      {error && (
        <p
          id={`${inputId}-error`}
          className="text-sm text-red-600"
          role="alert"
        >
          {error}
        </p>
      )}

      {helperText && !error && (
        <p
          id={`${inputId}-helper`}
          className="text-sm text-neutral-500"
        >
          {helperText}
        </p>
      )}
    </div>
  );
}
