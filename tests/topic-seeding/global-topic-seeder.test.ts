import { describe, expect, it } from 'vitest';
import { __topicSeedingInternals } from '@/lib/topic-seeding/topic-seeder';
import { selectSeedTemplate } from '@/lib/topic-seeding/template-registry';
import { mapTextToSeededTopic } from '@/lib/topic-seeding/synonym-mapper';
describe('global topic seeding', () => {
  it('detects Kinematics without NEET preset', () => {
    const selected = selectSeedTemplate({
      userId: 'u1',
      goalId: 'g1',
      goalTitle: 'I want to master Kinematics',
      presetId: null,
      subjects: ['Physics'],
    });
    expect(selected.templateKey).toBe('neet-physics-kinematics');
    expect(selected.source).toBe('seeded_template');
  });
  it('detects Human Reproduction', () => {
    const selected = selectSeedTemplate({
      userId: 'u1',
      goalId: 'g1',
      goalTitle: 'Master Human Reproduction',
      presetId: null,
      subjects: ['Biology'],
    });
    expect(selected.templateKey).toBe('neet-biology-reproduction');
  });
  it('detects JavaScript', () => {
    const selected = selectSeedTemplate({
      userId: 'u1',
      goalId: 'g1',
      goalTitle: 'I want to learn JavaScript',
      presetId: null,
      subjects: ['Programming'],
    });
    expect(selected.templateKey).toBe('coding_javascript_basics');
  });
  it('falls back for unknown custom goal', () => {
    const selected = selectSeedTemplate({
      userId: 'u1',
      goalId: 'g1',
      goalTitle: 'Master Ancient Trade Routes',
      presetId: null,
      subjects: ['History'],
    });
    expect(selected.templateKey).toBe('custom_goal_seed');
    expect(selected.source).toBe('custom_seed');
  });
  it('builds ordered rows with active first topic', () => {
    const selected = selectSeedTemplate({
      userId: 'u1',
      goalId: 'g1',
      goalTitle: 'Master Kinematics',
      presetId: null,
      subjects: ['Physics'],
    });
    const rows = __topicSeedingInternals.buildSeededTopicRows(
      {
        userId: 'u1',
        goalId: 'g1',
        goalTitle: 'Master Kinematics',
      },
      selected.template,
      selected.templateKey,
      selected.source
    );
    expect(rows.length).toBeGreaterThan(10);
    expect(rows[0].order_index).toBe(1);
    expect(rows[0].status).toBe('active');
    expect(rows[1].status).toBe('not_started');
  });
  it('maps autopsy text to seeded topics', () => {
    expect(mapTextToSeededTopic('I made a v-t graph slope mistake')).toBe('Motion graphs');
    expect(mapTextToSeededTopic('I used wrong range formula in projectile')).toBe('Projectile motion');
    expect(mapTextToSeededTopic('I confused hormone phases in menstrual cycle')).toBe('Menstrual cycle');
    expect(mapTextToSeededTopic('I got VSEPR shape wrong')).toBe('VSEPR theory');
  });
});
