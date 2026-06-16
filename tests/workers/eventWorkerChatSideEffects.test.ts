import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  lease: null as any,
  inserts: {} as Record<string, any[]>,
  updates: {} as Record<string, any[]>,
  processChatSideEffects: vi.fn(),
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
      return { data: state.lease ? [state.lease] : [], error: null };
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

vi.mock('@/lib/ai/chat-side-effects', () => ({
  processChatSideEffects: state.processChatSideEffects,
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

vi.mock('@/lib/engines/command-engine', () => ({
  CommandConsumer: {
    handleAutopsyProcessed: vi.fn(),
    handleStudySessionCompleted: vi.fn(),
  },
}));

vi.mock('@/lib/engines/concept-expansion-engine', () => ({
  ConceptExpansionConsumer: { handleConceptDiscovered: vi.fn() },
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

function chatLease(payload: Record<string, any>) {
  return {
    lock_id: 'lock-chat',
    event_id: 'event-chat',
    consumer_name: 'chat_side_effect_engine',
    event_type: 'CHAT_MESSAGE_PROCESSED',
    event_payload: payload,
    event_metadata: { trace_id: 'trace-chat' },
    user_id: '00000000-0000-0000-0000-000000000001',
    retry_count: 0,
  };
}

describe('EventWorkerService CHAT_MESSAGE_PROCESSED routing', () => {
  beforeEach(() => {
    state.lease = null;
    state.processChatSideEffects.mockReset();
    for (const key of Object.keys(state.inserts)) delete state.inserts[key];
    for (const key of Object.keys(state.updates)) delete state.updates[key];
  });

  it('passes the canonical event user_id and ignores payload userId spoofing', async () => {
    state.lease = chatLease({
      userId: '00000000-0000-0000-0000-000000000999',
      sessionId: 'session-1',
      message: 'teach me motion',
      fullResponse: 'let us work through it',
      emotion: 'neutral',
      history: [{ role: 'user', content: 'teach me motion' }],
      sessionTurnsCount: 2,
      mindContext: { weakConcepts: [] },
      intent: { intent: 'TUTOR_SESSION' },
      assistant_message_id: 'assistant-1',
    });

    const { EventWorkerService } = await import('@/lib/events/worker');
    const processed = await EventWorkerService.processBatch(1, 5);

    expect(processed.processed).toBe(1);
    expect(state.processChatSideEffects).toHaveBeenCalledWith(expect.objectContaining({
      userId: '00000000-0000-0000-0000-000000000001',
      sessionId: 'session-1',
      message: 'teach me motion',
      assistant_message_id: 'assistant-1',
    }));
    expect(state.processChatSideEffects.mock.calls[0][0].userId).not.toBe('00000000-0000-0000-0000-000000000999');
  });

  it('rejects malformed chat side-effect events before invoking the side-effect engine', async () => {
    state.lease = chatLease({
      sessionId: 'session-1',
      fullResponse: 'missing message should fail',
    });

    const { EventWorkerService } = await import('@/lib/events/worker');
    const processed = await EventWorkerService.processBatch(1, 5);

    expect(processed.failed).toBe(1);
    expect(state.processChatSideEffects).not.toHaveBeenCalled();
    expect(state.updates.consumer_locks).toContainEqual(expect.objectContaining({
      status: 'RETRY_SCHEDULED',
      retry_count: 1,
      last_error: 'CHAT_MESSAGE_PROCESSED missing event_payload.message',
    }));
  });
});
