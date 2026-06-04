import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/admin';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

export async function GET() {
  const { error, status } = await requireAdmin();
  if (error) {
    return NextResponse.json({ error }, { status });
  }

  const supabase = createAdminClient();

  // Aggregate telemetry: total tokens, cost, request counts, etc.
  const [
    { count: totalRequests },
    { data: usageStats },
    { data: recentErrors }
  ] = await Promise.all([
    supabase.from('ai_usage_events').select('*', { count: 'exact', head: true }),
    supabase.rpc('get_ai_usage_summary_v2'), // Assuming this exists or we can just fetch raw
    supabase.from('ai_usage_events').select('*').eq('status', 'error').order('created_at', { ascending: false }).limit(20)
  ]);

  return NextResponse.json({
    ok: true,
    telemetry: {
      totalRequests: totalRequests || 0,
      usageStats: usageStats || {},
      recentErrors: recentErrors || []
    },
    timestamp: new Date().toISOString()
  });
}
