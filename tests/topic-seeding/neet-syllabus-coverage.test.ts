import { describe, it, expect } from 'vitest';
import { ALL_NEET_CHAPTER_SEEDS } from '../../lib/topic-seeding/templates/neet';
import { NEET_UG_2026_UNITS } from '../../lib/syllabus/neet-ug-2026';

describe('NEET Syllabus Coverage', () => {
  it('should have exactly 56 official chapters (50 base + 6 Human Physiology sub-chapters)', () => {
    expect(NEET_UG_2026_UNITS.length).toBe(56);
    const physics = NEET_UG_2026_UNITS.filter(u => u.subject === 'Physics');
    const chemistry = NEET_UG_2026_UNITS.filter(u => u.subject === 'Chemistry');
    const biology = NEET_UG_2026_UNITS.filter(u => u.subject === 'Biology');
    
    expect(physics.length).toBe(20);
    expect(chemistry.length).toBe(20);
    // Biology: 10 original - 1 (Human Physiology monolith) + 7 (sub-chapters) = 16
    expect(biology.length).toBe(16);
  });

  it('should have a corresponding deterministic seed template for each unit', () => {
    expect(ALL_NEET_CHAPTER_SEEDS.length).toBe(NEET_UG_2026_UNITS.length);
    
    for (const unit of NEET_UG_2026_UNITS) {
      const match = ALL_NEET_CHAPTER_SEEDS.find(seed => seed.chapterSlug === unit.chapterSlug);
      expect(match, `Missing seed for ${unit.chapterSlug}`).toBeDefined();
      expect(match?.exam).toBe('NEET');
      expect(match?.missions.length).toBeGreaterThanOrEqual(1);
    }
  });
});
