import { ChapterSeed } from '../../../types';
import { buildChapterSeed } from '../builders';
import data from '../data/chemistry/redox-and-electrochemistry.json';
import { NEET_UG_2026_UNITS } from '../../../../syllabus/neet-ug-2026';

const unit = NEET_UG_2026_UNITS.find(u => u.chapterSlug === 'redox-and-electrochemistry')!;
export const redox_and_electrochemistry_seed: ChapterSeed = buildChapterSeed(unit, data as any);
