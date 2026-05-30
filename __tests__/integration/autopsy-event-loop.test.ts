import { beforeEach, describe, expect, it, vi } from 'vitest';

const inserts: Record<string, any[]> = {};
const published: any[] = [];

function insertBuilder(table: string, row: any) {
  inserts[table] ||= [];
  const rows = Array.isArray(row) ? row : [row];
  inserts[table].push(...rows);
  return {
    select: vi.fn(() => ({
      single: vi.fn(async () => ({
        data: table === 'mock_autopsies' ? { id: 'autopsy-1' } : { id: `${table}-1` },
        error: null,
      })),
    })),
  };
}

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    from: vi.fn((table: string) => ({
      insert: vi.fn((row: any) => insertBuilder(table, row)),
    })),
  })),
}));

vi.mock('@/lib/ai/gemini', () => ({
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

vi.mock('@/lib/events/orchestrator', () => ({
  EventDispatcher: {
    publish: vi.fn(async (event: any) => {
      published.push(event);
      return 'event-1';
    }),
  },
}));

vi.mock('@/lib/engines/knowledge-engine', () => ({
  generateKnowledgeUpdate: vi.fn(async () => undefined),
}));

vi.mock('@/lib/engines/mentor-engine', () => ({
  generateMentorRecovery: vi.fn(async () => ({ mentorQuote: 'Review Motion.', plan: [] })),
}));

vi.mock('@/lib/utils/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

describe('Autopsy event loop', () => {
  beforeEach(() => {
    for (const key of Object.keys(inserts)) delete inserts[key];
    published.length = 0;
  });

  it('saves autopsy rows and publishes AUTOPSY_MOCK_PROCESSED', async () => {
    const { processMockAutopsy } = await import('@/lib/engines/autopsy-engine');

    const result = await processMockAutopsy(
      'user-1',
      { kind: 'text', text: 'mock paper text' },
      'Unit Test Mock',
      'neet'
    );

    expect(result.autopsyId).toBe('autopsy-1');
    expect(inserts.mock_autopsies?.[0]).toMatchObject({
      user_id: 'user-1',
      test_name: 'Unit Test Mock',
      total_questions: 2,
      correct_count: 1,
      incorrect_count: 1,
    });
    expect(inserts.autopsy_questions).toHaveLength(2);
    expect(published[0]).toMatchObject({
      user_id: 'user-1',
      type: 'AUTOPSY_MOCK_PROCESSED',
      data: { autopsyId: 'autopsy-1', incorrectCount: 1 },
    });
  });
});
