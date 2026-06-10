import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const processBatch = vi.hoisted(() => vi.fn());
const getHealthSummary = vi.hoisted(() => vi.fn());

vi.mock('@/lib/events/worker', () => ({
  EventWorkerService: { processBatch, getHealthSummary },
}));

vi.mock('@/lib/utils/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

describe('event worker route auth', () => {
  beforeEach(() => {
    processBatch.mockReset();
    processBatch.mockResolvedValue({
      processed: 3,
      failed: 0,
      skipped: 0,
      agentActionsApplied: 2,
      agentActionsProposed: 1,
      agentActionsSkipped: 0,
      agentActionsFailed: 0,
    });
    getHealthSummary.mockReset();
    getHealthSummary.mockResolvedValue({
      pendingEvents: 0,
      processingEvents: 0,
      failedEvents: 0,
      pendingLocks: 0,
      processingLocks: 0,
      failedLocks: 0,
      dlqCount: 0,
      oldestPendingAgeSeconds: 0,
      staleRouteSkips: 0,
      averageAttempts: 0,
      errors: [],
      timestamp: '2026-06-02T00:00:00.000Z',
    });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('fails closed when INTERNAL_CRON_SECRET is not configured', async () => {
    vi.stubEnv('INTERNAL_CRON_SECRET', '');
    vi.stubEnv('CRON_SECRET', '');
    const { processEventWorkerRoute } = await import('@/lib/events/worker-route');

    const res = await processEventWorkerRoute(new Request('http://localhost/api/internal/workers/process-events'));

    expect(res.status).toBe(500);
    expect(processBatch).not.toHaveBeenCalled();
  });

  it('rejects requests without the configured bearer token', async () => {
    vi.stubEnv('INTERNAL_CRON_SECRET', 'test-secret');
    const { processEventWorkerRoute } = await import('@/lib/events/worker-route');

    const res = await processEventWorkerRoute(new Request('http://localhost/api/internal/workers/process-events'));

    expect(res.status).toBe(401);
    expect(processBatch).not.toHaveBeenCalled();
  });

  it('fails closed for weak production cron secrets', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('INTERNAL_CRON_SECRET', 'test-secret');
    const { processEventWorkerRoute } = await import('@/lib/events/worker-route');

    const res = await processEventWorkerRoute(new Request('http://localhost/api/internal/workers/process-events', {
      headers: { authorization: 'Bearer test-secret' },
    }));

    expect(res.status).toBe(500);
    expect(processBatch).not.toHaveBeenCalled();
  });

  it('runs the canonical worker only for authenticated requests', async () => {
    vi.stubEnv('NODE_ENV', 'test');
    vi.stubEnv('INTERNAL_CRON_SECRET', 'test-secret');
    const { processEventWorkerRoute } = await import('@/lib/events/worker-route');

    const res = await processEventWorkerRoute(new Request('http://localhost/api/internal/workers/process-events', {
      headers: { authorization: 'Bearer test-secret' },
    }));

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      ok: true,
      processed: 3,
      failed: 0,
      skipped: 0,
      dlq: 0,
      durationMs: expect.any(Number),
      queueHealth: {
        pendingEvents: 0,
        dlqCount: 0,
        oldestPendingAgeSeconds: 0,
        pendingLocks: 0,
        processingLocks: 0,
      },
      workerCaps: {
        batchSize: 10,
        maxRuntimeMs: 8000,
        maxAiCallsPerRun: 3,
      },
      nextRecommendedRunSeconds: 300,
    });
    expect(processBatch).toHaveBeenCalledWith(10, 5, 8000, expect.any(Number), expect.any(Number));
  });

  it('passes bounded env-configured runtime limits into the worker', async () => {
    vi.stubEnv('NODE_ENV', 'test');
    vi.stubEnv('INTERNAL_CRON_SECRET', 'test-secret');
    vi.stubEnv('EVENT_WORKER_BATCH_SIZE', '12');
    vi.stubEnv('EVENT_WORKER_LEASE_MINUTES', '3');
    vi.stubEnv('EVENT_WORKER_MAX_RUNTIME_MS', '17000');
    const { processEventWorkerRoute } = await import('@/lib/events/worker-route');

    const res = await processEventWorkerRoute(new Request('http://localhost/api/internal/workers/process-events', {
      headers: { authorization: 'Bearer test-secret' },
    }));

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      workerCaps: {
        batchSize: 12,
        maxRuntimeMs: 17000,
        maxAiCallsPerRun: 3,
      },
    });
    expect(processBatch).toHaveBeenCalledWith(12, 3, 17000, expect.any(Number), expect.any(Number));
  });
});
