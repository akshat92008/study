import { ChapterSeed } from '../../../types';
import { buildChapterSeed } from '../builders';
import data from '../data/physics/work-energy-power.json';
import { NEET_UG_2026_UNITS } from '../../../../syllabus/neet-ug-2026';

const unit = NEET_UG_2026_UNITS.find(u => u.chapterSlug === 'work-energy-power')!;
export const work_energy_power_seed: ChapterSeed = buildChapterSeed(unit, data as any);
