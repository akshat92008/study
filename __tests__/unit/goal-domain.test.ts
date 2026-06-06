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

  it('accepts NEET as a valid exam-level goal', () => {
    const result = inferGoalDomain('neet');
    expect(result.needsClarification).toBe(false);
    expect(result.exam).toBe('neet');
    expect(result.domain).toBe('medical_exam');
    expect(result.confidence).toBeGreaterThanOrEqual(0.75);
  });

  it('accepts NEET 2026 as a valid exam-level goal', () => {
    const result = inferGoalDomain('NEET 2026');
    expect(result.needsClarification).toBe(false);
    expect(result.exam).toBe('neet');
    expect(result.domain).toBe('medical_exam');
  });

  it('accepts NEET Biology with subject', () => {
    const result = inferGoalDomain('neet biology');
    expect(result.needsClarification).toBe(false);
    expect(result.exam).toBe('neet');
    expect(result.subject).toBe('biology');
    expect(result.domain).toBe('medical_exam');
  });

  it('accepts NEET Physics with subject', () => {
    const result = inferGoalDomain('neet physics');
    expect(result.needsClarification).toBe(false);
    expect(result.exam).toBe('neet');
    expect(result.subject).toBe('physics');
    expect(result.domain).toBe('medical_exam');
  });

  it('accepts JEE as a valid exam-level goal', () => {
    const result = inferGoalDomain('jee');
    expect(result.needsClarification).toBe(false);
    expect(result.exam).toBe('jee');
    expect(result.domain).toBe('engineering_exam');
  });

  it('accepts SAT as a valid exam-level goal', () => {
    const result = inferGoalDomain('sat');
    expect(result.needsClarification).toBe(false);
    expect(result.exam).toBe('sat');
    expect(result.domain).toBe('standardized_exam');
  });

  it('still rejects vague generic goals', () => {
    expect(inferGoalDomain('').needsClarification).toBe(true);
    expect(inferGoalDomain('study').needsClarification).toBe(true);
    expect(inferGoalDomain('learn').needsClarification).toBe(true);
    expect(inferGoalDomain('exam').needsClarification).toBe(true);
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
