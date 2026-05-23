// app/api/events/process/route.ts
// Runs every 5 minutes via Vercel cron.
// Drains the student_events table — the engine that connects all modules.

import { NextResponse } from 'next/server';
import { EventOrchestrator } from '@/lib/events/orchestrator';
import { logger } from '@/lib/utils/logger';

const BATCH_SIZE = 20;

export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  try {
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY! // Bypasses RLS for background jobs
    );

    // Fetch pending events
    const { data: pendingEvents, error } = await supabase
      .from('student_events')
      .select('*')
      .eq('status', 'pending')
      .limit(BATCH_SIZE);

    if (error) {
      logger.error('Failed to fetch pending events', error);
      return new Response('Error fetching events', { status: 500 });
    }

    if (!pendingEvents || pendingEvents.length === 0) {
      logger.info('No pending events to process');
      return new Response('No events', { status: 204 });
    }

    // Process each event
    await Promise.allSettled(
      pendingEvents.map((event) => EventOrchestrator.processEvent(event.id))
    );

    logger.info('Processed batch of events', { count: pendingEvents.length });
    return NextResponse.json({ processed: pendingEvents.length });
  } catch (err) {
    logger.error('Event processing route failed', err as any);
    return new Response('Internal server error', { status: 500 });
  }
}
