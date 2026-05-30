import { NextRequest, NextResponse } from 'next/server';
import { EventWorkerService } from '@/lib/events/worker';
import { validateCronRequest } from '@/lib/middleware/cronAuth';
import { logger } from '@/lib/utils/logger';

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const authError = validateCronRequest(req);
  if (authError) return authError;

  try {
    const start = Date.now();
    const processedCount = await EventWorkerService.processBatch(50, 5);

    return NextResponse.json({
      success: true,
      processed_count: processedCount,
      duration_ms: Date.now() - start,
    });
  } catch (error: any) {
    logger.error('process-events cron failed', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  return POST(req);
}
