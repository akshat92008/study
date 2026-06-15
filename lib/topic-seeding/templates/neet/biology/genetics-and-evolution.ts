import { ChapterSeed } from '../../../types';
import { buildChapterSeed } from '../builders';
import data from '../data/biology/genetics-and-evolution.json';
import { NEET_UG_2026_UNITS } from '../../../../syllabus/neet-ug-2026';

const unit = NEET_UG_2026_UNITS.find(u => u.chapterSlug === 'genetics-and-evolution')!;
export const genetics_and_evolution_seed: ChapterSeed = buildChapterSeed(unit, data as any);
