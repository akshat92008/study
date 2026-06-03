import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EventDispatcher } from '@/lib/events/orchestrator';
import * as serverAdmin from '@/lib/supabase/admin';
import * as schema from '@/lib/events/schema';
import * as routes from '@/lib/events/routes';

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(),
}));

vi.mock('@/lib/events/schema', () => ({
  validateEventEnvelope: vi.fn(),
}));

vi.mock('@/lib/events/routes', () => ({
  getConsumersForEvent: vi.fn(),
}));

describe('Event Idempotency Tests', () => {
  const rpcMock = vi.fn();
  
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(serverAdmin.createAdminClient).mockReturnValue({
      rpc: rpcMock,
    } as any);
  });

  it('generates deterministic idempotency keys if not provided', async () => {
    vi.mocked(routes.getConsumersForEvent).mockReturnValue(['test']);
    rpcMock.mockResolvedValue({ data: 'id-1', error: null });

    await EventDispatcher.publish({
      userId: 'u1',
      type: 'T1',
      data: { a: 1 }
    });

    await EventDispatcher.publish({
      userId: 'u1',
      type: 'T1',
      data: { a: 1 }
    });

    // We check that the second call used the same key.
    // In our mocked setup, rpcMock is called twice.
    expect(rpcMock).toHaveBeenCalledTimes(2);
    const call1 = rpcMock.mock.calls[0][1];
    const call2 = rpcMock.mock.calls[1][1];

    expect(call1.p_idempotency_key).toBe(call2.p_idempotency_key);
  });

  it('respects provided idempotency key', async () => {
    vi.mocked(routes.getConsumersForEvent).mockReturnValue(['test']);
    rpcMock.mockResolvedValue({ data: 'id-2', error: null });

    await EventDispatcher.publish({
      userId: 'u1',
      type: 'T1',
      data: { a: 1 },
      idempotencyKey: 'custom-key-123'
    });

    expect(rpcMock).toHaveBeenCalledWith(
      'create_event_with_consumers', 
      expect.objectContaining({ p_idempotency_key: 'custom-key-123' })
    );
  });
});
