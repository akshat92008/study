import type { SeedTemplate, SeedTopicParams, SelectedSeedTemplate } from './types';
import { buildGoalHaystack, normalizeText } from './text-utils';
import { buildFallbackTemplate } from './fallback-template';
import { NEET_PHYSICS_TEMPLATES } from './templates/neet-physics';
import { NEET_CHEMISTRY_TEMPLATES } from './templates/neet-chemistry';
import { NEET_BIOLOGY_TEMPLATES } from './templates/neet-biology';
import { CODING_TEMPLATES } from './templates/coding';
import { GENERAL_ACADEMIC_TEMPLATES } from './templates/general-academic';
export const ALL_SEED_TEMPLATES: SeedTemplate[] = [
  ...NEET_PHYSICS_TEMPLATES,
  ...NEET_CHEMISTRY_TEMPLATES,
  ...NEET_BIOLOGY_TEMPLATES,
  ...CODING_TEMPLATES,
  ...GENERAL_ACADEMIC_TEMPLATES,
];
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
  if (preset.includes('neet') && template.templateKey.startsWith('neet_')) score += 20;
  if (goalType.includes('neet') && template.templateKey.startsWith('neet_')) score += 20;
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
  const requestedExam = normalizeText(params.exam || params.goalType || params.presetId);
  const templateSubject = subjectFamily(template.subject);
  const templateKey = normalizeText(template.templateKey);

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

  if (requestedExam.includes('neet') && templateKey.startsWith('neet')) {
    if (requestedSubject && ['physics', 'chemistry', 'biology'].includes(requestedSubject)) {
      return templateSubject === requestedSubject;
    }
    return ['physics', 'chemistry', 'biology'].includes(templateSubject ?? '');
  }

  return true;
}

export function selectSeedTemplate(params: SeedTopicParams): SelectedSeedTemplate {
  const haystack = buildGoalHaystack(params);
  let best: { template: SeedTemplate; score: number } | null = null;
  for (const template of ALL_SEED_TEMPLATES) {
    if (!isTemplateCompatible(template, params)) continue;
    const score = scoreTemplate(template, haystack, params);
    if (!best || score > best.score) {
      best = { template, score };
    }
  }
  if (best && best.score >= 45) {
    return {
      template: best.template,
      templateKey: best.template.templateKey,
      source: 'seeded_template',
      confidence: best.score,
    };
  }
  const fallback = buildFallbackTemplate(params);
  return {
    template: fallback,
    templateKey: fallback.templateKey,
    source: 'custom_seed',
    confidence: 10,
  };
}
