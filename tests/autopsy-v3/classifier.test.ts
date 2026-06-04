import { describe, expect, it } from 'vitest';
import { classifyMistakeDeterministically } from '@/lib/autopsy-v3/mistake-classifier';

const baseQuestion = {
  id: 'question-1',
  assessment_id: 'assessment-1',
  user_id: 'user-1',
  question_number: 1,
  status: 'incorrect' as const,
  subject: 'Physics',
  topic: 'Ray Optics',
};

describe('Autopsy V3 deterministic classifier', () => {
  it('maps concept reason to concept_gap', () => {
    const result = classifyMistakeDeterministically({
      userId: 'user-1',
      question: baseQuestion,
      userReasonCategory: 'concept_gap',
    });
    expect(result.mistake_type).toBe('concept_gap');
  });

  it('maps forgot reason to memory_gap', () => {
    const result = classifyMistakeDeterministically({
      userId: 'user-1',
      question: baseQuestion,
      userReason: 'I forgot the formula.',
    });
    expect(result.mistake_type).toBe('memory_gap');
  });

  it('maps silly reason to silly_error', () => {
    const result = classifyMistakeDeterministically({
      userId: 'user-1',
      question: baseQuestion,
      userReasonCategory: 'silly_error',
    });
    expect(result.mistake_type).toBe('silly_error');
  });

  it('unknown reason produces useful fallback', () => {
    const result = classifyMistakeDeterministically({
      userId: 'user-1',
      question: baseQuestion,
      userReasonCategory: 'not_sure',
    });
    expect(result.mistake_type).toBe('unknown');
    expect(result.prevention_rule).toBeTruthy();
  });
});
