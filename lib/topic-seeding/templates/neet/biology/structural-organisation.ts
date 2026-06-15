import { ChapterSeed } from '../../../types';
import { buildChapterSeed } from '../builders';
import data from '../data/biology/structural-organisation.json';
import { NEET_UG_2026_UNITS } from '../../../../syllabus/neet-ug-2026';

const unit = NEET_UG_2026_UNITS.find(u => u.chapterSlug === 'structural-organisation')!;
export const structural_organisation_seed: ChapterSeed = buildChapterSeed(unit, data as any);
