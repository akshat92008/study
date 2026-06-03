import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from '@/app/api/autopsy/ingest/route';
import { createMockRequest } from '@/tests/utils/next-request-mock';
import { createMockSupabaseClient } from '@/tests/utils/supabase-mock';
import * as serverSupabase from '@/lib/supabase/server';
import { EventDispatcher } from '@/lib/events/orchestrator';

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}));

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(),
}));

vi.mock('@/lib/events/orchestrator', () => ({
  EventDispatcher: {
    publish: vi.fn(),
  }
}));

vi.mock('@/lib/middleware/rateLimit', () => ({
  checkRateLimit: vi.fn().mockResolvedValue({ allowed: true, remaining: 10, resetAt: Date.now() }),
  rateLimitResponse: vi.fn(),
}));

vi.mock('@/lib/middleware/withRateLimit', () => ({
  withRateLimit: (name: string, fn: any) => (req: any) => fn(req, 'user-123')
}));

vi.mock('next/server', async (importOriginal) => {
  const actual = await importOriginal<typeof import('next/server')>();
  return {
    ...actual,
    after: vi.fn((fn) => {
      // Don't execute the callback to prevent hanging the test
    }),
  };
});

import * as serverAdmin from '@/lib/supabase/admin';

describe('Mistake Ingestion Tests', () => {
  const { client, chain } = createMockSupabaseClient();
  const adminClient = { ...client, auth: { admin: { getUserById: vi.fn() } } };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(serverSupabase.createClient).mockResolvedValue(client as any);
    vi.mocked(serverAdmin.createAdminClient).mockReturnValue(adminClient as any);
    client.auth.getUser.mockResolvedValue({ data: { user: { id: 'user-123' } } });
  });

  it('validates required fields for mistake ingestion', async () => {
    // Empty body
    const req = createMockRequest('POST', 'http://localhost/api/autopsy/ingest', {});
    const response = await POST(req);
    
    expect(response.status).toBeGreaterThanOrEqual(400);
  });

  it('correctly ingests valid mistakes and publishes event', async () => {
    chain.single.mockResolvedValue({ data: { id: 'mistake-1' }, error: null });

    const req = createMockRequest(
      'POST', 
      'http://localhost/api/autopsy/ingest', 
      {
        subject: 'Physics',
        chapter: 'Kinematics',
        topic: 'Projectile Motion',
        rawText: 'Missed a minus sign',
      },
      { 'Content-Type': 'application/json' }
    );
    const response = await POST(req);

    // Depending on implementation, it may return 200 or 202
    expect(response.status).toBeLessThan(300);
    expect(EventDispatcher.publish).toHaveBeenCalledWith(expect.objectContaining({
      type: 'AUTOPSY_UPLOAD_RECEIVED'
    }));
  });
});
