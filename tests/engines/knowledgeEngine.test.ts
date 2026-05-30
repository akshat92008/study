import { beforeEach, describe, expect, it, vi } from 'vitest';
import { generateKnowledgeUpdate } from '@/lib/engines/knowledge-engine';

const fromMock = vi.hoisted(() => vi.fn());
const resolveConceptMock = vi.hoisted(() => vi.fn());

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    from: fromMock,
  })),
}));

vi.mock('@/lib/engines/concept-resolver', () => ({
  resolveConcept: resolveConceptMock,
}));

vi.mock('@/lib/utils/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

function makeSupabaseMock() {
  const operations: any[] = [];

  fromMock.mockImplementation((table: string) => {
    const builder: any = {
      select: vi.fn(() => builder),
      eq: vi.fn(() => builder),
      ilike: vi.fn(() => builder),
      limit: vi.fn(() => builder),
      in: vi.fn(() => builder),
      update: vi.fn((payload) => {
        operations.push({ table, type: 'update', payload });
        return builder;
      }),
      insert: vi.fn((payload) => {
        operations.push({ table, type: 'insert', payload });
        return builder;
      }),
      maybeSingle: vi.fn(async () => ({ data: null, error: null })),
      single: vi.fn(async () => ({ data: { id: 'created-concept-id' }, error: null })),
    };
    return builder;
  });

  return operations;
}

describe('generateKnowledgeUpdate', () => {
  beforeEach(() => {
    fromMock.mockReset();
    resolveConceptMock.mockReset();
  });

  it('resolves a concept via concept-resolver and logs a linked mistake for a new autopsy gap', async () => {
    const operations = makeSupabaseMock();

    // concept-resolver returns a newly-created concept ID
    resolveConceptMock.mockResolvedValue({
      conceptId: 'created-concept-id',
      confidence: 0.95,
      method: 'created',
      normalizedSubject: 'physics',
      normalizedChapter: 'thermodynamics',
      normalizedTopic: 'carnot efficiency',
    });

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
        ocrConfidence: 95,
      },
    ]);

    // concept-resolver was called with correct args
    expect(resolveConceptMock).toHaveBeenCalledOnce();
    expect(resolveConceptMock).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        subject: 'Physics',
        chapter: 'Thermodynamics',
        topic: 'Carnot efficiency',
        sourceType: 'autopsy',
      })
    );

    // A mistake row is inserted with the resolved concept ID
    expect(operations).toEqual(
      expect.arrayContaining([
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

  it('resolves an existing concept and logs a mistake without direct concept table mutation', async () => {
    const operations = makeSupabaseMock();

    // concept-resolver finds the existing concept via exact match
    resolveConceptMock.mockResolvedValue({
      conceptId: 'concept-1',
      confidence: 0.95,
      method: 'exact',
      normalizedSubject: 'chemistry',
      normalizedChapter: 'electrochemistry',
      normalizedTopic: 'nernst equation',
    });

    await generateKnowledgeUpdate('user-1', [
      {
        subject: 'Chemistry',
        chapter: 'Electrochemistry',
        conceptualGap: 'Nernst equation',
        mistakeCategory: 'calculation_error',
        ocrConfidence: 95,
      },
    ]);

    // concept-resolver was called
    expect(resolveConceptMock).toHaveBeenCalledOnce();

    // A mistake row is inserted referencing the existing concept
    expect(operations).toEqual(
      expect.arrayContaining([
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

    // No direct concepts table mutations should occur
    const conceptOps = operations.filter((op) => op.table === 'concepts');
    expect(conceptOps).toHaveLength(0);
  });
});
