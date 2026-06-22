import type { SeedTemplate, SeedTopicParams, SelectedSeedTemplate, ChapterSeed } from './types';
import { buildGoalHaystack, normalizeText } from './text-utils';
import { buildFallbackTemplate } from './fallback-template';
import { CODING_TEMPLATES } from './templates/coding';
import { GENERAL_ACADEMIC_TEMPLATES } from './templates/general-academic';
import { ALL_NEET_CHAPTER_SEEDS } from './templates/neet';
import { findNeetUnitByGoalText } from '../syllabus/neet-ug-2026';
import { resolveFocusedTopicSlugsFromText, resolveTopicSkeletonForText } from './templates/neet/topic-skeleton';
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
      let targetMicrotargetSlug: string | undefined = undefined;
      const targetTopicSlugs = resolveFocusedTopicSlugsFromText(goalText, unit.chapterSlug);
      const normalizedGoal = normalizeText(goalText);
      
      // Try to find a matching microtarget based on the goal text
      outer: for (const mission of seed.missions) {
        for (const mt of mission.microtargets) {
          const mtNormalized = normalizeText(mt.title);
          // If the exact microtarget title is in the goal or vice versa
          if (normalizedGoal.includes(mtNormalized) || mtNormalized.includes(normalizedGoal)) {
            targetMicrotargetSlug = mt.id || mtNormalized.replace(/\s+/g, '-');
            break outer;
          }
          // Or if any tag matches
          for (const tag of mt.conceptTags || []) {
            if (normalizedGoal.includes(normalizeText(tag))) {
              targetMicrotargetSlug = mt.id || mtNormalized.replace(/\s+/g, '-');
              break outer;
            }
          }
        }
      }

      return {
        template: seed,
        templateKey: `neet-${unit.subject.toLowerCase()}-${unit.chapterSlug}`,
        source: 'seeded_template',
        confidence: 0.99,
        targetMicrotargetSlug,
        targetTopicSlugs: targetTopicSlugs.length > 0
          ? targetTopicSlugs
          : targetMicrotargetSlug
            ? seed.missions
                .flatMap(mission => mission.microtargets)
                .filter(mt => mt.id === targetMicrotargetSlug)
                .map(mt => resolveTopicSkeletonForText([mt.title, ...(mt.conceptTags ?? [])].join(' '), unit.chapterSlug)?.slug)
                .filter((slug): slug is string => Boolean(slug))
            : undefined,
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

export function selectSeedTemplate(params: SeedTopicParams): SelectedSeedTemplate | null {
  const haystack = buildGoalHaystack(params);
  
  // Strict NEET detection
  const neetSeed = getSeedForGoal(haystack, params.subject);
  if (neetSeed) {
    logger.info('mission_template_selected', { goalText: haystack, matchedSlug: neetSeed.templateKey, confidence: 0.99 });
    return neetSeed;
  }

  // No fallback allowed for strict ground-truth tutoring
  logger.warn('mission_template_rejected', { goalText: haystack, reason: 'unrecognized_domain' });
  return null;
}
