import { test, expect, describe } from 'vitest';
import { ALL_NEET_CHAPTER_SEEDS } from '../../lib/topic-seeding/templates/neet';
import { NEET_UG_2026_UNITS } from '../../lib/syllabus/neet-ug-2026';

describe('NEET Full Syllabus Depth', () => {
  test('All NEET units exist', () => {
    expect(ALL_NEET_CHAPTER_SEEDS.length).toBe(NEET_UG_2026_UNITS.length);
  });

  test('Every unit meets minimum microtarget depth', () => {
    const largeBioUnits = ['human-physiology', 'genetics-and-evolution', 'reproduction', 'ecology-and-environment', 'plant-physiology'];
    
    for (const chapter of ALL_NEET_CHAPTER_SEEDS) {
      let mtCount = 0;
      for (const mission of chapter.missions) {
        mtCount += mission.microtargets.length;
      }
      
      if (chapter.subject === 'Physics' || chapter.subject === 'Chemistry') {
        expect(mtCount).toBeGreaterThanOrEqual(20);
      } else if (chapter.subject === 'Biology') {
        if (largeBioUnits.includes(chapter.chapterSlug)) {
          expect(mtCount).toBeGreaterThanOrEqual(50);
        } else {
          expect(mtCount).toBeGreaterThanOrEqual(30);
        }
      }
    }
  });

  test('No placeholder content exists', () => {
    const FORBIDDEN_PHRASES = [
      "X = Y + Z",
      "NCERT paragraph on",
      "What is the primary function or definition",
      "The most important fact about",
      "Generic subtopic"
    ];

    for (const chapter of ALL_NEET_CHAPTER_SEEDS) {
      const jsonStr = JSON.stringify(chapter);
      for (const phrase of FORBIDDEN_PHRASES) {
        expect(jsonStr).not.toContain(phrase);
      }
    }
  });
});
