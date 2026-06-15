import { ChapterSeed } from '../../../types';
import { buildChapterSeed } from '../builders';
import data from '../data/biology/ecology-and-environment.json';
import { NEET_UG_2026_UNITS } from '../../../../syllabus/neet-ug-2026';

const unit = NEET_UG_2026_UNITS.find(u => u.chapterSlug === 'ecology-and-environment')!;
export const ecology_and_environment_seed: ChapterSeed = buildChapterSeed(unit, data as any);
