import { expect, test, describe, vi } from 'vitest';
import { buildChatFirstEngineResponse } from '@/lib/ai/chat/orchestration';

// Mock dependencies
vi.mock('@/lib/services/command-plan.service', () => ({
  ensureCommandPlanForDate: vi.fn().mockResolvedValue({
    date: '2026-06-02',
    tasks: [],
    created: false,
    briefing: '',
    sourceSignals: { dueRevisionCount: 0, weakAreaCount: 0, recentMistakeCount: 0, specificMemoryUsed: false }
  }),
  formatWeakAreasForChat: vi.fn().mockReturnValue('mock weak areas response'),
  formatRevisionQueueForChat: vi.fn().mockReturnValue('mock revision response'),
  localDateAfter: vi.fn().mockReturnValue('2026-06-02'),
}));

describe('MIND Engine Independence Policy', () => {
  const baseInput = {
    userId: 'user-1',
    mindContext: {
      weakConcepts: [],
      recentMistakes: [],
      masteryStats: { masteryPercent: 0 },
      overdueCardsCount: 0,
      topOverdueCards: []
    },
    supabase: {}
  };

  test('Flashcard topic request with no due MEMORY cards', async () => {
    const result = await buildChatFirstEngineResponse({
      ...baseInput,
      message: 'give me flashcard for current electricity',
      intent: 'FLASHCARDS',
      orchestratorIntent: 'direct_answer'
    });
    // Should return null so LLM generates flashcards directly
    expect(result).toBeNull();
  });

  test('Due revision request uses MEMORY', async () => {
    const result = await buildChatFirstEngineResponse({
      ...baseInput,
      message: 'show my due memory cards',
      intent: 'FLASHCARDS',
      orchestratorIntent: 'memory_review'
    });
    expect(result).not.toBeNull();
    expect(result?.text).toBe('mock revision response');
    expect(result?.metadata.action).toBe('answer_memory_inline');
  });

  test('MCQ topic request does not require ATLAS/MEMORY', async () => {
    const result = await buildChatFirstEngineResponse({
      ...baseInput,
      message: 'generate mcq for current electricity',
      intent: 'PRACTICE',
      orchestratorIntent: 'direct_answer'
    });
    // Should return null for direct generation
    expect(result).toBeNull();
  });

  test('Full plan request with thin evidence expands into blocks', async () => {
    const result = await buildChatFirstEngineResponse({
      ...baseInput,
      message: "give me full today's plan",
      intent: 'CREATE_ARTIFACT',
      orchestratorIntent: 'planning'
    });
    // Should return null so LLM generates the full plan
    expect(result).toBeNull();
  });

  test('Weak area personalization is direct generation', async () => {
    const result = await buildChatFirstEngineResponse({
      ...baseInput,
      message: 'make flashcards for physics',
      intent: 'CREATE_ARTIFACT',
      orchestratorIntent: 'direct_answer'
    });
    expect(result).toBeNull();
  });

  test('No engine data (teach me) still generates', async () => {
    const result = await buildChatFirstEngineResponse({
      ...baseInput,
      message: 'teach me current electricity',
      intent: 'TUTOR_SESSION',
      orchestratorIntent: 'direct_answer'
    });
    expect(result).toBeNull();
  });

  test('Normal chat does not dump MEMORY/ATLAS status', async () => {
    const result = await buildChatFirstEngineResponse({
      ...baseInput,
      message: 'hi',
      intent: 'GENERAL_CHAT',
      orchestratorIntent: 'direct_answer'
    });
    expect(result).toBeNull();
  });
});
