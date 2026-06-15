import { ChapterSeed } from '../../../types';
import { buildChapterSeed } from '../builders';
import data from '../data/biology/biology-and-human-welfare.json';
import { NEET_UG_2026_UNITS } from '../../../../syllabus/neet-ug-2026';

const unit = NEET_UG_2026_UNITS.find(u => u.chapterSlug === 'biology-and-human-welfare')!;
export const biology_and_human_welfare_seed: ChapterSeed = buildChapterSeed(unit, data as any);
