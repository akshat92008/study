import { NextRequest, NextResponse } from 'next/server';
import { validateCronRequest } from '@/lib/middleware/cronAuth';
import { logger } from '@/lib/utils/logger';
import { EventWorkerService } from './worker';
import { apiErrorResponse, getRequestId } from '@/lib/api/errors';

export async function processEventWorkerRoute(req: NextRequest | Request) {
  const requestId = getRequestId(req as Request);
  const authError = validateCronRequest(req as NextRequest);
  if (authError) return authError;

  try {
    const start = Date.now();
    logger.info('Worker batch started', { requestId, feature: 'event-worker' });
    const processedCount = await EventWorkerService.processBatch(50, 5);
    const queue = await EventWorkerService.getHealthSummary();

    return NextResponse.json({
      ok: true,
      processed: processedCount,
      queue,
      durationMs: Date.now() - start,
    }, { headers: { 'x-request-id': requestId } });
  } catch (error: any) {
    logger.error('process-events worker route failed', error, { requestId, feature: 'event-worker' });
    return apiErrorResponse('worker_failed', {
      status: 500,
      message: 'Event worker failed.',
      requestId,
    });
  }
}

export async function eventWorkerHealthRoute(req: NextRequest | Request) {
  const requestId = getRequestId(req as Request);
  const authError = validateCronRequest(req as NextRequest);
  if (authError) return authError;

  try {
    const queue = await EventWorkerService.getHealthSummary();

    return NextResponse.json({
      ok: queue.errors.length === 0,
      worker: 'event_worker',
      queue,
      errors: queue.errors,
      timestamp: new Date().toISOString(),
    }, {
      status: queue.errors.length === 0 ? 200 : 503,
      headers: { 'x-request-id': requestId },
    });
  } catch (error: any) {
    logger.error('event worker health route failed', error, { requestId, feature: 'event-worker' });
    return apiErrorResponse('worker_health_failed', {
      status: 500,
      message: 'Worker health check failed.',
      requestId,
    });
  }
}
