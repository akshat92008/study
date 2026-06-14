import type { SeedTemplate, SeedTopicParams, SelectedSeedTemplate, ChapterSeed } from './types';
import { buildGoalHaystack, normalizeText } from './text-utils';
import { buildFallbackTemplate } from './fallback-template';
import { CODING_TEMPLATES } from './templates/coding';
import { GENERAL_ACADEMIC_TEMPLATES } from './templates/general-academic';
import { ALL_NEET_CHAPTER_SEEDS } from './templates/neet';
import { findNeetUnitByGoalText } from '../syllabus/neet-ug-2026';
import { logger } from '@/lib/utils/logger';

export const ALL_SEED_TEMPLATES: SeedTemplate[] = [
  ...CODING_TEMPLATES,
  ...GENERAL_ACADEMIC_TEMPLATES,
];

export function getNeetSeedBySlug(chapterSlug: string): ChapterSeed | null {
  return ALL_NEET_CHAPTER_SEEDS.find(seed => seed.chapterSlug === chapterSlug) || null;
}

export function getNeetSeedsBySubject(subject: string): ChapterSeed[] {
  const norm = normalizeText(subject);
  return ALL_NEET_CHAPTER_SEEDS.filter(seed => normalizeText(seed.subject) === norm);
}

export function getAllNeetSeeds(): ChapterSeed[] {
  return ALL_NEET_CHAPTER_SEEDS;
}

export function getSeedForGoal(goalText: string, activeGoalContext?: string | null): SelectedSeedTemplate | null {
  const unit = findNeetUnitByGoalText(goalText, activeGoalContext);
  if (unit) {
    const seed = getNeetSeedBySlug(unit.chapterSlug);
    if (seed) {
      return {
        template: seed,
        templateKey: `neet-${unit.subject.toLowerCase()}-${unit.chapterSlug}`,
        source: 'seeded_template',
        confidence: 0.99,
      };
    }
  }
  return null;
}

function scoreTemplate(template: SeedTemplate, haystack: string, params: SeedTopicParams): number {
  let score = 0;
  const normalizedHaystack = normalizeText(haystack);
  const preset = normalizeText(params.presetId);
  const goalType = normalizeText(params.goalType);
  const subject = normalizeText(params.subject || params.subjects?.join(' '));
  for (const alias of template.aliases) {
    const normalizedAlias = normalizeText(alias);
    if (!normalizedAlias) continue;
    if (normalizedHaystack === normalizedAlias) score += 100;
    else if (normalizedHaystack.includes(normalizedAlias)) score += 60;
    else if (normalizedAlias.includes(normalizedHaystack) && normalizedHaystack.length > 4) score += 35;
  }
  if (normalizedHaystack.includes(normalizeText(template.chapter))) score += 50;
  if (normalizedHaystack.includes(normalizeText(template.displayName))) score += 50;
  if (subject && normalizeText(template.subject).includes(subject)) score += 15;
  if (subject && subject.includes(normalizeText(template.subject))) score += 15;
  if (
    template.templateKey.includes('coding') &&
    ['coding', 'programming', 'javascript', 'python'].some((term) => normalizedHaystack.includes(term))
  ) {
    score += 20;
  }
  return score;
}

function subjectFamily(value: string | null | undefined): string | null {
  const normalized = normalizeText(value);
  if (!normalized) return null;
  if (['physics', 'chemistry', 'biology'].includes(normalized)) return normalized;
  if (['math', 'mathematics', 'algebra'].includes(normalized)) return 'mathematics';
  if (['history', 'geography', 'civics', 'economics', 'political science'].includes(normalized)) return 'humanities';
  if (['programming', 'coding', 'javascript', 'js', 'python', 'react'].includes(normalized)) return 'programming';
  if (normalized.includes('general learning')) return 'general';
  return normalized;
}

function isTemplateCompatible(template: SeedTemplate, params: SeedTopicParams): boolean {
  const requestedSubject = subjectFamily(params.subject || params.subjects?.[0]);
  const requestedSubjects = (params.subjects ?? []).map(subjectFamily).filter(Boolean);
  const requestedDomain = normalizeText(params.domain || params.goalType);
  const templateSubject = subjectFamily(template.subject);

  if (requestedDomain.includes('humanities') || requestedSubject === 'humanities') {
    return templateSubject === 'humanities' || templateSubject === 'general';
  }

  if (requestedDomain.includes('programming') || requestedSubject === 'programming') {
    return templateSubject === 'programming' || templateSubject === 'general';
  }

  if (requestedSubject && requestedSubject !== 'general') {
    const compatible = templateSubject === requestedSubject
      || (requestedSubject === 'mathematics' && templateSubject === 'mathematics')
      || (requestedSubject === 'programming' && templateSubject === 'programming');
    if (!compatible) return false;
  }

  if (requestedSubjects.length > 0 && !requestedSubjects.includes('general')) {
    const compatible = requestedSubjects.includes(templateSubject);
    if (!compatible) return false;
  }

  return true;
}

export function selectSeedTemplate(params: SeedTopicParams): SelectedSeedTemplate {
  const haystack = buildGoalHaystack(params);
  
  // First attempt rigorous NEET detection
  const isNeetContext = (params.exam || params.presetId || params.goalType)?.toLowerCase().includes('neet') || false;
  if (isNeetContext || haystack) {
     const neetSeed = getSeedForGoal(haystack, params.subject);
     if (neetSeed) {
       logger.info('mission_template_selected', { goalText: haystack, matchedSlug: neetSeed.templateKey, confidence: 0.99 });
       return neetSeed;
     }
  }

  // Fallback to older generic matching for coding/academics
  let best: { template: SeedTemplate; score: number } | null = null;
  for (const template of ALL_SEED_TEMPLATES) {
    if (!isTemplateCompatible(template, params)) continue;
    const score = scoreTemplate(template, haystack, params);
    if (!best || score > best.score) {
      best = { template, score };
    }
  }
  
  if (best && best.score >= 45) {
    logger.info('mission_template_selected', { goalText: haystack, matchedSlug: best.template.templateKey, confidence: best.score });
    return {
      template: best.template,
      templateKey: best.template.templateKey,
      source: 'seeded_template',
      confidence: best.score,
    };
  }
  
  logger.warn('mission_fallback_used', { goalText: haystack, confidence: 10 });
  const fallback = buildFallbackTemplate(params);
  return {
    template: fallback,
    templateKey: fallback.templateKey,
    source: 'custom_seed',
    confidence: 10,
  };
}
