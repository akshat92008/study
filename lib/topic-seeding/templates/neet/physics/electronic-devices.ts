import { ChapterSeed } from '../../../types';
import { buildChapterSeed } from '../builders';
import data from '../data/physics/electronic-devices.json';
import { NEET_UG_2026_UNITS } from '../../../../syllabus/neet-ug-2026';

const unit = NEET_UG_2026_UNITS.find(u => u.chapterSlug === 'electronic-devices')!;
export const electronic_devices_seed: ChapterSeed = buildChapterSeed(unit, data as any);
