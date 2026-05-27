import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { validateCronSecret } from '@/lib/utils/cron-auth';
import { EventOrchestrator } from '@/lib/events/orchestrator';

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const authError = validateCronSecret(req);
  if (authError) return authError;

  const supabase = createAdminClient();

  // Find events with pending consumers older than 2 minutes
  const cutoff = new Date(Date.now() - 2 * 60 * 1000).toISOString();

  const { data: staleTracking, error } = await supabase
    .from('event_consumer_tracking')
    .select('event_id, consumer_name')
    .eq('status', 'pending')
    .lt('created_at', cutoff)
    .limit(50);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!staleTracking?.length) return NextResponse.json({ retried: 0 });

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
