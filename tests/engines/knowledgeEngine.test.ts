import { generateKnowledgeUpdate } from '@/lib/engines/knowledge-engine';

const fromMock = jest.fn();

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(async () => ({
    from: fromMock,
  })),
}));

jest.mock('@/lib/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

function makeSupabaseMock(existingConcept: any = null) {
  const operations: any[] = [];

  fromMock.mockImplementation((table: string) => {
    const builder: any = {
      select: jest.fn(() => builder),
      eq: jest.fn(() => builder),
      ilike: jest.fn(() => builder),
      update: jest.fn((payload) => {
        operations.push({ table, type: 'update', payload });
        return builder;
      }),
      insert: jest.fn((payload) => {
        operations.push({ table, type: 'insert', payload });
        return builder;
      }),
      maybeSingle: jest.fn(async () => ({ data: existingConcept, error: null })),
      single: jest.fn(async () => ({ data: { id: 'created-concept-id' }, error: null })),
    };
    return builder;
  });

  return operations;
}

describe('generateKnowledgeUpdate', () => {
  beforeEach(() => {
    fromMock.mockReset();
  });

  it('creates an ATLAS concept and logs a linked mistake for a new autopsy gap', async () => {
    const operations = makeSupabaseMock(null);

    await generateKnowledgeUpdate('user-1', [
      {
        questionNumber: 7,
        subject: 'Physics',
        chapter: 'Thermodynamics',
        conceptualGap: 'Carnot efficiency',
        mistakeCategory: 'conceptual_gap',
        reasoning: 'Confused heat absorbed with work output.',
        correctExplanation: 'Efficiency depends on temperature ratio.',
        marksLost: 4,
      },
    ]);

    expect(operations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          table: 'concepts',
          type: 'insert',
          payload: expect.objectContaining({
            user_id: 'user-1',
            name: 'Carnot efficiency',
            mastery: 'exposed',
            times_incorrect: 1,
          }),
        }),
        expect.objectContaining({
          table: 'mistakes',
          type: 'insert',
          payload: expect.objectContaining({
            user_id: 'user-1',
            concept_id: 'created-concept-id',
            category: 'conceptual',
            marks_lost: 4,
          }),
        }),
      ])
    );
  });

  it('downscales an existing concept when the same gap appears again', async () => {
    const operations = makeSupabaseMock({
      id: 'concept-1',
      mastery: 'mastered',
      times_incorrect: 2,
    });

    await generateKnowledgeUpdate('user-1', [
      {
        subject: 'Chemistry',
        chapter: 'Electrochemistry',
        conceptualGap: 'Nernst equation',
        mistakeCategory: 'calculation_error',
      },
    ]);

    expect(operations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          table: 'concepts',
          type: 'update',
          payload: expect.objectContaining({
            mastery: 'proficient',
            confidence: 'low',
            times_incorrect: 3,
          }),
        }),
        expect.objectContaining({
          table: 'mistakes',
          type: 'insert',
          payload: expect.objectContaining({
            concept_id: 'concept-1',
            category: 'calculation',
          }),
        }),
      ])
    );
  });
});
