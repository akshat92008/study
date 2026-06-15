import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  processAutopsyJob: vi.fn(),
  updates: {} as Record<string, any[]>,
  inserts: {} as Record<string, any[]>,
}));

vi.mock('@/lib/services/autopsy-jobs', () => ({
  processAutopsyJob: state.processAutopsyJob,
}));

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(() => ({
    rpc: vi.fn(async (name: string) => {
      if (name !== 'acquire_event_leases') return { data: null, error: null };
      return {
        data: [{
          lock_id: 'lock-autopsy',
          event_id: 'event-autopsy',
          consumer_name: 'autopsy_engine',
          event_type: 'AUTOPSY_UPLOAD_RECEIVED',
          event_payload: { jobId: 'job-1' },
          event_metadata: { trace_id: 'trace-autopsy' },
          user_id: '00000000-0000-0000-0000-000000000001',
          retry_count: 0,
        }],
        error: null,
      };
    }),
    from: vi.fn((table: string) => ({
      insert: vi.fn((row: any) => {
        state.inserts[table] ||= [];
        state.inserts[table].push(row);
        return {
          select: vi.fn(() => ({
            single: vi.fn(async () => ({ data: { id: 'attempt-1' }, error: null })),
          })),
        };
      }),
      update: vi.fn((row: any) => {
        state.updates[table] ||= [];
        state.updates[table].push(row);
        return { eq: vi.fn(async () => ({ data: null, error: null })) };
      }),
      select: vi.fn(() => ({
        eq: vi.fn(async () => ({
          data: table === 'consumer_locks' ? [{ status: 'COMPLETED' }] : [],
          error: null,
        })),
      })),
    })),
  })),
}));

vi.mock('@/lib/engines/cognition-graph', () => ({
  AtlasConsumer: { handleAutopsyProcessed: vi.fn(), handleStudySessionCompleted: vi.fn() },
}));
vi.mock('@/lib/engines/revision-engine', () => ({
  MemoryConsumer: { handleAutopsyProcessed: vi.fn(), handleStudySessionCompleted: vi.fn() },
}));
vi.mock('@/lib/engines/command-engine', () => ({
  CommandConsumer: { handleAutopsyProcessed: vi.fn(), handleStudySessionCompleted: vi.fn() },
}));
vi.mock('@/lib/engines/learning-state-engine', () => ({
  LearningStateEngine: { processLegacyEvent: vi.fn() },
}));
vi.mock('@/lib/engines/concept-expansion-engine', () => ({
  ConceptExpansionConsumer: { handleConceptDiscovered: vi.fn() },
}));
vi.mock('@/lib/ai/chat-side-effects', () => ({ processChatSideEffects: vi.fn() }));
vi.mock('@/lib/telemetry/correlation', () => ({
  withCorrelationId: vi.fn(async (_traceId: string, fn: () => Promise<void>) => fn()),
}));
vi.mock('@/lib/observability/metrics', () => ({
  Metrics: { eventConsumer: vi.fn(), eventRetry: vi.fn(), captureError: vi.fn() },
}));
vi.mock('@/lib/utils/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

describe.skip('EventWorkerService AUTOPSY_UPLOAD_RECEIVED routing', () => {
  beforeEach(() => {
    vi.stubEnv('ENABLE_AUTOPSY_PROCESSING', 'true');
    state.processAutopsyJob.mockReset();
    state.processAutopsyJob.mockResolvedValue({ id: 'job-1', status: 'completed' });
    state.updates = {};
    state.inserts = {};
  });

  it('processes queued AUTOPSY jobs through the autopsy_engine consumer', async () => {
    const { EventWorkerService } = await import('@/lib/events/worker');

    const processed = await EventWorkerService.processBatch(1, 5);

    expect(processed.processed).toBe(1);
    expect(state.processAutopsyJob).toHaveBeenCalledWith(
      '00000000-0000-0000-0000-000000000001',
      'job-1'
    );
    expect(state.updates.consumer_locks).toContainEqual(expect.objectContaining({
      status: 'COMPLETED',
    }));
  });
});
