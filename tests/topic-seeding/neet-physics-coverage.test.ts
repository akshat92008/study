import { test, expect, describe } from 'vitest';
import { ALL_NEET_CHAPTER_SEEDS } from '../../lib/topic-seeding/templates/neet';

describe('NEET Physics Coverage', () => {
  test('Numerical Physics units must include formulas', () => {
    const numericalPhysics = ['kinematics', 'laws-of-motion', 'work-energy-power', 'rotational-motion', 'gravitation', 'thermodynamics', 'electrostatics', 'current-electricity', 'magnetic-effects-and-magnetism', 'emi-and-ac', 'optics', 'dual-nature', 'atoms-and-nuclei'];
    
    for (const chapter of ALL_NEET_CHAPTER_SEEDS) {
      if (chapter.subject === 'Physics' && numericalPhysics.includes(chapter.chapterSlug)) {
        let hasFormulas = false;
        for (const mission of chapter.missions) {
          for (const mt of mission.microtargets) {
            if (mt.formulas && mt.formulas.length > 0) {
              hasFormulas = true;
            }
          }
        }
        expect(hasFormulas).toBe(true);
      }
    }
  });

  test('Formulas must not be generic placeholders', () => {
    for (const chapter of ALL_NEET_CHAPTER_SEEDS) {
      if (chapter.subject === 'Physics') {
        for (const mission of chapter.missions) {
          for (const mt of mission.microtargets) {
            if (mt.formulas) {
              for (const f of mt.formulas) {
                if (chapter.chapterSlug !== 'laws-of-motion') {
                    // Make sure it doesn't just copy F=ma everywhere.
                    expect(f.expression).not.toBe('F = m a');
                }
              }
            }
          }
        }
      }
    }
  });
});
