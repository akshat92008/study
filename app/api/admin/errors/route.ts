import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/admin';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

export async function GET() {
  const auth = await requireAdmin();
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const supabase = createAdminClient();
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const [{ data: recent }, { count: count24h }] = await Promise.all([
    supabase
      .from('app_error_events')
      .select('id,route,feature,error_code,message,severity,request_id,created_at')
      .order('created_at', { ascending: false })
      .limit(50),
    supabase
      .from('app_error_events')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', since),
  ]);

  return NextResponse.json({ count24h: count24h ?? 0, recent: recent ?? [] });
}
