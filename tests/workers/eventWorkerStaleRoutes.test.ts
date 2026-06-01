import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  inserts: {} as Record<string, any[]>,
  updates: {} as Record<string, any[]>,
}));

function recordInsert(table: string, row: any) {
  state.inserts[table] ||= [];
  state.inserts[table].push(row);
}

function recordUpdate(table: string, row: any) {
  state.updates[table] ||= [];
  state.updates[table].push(row);
}

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(() => ({
    rpc: vi.fn(async (name: string) => {
      if (name !== 'acquire_event_leases') return { data: null, error: null };
      return {
        data: [{
          lock_id: 'lock-stale-route',
          event_id: 'event-study-session',
          consumer_name: 'chat_side_effect_engine',
          event_type: 'STUDY_SESSION_COMPLETED',
          event_payload: { sessionId: 'session-1' },
          event_metadata: { trace_id: 'trace-stale-route' },
          user_id: '00000000-0000-0000-0000-000000000001',
          retry_count: 3,
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

vi.mock('@/lib/engines/learning-state-engine', () => ({
  LearningStateEngine: { processLegacyEvent: vi.fn() },
}));

vi.mock('@/lib/engines/revision-engine', () => ({
  MemoryConsumer: {
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

describe('EventWorkerService stale route leases', () => {
  beforeEach(() => {
    for (const key of Object.keys(state.inserts)) delete state.inserts[key];
    for (const key of Object.keys(state.updates)) delete state.updates[key];
  });

  it('completes no-longer-routed consumer locks instead of sending them to DLQ', async () => {
    const { EventWorkerService } = await import('@/lib/events/worker');

    const processed = await EventWorkerService.processBatch(1, 5);

    expect(processed).toBe(1);
    expect(state.inserts.event_dlq).toBeUndefined();
    expect(state.updates.consumer_locks).toContainEqual(expect.objectContaining({
      status: 'COMPLETED',
    }));
    expect(state.updates.event_attempts).toContainEqual(expect.objectContaining({
      result_status: 'SKIPPED_INTENTIONALLY',
      result_reason: 'chat_side_effect_engine is no longer registered for STUDY_SESSION_COMPLETED',
    }));
  });
});
