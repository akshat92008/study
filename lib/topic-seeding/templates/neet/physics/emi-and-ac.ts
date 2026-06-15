import { ChapterSeed } from '../../../types';
import { buildChapterSeed } from '../builders';
import data from '../data/physics/emi-and-ac.json';
import { NEET_UG_2026_UNITS } from '../../../../syllabus/neet-ug-2026';

const unit = NEET_UG_2026_UNITS.find(u => u.chapterSlug === 'emi-and-ac')!;
export const emi_and_ac_seed: ChapterSeed = buildChapterSeed(unit, data as any);
