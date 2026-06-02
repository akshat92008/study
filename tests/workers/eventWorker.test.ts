import { beforeEach, describe, expect, it, vi } from 'vitest';

const inserts: Record<string, any[]> = {};
const updates: Record<string, any[]> = {};

function recordInsert(table: string, row: any) {
  inserts[table] ||= [];
  inserts[table].push(row);
}

function recordUpdate(table: string, row: any) {
  updates[table] ||= [];
  updates[table].push(row);
}

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(() => ({
    rpc: vi.fn(async (name: string) => {
      if (name !== 'acquire_event_leases') return { data: null, error: null };
      return {
        data: [{
          lock_id: 'lock-1',
          event_id: 'event-1',
          consumer_name: 'atlas_engine',
          event_type: 'AUTOPSY_MOCK_PROCESSED',
          event_payload: {},
          event_metadata: { trace_id: 'trace-1', wrongQuestions: [{ subject: 'Physics', chapter: 'Motion' }] },
          user_id: 'user-1',
          retry_count: 5,
        }],
        error: null,
      };
    }),
    from: vi.fn((table: string) => ({
      insert: vi.fn((row: any) => {
        recordInsert(table, row);
        return {
          select: vi.fn(() => ({
            single: vi.fn(async () => ({ data: { id: 'attempt-1' }, error: null })),
          })),
        };
      }),
      update: vi.fn((row: any) => {
        recordUpdate(table, row);
        return {
          eq: vi.fn(async () => ({ data: null, error: null })),
          in: vi.fn(async () => ({ data: null, error: null })),
        };
      }),
      select: vi.fn(() => ({
        eq: vi.fn(async () => ({
          data: table === 'consumer_locks' ? [{ status: 'DLQ' }] : [],
          error: null,
        })),
      })),
    })),
  })),
}));

vi.mock('@/lib/engines/cognition-graph', () => ({
  AtlasConsumer: {
    handleAutopsyProcessed: vi.fn(async () => {
      throw new Error('atlas failed');
    }),
  },
}));

vi.mock('@/lib/engines/learning-state-engine', () => ({
  LearningStateEngine: { processLegacyEvent: vi.fn() },
}));

vi.mock('@/lib/engines/revision-engine', () => ({
  MemoryConsumer: {
    handleAutopsyProcessed: vi.fn(),
    handleStudySessionCompleted: vi.fn(),
  },
}));

vi.mock('@/lib/engines/command-engine', () => ({
  CommandConsumer: {
    handleAutopsyProcessed: vi.fn(),
    handleStudySessionCompleted: vi.fn(),
  },
}));

vi.mock('@/lib/engines/concept-expansion-engine', () => ({
  ConceptExpansionConsumer: { handleConceptDiscovered: vi.fn() },
}));

vi.mock('@/lib/ai/chat-side-effects', () => ({
  processChatSideEffects: vi.fn(),
}));

vi.mock('@/lib/telemetry/correlation', () => ({
  withCorrelationId: vi.fn(async (_traceId: string, fn: () => Promise<void>) => fn()),
}));

vi.mock('@/lib/observability/metrics', () => ({
  Metrics: {
    eventConsumer: vi.fn(),
    eventRetry: vi.fn(),
    captureError: vi.fn(),
  },
}));

vi.mock('@/lib/utils/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

describe('EventWorkerService', () => {
  beforeEach(() => {
    for (const key of Object.keys(inserts)) delete inserts[key];
    for (const key of Object.keys(updates)) delete updates[key];
  });

  it('moves exhausted consumer failures to the DLQ', async () => {
    const { EventWorkerService } = await import('@/lib/events/worker');

    const result = await EventWorkerService.processBatch(1, 5);

    expect(result.failed).toBe(1);
    expect(result.processed).toBe(0);
    expect(inserts.event_dlq?.[0]).toMatchObject({
      event_id: 'event-1',
      user_id: 'user-1',
      consumer_name: 'atlas_engine',
      event_type: 'AUTOPSY_MOCK_PROCESSED',
      last_error: 'atlas failed',
    });
    expect(updates.consumer_locks).toContainEqual(expect.objectContaining({
      status: 'DLQ',
      retry_count: 6,
      last_error: 'atlas failed',
    }));
  });

  it('skips leases and releases them when maxRuntimeMs is reached', async () => {
    const { EventWorkerService } = await import('@/lib/events/worker');

    // Passing maxRuntimeMs = 0 ensures the time limit is immediately reached
    const result = await EventWorkerService.processBatch(1, 5, 0);

    expect(result).toMatchObject({ processed: 0, failed: 0, skipped: 1 });
    expect(updates.consumer_locks).toContainEqual(expect.objectContaining({
      status: 'PENDING',
      locked_at: null,
      locked_by: null,
    }));
  });
});
