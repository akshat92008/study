// app/api/events/process/route.ts
// Runs every 5 minutes via Vercel cron.
// Drains the student_events table — the engine that connects all modules.

import { NextResponse, NextRequest } from 'next/server';
import { EventConsumer, EventDispatcher } from '@/lib/events/orchestrator';
import { logger } from '@/lib/utils/logger';
import { validateCronSecret } from '@/lib/utils/cron-auth';

const BATCH_SIZE = 20;

export async function GET(req: NextRequest) {
  const authError = validateCronSecret(req);
  if (authError) return authError;

  try {
    const { createAdminClient } = await import('@/lib/supabase/admin');
    const supabase = createAdminClient();

    // Fetch consumer tracking rows that are pending or have failed and can be retried
    const { data: pendingConsumers, error } = await supabase
      .from('event_consumer_tracking')
      .select('event_id, consumer_name, retry_count')
      .in('status', ['processing', 'failed'])
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

export async function POST(req: NextRequest) {
  const authError = validateCronSecret(req);
  if (authError) return authError;

  try {
    const body = await req.json().catch(() => ({}));
    const eventId = body.eventId as string | undefined;
    const consumerName = body.consumerName as EventConsumer | undefined;

    if (!eventId) {
      return NextResponse.json({ error: 'Missing eventId' }, { status: 400 });
    }

    if (consumerName) {
      await EventDispatcher.processConsumer(eventId, consumerName);
      return NextResponse.json({ processed: 1 });
    }

    const { createAdminClient } = await import('@/lib/supabase/admin');
    const supabase = createAdminClient();
    const { data: rows, error } = await supabase
      .from('event_consumer_tracking')
      .select('consumer_name')
      .eq('event_id', eventId)
      .in('status', ['processing', 'failed'])
      .lt('retry_count', 5);

    if (error) {
      logger.error('Failed to fetch consumers for event retry', error);
      return NextResponse.json({ error: 'Failed to fetch event consumers' }, { status: 500 });
    }

    await Promise.allSettled(
      (rows || []).map((row) =>
        EventDispatcher.processConsumer(eventId, row.consumer_name as EventConsumer)
      )
    );

    return NextResponse.json({ processed: rows?.length || 0 });
  } catch (err) {
    logger.error('Event processing POST failed', err as any);
    return new Response('Internal server error', { status: 500 });
  }
}
