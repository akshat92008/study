import { describe, expect, it } from 'vitest';
import { inferGoalDomain } from '@/lib/goals/goal-domain';

describe('goal domain resolver', () => {
  it('infers school science goals', () => {
    const domain = inferGoalDomain('master physics class 12');
    expect(domain.subject).toBe('physics');
    expect(domain.grade).toBe('class_12');
    expect(domain.domain).toBe('school_science');
    expect(domain.needsClarification).toBe(false);
  });

  it('infers humanities goals', () => {
    const domain = inferGoalDomain('class 10 history');
    expect(domain.subject).toBe('history');
    expect(domain.grade).toBe('class_10');
    expect(domain.domain).toBe('school_humanities');
  });

  it('infers programming goals', () => {
    const domain = inferGoalDomain('learn React hooks');
    expect(domain.subject).toBe('react');
    expect(domain.domain).toBe('programming');
  });

  it('infers NEET without forcing Chemistry', () => {
    const domain = inferGoalDomain('prepare for NEET');
    expect(domain.exam).toBe('neet');
    expect(domain.subject).toBeNull();
    expect(domain.domain).toBe('medical_exam');
  });

  it('asks clarification for vague goals', () => {
    const domain = inferGoalDomain('study better');
    expect(domain.needsClarification).toBe(true);
    expect(domain.clarificationQuestion).toBeTruthy();
  });
});
