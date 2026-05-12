'use client';
import { ButtonHTMLAttributes, forwardRef } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', isLoading, children, disabled, style, ...props }, ref) => {
    const baseStyle: React.CSSProperties = {
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
      fontFamily: 'var(--font-sans)', fontWeight: 'var(--fw-semibold)' as any,
      borderRadius: 'var(--radius-md)', border: '1px solid transparent',
      cursor: disabled || isLoading ? 'not-allowed' : 'pointer',
      opacity: disabled ? 0.5 : 1,
      transition: 'all var(--duration-fast) var(--ease-out)',
      letterSpacing: 'var(--ls-tight)',
      ...(size === 'sm' ? { padding: '0.375rem 0.75rem', fontSize: 'var(--fs-sm)' } : {}),
      ...(size === 'md' ? { padding: '0.5rem 1.25rem', fontSize: 'var(--fs-base)' } : {}),
      ...(size === 'lg' ? { padding: '0.75rem 1.75rem', fontSize: 'var(--fs-md)' } : {}),
      ...(variant === 'primary' ? {
        background: 'var(--accent-blue)', color: 'white', border: '1px solid var(--accent-blue)',
      } : {}),
      ...(variant === 'secondary' ? {
        background: 'var(--bg-tertiary)', color: 'var(--text-primary)', border: '1px solid var(--border-default)',
      } : {}),
      ...(variant === 'ghost' ? {
        background: 'transparent', color: 'var(--text-secondary)',
      } : {}),
      ...(variant === 'danger' ? {
        background: 'var(--danger-dim)', color: 'var(--danger)', border: '1px solid var(--danger)',
      } : {}),
      ...style,
    };

    return (
      <button ref={ref} style={baseStyle} disabled={disabled || isLoading} {...props}>
        {isLoading && <span style={{ width: 14, height: 14, border: '2px solid currentColor', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.6s linear infinite' }} />}
        {children}
      </button>
    );
  }
);
Button.displayName = 'Button';
export default Button;
