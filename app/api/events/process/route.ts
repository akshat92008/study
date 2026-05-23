// app/api/events/process/route.ts
// Runs every 5 minutes via Vercel cron.
// Drains the student_events table — the engine that connects all modules.

import { NextResponse, NextRequest } from 'next/server';
import { EventDispatcher, EVENT_CONSUMERS } from '@/lib/events/orchestrator';
import { logger } from '@/lib/utils/logger';
import { validateCronSecret } from '@/lib/utils/cron-auth';

const BATCH_SIZE = 20;

export async function GET(req: NextRequest) {
  const authError = validateCronSecret(req);
  if (authError) return authError;

  try {
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY! // Bypasses RLS for background jobs
    );

    // Fetch consumer tracking rows that are pending or have failed and can be retried
    const { data: pendingConsumers, error } = await supabase
      .from('event_consumer_tracking')
      .select('event_id, consumer_name, retry_count')
      .in('status', ['pending', 'failed'])
      .lt('retry_count', 5)
      .order('updated_at', { ascending: true })
      .limit(BATCH_SIZE);

    if (error) {
      logger.error('Failed to fetch pending consumer tracking rows', error);
      return new Response('Error fetching events', { status: 500 });
    }

    if (!pendingConsumers || pendingConsumers.length === 0) {
      logger.info('No pending event consumers to process');
      return new Response('No events', { status: 204 });
    }

    // Process each consumer row independently for isolation
    await Promise.allSettled(
      pendingConsumers.map((row) =>
        EventDispatcher.processConsumer(row.event_id, row.consumer_name as any)
      )
    );

    logger.info('Processed batch of event consumers', { count: pendingConsumers.length });
    return NextResponse.json({ processed: pendingConsumers.length });
  } catch (err) {
    logger.error('Event processing route failed', err as any);
    return new Response('Internal server error', { status: 500 });
  }
}
