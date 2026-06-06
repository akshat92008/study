import { describe, it, expect } from 'vitest';
import { inferGoalDomain } from '@/lib/goals/goal-domain';

describe('inferGoalDomain', () => {
  it('rejects empty goal', () => {
    const result = inferGoalDomain('');
    expect(result.needsClarification).toBe(true);
  });

  it('rejects generic "study" goal', () => {
    const result = inferGoalDomain('study');
    expect(result.needsClarification).toBe(true);
  });

  it('accepts "mechanical property of fluid" as physics', () => {
    const result = inferGoalDomain('mechanical property of fluid');
    expect(result.needsClarification).toBe(false);
    expect(result.subject).toBe('physics');
    expect(result.domain).toBe('school_science');
  });

  it('accepts "mechanical properties of fluids" as physics', () => {
    const result = inferGoalDomain('mechanical properties of fluids');
    expect(result.needsClarification).toBe(false);
    expect(result.subject).toBe('physics');
  });

  it('accepts "solutions" as chemistry', () => {
    const result = inferGoalDomain('solutions');
    expect(result.needsClarification).toBe(false);
    expect(result.subject).toBe('chemistry');
    expect(result.domain).toBe('school_science');
  });

  it('accepts "electrochemistry" as chemistry', () => {
    const result = inferGoalDomain('electrochemistry');
    expect(result.needsClarification).toBe(false);
    expect(result.subject).toBe('chemistry');
  });

  it('accepts "build a react portfolio" as programming', () => {
    const result = inferGoalDomain('build a react portfolio');
    expect(result.needsClarification).toBe(false);
    expect(result.subject).toBe('react');
    expect(result.domain).toBe('programming');
  });

  it('accepts "NEET physics revision" with exam and subject', () => {
    const result = inferGoalDomain('NEET physics revision');
    expect(result.needsClarification).toBe(false);
    expect(result.exam).toBe('neet');
    expect(result.subject).toBe('physics');
  });
});
