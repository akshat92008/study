import { ChapterSeed } from '../../../types';
import { buildChapterSeed } from '../builders';
import data from '../data/physics/oscillations-and-waves.json';
import { NEET_UG_2026_UNITS } from '../../../../syllabus/neet-ug-2026';

const unit = NEET_UG_2026_UNITS.find(u => u.chapterSlug === 'oscillations-and-waves')!;
export const oscillations_and_waves_seed: ChapterSeed = buildChapterSeed(unit, data as any);
