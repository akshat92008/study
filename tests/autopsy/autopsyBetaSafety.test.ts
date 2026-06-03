import { describe, expect, it, vi, beforeEach } from 'vitest';
import { POST } from '@/app/api/autopsy/ingest/route';
import { NextRequest } from 'next/server';

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn().mockResolvedValue({
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: { exam_type: 'Test' } })
  })
}));

vi.mock('@/lib/middleware/withRateLimit', () => ({
  withRateLimit: (name: string, fn: any) => fn
}));

vi.mock('@/lib/services/autopsy-jobs', () => ({
  createAutopsyJob: vi.fn().mockResolvedValue({ status: 'queued', id: '123', result_autopsy_id: null, error_message: null })
}));

vi.mock('@/lib/utils/billing', () => ({
  validateUploadBytes: vi.fn().mockReturnValue({ allowed: true }),
  validatePromptLength: vi.fn().mockReturnValue({ allowed: true }),
  consumeUsageLimit: vi.fn().mockResolvedValue({ allowed: true }),
  getMaxUploadBytes: vi.fn().mockReturnValue(1000000)
}));

vi.mock('@/lib/ai/cost-guard', () => ({
  reserveBudgetForModelCall: vi.fn(),
  commitBudgetUsage: vi.fn(),
  releaseBudgetReservation: vi.fn(),
  isBudgetExceeded: vi.fn(),
  isBudgetUnavailable: vi.fn()
}));

vi.mock('@/lib/engines/autopsy-engine', () => ({
  processMockAutopsy: vi.fn(),
  AutopsyExtractionError: class {},
  AutopsyNeedsUserInputError: class {}
}));

vi.mock('next/server', async (importOriginal) => {
  const actual = await importOriginal<typeof import('next/server')>();
  return {
    ...actual,
    after: vi.fn((fn) => fn()),
  };
});

describe('Autopsy Beta Safety', () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
  });

  it('rejects when autopsy is disabled', async () => {
    vi.stubEnv('ENABLE_AUTOPSY_PROCESSING', 'false');
    const req = new NextRequest('http://localhost/api/autopsy/ingest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fileData: { kind: 'text', text: 'test' } })
    });
    
    const res = await POST(req, 'user123');
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.error).toBe('autopsy_disabled');
  });

  it('queues job when autopsy is enabled without processing synchronously', async () => {
    vi.stubEnv('ENABLE_AUTOPSY_PROCESSING', 'true');
    const req = new NextRequest('http://localhost/api/autopsy/ingest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fileData: { kind: 'text', text: 'test' } })
    });
    
    const res = await POST(req, 'user123');
    expect(res.status).toBe(202);
    const body = await res.json();
    expect(body.status).toBe('queued');
    expect(body.jobId).toBe('123');
  });
});
