import { ChapterSeed } from '../../../types';
import { buildChapterSeed } from '../builders';
import data from '../data/chemistry/purification-characterisation-organic.json';
import { NEET_UG_2026_UNITS } from '../../../../syllabus/neet-ug-2026';

const unit = NEET_UG_2026_UNITS.find(u => u.chapterSlug === 'purification-characterisation-organic')!;
export const purification_characterisation_organic_seed: ChapterSeed = buildChapterSeed(unit, data as any);
