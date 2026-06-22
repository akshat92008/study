import { describe, it, expect } from 'vitest';
import { normalizeGoal } from '../lib/goals/normalize-goal';
import { resolveFocusedTopicSlugsFromText, resolveTopicSkeletonForText } from '../lib/topic-seeding/templates/neet/topic-skeleton';

describe('NEET Beta Loop Hardening Tests', () => {
  it('should map human respiration to breathing unit', () => {
    const goal = normalizeGoal('human respiration');
    expect(goal.exam).toBe('NEET');
    expect(goal.subject).toBe('Biology');
    expect(goal.chapterSlug).toBe('neet-biology-human-physiology-breathing');
  });

  it('should map plant respiration to plant physiology unit', () => {
    const goal = normalizeGoal('plant respiration');
    expect(goal.exam).toBe('NEET');
    expect(goal.subject).toBe('Biology');
    expect(goal.chapterSlug).toBe('neet-biology-plant-physiology');
  });

  it('should resolve ECG to ecg topic in human-physiology-circulation chapter', () => {
    const slugs = resolveFocusedTopicSlugsFromText('ECG', 'human-physiology-circulation');
    expect(slugs).toContain('ecg');
  });

  it('should not map heart to ear topic (sensory-organs) via word boundary check', () => {
    // "ear" is a substring of "heart". Previously, normalized.includes("ear") was true for "heart".
    // With word boundary check, "heart" should not match "ear".
    const match = resolveTopicSkeletonForText('heart', 'human-physiology-neural');
    // sensory-organs has alias 'ear'
    expect(match?.slug).not.toBe('sensory-organs');
  });
});
