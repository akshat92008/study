import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getMINDSystemPrompt, MINDContext } from '../lib/ai/prompts/mind-prompt';
import { ChatMemoryService } from '../lib/services/chatMemoryService';

const { mockInsert, mockFrom } = vi.hoisted(() => {
  const mockInsert = vi.fn().mockResolvedValue({ error: null });
  const mockFrom = vi.fn().mockReturnValue({
    insert: mockInsert,
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    textSearch: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue({ data: [], error: null })
  });
  return { mockInsert, mockFrom };
});

// Mock getEmbedding so it doesn't fail in tests
vi.mock('../lib/ai/provider-client', () => ({
  getEmbedding: vi.fn().mockResolvedValue([0.1, 0.2, 0.3]),
}));

vi.mock('../lib/ai/router', () => ({
  routeJSONGeneration: vi.fn().mockResolvedValue({ importance: 8, novelty: 5, emotional_salience: 9, learning_relevance: 2, repetition_signal: 0 }),
}));

// Mock logger
vi.mock('../lib/utils/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }
}));

// Mock supabase client
vi.mock('../lib/supabase/server', () => ({
  createClient: vi.fn().mockReturnValue({
    from: mockFrom,
    rpc: vi.fn().mockResolvedValue({ data: [], error: null }),
  })
}));

import { createClient } from '../lib/supabase/server';

describe('MIND Context & Prompts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const baseCtx: MINDContext = {
    profile: {
      name: 'Test',
      examType: 'General',
      examDate: null,
      currentLevel: 'intermediate',
      learningStyle: 'visual',
      streakDays: 5,
      timezone: 'UTC',
      learnerStateVersion: 1
    },
    activeGoal: null,
    currentSessionCard: null,
    commandTasks: [],
    recentStudySessions: [],
    weakConcepts: [
      { name: 'Concept A', subject: 'Math', chapter: 'Algebra', mastery: 'exposed' },
      { name: 'Concept B', subject: 'Math', chapter: 'Algebra', mastery: 'exposed' },
      { name: 'Concept C', subject: 'Math', chapter: 'Algebra', mastery: 'exposed' },
      { name: 'Concept D', subject: 'Math', chapter: 'Algebra', mastery: 'exposed' }
    ],
    recentMistakes: [
      { chapter: 'Chap 1', category: 'Silly Error', subject: 'Math' },
      { chapter: 'Chap 2', category: 'Conceptual', subject: 'Math' },
      { chapter: 'Chap 3', category: 'Calculation', subject: 'Math' },
      { chapter: 'Chap 4', category: 'Time Management', subject: 'Math' }
    ],
    struggles: [],
    masteryStats: { totalConcepts: 100, masteredCount: 10, masteryPercent: 10 },
    overdueCardsCount: 10,
    topOverdueCards: [
      { id: '1', front: 'Card 1' },
      { id: '2', front: 'Card 2' },
      { id: '3', front: 'Card 3' },
      { id: '4', front: 'Card 4' }
    ],
    emotionalState: 'neutral',
    recentTopics: ['Topic 1', 'Topic 2', 'Topic 3', 'Topic 4'],
    knownAnalogies: [],
    rootGapChains: [],
    currentSessionDurationMinutes: 0,
    sessionGoal: '',
    ragChunks: []
  };

  it('chat context enforces bounds on weak concepts, mistakes, and due cards', () => {
    const prompt = getMINDSystemPrompt(baseCtx, [], 'GENERAL_CHAT');
    
    // Check weak concepts capped at 3
    expect(prompt).toContain('Concept A (exposed)');
    expect(prompt).toContain('Concept B (exposed)');
    expect(prompt).toContain('Concept C (exposed)');
    expect(prompt).not.toContain('Concept D (exposed)');

    // Check mistakes capped at 3
    expect(prompt).toContain('Chap 1 — Silly Error');
    expect(prompt).toContain('Chap 2 — Conceptual');
    expect(prompt).toContain('Chap 3 — Calculation');
    expect(prompt).not.toContain('Chap 4 — Time Management');

    // Check due cards capped at 3
    expect(prompt).toContain('Top due: Card 1 | Card 2 | Card 3');
    expect(prompt).not.toContain('Card 4');
  });

  it('includes personal state and streak logic in prompt', () => {
    const prompt = getMINDSystemPrompt(baseCtx, [], 'GENERAL_CHAT');
    expect(prompt).toContain('Active streak: 5 days');
    expect(prompt).toContain('Overdue flashcards: 10');
  });
});

describe('ChatMemoryService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('skips short messages that are not emotional', async () => {
    const service = new ChatMemoryService();
    await service.storeMessageInMemory('user-1', 'hi there!');
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it('preserves short emotional messages like "I failed"', async () => {
    const service = new ChatMemoryService();
    await service.storeMessageInMemory('user-1', 'I failed');
    expect(mockInsert).toHaveBeenCalled();
  });

  it('preserves short emotional messages like "I am scared"', async () => {
    const service = new ChatMemoryService();
    await service.storeMessageInMemory('user-1', 'I am scared');
    expect(mockInsert).toHaveBeenCalled();
  });
});
