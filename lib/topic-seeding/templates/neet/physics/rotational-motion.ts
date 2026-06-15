import { ChapterSeed } from '../../../types';
import { buildChapterSeed } from '../builders';
import data from '../data/physics/rotational-motion.json';
import { NEET_UG_2026_UNITS } from '../../../../syllabus/neet-ug-2026';

const unit = NEET_UG_2026_UNITS.find(u => u.chapterSlug === 'rotational-motion')!;
export const rotational_motion_seed: ChapterSeed = buildChapterSeed(unit, data as any);
