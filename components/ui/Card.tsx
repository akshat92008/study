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

/* ── Sub-components matching shadcn/ui Card API ────────────────────── */

const CardHeader = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ children, style, ...props }, ref) => (
    <div ref={ref} style={{ display: 'flex', flexDirection: 'column', gap: '6px', ...style }} {...props}>
      {children}
    </div>
  )
);
CardHeader.displayName = 'CardHeader';

const CardTitle = forwardRef<HTMLHeadingElement, HTMLAttributes<HTMLHeadingElement>>(
  ({ children, style, ...props }, ref) => (
    <h3 ref={ref} style={{ fontSize: '1rem', fontWeight: 600, lineHeight: 1.2, margin: 0, ...style }} {...props}>
      {children}
    </h3>
  )
);
CardTitle.displayName = 'CardTitle';

const CardContent = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ children, style, ...props }, ref) => (
    <div ref={ref} style={{ ...style }} {...props}>
      {children}
    </div>
  )
);
CardContent.displayName = 'CardContent';

export { Card, CardHeader, CardTitle, CardContent };
export default Card;
