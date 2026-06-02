import { describe, expect, it, vi } from 'vitest';
import { POST } from '@/app/api/admin/queue/process/route';
import { NextRequest } from 'next/server';

vi.mock('@/lib/auth/admin', () => ({
  requireAdmin: vi.fn().mockResolvedValue({ error: null, status: 200 })
}));

vi.mock('@/lib/events/worker', () => ({
  EventWorkerService: {
    processBatch: vi.fn().mockRejectedValue(new Error('Simulated processing error'))
  }
}));

describe('admin queue process route', () => {
  it('returns 500 and ok: false when processing fails', async () => {
    const req = new NextRequest('http://localhost/api/admin/queue/process', { method: 'POST' });
    const res = await POST(req);
    expect(res.status).toBe(500);
    
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.error).toBe('Simulated processing error');
    expect(body.INTERNAL_CRON_SECRET).toBeUndefined();
  });
});
