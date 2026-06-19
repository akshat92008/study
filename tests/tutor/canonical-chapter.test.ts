import { describe, expect, it } from 'vitest';
import { resolveCanonicalChapter, toCanonicalChapterSlug, toCanonicalGoalSlug } from '@/lib/goals/canonical-chapter';
import { getNextQuestion } from '@/lib/tutor/question-engine';

describe('canonical chapter resolver', () => {
  it.each([
    ['kinematics', 'kinematics', 'neet-physics-kinematics'],
    ['neet-physics-kinematics', 'kinematics', 'neet-physics-kinematics'],
    ['biotechnology-principles-and-processes', 'biotechnology', 'neet-biology-biotechnology'],
    ['neet-biology-biotechnology', 'biotechnology', 'neet-biology-biotechnology'],
    ['circulatory system', 'human-physiology-circulation', 'neet-biology-human-physiology-circulation'],
  ])('resolves %s', (input, chapterSlug, goalSlug) => {
    expect(toCanonicalChapterSlug(input)).toBe(chapterSlug);
    expect(toCanonicalGoalSlug(input)).toBe(goalSlug);
    expect(resolveCanonicalChapter(input)?.aliases.length).toBeGreaterThan(0);
  });

  it('lets the seeded question engine accept goal-prefixed slugs', () => {
    const question = getNextQuestion({ chapterSlug: 'neet-physics-kinematics', recentQuestions: [] });
    expect(question).toBeDefined();
    expect(question?.questionId).toContain('kinematics-q-');
    expect(question?.taxonomyPath?.chapterSlug).toBe('kinematics');
  });
});
