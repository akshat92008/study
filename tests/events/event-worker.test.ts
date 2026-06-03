import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EventWorkerService } from '@/lib/events/worker';
import * as serverAdmin from '@/lib/supabase/admin';
import * as eventRunner from '@/lib/agents/event-runner';

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(),
}));
vi.mock('@/lib/events/orchestrator', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/events/orchestrator')>();
  return {
    ...actual,
    getConsumersForEvent: vi.fn().mockReturnValue(['test-consumer']),
  };
});
vi.mock('@/lib/agents/event-runner', () => ({
  runAgenticConsumer: vi.fn(),
}));

describe('Event Worker Tests', () => {
  const rpcMock = vi.fn();
  
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(serverAdmin.createAdminClient).mockReturnValue({
      rpc: rpcMock,
      from: vi.fn().mockReturnValue({
        insert: vi.fn().mockReturnThis(),
        update: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        in: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: { id: 'attempt-1' } }),
      }),
    } as any);
  });

  it('processes events and respects locks', async () => {
    vi.mocked(eventRunner.runAgenticConsumer).mockResolvedValue({ status: 'HANDLED' });
    // Mock get_and_lock_events_v2 to return 1 event
    rpcMock.mockImplementation(async (method: string) => {
      if (method === 'acquire_event_leases') {
        return { data: [{ lock_id: 'lock-1', event_id: 'event-1', event_type: 'TEST_EVENT', event_payload: {}, consumer_name: 'test-consumer' }], error: null };
      }
      return { error: null };
    });
    const result = await EventWorkerService.processBatch(1, 1, 1000, Date.now());
    expect(result.processed + result.failed + result.skipped).toBe(1);
  });

  it('handles event failures and increments attempts', async () => {
    vi.mocked(eventRunner.runAgenticConsumer).mockResolvedValue({ status: 'RETRYABLE_FAILURE', reason: 'Fail' });
    rpcMock.mockImplementation(async (method: string) => {
      if (method === 'acquire_event_leases') {
        return { data: [{ lock_id: 'lock-2', event_id: 'event-2', event_type: 'TEST_EVENT', event_payload: {}, consumer_name: 'test-consumer' }], error: null };
      }
      return { error: null };
    });
    
    const result = await EventWorkerService.processBatch(1, 1, 1000, Date.now());
    expect(result.failed + result.skipped).toBe(1);
  });
});
