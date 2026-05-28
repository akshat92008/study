import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { validateCronRequest } from '@/lib/middleware/cronAuth';
import { EventOrchestrator } from '@/lib/events/orchestrator';

export const maxDuration = 60;
export const GET = POST;

export async function POST(req: NextRequest) {
  const authError = validateCronRequest(req);
  if (authError) return authError;

  const supabase = createAdminClient();

  // Find failed events (under max retries) or events stuck in processing for more than 15 minutes
  const cutoff = new Date(Date.now() - 15 * 60 * 1000).toISOString();

  const { data: failedTracking, error: err1 } = await supabase
    .from('event_consumer_tracking')
    .select('event_id, consumer_name')
    .eq('status', 'failed')
    .lt('retry_count', 5)
    .limit(25);

  const { data: stuckTracking, error: err2 } = await supabase
    .from('event_consumer_tracking')
    .select('event_id, consumer_name')
    .eq('status', 'processing')
    .lt('updated_at', cutoff)
    .limit(25);

  if (err1 || err2) return NextResponse.json({ error: err1?.message || err2?.message }, { status: 500 });

  const staleTracking = [...(failedTracking || []), ...(stuckTracking || [])];
  
  if (!staleTracking.length) return NextResponse.json({ retried: 0 });

  let retried = 0;

  for (const row of staleTracking) {
    try {
      await EventOrchestrator.processConsumer(row.event_id, row.consumer_name as any);
      retried++;
    } catch (e) {
      console.error(`[RetryJob] Failed consumer ${row.consumer_name} for event ${row.event_id}:`, e);
    }
  }

  return NextResponse.json({ retried });
}
