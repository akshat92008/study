import { ChapterSeed } from '../../../types';
import { buildChapterSeed } from '../builders';
import data from '../data/physics/electromagnetic-waves.json';
import { NEET_UG_2026_UNITS } from '../../../../syllabus/neet-ug-2026';

const unit = NEET_UG_2026_UNITS.find(u => u.chapterSlug === 'electromagnetic-waves')!;
export const electromagnetic_waves_seed: ChapterSeed = buildChapterSeed(unit, data as any);
