import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET } from '@/app/api/admin/system/status/route';
import { createMockRequest } from '@/tests/utils/next-request-mock';
import * as authAdmin from '@/lib/auth/admin';
import * as serverAdmin from '@/lib/supabase/admin';
import { createMockSupabaseClient } from '@/tests/utils/supabase-mock';

vi.mock('@/lib/auth/admin', () => ({
  requireAdmin: vi.fn(),
}));

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(),
}));

describe('Admin Routes Security', () => {
  const { client, chain } = createMockSupabaseClient();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(serverAdmin.createAdminClient).mockReturnValue(client as any);
  });

  it('rejects requests without admin credentials', async () => {
    vi.mocked(authAdmin.requireAdmin).mockResolvedValueOnce({
      error: { code: 'unauthorized', message: 'Admin only' },
      status: 403,
    } as any);

    const req = createMockRequest('GET', 'http://localhost/api/admin/system/status');
    const response = await GET(req);

    expect(response.status).toBe(403);
    const data = await response.json();
    expect(data.error.code).toBe('unauthorized');
  });

  it('allows requests with valid admin credentials', async () => {
    vi.mocked(authAdmin.requireAdmin).mockResolvedValueOnce({} as any);
    
    // The chain has a default .then() that resolves with { data: [], count: 0, error: null }

    const req = createMockRequest('GET', 'http://localhost/api/admin/system/status');
    const response = await GET(req);

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.status).toBe('ok');
  });
});
