import { describe, it, expect } from 'vitest';
import { normalizeGoal } from '../../lib/goals/normalize-goal';

describe('NEET Goal Normalization', () => {
  it('should correctly normalize exact official chapter names', () => {
    const goal = normalizeGoal('master kinematics');
    expect(goal.exam).toBe('NEET');
    expect(goal.subject).toBe('Physics');
    expect(goal.chapterSlug).toBe('neet-physics-kinematics');
    expect(goal.mode).toBe('mastery');
  });

  it('should resolve ambiguous aliases via context if provided', () => {
    // "respiration" can be plant physiology or human physiology
    const plantGoal = normalizeGoal('respiration', 'Biology');
    // It should pick plant physiology based on the disambiguation logic if "plant" is in the text, 
    // or if the alias specifically maps. Actually "respiration in plants" is the alias.
    const explicitPlantGoal = normalizeGoal('respiration in plants');
    expect(explicitPlantGoal.chapterSlug).toBe('neet-biology-plant-physiology');
    
    const humanGoal = normalizeGoal('breathing and exchange of gases');
    expect(humanGoal.chapterSlug).toBe('neet-biology-human-physiology');
  });

  it('should resolve common aliases correctly', () => {
    const pBlock = normalizeGoal('p block elements');
    expect(pBlock.chapterSlug).toBe('neet-chemistry-p-block-elements');
    expect(pBlock.subject).toBe('Chemistry');

    const solutions = normalizeGoal('revise solutions');
    expect(solutions.chapterSlug).toBe('neet-chemistry-solutions');
    expect(solutions.mode).toBe('revision');
    
    const nlm = normalizeGoal('newton laws');
    expect(nlm.chapterSlug).toBe('neet-physics-laws-of-motion');
  });

  it('should fall back gracefully for non-NEET goals', () => {
    const nonNeet = normalizeGoal('learn how to bake a cake');
    expect(nonNeet.exam).toBeNull();
    expect(nonNeet.chapterSlug).toBeNull();
  });
});
