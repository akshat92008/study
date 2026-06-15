import { ChapterSeed } from '../../../types';
import { buildChapterSeed } from '../builders';
import data from '../data/chemistry/d-and-f-block-elements.json';
import { NEET_UG_2026_UNITS } from '../../../../syllabus/neet-ug-2026';

const unit = NEET_UG_2026_UNITS.find(u => u.chapterSlug === 'd-and-f-block-elements')!;
export const d_and_f_block_elements_seed: ChapterSeed = buildChapterSeed(unit, data as any);
