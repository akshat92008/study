import { beforeEach, describe, expect, it, vi } from 'vitest';

const publish = vi.hoisted(() => vi.fn());

vi.mock('@/lib/services/chatMemoryService', () => ({
  ChatMemoryService: vi.fn(() => ({
    storeConversationTurnInMemory: vi.fn(),
    storeMessageInMemory: vi.fn(),
  })),
}));

vi.mock('@/lib/engines/inference-engine', () => ({
  syncStudentModel: vi.fn(),
}));

vi.mock('@/lib/events/orchestrator', () => ({
  EventDispatcher: { publish },
}));

vi.mock('@/lib/telemetry/sentry-runtime', () => ({
  captureSentryException: vi.fn(),
}));

vi.mock('@/lib/utils/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

function makeSupabase() {
  return {
    from: vi.fn((table: string) => {
      if (table === 'chat_messages') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(async () => ({ count: 12, data: null, error: null })),
            })),
          })),
        };
      }

      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn(async () => ({ data: { emotional_state: 'neutral' }, error: null })),
          })),
        })),
        update: vi.fn(() => ({
          eq: vi.fn(async () => ({ error: null })),
        })),
      };
    }),
  };
}

describe('processChatSideEffects identity propagation', () => {
  beforeEach(() => {
    publish.mockReset();
  });

  it('derives MIND_TUTOR_COMPLETED with the canonical worker userId', async () => {
    const { processChatSideEffects } = await import('@/lib/ai/chat-side-effects');

    await processChatSideEffects({
      supabase: makeSupabase() as any,
      userId: '00000000-0000-0000-0000-000000000001',
      sessionId: 'session-1',
      message: 'latest question',
      fullResponse: 'latest answer',
      emotion: 'neutral',
      history: [
        { role: 'user', content: 'a' },
        { role: 'assistant', content: 'b' },
        { role: 'user', content: 'c' },
        { role: 'assistant', content: 'd' },
        { role: 'user', content: 'e' },
        { role: 'assistant', content: 'f' },
        { role: 'user', content: 'g' },
        { role: 'assistant', content: 'h' },
        { role: 'user', content: 'i' },
        { role: 'assistant', content: 'j' },
        { role: 'user', content: 'k' },
        { role: 'assistant', content: 'l' },
        { role: 'user', content: 'm' },
        { role: 'assistant', content: 'n' },
      ],
      sessionTurnsCount: 8,
      mindContext: {
        weakConcepts: [{ subject: 'Physics', chapter: 'Motion' }],
      },
      intent: { intent: 'TUTOR_SESSION' },
    });

    expect(publish).toHaveBeenCalledWith(expect.objectContaining({
      user_id: '00000000-0000-0000-0000-000000000001',
      type: 'MIND_TUTOR_COMPLETED',
      idempotency_key: expect.stringContaining('session:00000000-0000-0000-0000-000000000001:Physics:Motion:'),
    }));
  });
});
