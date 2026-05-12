export default function Skeleton({ width = '100%', height = '20px' }: { width?: string; height?: string }) {
  return (
    <div style={{
      width, height, borderRadius: 'var(--radius-md)',
      background: 'linear-gradient(90deg, var(--bg-tertiary) 25%, var(--bg-hover) 50%, var(--bg-tertiary) 75%)',
      backgroundSize: '200% 100%', animation: 'shimmer 1.5s infinite',
    }} />
  );
}
