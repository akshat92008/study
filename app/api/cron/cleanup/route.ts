import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { validateCronRequest } from '@/lib/middleware/cronAuth';

export const maxDuration = 60;
export const GET = POST;

export async function POST(req: NextRequest) {
  const authError = validateCronRequest(req);
  if (authError) return authError;

  const supabase = createAdminClient();
  const results: Record<string, number> = {};

  // 1. Delete completed events older than 7 days
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { count: deletedEvents } = await supabase
    .from('event_queue')
    .delete({ count: 'exact' })
    .eq('status', 'COMPLETED')
    .lt('created_at', sevenDaysAgo);
  results.deletedCompletedEvents = deletedEvents ?? 0;

  // 2. Delete orphaned consumer tracking rows
  const { count: deletedTracking } = await supabase
    .from('consumer_locks')
    .delete({ count: 'exact' })
    .lt('created_at', sevenDaysAgo)
    .in('status', ['COMPLETED']);
  results.deletedTrackingRows = deletedTracking ?? 0;

  // 3. Log DLQ summary (don't delete — keep for manual inspection)
  const { count: dlqCount } = await supabase
    .from('event_dlq')
    .select('id', { count: 'exact', head: true });
  results.dlqQueueDepth = dlqCount ?? 0;

  console.log('[Cleanup Cron] Results:', results);
  return NextResponse.json({ ok: true, ...results });
}
