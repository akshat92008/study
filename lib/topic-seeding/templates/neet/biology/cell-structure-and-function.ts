import { ChapterSeed } from '../../../types';
import { buildChapterSeed } from '../builders';
import data from '../data/biology/cell-structure-and-function.json';
import { NEET_UG_2026_UNITS } from '../../../../syllabus/neet-ug-2026';

const unit = NEET_UG_2026_UNITS.find(u => u.chapterSlug === 'cell-structure-and-function')!;
export const cell_structure_and_function_seed: ChapterSeed = buildChapterSeed(unit, data as any);
