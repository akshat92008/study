import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Activity, Server, Zap, AlertTriangle } from 'lucide-react';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export const metadata = {
  title: 'System Health | Cognition OS',
};

async function getHealthStats() {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: () => {},
      },
    }
  );

  const { count: pendingEvents } = await supabase
    .from('event_queue')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'PENDING');

  const { count: dlqEvents } = await supabase
    .from('event_dlq')
    .select('*', { count: 'exact', head: true });

  const isDatabaseHealthy = pendingEvents !== null;

  return {
    pendingEvents: pendingEvents || 0,
    dlqEvents: dlqEvents || 0,
    isDatabaseHealthy,
  };
}

export default async function HealthDashboardPage() {
  const stats = await getHealthStats();

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-white mb-2">Production Health</h1>
        <p className="text-gray-400">System observability and queue metrics.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="bg-zinc-900/50 border-zinc-800">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-zinc-400">System Status</CardTitle>
            <Activity className="w-4 h-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-500">Operational</div>
            <p className="text-xs text-zinc-500 mt-1">All core services running</p>
          </CardContent>
        </Card>

        <Card className="bg-zinc-900/50 border-zinc-800">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-zinc-400">Database Connection</CardTitle>
            <Server className={`w-4 h-4 ${stats.isDatabaseHealthy ? 'text-emerald-500' : 'text-red-500'}`} />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${stats.isDatabaseHealthy ? 'text-white' : 'text-red-500'}`}>
              {stats.isDatabaseHealthy ? 'Connected' : 'Offline'}
            </div>
            <p className="text-xs text-zinc-500 mt-1">Supabase pgBouncer</p>
          </CardContent>
        </Card>

        <Card className="bg-zinc-900/50 border-zinc-800">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-zinc-400">Queue Depth</CardTitle>
            <Zap className="w-4 h-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">{stats.pendingEvents}</div>
            <p className="text-xs text-zinc-500 mt-1">Pending background events</p>
          </CardContent>
        </Card>

        <Card className={`bg-zinc-900/50 border-zinc-800 ${stats.dlqEvents > 0 ? 'border-red-500/50 bg-red-500/10' : ''}`}>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-zinc-400">DLQ Spikes</CardTitle>
            <AlertTriangle className={`w-4 h-4 ${stats.dlqEvents > 0 ? 'text-red-500' : 'text-zinc-500'}`} />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${stats.dlqEvents > 0 ? 'text-red-500' : 'text-white'}`}>
              {stats.dlqEvents}
            </div>
            <p className="text-xs text-zinc-500 mt-1">Events permanently failed</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
