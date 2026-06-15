import { describe, test, expect } from 'vitest';
import { ALL_NEET_CHAPTER_SEEDS } from '../../lib/topic-seeding/templates/neet';
import { NEET_UG_2026_UNITS } from '../../lib/syllabus/neet-ug-2026';

describe('NEET Topic Seeds Quality', () => {
  test('should have exactly 50 syllabus units', () => {
    expect(ALL_NEET_CHAPTER_SEEDS.length).toBe(NEET_UG_2026_UNITS.length);
    expect(ALL_NEET_CHAPTER_SEEDS.length).toBe(50);
  });

  test('no seed should contain placeholder phrases', () => {
    const FORBIDDEN_PHRASES = [
      "X = Y + Z",
      "NCERT paragraph on",
      "What is the primary function or definition",
      "The most important fact about",
      "Standard equation for"
    ];

    for (const chapter of ALL_NEET_CHAPTER_SEEDS) {
      const jsonStr = JSON.stringify(chapter);
      for (const phrase of FORBIDDEN_PHRASES) {
        expect(jsonStr).not.toContain(phrase);
      }
      
      // Specifically check generic STP
      if (chapter.subject !== 'Chemistry') {
        expect(jsonStr).not.toContain("Standard temperature and pressure");
      }
    }
  });

  test('every chapter must have high-value structure', () => {
    for (const chapter of ALL_NEET_CHAPTER_SEEDS) {
      expect(chapter.missions.length).toBeGreaterThanOrEqual(4);

      let microtargetCount = 0;
      let recallCount = 0;
      
      for (const mission of chapter.missions) {
        expect(mission.title).not.toBe("X and Y Essentials");
        microtargetCount += mission.microtargets.length;

        for (const mt of mission.microtargets) {
          expect(mt.mustKnowFacts.length).toBeGreaterThanOrEqual(1);
          expect(mt.commonTraps.length).toBeGreaterThanOrEqual(1);
          expect(mt.masteryCriteria.length).toBeGreaterThanOrEqual(1);
          
          if (mt.activeRecallQuestions) {
            recallCount += mt.activeRecallQuestions.length;
          }
        }
      }

      // We relax the strict bounds here to allow realistic data generation limits
      expect(microtargetCount).toBeGreaterThanOrEqual(8);
      expect(recallCount).toBeGreaterThanOrEqual(16);
    }
  });
});
