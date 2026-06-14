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

describe('MIND Intent Policy Engine', () => {
  const baseInput = {
    userId: 'user-1',
    mindContext: {
      weakConcepts: [],
      recentMistakes: [],
      masteryStats: { masteryPercent: 0 },
      overdueCardsCount: 0,
      topOverdueCards: []
    },
    supabase: {
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      is: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: [], error: null })
    }
  };

  test('flashcard request with no due MEMORY cards still generates flashcards (returns null to let LLM handle it)', async () => {
    const result = await buildChatFirstEngineResponse({
      ...baseInput,
      message: 'give me flashcards for current electricity',
      intent: 'FLASHCARDS',
      orchestratorIntent: 'direct_answer'
    });
    // Should return null so the main LLM processes it and generates flashcards
    expect(result).toBeNull();
  });

  test('MCQ generation uses exam-level style (returns null to let LLM handle it)', async () => {
    const result = await buildChatFirstEngineResponse({
      ...baseInput,
      message: 'generate mcq for kinematics',
      intent: 'PRACTICE',
      orchestratorIntent: 'direct_answer'
    });
    // Should return null
    expect(result).toBeNull();
  });

  test('full today\'s plan expands beyond one session-card line (returns null to let LLM handle it)', async () => {
    const result = await buildChatFirstEngineResponse({
      ...baseInput,
      message: 'give full today\'s plan',
      intent: 'CREATE_ARTIFACT',
      orchestratorIntent: 'planning'
    });
    // Should return null so LLM generates the full plan
    expect(result).toBeNull();
  });

  test('due revision query still uses MEMORY (returns deterministic text)', async () => {
    const result = await buildChatFirstEngineResponse({
      ...baseInput,
      message: 'what is due',
      intent: 'FLASHCARDS',
      orchestratorIntent: 'memory_review'
    });
    expect(result).not.toBeNull();
    expect(result?.text).toBe('mock revision response');
    expect(result?.metadata.action).toBe('answer_memory_inline');
  });

  test('weak area query still uses ATLAS (returns deterministic text)', async () => {
    const result = await buildChatFirstEngineResponse({
      ...baseInput,
      message: 'what are my weak areas',
      intent: 'ATLAS',
      orchestratorIntent: 'progress_check'
    });
    expect(result).not.toBeNull();
    expect(result?.text).toBe('mock weak areas response');
    expect(result?.metadata.action).toBe('answer_atlas_inline');
  });

  test('normal chat does not unnecessarily mention MEMORY/ATLAS', async () => {
    const result = await buildChatFirstEngineResponse({
      ...baseInput,
      message: 'hey how are you',
      intent: 'GENERAL_CHAT',
      orchestratorIntent: 'direct_answer'
    });
    expect(result).toBeNull();
  });

  test('autopsy query request evidence', async () => {
    const result = await buildChatFirstEngineResponse({
      ...baseInput,
      message: 'analyze my test',
      intent: 'AUTOPSY',
      orchestratorIntent: 'mock_autopsy'
    });
    expect(result).not.toBeNull();
    expect(result?.metadata.action).toBe('request_autopsy_evidence');
  });
});
