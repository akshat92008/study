import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/utils/logger', () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
  },
}));

import { finalizeChatTurn } from '@/lib/services/chat-turn-finalizer';

function baseInput(overrides: Record<string, any> = {}) {
  return {
    supabase: { from: vi.fn() },
    userId: '00000000-0000-0000-0000-000000000001',
    sessionId: 'session-1',
    userMessage: 'What should I study?',
    userMessageId: '00000000-0000-0000-0000-000000000011',
    assistantText: 'Study motion first.',
    intent: { intent: 'GENERAL_CHAT' },
    emotion: 'neutral',
    promptVersion: 'mind:test',
    idempotencyKey: 'turn-1',
    recentHistory: [],
    sessionTurnsCount: 1,
    mindContext: { weakConcepts: [] },
    ...overrides,
  };
}

describe('finalizeChatTurn', () => {
  it('persists the assistant message, commits budget, and publishes CHAT_MESSAGE_PROCESSED once', async () => {
    const persistAssistantMessage = vi.fn(async () => ({ id: 'assistant-1', existed: false }));
    const publishEvent = vi.fn(async () => 'event-1');
    const commitBudget = vi.fn(async () => undefined);
    const releaseBudget = vi.fn(async () => undefined);
    const onBudgetSettled = vi.fn();

    const result = await finalizeChatTurn(baseInput({
      budgetReservationId: 'reservation-1',
      budgetUsage: {
        promptTokens: 10,
        completionTokens: 5,
        route: '/api/ai/chat',
        promptVersion: 'mind:test',
        promptFamily: 'mind_chat',
        promptSource: 'chat_stream',
      },
      persistAssistantMessage,
      publishEvent,
      commitBudget,
      releaseBudget,
      onBudgetSettled,
    }));

    expect(result).toEqual({
      assistantMessageId: 'assistant-1',
      eventId: 'event-1',
      assistantAlreadyExisted: false,
      learningSignalSummary: expect.any(String),
    });
    expect(persistAssistantMessage).toHaveBeenCalledOnce();
    expect(persistAssistantMessage.mock.calls[0][1]).toMatchObject({
      role: 'assistant',
      content: 'Study motion first.',
      idempotencyKey: 'turn-1:assistant',
    });
    expect(commitBudget).toHaveBeenCalledOnce();
    expect(releaseBudget).not.toHaveBeenCalled();
    expect(onBudgetSettled).toHaveBeenCalledOnce();
    expect(publishEvent).toHaveBeenCalledOnce();
    expect(publishEvent.mock.calls[0][0]).toMatchObject({
      type: 'CHAT_MESSAGE_PROCESSED',
      idempotency_key: 'turn-1:chat-message-processed',
      data: {
        assistant_message_id: 'assistant-1',
        user_message_id: '00000000-0000-0000-0000-000000000011',
        fullResponse: 'Study motion first.',
      },
    });
  });

  it('uses assistant idempotency to avoid duplicate writes and releases retry reservations', async () => {
    const persistAssistantMessage = vi.fn(async () => ({ id: 'assistant-1', existed: true }));
    const publishEvent = vi.fn(async () => 'event-1');
    const commitBudget = vi.fn(async () => undefined);
    const releaseBudget = vi.fn(async () => undefined);

    const result = await finalizeChatTurn(baseInput({
      budgetReservationId: 'reservation-dup',
      budgetUsage: {
        promptTokens: 10,
        completionTokens: 5,
        route: '/api/ai/chat',
      },
      persistAssistantMessage,
      publishEvent,
      commitBudget,
      releaseBudget,
    }));

    expect(result.assistantAlreadyExisted).toBe(true);
    expect(commitBudget).not.toHaveBeenCalled();
    expect(releaseBudget).toHaveBeenCalledWith('reservation-dup', 'duplicate_chat_turn');
    expect(publishEvent.mock.calls[0][0].idempotency_key).toBe('turn-1:chat-message-processed');
  });

  it('releases budget and does not publish when assistant persistence fails', async () => {
    const persistAssistantMessage = vi.fn(async () => {
      throw new Error('insert failed');
    });
    const publishEvent = vi.fn(async () => 'event-1');
    const commitBudget = vi.fn(async () => undefined);
    const releaseBudget = vi.fn(async () => undefined);

    await expect(finalizeChatTurn(baseInput({
      budgetReservationId: 'reservation-fail',
      budgetUsage: {
        promptTokens: 10,
        completionTokens: 5,
        route: '/api/ai/chat',
      },
      persistAssistantMessage,
      publishEvent,
      commitBudget,
      releaseBudget,
    }))).rejects.toThrow('insert failed');

    expect(commitBudget).not.toHaveBeenCalled();
    expect(publishEvent).not.toHaveBeenCalled();
    expect(releaseBudget).toHaveBeenCalledWith('reservation-fail', 'insert failed');
  });

  it('does not release an already committed budget if event publication fails', async () => {
    const persistAssistantMessage = vi.fn(async () => ({ id: 'assistant-1', existed: false }));
    const publishEvent = vi.fn(async () => {
      throw new Error('event unavailable');
    });
    const commitBudget = vi.fn(async () => undefined);
    const releaseBudget = vi.fn(async () => undefined);

    await expect(finalizeChatTurn(baseInput({
      budgetReservationId: 'reservation-committed',
      budgetUsage: {
        promptTokens: 10,
        completionTokens: 5,
        route: '/api/ai/chat',
      },
      persistAssistantMessage,
      publishEvent,
      commitBudget,
      releaseBudget,
    }))).rejects.toThrow('event unavailable');

    expect(commitBudget).toHaveBeenCalledOnce();
    expect(releaseBudget).not.toHaveBeenCalled();
  });

  it('releases a reservation instead of leaking it when commit usage is missing', async () => {
    const persistAssistantMessage = vi.fn(async () => ({ id: 'assistant-1', existed: false }));
    const publishEvent = vi.fn(async () => 'event-1');
    const commitBudget = vi.fn(async () => undefined);
    const releaseBudget = vi.fn(async () => undefined);

    await finalizeChatTurn(baseInput({
      budgetReservationId: 'reservation-no-usage',
      budgetUsage: null,
      persistAssistantMessage,
      publishEvent,
      commitBudget,
      releaseBudget,
    }));

    expect(commitBudget).not.toHaveBeenCalled();
    expect(releaseBudget).toHaveBeenCalledWith('reservation-no-usage', 'missing_chat_budget_usage');
  });
});
