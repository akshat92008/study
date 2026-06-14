import { describe, it, expect } from 'vitest';
import { selectSeedTemplate } from '../../lib/topic-seeding/template-registry';

describe('NEET Topic Seeding - No Generic Fallback', () => {
  it('should return a deterministic NEET seed instead of fallback for a known NEET goal', () => {
    const params = {
      userId: 'test-user',
      goalId: 'test-goal',
      goalTitle: 'master thermodynamics',
      goalType: 'exam_prep',
      presetId: 'neet_physics',
      subject: 'Physics',
    };

    const selected = selectSeedTemplate(params);
    expect(selected.source).toBe('seeded_template');
    expect(selected.templateKey).toBe('thermodynamics');
    expect(selected.confidence).toBe(0.99);
  });

  it('should suppress fallback if the goal matches a known unit entirely without NEET explicit preset', () => {
    const params = {
      userId: 'test-user',
      goalId: 'test-goal',
      goalTitle: 'study chemical kinetics',
      goalType: 'general',
      presetId: '',
      subject: '',
    };

    const selected = selectSeedTemplate(params);
    expect(selected.source).toBe('seeded_template');
    expect(selected.templateKey).toBe('chemical-kinetics');
  });
});
