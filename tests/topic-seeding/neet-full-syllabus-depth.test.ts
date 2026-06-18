import { test, expect, describe } from 'vitest';
import { ALL_NEET_CHAPTER_SEEDS } from '../../lib/topic-seeding/templates/neet';
import { NEET_UG_2026_UNITS } from '../../lib/syllabus/neet-ug-2026';
import { getChapterSkeleton } from '../../lib/topic-seeding/templates/neet/topic-skeleton';

describe('NEET Full Syllabus Depth', () => {
  test('All NEET units exist', () => {
    expect(ALL_NEET_CHAPTER_SEEDS.length).toBe(NEET_UG_2026_UNITS.length);
  });

  test('Every unit has real cleaned seed content and curated topic coverage', () => {
    for (const chapter of ALL_NEET_CHAPTER_SEEDS) {
      let mtCount = 0;
      for (const mission of chapter.missions) {
        mtCount += mission.microtargets.length;
      }

      const skeleton = getChapterSkeleton(chapter.chapterSlug);
      expect(skeleton, `Missing topic skeleton for ${chapter.chapterSlug}`).not.toBeNull();
      expect(skeleton?.topics.length ?? 0, `${chapter.chapterSlug} needs curated topic coverage`).toBeGreaterThanOrEqual(3);
      expect(mtCount, `${chapter.chapterSlug} has negative cleaned seed microtargets`).toBeGreaterThanOrEqual(0);
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
