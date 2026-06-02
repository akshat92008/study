import { describe, expect, it } from 'vitest';
import { classifyMistake } from '@/lib/autopsy/classifier';

describe('Classifier', () => {
  it('normalizes MCQ answers', async () => {
    const result = await classifyMistake({
      userId: 'test-user',
      studentAnswer: 'Option A',
      correctAnswer: 'A',
      evidenceSource: 'autopsy'
    });
    expect(result.isCorrect).toBe(true);
    expect(result.evidenceStatus).toBe('verified_correct');

    const result2 = await classifyMistake({
      userId: 'test-user',
      studentAnswer: '(B)',
      correctAnswer: 'B',
      evidenceSource: 'autopsy'
    });
    expect(result2.isCorrect).toBe(true);
    expect(result2.evidenceStatus).toBe('verified_correct');
  });
});
