import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EventWorkerService } from '@/lib/events/worker';
import { AMAURA_CONSUMERS } from '@/lib/amaura/events/event-matrix';
import * as serverAdmin from '@/lib/supabase/admin';
import * as eventRunner from '@/lib/agents/event-runner';

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(),
}));
vi.mock('@/lib/agents/orchestrator', () => ({
  runCheapAgenticCycle: vi.fn().mockResolvedValue({ applied: 0, proposed: 0, skipped: 0, failed: 0 }),
}));
vi.mock('@/lib/agents/event-runner', () => ({
  runAgenticConsumer: vi.fn(),
}));
vi.mock('@/lib/events/orchestrator', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/events/orchestrator')>();
  return {
    ...actual,
    getConsumersForEvent: vi.fn().mockReturnValue(['test-consumer']),
  };
});

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

  it('does NOT run cheap agentic cycle for Amaura consumer leases', async () => {
    const runAgenticConsumer = vi.mocked(eventRunner.runAgenticConsumer);
    const runCheapAgenticCycle = await import('@/lib/agents/orchestrator').then(m => m.runCheapAgenticCycle);

    runAgenticConsumer.mockResolvedValue({ status: 'HANDLED' });
    vi.mocked(runCheapAgenticCycle).mockResolvedValue({ applied: 1, proposed: 0, skipped: 0, failed: 0 });

    const amauraConsumer = AMAURA_CONSUMERS[0]; // e.g. 'amaura_goal_decomposer'
    rpcMock.mockImplementation(async (method: string) => {
      if (method === 'acquire_event_leases') {
        return {
          data: [{
            lock_id: 'lock-3',
            event_id: 'event-3',
            event_type: 'STUDY_SESSION_COMPLETED',
            event_payload: {},
            consumer_name: amauraConsumer,
            user_id: '00000000-0000-0000-0000-000000000001',
          }],
          error: null,
        };
      }
      return { error: null };
    });

    await EventWorkerService.processBatch(1, 1, 1000, Date.now());

    // The native Amaura runtime handles it; cheap rule-agent cycle must NOT be called
    expect(runAgenticConsumer).toHaveBeenCalled();
    expect(vi.mocked(runCheapAgenticCycle)).not.toHaveBeenCalled();
  });

  it('still runs cheap agentic cycle for non-Amaura legacy consumer leases', async () => {
    const runAgenticConsumer = vi.mocked(eventRunner.runAgenticConsumer);
    const runCheapAgenticCycle = await import('@/lib/agents/orchestrator').then(m => m.runCheapAgenticCycle);

    runAgenticConsumer.mockResolvedValue({ status: 'HANDLED' });
    vi.mocked(runCheapAgenticCycle).mockResolvedValue({ applied: 1, proposed: 0, skipped: 0, failed: 0 });

    rpcMock.mockImplementation(async (method: string) => {
      if (method === 'acquire_event_leases') {
        return {
          data: [{
            lock_id: 'lock-4',
            event_id: 'event-4',
            event_type: 'PRACTICE_ATTEMPT_RECORDED',
            event_payload: {},
            consumer_name: 'test-consumer',
            user_id: '00000000-0000-0000-0000-000000000001',
          }],
          error: null,
        };
      }
      return { error: null };
    });

    await EventWorkerService.processBatch(1, 1, 1000, Date.now());

    expect(runAgenticConsumer).toHaveBeenCalled();
    expect(vi.mocked(runCheapAgenticCycle)).toHaveBeenCalled();
  });
});
