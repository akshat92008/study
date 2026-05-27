const inserts: Array<{ table: string; rows: any }> = [];

jest.mock('@/lib/supabase/admin', () => ({
  createAdminClient: jest.fn(() => ({
    from: jest.fn((table: string) => {
      if (table === 'student_events') {
        return {
          insert: jest.fn((rows: any) => {
            inserts.push({ table, rows });
            return {
              select: jest.fn(() => ({
                single: jest.fn(async () => ({ data: { id: 'event-1' }, error: null })),
              })),
            };
          }),
        };
      }

      if (table === 'event_consumer_tracking') {
        return {
          insert: jest.fn(async (rows: any) => {
            inserts.push({ table, rows });
            return { error: null };
          }),
        };
      }

      return {};
    }),
  })),
}));

jest.mock('@/lib/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

jest.mock('@/lib/engines/learning-state-engine', () => ({
  LearningStateEngine: { processLegacyEvent: jest.fn() },
}));
jest.mock('@/lib/engines/cognition-graph', () => ({
  AtlasConsumer: {
    handleAutopsyProcessed: jest.fn(),
    handleStudySessionCompleted: jest.fn(),
  },
}));
jest.mock('@/lib/engines/revision-engine', () => ({
  MemoryConsumer: {
    handleAutopsyProcessed: jest.fn(),
    handleStudySessionCompleted: jest.fn(),
  },
}));
jest.mock('@/lib/engines/command-engine', () => ({
  CommandConsumer: {
    handleAutopsyProcessed: jest.fn(),
    handleStudySessionCompleted: jest.fn(),
  },
}));
jest.mock('@/lib/engines/concept-expansion-engine', () => ({
  ConceptExpansionConsumer: { handleConceptDiscovered: jest.fn() },
}));

import { EventDispatcher, EVENT_CONSUMERS } from '@/lib/events/orchestrator';

describe('EventDispatcher', () => {
  beforeEach(() => {
    inserts.length = 0;
    jest.spyOn(EventDispatcher, 'processConsumer').mockResolvedValue();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('publishes to student_events and registers every consumer', async () => {
    const eventId = await EventDispatcher.publish({
      userId: '00000000-0000-0000-0000-000000000001',
      type: 'AUTOPSY_MOCK_PROCESSED',
      source: 'test',
      data: { wrongAnswers: 2 },
      idempotencyKey: 'autopsy-test',
    });

    expect(eventId).toBe('event-1');
    expect(inserts[0]).toMatchObject({
      table: 'student_events',
      rows: {
        user_id: '00000000-0000-0000-0000-000000000001',
        type: 'AUTOPSY_MOCK_PROCESSED',
        data: { wrongAnswers: 2 },
        idempotency_key: 'autopsy-test',
      },
    });
    expect(inserts[1].table).toBe('event_consumer_tracking');
    expect(inserts[1].rows).toHaveLength(EVENT_CONSUMERS.length);
    expect(EventDispatcher.processConsumer).toHaveBeenCalledTimes(EVENT_CONSUMERS.length);
  });
});
