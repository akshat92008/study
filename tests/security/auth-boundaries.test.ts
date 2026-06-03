import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET, POST } from '@/app/api/chat/sessions/route';
import { createMockRequest } from '@/tests/utils/next-request-mock';
import { createMockSupabaseClient } from '@/tests/utils/supabase-mock';
import * as serverSupabase from '@/lib/supabase/server';

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
  createAdminClient: vi.fn(),
}));

describe('Auth Boundaries Security', () => {
  const { client, chain } = createMockSupabaseClient();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(serverSupabase.createClient).mockResolvedValue(client as any);
  });

  describe('API Routes protection', () => {
    it('rejects unauthenticated users for GET /api/chat/sessions', async () => {
      client.auth.getUser.mockResolvedValueOnce({ data: { user: null } });

      const req = createMockRequest('GET', 'http://localhost/api/chat/sessions');
      const response = await GET(req);

      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.error).toBe('unauthorized');
    });

    it('rejects unauthenticated users for POST /api/chat/sessions', async () => {
      client.auth.getUser.mockResolvedValueOnce({ data: { user: null } });

      const req = createMockRequest('POST', 'http://localhost/api/chat/sessions', { title: 'Test' });
      const response = await POST(req);

      expect(response.status).toBe(401);
    });

    it('allows authenticated users and uses their ID safely', async () => {
      client.auth.getUser.mockResolvedValueOnce({ data: { user: { id: 'user-123' } } });
      chain.order.mockResolvedValueOnce({ data: [], error: null });

      const req = createMockRequest('GET', 'http://localhost/api/chat/sessions');
      const response = await GET(req);

      expect(response.status).toBe(200);
      expect(chain.eq).toHaveBeenCalledWith('user_id', 'user-123'); // Proves we didn't pull user_id from body
    });
  });
});
