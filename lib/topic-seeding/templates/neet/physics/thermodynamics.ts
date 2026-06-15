import { ChapterSeed } from '../../../types';
import { buildChapterSeed } from '../builders';
import data from '../data/physics/thermodynamics.json';
import { NEET_UG_2026_UNITS } from '../../../../syllabus/neet-ug-2026';

const unit = NEET_UG_2026_UNITS.find(u => u.chapterSlug === 'thermodynamics')!;
export const thermodynamics_seed: ChapterSeed = buildChapterSeed(unit, data as any);
