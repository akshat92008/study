import { HTMLAttributes, forwardRef } from 'react';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'glass' | 'glow';
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ variant = 'default', padding = 'md', children, style, ...props }, ref) => {
    const padMap = { none: '0', sm: 'var(--sp-3)', md: 'var(--sp-5)', lg: 'var(--sp-8)' };
    const cardStyle: React.CSSProperties = {
      background: variant === 'glass' ? 'var(--bg-glass)' : 'var(--bg-secondary)',
      border: '1px solid var(--border-subtle)',
      borderRadius: 'var(--radius-lg)',
      padding: padMap[padding],
      backdropFilter: variant === 'glass' ? 'blur(12px)' : undefined,
      boxShadow: variant === 'glow' ? 'var(--shadow-glow-blue)' : 'var(--shadow-sm)',
      transition: 'all var(--duration-normal) var(--ease-out)',
      ...style,
    };
    return <div ref={ref} style={cardStyle} {...props}>{children}</div>;
  }
);
Card.displayName = 'Card';
export default Card;
