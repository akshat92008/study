import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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

function queryChain(result: any) {
  const chain: any = {
    select: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    gte: vi.fn(() => chain),
    contains: vi.fn(() => chain),
    in: vi.fn(() => chain),
    order: vi.fn(() => chain),
    limit: vi.fn(() => chain),
    maybeSingle: vi.fn(async () => result),
    then: vi.fn((resolve) => resolve(result)),
  };
  return chain;
}

function mockEventStore(results: any[]) {
  const rpc = vi.fn();
  const chains = results.map(queryChain);
  const from = vi.fn(() => chains.shift() ?? queryChain({ data: null, count: 0, error: null }));
  vi.mocked(serverAdmin.createAdminClient).mockReturnValue({ from, rpc } as any);
  return { from, rpc };
}

describe('event enqueue pressure guard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(routes.getConsumersForEvent).mockReturnValue(['test-consumer']);
    vi.mocked(schema.validateEventEnvelope).mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('skips enqueue when a user reaches the daily event cap', async () => {
    vi.stubEnv('DAILY_USER_EVENT_LIMIT', '1');
    const { rpc } = mockEventStore([
      { data: null, count: 1, error: null },
    ]);

    const eventId = await EventDispatcher.publish({
      userId: 'user-1',
      type: 'SESSION_CARD_COMPLETED',
      data: { sessionId: 'session-1' },
    });

    expect(eventId).toBe('event_skipped:SESSION_CARD_COMPLETED:daily_user_event_cap');
    expect(rpc).not.toHaveBeenCalled();
  });

  it('coalesces duplicate noisy events that are already pending', async () => {
    const { rpc } = mockEventStore([
      { data: null, count: 0, error: null },
      { data: { id: 'existing-event-1', status: 'PENDING' }, error: null },
    ]);

    const eventId = await EventDispatcher.publish({
      userId: 'user-1',
      type: 'MATERIAL_UPLOADED',
      data: { materialId: 'material-1' },
      source: 'upload-route',
    });

    expect(eventId).toBe('existing-event-1');
    expect(rpc).not.toHaveBeenCalled();
  });

  it('enqueues normally when pressure guards do not match', async () => {
    const { rpc } = mockEventStore([
      { data: null, count: 0, error: null },
      { data: null, error: null },
    ]);
    rpc.mockResolvedValue({ data: 'new-event-1', error: null });

    const eventId = await EventDispatcher.publish({
      userId: 'user-1',
      type: 'MATERIAL_UPLOADED',
      data: { materialId: 'material-1' },
    });

    expect(eventId).toBe('new-event-1');
    expect(rpc).toHaveBeenCalledWith('create_event_with_consumers', expect.objectContaining({
      p_metadata: expect.objectContaining({
        coalesce_key: 'MATERIAL_UPLOADED:material-1:system_publish',
      }),
    }));
  });
});
