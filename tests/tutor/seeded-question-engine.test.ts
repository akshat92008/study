import { describe, it, expect } from 'vitest';
import { getNextQuestion, QuestionEngine } from '../../lib/tutor/question-engine';

describe('Seeded Question Engine', () => {
  it('should fetch questions deterministically for a NEET chapter', () => {
    const question = getNextQuestion({
      chapterSlug: 'electrostatics',
      recentQuestions: [],
    });

    expect(question).toBeDefined();
    expect(question?.questionId).toContain('electrostatics-q-');
    expect(question?.source).toBe('deterministic_template');
  });

  it('should prioritize weak tags if provided', () => {
    const question = getNextQuestion({
      chapterSlug: 'kinematics',
      weakAreas: ['area'],
    });

    expect(question).toBeDefined();
    expect(question?.conceptTags.some(tag => tag.includes('area'))).toBe(true);
  });

  it('should not return recently asked questions unless all are exhausted', () => {
    const q1 = getNextQuestion({ chapterSlug: 'rotational-motion', recentQuestions: [] });
    expect(q1).toBeDefined();

    const q2 = getNextQuestion({ chapterSlug: 'rotational-motion', recentQuestions: [q1!.questionId] });
    expect(q2).toBeDefined();
    expect(q2?.questionId).not.toBe(q1?.questionId);
  });

  it('QuestionEngine wrapper should behave identically', () => {
    const question = QuestionEngine.getDeterministicQuestion('biology-and-human-welfare', 0);
    expect(question).toBeDefined();
    expect(question?.questionId).toContain('biology-and-human-welfare-q-');
    expect(question?.expectedConcepts).toBeDefined();
  });
});
