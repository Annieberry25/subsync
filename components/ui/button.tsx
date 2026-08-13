'use client';

import React from 'react';
import { Loader2 } from 'lucide-react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  icon?: React.ReactNode;
  children?: React.ReactNode;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      loading = false,
      icon,
      children,
      className = '',
      disabled,
      type = 'button',
      ...props
    },
    ref
  ) => {
    const baseStyles =
      'inline-flex items-center justify-center font-semibold rounded-full transition-all duration-200 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed select-none focus:outline-none focus:ring-2 focus:ring-[#14B8A6]/40 active:scale-[0.98]';

    const sizeStyles = {
      sm: 'px-3 py-1 text-xs min-h-[32px] h-8 gap-1.5',
      md: 'px-4 py-1.5 text-xs min-h-[36px] h-9 gap-2',
      lg: 'px-5 py-2 text-xs sm:text-sm min-h-[40px] h-10 gap-2',
    };

    const variantStyles = {
      primary: 'bg-[#14B8A6] hover:bg-[#0D9488] text-[#091512]',
      secondary: 'bg-[#0D0F0F] hover:bg-[#1A1D1D] text-[#F5F7F6] border border-[#1A1D1D]',
      outline: 'bg-transparent hover:bg-[#1A1D1D]/50 text-[#F5F7F6] border border-[#1A1D1D]',
      ghost: 'bg-transparent hover:bg-[#1A1D1D] text-[#94A3B8] hover:text-[#F5F7F6]',
      danger: 'bg-[#D9363E] hover:bg-[#B91C1C] text-white',
    };

    return (
      <button
        ref={ref}
        type={type}
        disabled={disabled || loading}
        className={`${baseStyles} ${sizeStyles[size]} ${variantStyles[variant]} ${className}`}
        {...props}
      >
        {loading ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
        ) : icon ? (
          <span className="shrink-0">{icon}</span>
        ) : null}
        {children && <span>{children}</span>}
      </button>
    );
  }
);

Button.displayName = 'Button';
