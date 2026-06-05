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
    const batchSize = boundedInt(process.env.EVENT_WORKER_BATCH_SIZE, 10, 1, 50);
    const leaseMinutes = boundedInt(process.env.EVENT_WORKER_LEASE_MINUTES, 5, 1, 30);
    const maxRuntimeMs = boundedInt(process.env.EVENT_WORKER_MAX_RUNTIME_MS, 8_000, 1_000, 60_000);
    const maxAiCallsPerRun = boundedInt(process.env.EVENT_WORKER_MAX_AI_CALLS_PER_RUN, 3, 0, 50);
    logger.info('Worker batch started', { requestId, feature: 'event-worker' });
    const {
      processed,
      failed,
      skipped,
      agentActionsApplied,
      agentActionsProposed,
      agentActionsSkipped,
      agentActionsFailed,
    } = await EventWorkerService.processBatch(batchSize, leaseMinutes, maxRuntimeMs, start);
    logger.info('Worker batch completed', { processed, failed, skipped, durationMs: Date.now() - start, requestId, feature: 'event-worker' });
    const queue = await EventWorkerService.getHealthSummary();

    const queueDepth = queue.pendingEvents;
    const dlqDepth = queue.dlqCount;
    const nextRecommendedRunSeconds = (queueDepth > 0 || skipped > 0) ? 60 : 300;

    return NextResponse.json({
      ok: true,
      processed,
      failed,
      skipped,
      dlq: queue.dlqCount,
      durationMs: Date.now() - start,
      workerCaps: {
        batchSize,
        maxRuntimeMs,
        maxAiCallsPerRun,
      },
      queueHealth: {
        pendingEvents: queue.pendingEvents,
        pendingLocks: queue.pendingLocks,
        processingLocks: queue.processingLocks,
        dlqCount: queue.dlqCount,
        oldestPendingAgeSeconds: queue.oldestPendingAgeSeconds ?? null,
      },
      nextRecommendedRunSeconds,
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

function boundedInt(value: string | undefined, fallback: number, min: number, max: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(parsed)));
}

export async function eventWorkerHealthRoute(req: NextRequest | Request) {
  const requestId = getRequestId(req as Request);
  const authError = validateCronRequest(req as NextRequest);
  if (authError) return authError;

  try {
    const queue = await EventWorkerService.getHealthSummary();

    if (queue.errors.length > 0) {
      logger.error('Worker health check completed with errors', { errors: queue.errors, queueHealth: queue, requestId, feature: 'event-worker' });
    } else {
      logger.info('Worker health check completed', { queueHealth: queue, requestId, feature: 'event-worker' });
    }

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
