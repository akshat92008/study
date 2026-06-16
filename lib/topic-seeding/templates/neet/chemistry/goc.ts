import { ChapterSeed } from '../../../types';
import { buildChapterSeed } from '../builders';
import data from '../data/chemistry/some-basic-principles-of-organic-chemistry.json';
import { NEET_UG_2026_UNITS } from '../../../../syllabus/neet-ug-2026';

const unit = NEET_UG_2026_UNITS.find(u => u.chapterSlug === 'goc')!;
export const goc_seed: ChapterSeed = buildChapterSeed(unit, data as any);
