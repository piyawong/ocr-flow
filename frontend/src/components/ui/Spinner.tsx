'use client';

import { forwardRef, HTMLAttributes } from 'react';

export interface SpinnerProps extends HTMLAttributes<HTMLDivElement> {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  variant?: 'default' | 'primary' | 'white';
}

const Spinner = forwardRef<HTMLDivElement, SpinnerProps>(
  ({ className = '', size = 'md', variant = 'default', ...props }, ref) => {
    const sizes = {
      sm: 'w-4 h-4 border-2',
      md: 'w-8 h-8 border-3',
      lg: 'w-12 h-12 border-4',
      xl: 'w-16 h-16 border-4',
    };

    const variants = {
      default: 'border-border-color border-t-text-secondary',
      primary: 'border-accent/30 border-t-accent',
      white: 'border-white/30 border-t-white',
    };

    return (
      <div
        ref={ref}
        className={`
          ${sizes[size]}
          ${variants[variant]}
          rounded-full animate-spin
          ${className}
        `}
        role="status"
        aria-label="Loading"
        {...props}
      />
    );
  }
);

Spinner.displayName = 'Spinner';

// Full page loading overlay
export interface LoadingOverlayProps extends HTMLAttributes<HTMLDivElement> {
  message?: string;
}

const LoadingOverlay = forwardRef<HTMLDivElement, LoadingOverlayProps>(
  ({ message = 'Loading...', className = '', ...props }, ref) => (
    <div
      ref={ref}
      className={`
        fixed inset-0 z-50 flex flex-col items-center justify-center
        bg-bg-primary/80 backdrop-blur-sm
        ${className}
      `}
      {...props}
    >
      <Spinner size="lg" variant="primary" />
      {message && (
        <p className="mt-4 text-text-secondary text-sm">{message}</p>
      )}
    </div>
  )
);

LoadingOverlay.displayName = 'LoadingOverlay';

// Inline loading state
export interface LoadingStateProps extends HTMLAttributes<HTMLDivElement> {
  text?: string;
}

const LoadingState = forwardRef<HTMLDivElement, LoadingStateProps>(
  ({ text = 'Loading...', className = '', ...props }, ref) => (
    <div
      ref={ref}
      className={`flex items-center justify-center gap-3 py-8 ${className}`}
      {...props}
    >
      <Spinner size="md" variant="primary" />
      <span className="text-text-secondary">{text}</span>
    </div>
  )
);

LoadingState.displayName = 'LoadingState';

export { Spinner, LoadingOverlay, LoadingState };
