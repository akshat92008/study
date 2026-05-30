import { NextResponse } from 'next/server';
import { EventWorkerService } from '@/lib/events/worker';
import { logger } from '@/lib/utils/logger';
import { validateCronRequest } from '@/lib/middleware/cronAuth';

export const maxDuration = 60; // Max execution time 60 seconds (adjust based on Vercel plan)

export async function POST(req: Request) {
  try {
    // Optionally: Authenticate via a secret header to ensure only Vercel/cron/internal can hit this
    const authError = validateCronRequest(req as any);
    if (authError) return authError;

    const start = Date.now();
    const processedCount = await EventWorkerService.processBatch(50, 5); // 50 items, 5 min lease

    return NextResponse.json({
      success: true,
      processed_count: processedCount,
      duration_ms: Date.now() - start
    });
  } catch (error) {
    logger.error('Error in worker route', { error });
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
