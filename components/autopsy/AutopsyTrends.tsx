import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import Card from '@/components/ui/Card';
import { TrendingUp } from 'lucide-react';

interface TrendData {
  date: string;
  score: number;
}

interface AutopsyTrendsProps {
  data: TrendData[];
}

export default function AutopsyTrends({ data }: AutopsyTrendsProps) {
  if (!data || data.length === 0) {
    return (
      <Card padding="lg">
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)', marginBottom: 'var(--sp-4)' }}>
          <TrendingUp color="var(--text-secondary)" />
          <h3 style={{ fontSize: 'var(--fs-lg)', fontWeight: 'var(--fw-bold)', color: 'var(--text-primary)' }}>Historical Trends</h3>
        </div>
        <p style={{ color: 'var(--text-secondary)' }}>No historical data available yet. Complete more mock tests to see your trends.</p>
      </Card>
    );
  }

  return (
    <Card padding="lg">
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)', marginBottom: 'var(--sp-6)' }}>
        <TrendingUp color="var(--accent-cyan)" />
        <h3 style={{ fontSize: 'var(--fs-lg)', fontWeight: 'var(--fw-bold)', color: 'var(--text-primary)' }}>Historical Trends</h3>
      </div>
      
      <div style={{ height: '250px', width: '100%' }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <XAxis dataKey="date" stroke="var(--text-secondary)" fontSize={12} tickLine={false} axisLine={false} />
            <YAxis stroke="var(--text-secondary)" fontSize={12} tickLine={false} axisLine={false} />
            <Tooltip 
              contentStyle={{ background: 'var(--bg-primary)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)' }} 
              itemStyle={{ color: 'var(--accent-cyan)' }}
            />
            <Line type="monotone" dataKey="score" stroke="var(--accent-cyan)" strokeWidth={3} dot={{ r: 4, fill: 'var(--accent-cyan)' }} activeDot={{ r: 6 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}
