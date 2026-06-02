import { beforeEach, describe, expect, it, vi } from 'vitest';

const rpc = vi.hoisted(() => vi.fn());

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    rpc,
  })),
}));

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(() => ({
    rpc,
  })),
}));

vi.mock('@/lib/ai/provider-client', () => ({
  generateJSON: vi.fn(async (_model: string, _system: string, prompt: string) => {
    if (prompt.includes('Extract all questions')) {
      return {
        questions: [
          { questionNumber: 1, subject: 'Physics', chapter: 'Motion', status: 'Incorrect', mistakeCategory: null, reasoning: null, ocrConfidence: 99 },
          { questionNumber: 2, subject: 'Physics', chapter: 'Motion', status: 'Correct', mistakeCategory: null, reasoning: null, ocrConfidence: 99 },
        ],
      };
    }
    return [{
      mistakeCategory: 'conceptual_gap',
      reasoning: 'Velocity and acceleration were mixed up.',
      conceptualGap: 'Acceleration definition',
      correctExplanation: 'Acceleration is the rate of change of velocity.',
    }];
  }),
}));

vi.mock('@/lib/ai/budgeted', () => ({
  budgetedGenerateMultimodalJSON: vi.fn(),
  budgetedGenerateJSON: vi.fn(async (input: { userPrompt?: string }) => {
    const prompt = input.userPrompt ?? '';
    if (prompt.includes('Extract all questions')) {
      return {
        questions: [
          { questionNumber: 1, subject: 'Physics', chapter: 'Motion', status: 'Incorrect', mistakeCategory: null, reasoning: null, ocrConfidence: 99 },
          { questionNumber: 2, subject: 'Physics', chapter: 'Motion', status: 'Correct', mistakeCategory: null, reasoning: null, ocrConfidence: 99 },
        ],
      };
    }
    return [{
      mistakeCategory: 'conceptual_gap',
      reasoning: 'Velocity and acceleration were mixed up.',
      conceptualGap: 'Acceleration definition',
      correctExplanation: 'Acceleration is the rate of change of velocity.',
    }];
  }),
}));

vi.mock('@/lib/engines/mentor-engine', () => ({
  generateMentorRecovery: vi.fn(async () => ({ mentorQuote: 'Review Motion.', plan: [] })),
}));

vi.mock('@/lib/utils/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

describe('Autopsy event loop', () => {
  beforeEach(() => {
    rpc.mockReset();
    rpc.mockResolvedValue({
      data: { autopsy_id: 'autopsy-1', event_id: 'event-1', idempotent_replay: false },
      error: null,
    });
  });

  it('ingests autopsy rows and enqueues AUTOPSY_MOCK_PROCESSED transactionally', async () => {
    const { processMockAutopsy } = await import('@/lib/engines/autopsy-engine');

    const result = await processMockAutopsy(
      'user-1',
      { kind: 'text', text: 'Mock result sheet: Q1 Incorrect, student answer A, correct answer B. Q2 Correct, student answer C, correct answer C.' },
      'Unit Test Mock',
      'neet'
    );

    expect(result.autopsyId).toBe('autopsy-1');
    expect(result.eventId).toBe('event-1');
    expect(rpc).toHaveBeenCalledWith('ingest_mock_autopsy', expect.objectContaining({
      p_user_id: 'user-1',
      p_test_name: 'Unit Test Mock',
      p_total_questions: 2,
      p_correct_count: 1,
      p_incorrect_count: 1,
    }));
    expect(rpc.mock.calls[0][1].p_questions).toHaveLength(2);
  });

  it('does not classify a bare question paper without answer evidence', async () => {
    const { processMockAutopsy, AutopsyNeedsUserInputError } = await import('@/lib/engines/autopsy-engine');

    await expect(processMockAutopsy(
      'user-1',
      { kind: 'text', text: 'Question 1. A ball is thrown upward. Question 2. Define acceleration.' },
      'Question Paper Only',
      'neet'
    )).rejects.toBeInstanceOf(AutopsyNeedsUserInputError);

    expect(rpc).not.toHaveBeenCalled();
  });
});
