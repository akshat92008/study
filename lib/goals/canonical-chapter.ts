import { NEET_UG_2026_UNITS } from '@/lib/syllabus/neet-ug-2026';

export type CanonicalSubject = 'physics' | 'chemistry' | 'biology';

export type CanonicalChapterResolution = {
  subject: CanonicalSubject;
  chapterSlug: string;
  canonicalGoalSlug: string;
  title: string;
  aliases: string[];
};

function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .replace(/^neet[-\s]+(physics|chemistry|biology)[-\s]+/, '')
    .replace(/[^a-z0-9+#\s-]/g, ' ')
    .replace(/-/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function subjectSlug(subject: string): CanonicalSubject {
  return subject.toLowerCase() as CanonicalSubject;
}

function goalSlug(subject: string, chapterSlug: string): string {
  return `neet-${subject.toLowerCase()}-${chapterSlug}`;
}

function scoreCandidate(input: string, unit: typeof NEET_UG_2026_UNITS[number]): number {
  const normalizedInput = normalizeText(input);
  if (!normalizedInput) return 0;

  const candidates = [
    unit.chapterSlug,
    goalSlug(unit.subject, unit.chapterSlug),
    unit.unitTitle,
    ...unit.aliases,
    ...unit.ncertMapping,
  ];

  let best = 0;
  for (const candidate of candidates) {
    const normalizedCandidate = normalizeText(candidate);
    if (!normalizedCandidate) continue;
    if (normalizedInput === normalizedCandidate) best = Math.max(best, 120);
    else if (normalizedInput.includes(normalizedCandidate)) best = Math.max(best, 90);
    else if (normalizedCandidate.includes(normalizedInput) && normalizedInput.length >= 4) best = Math.max(best, 70);
  }

  const tokens = new Set(normalizedInput.split(' ').filter(token => token.length >= 3));
  const keywordHits = unit.keywords.filter(keyword => tokens.has(normalizeText(keyword))).length;
  return best + keywordHits * 10;
}

export function resolveCanonicalChapter(input: string | null | undefined): CanonicalChapterResolution | null {
  const raw = String(input ?? '').trim();
  if (!raw) return null;

  let best: { unit: typeof NEET_UG_2026_UNITS[number]; score: number } | null = null;
  for (const unit of NEET_UG_2026_UNITS) {
    const score = scoreCandidate(raw, unit);
    if (!best || score > best.score) best = { unit, score };
  }

  if (!best || best.score < 20) return null;
  const unit = best.unit;
  return {
    subject: subjectSlug(unit.subject),
    chapterSlug: unit.chapterSlug,
    canonicalGoalSlug: goalSlug(unit.subject, unit.chapterSlug),
    title: unit.unitTitle,
    aliases: [...unit.aliases, ...unit.ncertMapping, unit.chapterSlug, goalSlug(unit.subject, unit.chapterSlug)],
  };
}

export function toCanonicalChapterSlug(input: string | null | undefined): string | null {
  return resolveCanonicalChapter(input)?.chapterSlug ?? null;
}

export function toCanonicalGoalSlug(input: string | null | undefined): string | null {
  return resolveCanonicalChapter(input)?.canonicalGoalSlug ?? null;
}
