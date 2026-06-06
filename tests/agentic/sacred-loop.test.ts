import { describe, it, expect, beforeEach, vi } from 'vitest';
import { classifyMessageCombined } from '@/lib/ai/chat-intent-with-emotion';
import { projectLearningSignalToStudyState } from '@/lib/services/learning-event-projections.service';

// Mocking dependencies
vi.mock('@/lib/ai/budgeted', () => ({
  budgetedGenerateJSON: vi.fn(async ({ userPrompt }) => {
    if (userPrompt.includes('Current message: "I keep confusing')) {
      return { intent: 'CONCEPT_CONFUSION', topic: 'Human Reproduction', confidence: 0.9, emotion: 'neutral' };
    }
    if (userPrompt.includes('Current message: "I got Q4 wrong')) {
      return { intent: 'MISTAKE_ADMITTED', topic: 'unknown', confidence: 0.9, emotion: 'frustrated' };
    }
    if (userPrompt.includes('Plant Physiology')) {
      return { intent: 'PRACTICE_REQUESTED', topic: 'Plant Physiology', confidence: 0.9, emotion: 'neutral' };
    }
    return { intent: 'GENERAL_CHAT', topic: null, confidence: 0.5, emotion: 'neutral' };
  }),
}));

const mockSupabase = {
  from: vi.fn(() => mockSupabase),
  select: vi.fn(() => mockSupabase),
  eq: vi.fn(() => mockSupabase),
  in: vi.fn(() => mockSupabase),
  order: vi.fn(() => mockSupabase),
  limit: vi.fn(() => mockSupabase),
  upsert: vi.fn(() => ({ error: null, select: vi.fn(() => ({ single: vi.fn(async () => ({ data: { id: 'test-id' } })) })) })),
  maybeSingle: vi.fn(async () => ({ data: { id: 'test-concept-id', mastery: 'exposed', mastery_score: 15 }, error: null })),
  single: vi.fn(async () => ({ data: { id: 'test-id' }, error: null })),
  insert: vi.fn(() => ({ error: null, select: vi.fn(() => ({ single: vi.fn(async () => ({ data: { id: 'test-id' } })) })) })),
  update: vi.fn(() => ({ eq: vi.fn(async () => ({ error: null })) })),
  rpc: vi.fn(async () => ({ data: { autopsy_id: 'autopsy-id', event_id: 'event-id' }, error: null })),
};

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(() => mockSupabase),
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => mockSupabase),
}));

describe('Sacred Agentic Loop Logic', () => {
  const userId = 'test-user-uuid';
  const goalId = 'test-goal-uuid';

  it('should extract CONCEPT_CONFUSION intent from user doubt', async () => {
    const message = "I keep confusing LH and FSH in Human Reproduction";
    const result = await classifyMessageCombined(message, undefined, 'NEET', userId);
    
    expect(result.intent.intent).toBe('CONCEPT_CONFUSION');
    expect(result.intent.topic).toMatch(/Human Reproduction|LH|FSH/i);
  });

  it('should extract MISTAKE_ADMITTED intent from user admission', async () => {
    const message = "I got Q4 wrong because I didn't read the negative sign";
    const result = await classifyMessageCombined(message, undefined, 'NEET', userId);
    
    expect(result.intent.intent).toBe('MISTAKE_ADMITTED');
  });

  it('should extract PRACTICE_REQUESTED intent', async () => {
    // Using a message that won't trigger the regex shortcut to test LLM extraction
    const message = "Could you please generate some MCQs on Plant Physiology for my revision?";
    const result = await classifyMessageCombined(message, undefined, 'NEET', userId);
    
    expect(result.intent.intent).toBe('PRACTICE_REQUESTED');
    expect(result.intent.topic).toMatch(/Plant Physiology/i);
  });

  it('should project a confusion signal to Atlas mastery update', async () => {
    const payload = {
      signalType: 'confusion_detected',
      topic: 'Human Reproduction',
      subject: 'Biology',
      confidence: 0.8,
    };
    
    const result = await projectLearningSignalToStudyState({
      userId,
      payload,
      eventId: 'test-event-id',
    });

    expect(result.reason).not.toBe('concept_unresolved');
  });
});
