import { ChapterSeed } from '../../../types';
import { buildChapterSeed } from '../builders';
import data from '../data/physics/atoms-and-nuclei.json';
import { NEET_UG_2026_UNITS } from '../../../../syllabus/neet-ug-2026';

const unit = NEET_UG_2026_UNITS.find(u => u.chapterSlug === 'atoms-and-nuclei')!;
export const atoms_and_nuclei_seed: ChapterSeed = buildChapterSeed(unit, data as any);
