import { afterEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { middleware } from '@/middleware';

describe('middleware internal worker auth', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('accepts the dedicated worker secret header for internal worker routes', async () => {
    vi.stubEnv('NODE_ENV', 'test');
    vi.stubEnv('INTERNAL_WORKER_SECRET', 'worker-secret');
    vi.stubEnv('INTERNAL_CRON_SECRET', 'cron-secret');

    const response = await middleware(new NextRequest('http://localhost/api/internal/workers/process-events', {
      headers: { 'x-internal-worker-secret': 'worker-secret' },
    }));

    expect(response.status).toBe(200);
  });

  it('rejects an incorrect worker secret header before falling back to cron auth', async () => {
    vi.stubEnv('NODE_ENV', 'test');
    vi.stubEnv('INTERNAL_WORKER_SECRET', 'worker-secret');
    vi.stubEnv('INTERNAL_CRON_SECRET', 'cron-secret');

    const response = await middleware(new NextRequest('http://localhost/api/internal/workers/process-events', {
      headers: {
        'x-internal-worker-secret': 'wrong-secret',
        authorization: 'Bearer cron-secret',
      },
    }));

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({
      error: 'unauthorized',
    });
  });

  it('fails closed for weak worker secrets in production', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('INTERNAL_WORKER_SECRET', 'changeme');

    const response = await middleware(new NextRequest('http://localhost/api/internal/workers/process-events', {
      headers: { 'x-internal-worker-secret': 'changeme' },
    }));

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toMatchObject({
      error: 'worker_not_configured',
    });
  });
});
