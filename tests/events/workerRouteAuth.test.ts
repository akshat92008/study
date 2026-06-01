import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const processBatch = vi.hoisted(() => vi.fn());

vi.mock('@/lib/events/worker', () => ({
  EventWorkerService: { processBatch },
}));

vi.mock('@/lib/utils/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

describe('event worker route auth', () => {
  beforeEach(() => {
    processBatch.mockReset();
    processBatch.mockResolvedValue(3);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('fails closed when CRON_SECRET is not configured', async () => {
    vi.stubEnv('CRON_SECRET', '');
    const { processEventWorkerRoute } = await import('@/lib/events/worker-route');

    const res = await processEventWorkerRoute(new Request('http://localhost/api/events/process'));

    expect(res.status).toBe(500);
    expect(processBatch).not.toHaveBeenCalled();
  });

  it('rejects requests without the configured bearer token', async () => {
    vi.stubEnv('CRON_SECRET', 'test-secret');
    const { processEventWorkerRoute } = await import('@/lib/events/worker-route');

    const res = await processEventWorkerRoute(new Request('http://localhost/api/events/process'));

    expect(res.status).toBe(401);
    expect(processBatch).not.toHaveBeenCalled();
  });

  it('runs the canonical worker only for authenticated requests', async () => {
    vi.stubEnv('CRON_SECRET', 'test-secret');
    const { processEventWorkerRoute } = await import('@/lib/events/worker-route');

    const res = await processEventWorkerRoute(new Request('http://localhost/api/events/process', {
      headers: { authorization: 'Bearer test-secret' },
    }));

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true, processed: 3, failed: 0 });
    expect(processBatch).toHaveBeenCalledWith(50, 5);
  });
});
