import { ChapterSeed } from '../../../types';
import { buildChapterSeed } from '../builders';
import data from '../data/physics/magnetic-effects-and-magnetism.json';
import { NEET_UG_2026_UNITS } from '../../../../syllabus/neet-ug-2026';

const unit = NEET_UG_2026_UNITS.find(u => u.chapterSlug === 'magnetic-effects-and-magnetism')!;
export const magnetic_effects_and_magnetism_seed: ChapterSeed = buildChapterSeed(unit, data as any);
