import { beforeEach, describe, expect, it, vi } from 'vitest';

const atlas = vi.fn();
const memory = vi.fn();
const command = vi.fn();

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(() => ({
    rpc: vi.fn(async () => ({
      data: ['atlas_engine', 'memory_engine', 'command_engine'].map((consumer_name, index) => ({
        lock_id: `lock-${index}`,
        event_id: 'event-session-1',
        consumer_name,
        event_type: 'COMMAND_SESSION_COMPLETED',
        event_payload: {
          subject: 'Physics',
          chapter: 'Motion',
          durationMinutes: 30,
          understood: false,
          gapFound: 'Acceleration definition',
          isSessionComplete: true,
        },
        event_metadata: { trace_id: 'trace-session-1' },
        user_id: 'user-1',
        retry_count: 0,
      })),
      error: null,
    })),
    from: vi.fn((table: string) => ({
      insert: vi.fn(() => ({
        select: vi.fn(() => ({
          single: vi.fn(async () => ({ data: { id: 'attempt-1' }, error: null })),
        })),
      })),
      update: vi.fn(() => ({ eq: vi.fn(async () => ({ error: null })) })),
      select: vi.fn(() => ({
        eq: vi.fn(async () => ({
          data: table === 'consumer_locks'
            ? [{ status: 'COMPLETED' }, { status: 'COMPLETED' }, { status: 'COMPLETED' }]
            : [],
          error: null,
        })),
      })),
    })),
  })),
}));

vi.mock('@/lib/engines/cognition-graph', () => ({
  AtlasConsumer: { handleStudySessionCompleted: atlas },
}));
vi.mock('@/lib/engines/revision-engine', () => ({
  MemoryConsumer: { handleStudySessionCompleted: memory },
}));
vi.mock('@/lib/engines/command-engine', () => ({
  CommandConsumer: { handleStudySessionCompleted: command },
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
  Metrics: {
    eventConsumer: vi.fn(),
    eventRetry: vi.fn(),
    captureError: vi.fn(),
  },
}));
vi.mock('@/lib/utils/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

describe('MVP core loop event routing', () => {
  beforeEach(() => {
    atlas.mockReset();
    memory.mockReset();
    command.mockReset();
  });

  it('routes a completed session to ATLAS, MEMORY, and COMMAND consumers', async () => {
    const { EventWorkerService } = await import('@/lib/events/worker');

    const processed = await EventWorkerService.processBatch(3, 5);

    expect(processed).toBe(3);
    expect(atlas).toHaveBeenCalledWith('user-1', expect.objectContaining({ gapFound: 'Acceleration definition' }));
    expect(memory).toHaveBeenCalledWith('user-1', expect.objectContaining({ gapFound: 'Acceleration definition' }));
    expect(command).toHaveBeenCalledWith('user-1', expect.objectContaining({ chapter: 'Motion' }));
  });
});
