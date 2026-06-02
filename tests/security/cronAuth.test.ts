import { afterEach, describe, expect, it, vi } from 'vitest';
import { validateCronRequest } from '@/lib/middleware/cronAuth';
import { NextRequest } from 'next/server';

describe('cronAuth validation', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('rejects missing secret', () => {
    vi.stubEnv('INTERNAL_CRON_SECRET', '');
    vi.stubEnv('CRON_SECRET', '');
    vi.stubEnv('NODE_ENV', 'production');
    const req = new NextRequest('http://localhost/api');
    const res = validateCronRequest(req);
    expect(res).not.toBeNull();
    expect(res?.status).toBe(500);
  });

  it('rejects weak secret', () => {
    vi.stubEnv('INTERNAL_CRON_SECRET', 'changeme');
    vi.stubEnv('CRON_SECRET', '');
    vi.stubEnv('NODE_ENV', 'production');
    const req = new NextRequest('http://localhost/api');
    const res = validateCronRequest(req);
    expect(res).not.toBeNull();
    expect(res?.status).toBe(500);
  });

  it('rejects short secret in production', () => {
    vi.stubEnv('INTERNAL_CRON_SECRET', 'short-secret');
    vi.stubEnv('NODE_ENV', 'production');
    const req = new NextRequest('http://localhost/api');
    const res = validateCronRequest(req);
    expect(res).not.toBeNull();
    expect(res?.status).toBe(500);
  });

  it('accepts short secret in test environment', () => {
    vi.stubEnv('INTERNAL_CRON_SECRET', 'short-secret');
    vi.stubEnv('NODE_ENV', 'test');
    const req = new NextRequest('http://localhost/api', {
      headers: {
        authorization: 'Bearer short-secret'
      }
    });
    const res = validateCronRequest(req);
    expect(res).toBeNull(); // null means it passed
  });

  it('rejects if auth header does not match', () => {
    vi.stubEnv('INTERNAL_CRON_SECRET', 'this_is_a_very_long_and_strong_secret_string');
    vi.stubEnv('NODE_ENV', 'production');
    const req = new NextRequest('http://localhost/api', {
      headers: {
        authorization: 'Bearer wrong-secret'
      }
    });
    const res = validateCronRequest(req);
    expect(res).not.toBeNull();
    expect(res?.status).toBe(401);
  });

  it('accepts if auth header matches strong secret', () => {
    vi.stubEnv('INTERNAL_CRON_SECRET', 'this_is_a_very_long_and_strong_secret_string');
    vi.stubEnv('NODE_ENV', 'production');
    const req = new NextRequest('http://localhost/api', {
      headers: {
        authorization: 'Bearer this_is_a_very_long_and_strong_secret_string'
      }
    });
    const res = validateCronRequest(req);
    expect(res).toBeNull();
  });
});
