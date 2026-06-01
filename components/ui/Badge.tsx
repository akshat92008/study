interface BadgeProps {
  children: React.ReactNode;
  color?: 'blue' | 'green' | 'yellow' | 'red' | 'purple' | 'cyan' | 'gray';
  style?: React.CSSProperties;
}

const colorMap: Record<string, { bg: string; fg: string; border: string }> = {
  blue:   { bg: 'var(--accent-blue-glow)', fg: 'var(--accent-blue)', border: 'var(--accent-blue-dim)' },
  green:  { bg: 'var(--success-glow)', fg: 'var(--success)', border: 'var(--success-dim)' },
  yellow: { bg: 'var(--warning-glow)', fg: 'var(--warning)', border: 'var(--warning-dim)' },
  red:    { bg: 'var(--danger-glow)', fg: 'var(--danger)', border: 'var(--danger-dim)' },
  purple: { bg: 'hsla(265,80%,60%,0.12)', fg: 'var(--accent-purple)', border: 'var(--accent-purple-dim)' },
  cyan:   { bg: 'hsla(185,80%,50%,0.12)', fg: 'var(--accent-cyan)', border: 'var(--accent-cyan-dim)' },
  gray:   { bg: 'var(--bg-tertiary)', fg: 'var(--text-secondary)', border: 'var(--border-default)' },
};

export default function Badge({ children, color = 'blue', style }: BadgeProps) {
  const c = colorMap[color];
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', padding: '0.125rem 0.625rem',
      fontSize: 'var(--fs-xs)', fontWeight: 'var(--fw-semibold)' as any,
      background: c.bg, color: c.fg, border: `1px solid ${c.border}`,
      borderRadius: 'var(--radius-full)', letterSpacing: 'var(--ls-wide)',
      textTransform: 'uppercase',
      ...style,
    }}>
      {children}
    </span>
  );
}
