import { ChapterSeed } from '../../../types';
import { buildChapterSeed } from '../builders';
import data from '../data/biology/human-physiology.json';
import { NEET_UG_2026_UNITS } from '../../../../syllabus/neet-ug-2026';

const unit = NEET_UG_2026_UNITS.find(u => u.chapterSlug === 'human-physiology')!;
export const human_physiology_seed: ChapterSeed = buildChapterSeed(unit, data as any);
