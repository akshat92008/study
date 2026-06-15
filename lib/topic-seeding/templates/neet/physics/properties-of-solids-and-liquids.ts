import { ChapterSeed } from '../../../types';
import { buildChapterSeed } from '../builders';
import data from '../data/physics/properties-of-solids-and-liquids.json';
import { NEET_UG_2026_UNITS } from '../../../../syllabus/neet-ug-2026';

const unit = NEET_UG_2026_UNITS.find(u => u.chapterSlug === 'properties-of-solids-and-liquids')!;
export const properties_of_solids_and_liquids_seed: ChapterSeed = buildChapterSeed(unit, data as any);
