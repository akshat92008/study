import { describe, expect, it } from 'vitest';
import { scoreEpisode, shouldCreateEpisode } from '@/lib/services/episodic-memory.service';

describe('episodic memory selection', () => {
  it('stores important learning or emotional episodes and skips trivial chatter', () => {
    expect(shouldCreateEpisode('ok')).toBe(false);
    expect(shouldCreateEpisode('I am burnt out and scared after my mock score dropped')).toBe(true);
    expect(shouldCreateEpisode('I keep confusing Hess Law sign conventions in thermodynamics')).toBe(true);
  });

  it('ranks emotional and learning-salient episodes higher', () => {
    const neutral = scoreEpisode('Please explain this chapter in more detail later.');
    const salient = scoreEpisode('I am overwhelmed and stuck after repeating the same mock mistake.');

    expect(salient.retrievalWeight).toBeGreaterThan(neutral.retrievalWeight);
    expect(salient.emotionalSalience).toBeGreaterThan(neutral.emotionalSalience);
  });
});
