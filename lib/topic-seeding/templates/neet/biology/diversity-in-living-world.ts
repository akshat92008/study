import { ChapterSeed } from '../../../types';
import { buildChapterSeed } from '../builders';
import data from '../data/biology/diversity-in-living-world.json';
import { NEET_UG_2026_UNITS } from '../../../../syllabus/neet-ug-2026';

const unit = NEET_UG_2026_UNITS.find(u => u.chapterSlug === 'diversity-in-living-world')!;
export const diversity_in_living_world_seed: ChapterSeed = buildChapterSeed(unit, data as any);
