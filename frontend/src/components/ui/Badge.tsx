'use client';

import { forwardRef, HTMLAttributes } from 'react';

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  dot?: boolean;
}

const Badge = forwardRef<HTMLSpanElement, BadgeProps>(
  (
    {
      className = '',
      variant = 'default',
      size = 'md',
      dot = false,
      children,
      ...props
    },
    ref
  ) => {
    const baseStyles =
      'inline-flex items-center gap-1.5 font-medium rounded-full transition-colors';

    const variants = {
      default: 'bg-bg-secondary text-text-primary',
      success: 'bg-success/10 text-success',
      warning: 'bg-warning/10 text-warning',
      danger: 'bg-danger/10 text-danger',
      info: 'bg-accent/10 text-accent',
      outline: 'bg-transparent border border-border-color text-text-secondary',
    };

    const sizes = {
      sm: 'px-2 py-0.5 text-xs',
      md: 'px-2.5 py-1 text-sm',
      lg: 'px-3 py-1.5 text-base',
    };

    const dotColors = {
      default: 'bg-text-secondary',
      success: 'bg-success',
      warning: 'bg-warning',
      danger: 'bg-danger',
      info: 'bg-accent',
      outline: 'bg-text-secondary',
    };

    return (
      <span
        ref={ref}
        className={`
          ${baseStyles}
          ${variants[variant]}
          ${sizes[size]}
          ${className}
        `}
        {...props}
      >
        {dot && (
          <span
            className={`w-2 h-2 rounded-full ${dotColors[variant]}`}
          />
        )}
        {children}
      </span>
    );
  }
);

Badge.displayName = 'Badge';

// Status Badge - commonly used for showing status with dot
export interface StatusBadgeProps extends HTMLAttributes<HTMLSpanElement> {
  status: 'success' | 'warning' | 'error' | 'info' | 'pending';
  children: React.ReactNode;
}

const StatusBadge = forwardRef<HTMLSpanElement, StatusBadgeProps>(
  ({ status, children, className = '', ...props }, ref) => {
    const statusConfig = {
      success: { variant: 'success' as const, label: 'Success' },
      warning: { variant: 'warning' as const, label: 'Warning' },
      error: { variant: 'danger' as const, label: 'Error' },
      info: { variant: 'info' as const, label: 'Info' },
      pending: { variant: 'default' as const, label: 'Pending' },
    };

    const config = statusConfig[status];

    return (
      <Badge
        ref={ref}
        variant={config.variant}
        dot
        className={className}
        {...props}
      >
        {children}
      </Badge>
    );
  }
);

StatusBadge.displayName = 'StatusBadge';

export { Badge, StatusBadge };
