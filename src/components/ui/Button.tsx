'use client';

// ============================================================
// src/components/ui/Button.tsx
// ============================================================

import { forwardRef } from 'react';

import { cn } from '@/lib/utils';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
type ButtonSize = 'sm' | 'md' | 'lg';

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  fullWidth?: boolean;
};

const variantClasses: Record<ButtonVariant, string> = {
  primary: [
    'bg-gradient-to-r from-pink-500 to-purple-600',
    'text-white font-semibold',
    'hover:from-pink-600 hover:to-purple-700',
    'focus-visible:ring-pink-500',
    'disabled:from-pink-300 disabled:to-purple-400',
    'shadow-sm hover:shadow-md',
  ].join(' '),

  secondary: [
    'bg-white text-gray-700 font-medium',
    'border border-gray-300',
    'hover:bg-gray-50 hover:border-gray-400',
    'focus-visible:ring-gray-400',
    'disabled:bg-gray-50 disabled:text-gray-400',
  ].join(' '),

  ghost: [
    'bg-transparent text-gray-600 font-medium',
    'hover:bg-gray-100',
    'focus-visible:ring-gray-400',
    'disabled:text-gray-300',
  ].join(' '),

  danger: [
    'bg-red-500 text-white font-semibold',
    'hover:bg-red-600',
    'focus-visible:ring-red-500',
    'disabled:bg-red-300',
  ].join(' '),
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'h-8 px-3 text-sm rounded-lg',
  md: 'h-10 px-4 text-sm rounded-xl',
  lg: 'h-12 px-6 text-base rounded-xl',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      loading = false,
      fullWidth = false,
      disabled,
      children,
      className,
      ...props
    },
    ref
  ) => {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={cn(
          // Base
          'inline-flex items-center justify-center gap-2',
          'transition-all duration-150 ease-in-out',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
          'disabled:cursor-not-allowed disabled:opacity-60',
          'select-none',
          // Variant + size
          variantClasses[variant],
          sizeClasses[size],
          fullWidth && 'w-full',
          className
        )}
        {...props}
      >
        {loading && (
          <svg
            className="h-4 w-4 animate-spin"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            />
          </svg>
        )}
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';
