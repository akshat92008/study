interface ProgressProps {
  value: number; // 0-100
  color?: 'blue' | 'green' | 'yellow' | 'red' | 'purple';
  size?: 'sm' | 'md';
  showLabel?: boolean;
}

const colorVar: Record<string, string> = {
  blue: 'var(--accent-blue)', green: 'var(--success)',
  yellow: 'var(--warning)', red: 'var(--danger)', purple: 'var(--accent-purple)',
};

export default function Progress({ value, color = 'blue', size = 'md', showLabel }: ProgressProps) {
  const h = size === 'sm' ? '4px' : '8px';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)', width: '100%' }}>
      <div style={{ flex: 1, height: h, background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-full)', overflow: 'hidden' }}>
        <div style={{
          height: '100%', width: `${Math.min(100, Math.max(0, value))}%`,
          background: colorVar[color], borderRadius: 'var(--radius-full)',
          transition: 'width var(--duration-slow) var(--ease-out)',
        }} />
      </div>
      {showLabel && <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)', minWidth: '3ch' }}>{Math.round(value)}%</span>}
    </div>
  );
}
