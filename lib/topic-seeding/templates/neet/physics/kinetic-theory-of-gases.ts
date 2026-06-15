import { ChapterSeed } from '../../../types';
import { buildChapterSeed } from '../builders';
import data from '../data/physics/kinetic-theory-of-gases.json';
import { NEET_UG_2026_UNITS } from '../../../../syllabus/neet-ug-2026';

const unit = NEET_UG_2026_UNITS.find(u => u.chapterSlug === 'kinetic-theory-of-gases')!;
export const kinetic_theory_of_gases_seed: ChapterSeed = buildChapterSeed(unit, data as any);
