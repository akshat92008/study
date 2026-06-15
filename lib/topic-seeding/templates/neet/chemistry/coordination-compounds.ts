import { ChapterSeed } from '../../../types';
import { buildChapterSeed } from '../builders';
import data from '../data/chemistry/coordination-compounds.json';
import { NEET_UG_2026_UNITS } from '../../../../syllabus/neet-ug-2026';

const unit = NEET_UG_2026_UNITS.find(u => u.chapterSlug === 'coordination-compounds')!;
export const coordination_compounds_seed: ChapterSeed = buildChapterSeed(unit, data as any);
