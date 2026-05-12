'use client';
import { InputHTMLAttributes, forwardRef } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, style, ...props }, ref) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-1)' }}>
      {label && <label style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)', fontWeight: 'var(--fw-medium)' }}>{label}</label>}
      <input
        ref={ref}
        style={{
          padding: '0.625rem 0.875rem', fontSize: 'var(--fs-base)',
          background: 'var(--bg-primary)', color: 'var(--text-primary)',
          border: `1px solid ${error ? 'var(--danger)' : 'var(--border-default)'}`,
          borderRadius: 'var(--radius-md)', outline: 'none', fontFamily: 'var(--font-sans)',
          transition: 'border-color var(--duration-fast)',
          ...style,
        }}
        onFocus={(e) => { e.target.style.borderColor = 'var(--accent-blue)'; props.onFocus?.(e); }}
        onBlur={(e) => { e.target.style.borderColor = error ? 'var(--danger)' : 'var(--border-default)'; props.onBlur?.(e); }}
        {...props}
      />
      {error && <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--danger)' }}>{error}</span>}
    </div>
  )
);
Input.displayName = 'Input';
export default Input;
