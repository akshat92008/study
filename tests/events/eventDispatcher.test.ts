import { beforeEach, describe, expect, it, vi } from 'vitest';

const rpc = vi.fn();

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(() => ({ rpc })),
}));

vi.mock('@/lib/utils/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('@/lib/telemetry/correlation', () => ({
  getCorrelationId: vi.fn(() => 'trace-test'),
}));

describe('EventDispatcher', () => {
  beforeEach(() => {
    rpc.mockReset();
    rpc.mockResolvedValue({ data: 'event-1', error: null });
  });

  it('publishes to event_queue through the canonical enqueue RPC only', async () => {
    const { EventDispatcher } = await import('@/lib/events/orchestrator');

    const eventId = await EventDispatcher.publish({
      userId: '00000000-0000-0000-0000-000000000001',
      type: 'AUTOPSY_MOCK_PROCESSED',
      source: 'test',
      data: { autopsyId: 'autopsy-test', incorrectCount: 2 },
      idempotencyKey: 'autopsy-test',
    });

    expect(eventId).toBe('event-1');
    expect(rpc).toHaveBeenCalledOnce();
    expect(rpc).toHaveBeenCalledWith('create_event_with_consumers', {
      p_user_id: '00000000-0000-0000-0000-000000000001',
      p_type: 'AUTOPSY_MOCK_PROCESSED',
      p_data: { autopsyId: 'autopsy-test', incorrectCount: 2 },
      p_idempotency_key: 'autopsy-test',
      p_source: 'test',
      p_metadata: {
        source: 'test',
        trace_id: 'trace-test',
      },
    });
  });

  it('rejects unsupported event types before enqueueing', async () => {
    const { EventDispatcher } = await import('@/lib/events/orchestrator');

    await expect(EventDispatcher.publish({
      userId: '00000000-0000-0000-0000-000000000001',
      type: 'UNSUPPORTED_EVENT',
      source: 'test',
      data: {},
    })).rejects.toThrow('Unsupported event type');

    expect(rpc).not.toHaveBeenCalled();
  });
});
