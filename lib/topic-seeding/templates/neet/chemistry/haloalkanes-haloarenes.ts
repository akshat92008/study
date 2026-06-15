import { ChapterSeed } from '../../../types';
import { buildChapterSeed } from '../builders';
import data from '../data/chemistry/haloalkanes-haloarenes.json';
import { NEET_UG_2026_UNITS } from '../../../../syllabus/neet-ug-2026';

const unit = NEET_UG_2026_UNITS.find(u => u.chapterSlug === 'haloalkanes-haloarenes')!;
export const haloalkanes_haloarenes_seed: ChapterSeed = buildChapterSeed(unit, data as any);
