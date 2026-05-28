export const dynamic = 'force-dynamic';
import { getAnalyticsData } from '@/lib/actions/analytics';
import AnalyticsDashboard from '@/components/analytics/AnalyticsDashboard';

export default async function AnalyticsPage() {
  try {
    const data = await getAnalyticsData();
    return <AnalyticsDashboard data={data} />;
  } catch (err: any) {
    console.error("ANALYTICS PAGE CRASH:", err);
    return (
      <div style={{ padding: 'var(--sp-6)', color: 'var(--danger)' }}>
        <h3>Analytics Page Crash</h3>
        <p>{err.message}</p>
        <pre>{err.stack}</pre>
      </div>
    );
  }
}
