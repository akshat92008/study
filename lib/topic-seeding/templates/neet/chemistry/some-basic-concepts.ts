import { ChapterSeed } from '../../../types';
import { buildChapterSeed } from '../builders';
import data from '../data/chemistry/some-basic-concepts.json';
import { NEET_UG_2026_UNITS } from '../../../../syllabus/neet-ug-2026';

const unit = NEET_UG_2026_UNITS.find(u => u.chapterSlug === 'some-basic-concepts')!;
export const some_basic_concepts_seed: ChapterSeed = buildChapterSeed(unit, data as any);
