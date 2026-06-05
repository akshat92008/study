import { describe, expect, it } from 'vitest';
import { selectSeedTemplate } from '@/lib/topic-seeding/template-registry';

describe('topic seeding subject leakage prevention', () => {
  it('does not select Chemistry for Physics class 12', () => {
    const selected = selectSeedTemplate({
      userId: 'u1',
      goalId: 'g1',
      goalTitle: 'master physics class 12',
      subject: 'physics',
      domain: 'school_science',
      grade: 'class_12',
    });
    expect(selected.template.subject.toLowerCase()).not.toBe('chemistry');
    expect(selected.template.displayName.toLowerCase()).not.toContain('equilibrium');
  });

  it('does not select science templates for History', () => {
    const selected = selectSeedTemplate({
      userId: 'u1',
      goalId: 'g1',
      goalTitle: 'class 10 history',
      subject: 'history',
      domain: 'school_humanities',
      grade: 'class_10',
    });
    expect(selected.templateKey).toBe('custom_goal_seed');
    expect(selected.template.subject.toLowerCase()).toBe('history');
  });

  it('keeps NEET Chemistry on Chemistry', () => {
    const selected = selectSeedTemplate({
      userId: 'u1',
      goalId: 'g1',
      goalTitle: 'neet chemistry equilibrium',
      subject: 'chemistry',
      exam: 'neet',
    });
    expect(selected.template.subject.toLowerCase()).toBe('chemistry');
  });
});
