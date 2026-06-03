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

describe('Event Enqueue Tests', () => {
  const rpcMock = vi.fn();
  
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(serverAdmin.createAdminClient).mockReturnValue({
      rpc: rpcMock,
    } as any);
  });

  it('rejects publish without userId', async () => {
    await expect(EventDispatcher.publish({
      type: 'TEST_EVENT',
      data: {}
    } as any)).rejects.toThrow('Event publish requires userId');
  });

  it('rejects unsupported event types', async () => {
    vi.mocked(routes.getConsumersForEvent).mockReturnValue([]);
    await expect(EventDispatcher.publish({
      userId: 'user-123',
      type: 'INVALID_EVENT',
      data: {}
    })).rejects.toThrow('Unsupported event type: INVALID_EVENT');
  });

  it('enqueues a valid event using rpc', async () => {
    vi.mocked(routes.getConsumersForEvent).mockReturnValue(['test-consumer']);
    vi.mocked(schema.validateEventEnvelope).mockImplementation(() => {});
    rpcMock.mockResolvedValue({ data: 'event-id-123', error: null });

    const eventId = await EventDispatcher.publish({
      userId: 'user-123',
      type: 'VALID_EVENT',
      data: { foo: 'bar' },
      idempotencyKey: 'idemp-123',
    });

    expect(eventId).toBe('event-id-123');
    expect(rpcMock).toHaveBeenCalledWith('create_event_with_consumers', expect.objectContaining({
      p_user_id: 'user-123',
      p_type: 'VALID_EVENT',
      p_data: { foo: 'bar' },
      p_idempotency_key: 'idemp-123',
    }));
  });
});
