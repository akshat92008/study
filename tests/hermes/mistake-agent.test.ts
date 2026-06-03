import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { HermesMistakeResultSchema } from '@/lib/hermes/schemas/mistake.schema';
import { buildMistakeFallback } from '@/lib/hermes/agents/mistake-agent';

describe('Hermes Mistake Schema', () => {
  it('validates correct JSON', () => {
    const valid = {
      category: 'conceptual_gap',
      subject: 'Physics',
      chapter: 'Kinematics',
      topic: 'Projectile Motion',
      diagnosis: 'Student confused horizontal and vertical velocity components.',
      whyMyAnswerWasWrong: 'The student applied vertical acceleration to horizontal velocity.',
      whyCorrectAnswerWorks: 'Horizontal velocity is constant; only vertical component changes.',
      keyMissedClue: 'The question specified frictionless horizontal surface.',
      confidence: 'high',
      weakConcept: {
        subject: 'Physics',
        chapter: 'Kinematics',
        topic: 'Projectile Motion',
        name: 'Independence of horizontal and vertical motion',
      },
      cards: [
        {
          front: 'What happens to horizontal velocity in projectile motion?',
          back: 'Horizontal velocity remains constant (no horizontal force).',
          type: 'mistake_concept',
          difficulty: 'medium',
        },
        {
          front: 'Why does gravity only affect vertical motion?',
          back: 'Gravity acts downward; no horizontal component in standard projectile motion.',
          type: 'error_pattern',
          difficulty: 'hard',
        },
        {
          front: 'A ball is thrown horizontally. Its horizontal speed after 2s is?',
          back: 'Same as initial — horizontal speed does not change.',
          type: 'similar_trap',
          difficulty: 'easy',
        },
      ],
      nextAction: {
        label: 'Review projectile motion cards',
        rationale: 'Active recall on this specific mistake pattern.',
        estimatedMinutes: 10,
        actionType: 'review_cards',
      },
      safetyFlags: {
        possibleHallucination: false,
        needsHumanReview: false,
      },
    };

    const result = HermesMistakeResultSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  it('rejects invalid category', () => {
    const invalid = {
      category: 'definitely_invalid_category',
      subject: null,
      chapter: null,
      topic: null,
      diagnosis: 'test',
      whyMyAnswerWasWrong: 'test',
      whyCorrectAnswerWorks: 'test',
      keyMissedClue: null,
      confidence: 'high',
      weakConcept: { subject: null, chapter: null, topic: null, name: 'test' },
      cards: [{ front: 'q', back: 'a', type: 'mistake_concept', difficulty: 'easy' }],
      nextAction: { label: 'test', rationale: 'test', estimatedMinutes: 5, actionType: 'review_cards' },
      safetyFlags: { possibleHallucination: false, needsHumanReview: false },
    };

    const result = HermesMistakeResultSchema.safeParse(invalid);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some(i => i.path.includes('category'))).toBe(true);
    }
  });

  it('rejects missing cards array', () => {
    const invalid = {
      category: 'conceptual_gap',
      subject: null,
      chapter: null,
      topic: null,
      diagnosis: 'test',
      whyMyAnswerWasWrong: 'test',
      whyCorrectAnswerWorks: 'test',
      keyMissedClue: null,
      confidence: 'medium',
      weakConcept: { subject: null, chapter: null, topic: null, name: 'test' },
      // cards is missing
      nextAction: { label: 'test', rationale: 'test', estimatedMinutes: 5, actionType: 'review_cards' },
      safetyFlags: { possibleHallucination: false, needsHumanReview: false },
    };

    const result = HermesMistakeResultSchema.safeParse(invalid);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some(i => i.path.includes('cards'))).toBe(true);
    }
  });

  it('requires at least 1 card', () => {
    const invalid = {
      category: 'unknown',
      subject: null,
      chapter: null,
      topic: null,
      diagnosis: 'test',
      whyMyAnswerWasWrong: 'test',
      whyCorrectAnswerWorks: 'test',
      keyMissedClue: null,
      confidence: 'low',
      weakConcept: { subject: null, chapter: null, topic: null, name: 'test' },
      cards: [], // empty — should fail
      nextAction: { label: 'test', rationale: 'test', estimatedMinutes: 5, actionType: 'review_cards' },
      safetyFlags: { possibleHallucination: false, needsHumanReview: false },
    };

    const result = HermesMistakeResultSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it('validates safetyFlags correctly', () => {
    // Safety flags with reason
    const valid = {
      category: 'unknown',
      subject: null,
      chapter: null,
      topic: null,
      diagnosis: 'Could not diagnose.',
      whyMyAnswerWasWrong: 'Unknown.',
      whyCorrectAnswerWorks: 'Unknown.',
      keyMissedClue: null,
      confidence: 'low',
      weakConcept: { subject: null, chapter: null, topic: null, name: 'Unknown' },
      cards: [{ front: 'q', back: 'a', type: 'mistake_concept', difficulty: 'easy' }],
      nextAction: { label: 'Review', rationale: 'test', estimatedMinutes: 5, actionType: 'review_cards' },
      safetyFlags: {
        possibleHallucination: true,
        needsHumanReview: true,
        reason: 'Fallback used — automatic diagnosis not available.',
      },
    };

    const result = HermesMistakeResultSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });
});

describe('buildMistakeFallback', () => {
  it('returns 3 cards with category unknown', () => {
    const result = buildMistakeFallback({
      question: 'What is the speed of light?',
      myAnswer: '300 km/s',
      correctAnswer: '3 × 10^8 m/s',
      explanation: 'Speed of light in vacuum is 299,792,458 m/s',
    });

    expect(result.category).toBe('unknown');
    expect(result.cards).toHaveLength(3);
    expect(result.confidence).toBe('low');
    expect(result.safetyFlags.needsHumanReview).toBe(true);
  });

  it('fallback validates against schema', () => {
    const result = buildMistakeFallback({
      question: 'What is Newtons first law?',
      myAnswer: 'Force equals mass times acceleration',
      correctAnswer: 'A body in rest stays in rest unless acted upon by an external force.',
    });

    const parsed = HermesMistakeResultSchema.safeParse(result);
    expect(parsed.success).toBe(true);
  });

  it('handles missing explanation gracefully', () => {
    const result = buildMistakeFallback({
      question: 'Question without explanation?',
      myAnswer: 'Wrong answer',
      correctAnswer: 'Right answer',
    });

    expect(result.whyCorrectAnswerWorks).toContain('Right answer');
    expect(result.cards.length).toBeGreaterThanOrEqual(1);
  });
});
