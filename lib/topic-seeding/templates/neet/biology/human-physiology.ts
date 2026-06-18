import { ChapterSeed } from '../../../types';
import { buildChapterSeed } from '../builders';
import data from '../data/biology/human-physiology.json';
import { NEET_UG_2026_UNITS } from '../../../../syllabus/neet-ug-2026';

function buildHumanPhysiologySeed(chapterSlug: string): ChapterSeed {
  const unit = NEET_UG_2026_UNITS.find(u => u.chapterSlug === chapterSlug);
  if (!unit) {
    throw new Error(`Missing NEET Human Physiology unit: ${chapterSlug}`);
  }
  return buildChapterSeed(unit, data as any);
}

export const human_physiology_digestion_seed: ChapterSeed = buildHumanPhysiologySeed('human-physiology-digestion');
export const human_physiology_breathing_seed: ChapterSeed = buildHumanPhysiologySeed('human-physiology-breathing');
export const human_physiology_circulation_seed: ChapterSeed = buildHumanPhysiologySeed('human-physiology-circulation');
export const human_physiology_excretion_seed: ChapterSeed = buildHumanPhysiologySeed('human-physiology-excretion');
export const human_physiology_locomotion_seed: ChapterSeed = buildHumanPhysiologySeed('human-physiology-locomotion');
export const human_physiology_neural_seed: ChapterSeed = buildHumanPhysiologySeed('human-physiology-neural');
export const human_physiology_chemical_seed: ChapterSeed = buildHumanPhysiologySeed('human-physiology-chemical');
