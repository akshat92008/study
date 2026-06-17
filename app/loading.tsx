import Card from '@/components/ui/Card';
import Skeleton from '@/components/ui/Skeleton';

export default function Loading() {
  return (
    <div style={{ padding: 'var(--sp-8)', display: 'grid', gap: 'var(--sp-4)' }}>
      <Card padding="lg">
        <Skeleton height="28px" width="45%" />
        <div style={{ marginTop: 'var(--sp-4)', display: 'grid', gap: 'var(--sp-3)' }}>
          <Skeleton height="16px" width="80%" />
          <Skeleton height="16px" width="60%" />
        </div>
      </Card>
      <Card padding="lg">
        <Skeleton height="180px" width="100%" />
      </Card>

    </div>
  );
}
